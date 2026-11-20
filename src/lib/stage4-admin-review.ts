/**
 * Stage 4 Admin Review, Visual Diff Alerts & 24-Hour Correction Window Logic
 * Step 4.3: Excessive modification alerts (E11), 2-admin validation, 24h correction window (E12), and Round 2 review (E13)
 */

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  auditLogs,
  enrollments,
  stories,
  storyAlertVotes,
  storyModificationAlerts,
  type AlertDecision,
  type AlertStatus,
  type EnrollmentStatus,
} from "@/db/schema";
import { dispatchTemplateEmail } from "./email";
import { validateStage3EditInput } from "./stage3-submission";
import { addHoursToUtcIso, formatCaracasDateTime, parseUtcMs } from "./timezone";

export const REQUIRED_ADMIN_VALIDATIONS = 2;

export interface AlertVoteOutcome {
  validateCount: number;
  rejectCount: number;
  isApproved: boolean;
}

/**
 * Evaluates whether a modification alert has reached the required 2 admin validations.
 */
export function evaluateAlertVoteOutcome(
  votes: Array<{ decision: AlertDecision }>
): AlertVoteOutcome {
  let validateCount = 0;
  let rejectCount = 0;

  for (const vote of votes) {
    if (vote.decision === "VALIDATE") {
      validateCount += 1;
    } else if (vote.decision === "REJECT") {
      rejectCount += 1;
    }
  }

  return {
    validateCount,
    rejectCount,
    isApproved: validateCount >= REQUIRED_ADMIN_VALIDATIONS,
  };
}

export interface AdminRecipient {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

export interface TriggerModificationAlertInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
  };
  story: {
    id: string;
    authorId: string;
    editedTitle: string | null;
    originalTitle: string;
  };
  actorAdmin: AdminRecipient;
  otherAdmins: AdminRecipient[];
  justification?: string;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface TriggerModificationAlertResult {
  triggered: boolean;
  alertId?: string;
  notifiedCount?: number;
  error?: string;
}

/**
 * Triggers a Round 1 Excessive Modification Alert on a postulated story:
 * - Creates `story_modification_alerts` (`round = 1`, `status = 'PENDING'`)
 * - Records the triggering admin's automatic `REJECT` vote
 * - Writes an immutable `TRIGGER_MOD_ALERT` audit log entry
 * - Dispatches email `E11` to all other admins
 */
export async function triggerModificationAlertInDb(
  input: TriggerModificationAlertInput
): Promise<TriggerModificationAlertResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();

  const existingAlerts = await input.db
    .select({ id: storyModificationAlerts.id })
    .from(storyModificationAlerts)
    .where(
      and(
        eq(storyModificationAlerts.storyId, input.story.id),
        eq(storyModificationAlerts.round, 1)
      )
    );

  if (existingAlerts.length > 0) {
    return {
      triggered: false,
      error: "Este cuento ya tiene una alerta de modificaciones abierta en Ronda 1.",
    };
  }

  const alertId = crypto.randomUUID();
  const voteId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const storyTitle = input.story.editedTitle ?? input.story.originalTitle;

  await input.db.insert(storyModificationAlerts).values({
    id: alertId,
    storyId: input.story.id,
    round: 1,
    triggeredByAdminId: input.actorAdmin.id,
    status: "PENDING",
    createdAt: nowIso,
    resolvedAt: null,
  });

  await input.db.insert(storyAlertVotes).values({
    id: voteId,
    alertId,
    adminId: input.actorAdmin.id,
    decision: "REJECT",
    votedAt: nowIso,
  });

  await input.db.insert(auditLogs).values({
    id: auditId,
    editionId: input.edition.id,
    actorId: input.actorAdmin.id,
    actionType: "TRIGGER_MOD_ALERT",
    targetUserId: input.story.authorId,
    targetStoryId: input.story.id,
    justification:
      input.justification?.trim() ||
      "Alerta por exceso de modificaciones lanzada durante la revisión de Etapa 4.",
    metadataJson: JSON.stringify({ alertId, round: 1 }),
    createdAt: nowIso,
  });

  let notifiedCount = 0;
  for (const admin of input.otherAdmins) {
    if (admin.id === input.actorAdmin.id) continue;
    const res = await dispatchTemplateEmail({
      db: input.db,
      apiKey: input.brevoApiKey,
      editionId: input.edition.id,
      templateCode: "E11",
      recipientUserId: admin.id,
      recipientEmail: admin.email,
      recipientName: admin.name ?? admin.email,
      contextKey: `mod_alert_r1_${input.story.id}`,
      variables: {
        NOMBRE: admin.firstName ?? admin.name ?? "Administrador",
        APELLIDO: admin.lastName ?? "",
        EDICION: input.edition.title,
        TITULO_CUENTO: storyTitle,
        LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/admin/cuentos`,
      },
      nowIso,
    });
    if (res.dispatched) {
      notifiedCount += 1;
    }
  }

  return {
    triggered: true,
    alertId,
    notifiedCount,
  };
}

export interface VoteOnModificationAlertInput {
  db: AppDatabase;
  editionId: string;
  alert: {
    id: string;
    storyId: string;
    round: number;
    status: AlertStatus;
  };
  storyAuthorId: string;
  actorAdminId: string;
  decision: AlertDecision;
  existingVotes: Array<{ adminId: string; decision: AlertDecision }>;
  nowIso?: string;
}

export interface VoteOnModificationAlertResult {
  voted: boolean;
  newStatus?: AlertStatus;
  validateCount?: number;
  rejectCount?: number;
  error?: string;
}

/**
 * Records an admin's `VALIDATE` or `REJECT` vote on a pending modification alert.
 * Automatically resolves the alert to `APPROVED` as soon as 2 `VALIDATE` votes are reached.
 */
export async function voteOnModificationAlertInDb(
  input: VoteOnModificationAlertInput
): Promise<VoteOnModificationAlertResult> {
  if (input.alert.status !== "PENDING") {
    return {
      voted: false,
      error: "Esta alerta ya fue resuelta y no admite nuevos votos.",
    };
  }

  if (input.existingVotes.some((v) => v.adminId === input.actorAdminId)) {
    return {
      voted: false,
      error: "Ya registraste tu voto en esta alerta.",
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();

  await input.db.insert(storyAlertVotes).values({
    id: crypto.randomUUID(),
    alertId: input.alert.id,
    adminId: input.actorAdminId,
    decision: input.decision,
    votedAt: nowIso,
  });

  await input.db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    editionId: input.editionId,
    actorId: input.actorAdminId,
    actionType: "VOTE_MOD_ALERT",
    targetUserId: input.storyAuthorId,
    targetStoryId: input.alert.storyId,
    justification:
      input.decision === "VALIDATE"
        ? `Validación de cambios en alerta de ronda ${input.alert.round}.`
        : `Rechazo de cambios en alerta de ronda ${input.alert.round}.`,
    metadataJson: JSON.stringify({
      alertId: input.alert.id,
      round: input.alert.round,
      decision: input.decision,
    }),
    createdAt: nowIso,
  });

  const outcome = evaluateAlertVoteOutcome([
    ...input.existingVotes,
    { decision: input.decision },
  ]);

  let newStatus: AlertStatus = "PENDING";
  if (outcome.isApproved) {
    newStatus = "APPROVED";
    await input.db
      .update(storyModificationAlerts)
      .set({
        status: "APPROVED",
        resolvedAt: nowIso,
      })
      .where(eq(storyModificationAlerts.id, input.alert.id));
  }

  return {
    voted: true,
    newStatus,
    validateCount: outcome.validateCount,
    rejectCount: outcome.rejectCount,
  };
}

export interface OpenCorrectionWindowInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
    adminReviewEndAt: string;
  };
  alertId: string;
  enrollmentId: string;
  participant: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
  storyTitle: string;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface OpenCorrectionWindowResult {
  opened: boolean;
  correctionDeadlineAt: string;
  emailSent: boolean;
}

/**
 * Executed at Stage 4 close when a Round 1 alert failed to obtain 2 validations:
 * - Marks alert `REJECTED`
 * - Enables `in_correction_window = true` with a 24h deadline (`admin_review_end_at + 24h`)
 * - Sends email `E12` to the participant
 */
export async function openCorrectionWindowForPendingAlertInDb(
  input: OpenCorrectionWindowInput
): Promise<OpenCorrectionWindowResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const correctionDeadlineAt = addHoursToUtcIso(
    input.edition.adminReviewEndAt,
    24
  );

  await input.db
    .update(storyModificationAlerts)
    .set({
      status: "REJECTED",
      resolvedAt: nowIso,
    })
    .where(eq(storyModificationAlerts.id, input.alertId));

  await input.db
    .update(enrollments)
    .set({
      inCorrectionWindow: true,
      correctionDeadlineAt,
    })
    .where(eq(enrollments.id, input.enrollmentId));

  const emailRes = await dispatchTemplateEmail({
    db: input.db,
    apiKey: input.brevoApiKey,
    editionId: input.edition.id,
    templateCode: "E12",
    recipientUserId: input.participant.id,
    recipientEmail: input.participant.email,
    recipientName: input.participant.name ?? input.participant.email,
    contextKey: `correction_window_24h_${input.enrollmentId}`,
    variables: {
      NOMBRE: input.participant.firstName ?? input.participant.name ?? "Participante",
      APELLIDO: input.participant.lastName ?? "",
      EDICION: input.edition.title,
      TITULO_CUENTO: input.storyTitle,
      FECHA_HORA_CIERRE: formatCaracasDateTime(correctionDeadlineAt),
      LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/concurso`,
    },
    nowIso,
  });

  return {
    opened: true,
    correctionDeadlineAt,
    emailSent: emailRes.dispatched,
  };
}

export interface SubmitCorrectionWindowStoryInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
    minChars: number;
    maxChars: number;
    minSimilarityPct: number;
  };
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    selectedStoryId: string | null;
    inCorrectionWindow: boolean;
    correctionDeadlineAt: string | null;
    correctionSubmittedAt: string | null;
  };
  story: {
    id: string;
    enrollmentId: string;
    originalBody: string;
  };
  title: string;
  body: string;
  allAdmins: AdminRecipient[];
  triggeredByAdminId: string;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface SubmitCorrectionWindowStoryResult {
  submitted: boolean;
  round2AlertId?: string;
  similarityPct?: number;
  notifiedAdmins?: number;
  error?: string;
}

/**
 * Saves the participant's corrected story during their exceptional 24h window,
 * creates a Round 2 modification alert (`round = 2`), and dispatches `E13` to all admins.
 */
export async function submitCorrectionWindowStoryInDb(
  input: SubmitCorrectionWindowStoryInput
): Promise<SubmitCorrectionWindowStoryResult> {
  if (input.enrollment.status !== "ACTIVE") {
    return {
      submitted: false,
      error: "Tu participación está descalificada y no admite correcciones.",
    };
  }

  if (!input.enrollment.inCorrectionWindow || !input.enrollment.correctionDeadlineAt) {
    return {
      submitted: false,
      error: "No tienes una ventana de corrección activa en este momento.",
    };
  }

  if (input.enrollment.correctionSubmittedAt) {
    return {
      submitted: false,
      error: "Ya enviaste tu versión corregida en la ventana de 24 horas.",
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  if (parseUtcMs(nowIso) > parseUtcMs(input.enrollment.correctionDeadlineAt)) {
    return {
      submitted: false,
      error: "El plazo de 24 horas para enviar tu corrección ya venció.",
    };
  }

  const validation = validateStage3EditInput({
    title: input.title,
    body: input.body,
    originalBody: input.story.originalBody,
    minChars: input.edition.minChars,
    maxChars: input.edition.maxChars,
    minSimilarityPct: input.edition.minSimilarityPct,
  });

  if (!validation.valid) {
    return {
      submitted: false,
      error: validation.errors[0],
    };
  }

  const trimmedTitle = input.title.trim();

  await input.db
    .update(stories)
    .set({
      editedTitle: trimmedTitle,
      editedBody: input.body,
      editedCharCount: validation.charCount,
      similarityPct: validation.similarityPct,
      updatedAt: nowIso,
    })
    .where(eq(stories.id, input.story.id));

  await input.db
    .update(enrollments)
    .set({
      inCorrectionWindow: false,
      correctionSubmittedAt: nowIso,
    })
    .where(eq(enrollments.id, input.enrollment.id));

  const round2AlertId = crypto.randomUUID();
  await input.db.insert(storyModificationAlerts).values({
    id: round2AlertId,
    storyId: input.story.id,
    round: 2,
    triggeredByAdminId: input.triggeredByAdminId,
    status: "PENDING",
    createdAt: nowIso,
    resolvedAt: null,
  });

  let notifiedAdmins = 0;
  for (const admin of input.allAdmins) {
    const res = await dispatchTemplateEmail({
      db: input.db,
      apiKey: input.brevoApiKey,
      editionId: input.edition.id,
      templateCode: "E13",
      recipientUserId: admin.id,
      recipientEmail: admin.email,
      recipientName: admin.name ?? admin.email,
      contextKey: `mod_alert_r2_${input.story.id}`,
      variables: {
        NOMBRE: admin.firstName ?? admin.name ?? "Administrador",
        APELLIDO: admin.lastName ?? "",
        EDICION: input.edition.title,
        TITULO_CUENTO: trimmedTitle,
        LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/admin/cuentos`,
      },
      nowIso,
    });
    if (res.dispatched) {
      notifiedAdmins += 1;
    }
  }

  return {
    submitted: true,
    round2AlertId,
    similarityPct: validation.similarityPct,
    notifiedAdmins,
  };
}
