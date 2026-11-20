/**
 * Admin Participant Interventions & Immutable Audit Logging
 * Step 6.3: Manual disqualification (E18), manual reinstatement (E19), and late story upload/edit with automatic reactivation on MAX_MISSES
 */

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  auditLogs,
  enrollments,
  stories,
  type DisqualificationReason,
  type EnrollmentStatus,
} from "@/db/schema";
import { dispatchTemplateEmail } from "./email";
import { validateStage2StoryInput } from "./stage2-writing";

export const MIN_JUSTIFICATION_LENGTH = 5;

export interface PersonRecipient {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

export function validateJustification(justification: string): {
  valid: boolean;
  trimmed: string;
  error?: string;
} {
  const trimmed = justification.trim();
  if (trimmed.length < MIN_JUSTIFICATION_LENGTH) {
    return {
      valid: false,
      trimmed,
      error: `Debes ingresar una justificación de al menos ${MIN_JUSTIFICATION_LENGTH} caracteres.`,
    };
  }
  return { valid: true, trimmed };
}

export interface ManualDisqualifyInput {
  db: AppDatabase;
  edition: { id: string; title: string };
  enrollment: { id: string; status: EnrollmentStatus };
  participant: PersonRecipient;
  actorAdmin: PersonRecipient;
  allAdmins: PersonRecipient[];
  justification: string;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface ManualDisqualifyResult {
  disqualified: boolean;
  notifiedAdmins?: number;
  error?: string;
}

/**
 * Manually disqualifies an active participant with mandatory justification,
 * writes `DISQUALIFY_USER` to `audit_logs`, and sends `E18` to the participant and all admins.
 */
export async function manualDisqualifyParticipantInDb(
  input: ManualDisqualifyInput
): Promise<ManualDisqualifyResult> {
  if (input.enrollment.status !== "ACTIVE") {
    return {
      disqualified: false,
      error: "El participante ya se encuentra descalificado.",
    };
  }

  const check = validateJustification(input.justification);
  if (!check.valid) {
    return { disqualified: false, error: check.error };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();

  await input.db
    .update(enrollments)
    .set({
      status: "DISQUALIFIED",
      disqualificationReason: "MANUAL_ADMIN",
      disqualifiedAt: nowIso,
    })
    .where(eq(enrollments.id, input.enrollment.id));

  await input.db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    editionId: input.edition.id,
    actorId: input.actorAdmin.id,
    actionType: "DISQUALIFY_USER",
    targetUserId: input.participant.id,
    targetStoryId: null,
    justification: check.trimmed,
    metadataJson: JSON.stringify({ enrollmentId: input.enrollment.id }),
    createdAt: nowIso,
  });

  const cleanBase = input.baseUrl.replace(/\/$/, "");
  const contextKey = `manual_dq_${input.enrollment.id}_${nowIso}`;

  await dispatchTemplateEmail({
    db: input.db,
    apiKey: input.brevoApiKey,
    editionId: input.edition.id,
    templateCode: "E18",
    recipientUserId: input.participant.id,
    recipientEmail: input.participant.email,
    recipientName: input.participant.name ?? input.participant.email,
    contextKey,
    variables: {
      NOMBRE: input.participant.firstName ?? input.participant.name ?? "Participante",
      APELLIDO: input.participant.lastName ?? "",
      EDICION: input.edition.title,
      LINK_PLATAFORMA: `${cleanBase}/concurso`,
    },
    nowIso,
  });

  let notifiedAdmins = 0;
  for (const admin of input.allAdmins) {
    const res = await dispatchTemplateEmail({
      db: input.db,
      apiKey: input.brevoApiKey,
      editionId: input.edition.id,
      templateCode: "E18",
      recipientUserId: admin.id,
      recipientEmail: admin.email,
      recipientName: admin.name ?? admin.email,
      contextKey: `${contextKey}_admin`,
      variables: {
        NOMBRE: admin.firstName ?? admin.name ?? "Administrador",
        APELLIDO: admin.lastName ?? "",
        EDICION: input.edition.title,
        LINK_PLATAFORMA: `${cleanBase}/admin/log`,
      },
      nowIso,
    });
    if (res.dispatched) notifiedAdmins += 1;
  }

  return { disqualified: true, notifiedAdmins };
}

export interface ManualReinstateInput {
  db: AppDatabase;
  edition: { id: string; title: string };
  enrollment: { id: string; status: EnrollmentStatus };
  participant: PersonRecipient;
  actorAdmin: PersonRecipient;
  justification: string;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface ManualReinstateResult {
  reinstated: boolean;
  emailSent?: boolean;
  error?: string;
}

/**
 * Manually reinstates a disqualified participant with mandatory justification,
 * writes `REINSTATE_USER` to `audit_logs`, and sends `E19` to the participant.
 */
export async function manualReinstateParticipantInDb(
  input: ManualReinstateInput
): Promise<ManualReinstateResult> {
  if (input.enrollment.status !== "DISQUALIFIED") {
    return {
      reinstated: false,
      error: "El participante ya se encuentra activo.",
    };
  }

  const check = validateJustification(input.justification);
  if (!check.valid) {
    return { reinstated: false, error: check.error };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();

  await input.db
    .update(enrollments)
    .set({
      status: "ACTIVE",
      disqualificationReason: null,
      disqualifiedAt: null,
    })
    .where(eq(enrollments.id, input.enrollment.id));

  await input.db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    editionId: input.edition.id,
    actorId: input.actorAdmin.id,
    actionType: "REINSTATE_USER",
    targetUserId: input.participant.id,
    targetStoryId: null,
    justification: check.trimmed,
    metadataJson: JSON.stringify({ enrollmentId: input.enrollment.id }),
    createdAt: nowIso,
  });

  const emailRes = await dispatchTemplateEmail({
    db: input.db,
    apiKey: input.brevoApiKey,
    editionId: input.edition.id,
    templateCode: "E19",
    recipientUserId: input.participant.id,
    recipientEmail: input.participant.email,
    recipientName: input.participant.name ?? input.participant.email,
    contextKey: `manual_reinstate_${input.enrollment.id}_${nowIso}`,
    variables: {
      NOMBRE: input.participant.firstName ?? input.participant.name ?? "Participante",
      APELLIDO: input.participant.lastName ?? "",
      EDICION: input.edition.title,
      LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/concurso`,
    },
    nowIso,
  });

  return { reinstated: true, emailSent: emailRes.dispatched };
}

export interface AdminLateStoryInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
    minChars: number;
    maxChars: number;
    maxAllowedMisses: number;
  };
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    disqualificationReason: DisqualificationReason | null;
    missesCount: number;
  };
  participant: PersonRecipient;
  promptId: string;
  actorAdmin: PersonRecipient;
  title: string;
  body: string;
  justification: string;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface AdminLateStoryResult {
  saved: boolean;
  storyId?: string;
  actionType?: "LATE_STORY_UPLOAD" | "LATE_STORY_EDIT";
  autoReactivated?: boolean;
  error?: string;
}

/**
 * Uploads or edits a story on behalf of a participant after close:
 * - Enforces `minChars`/`maxChars` and mandatory justification
 * - Writes `LATE_STORY_UPLOAD` or `LATE_STORY_EDIT` to `audit_logs`
 * - Automatically reactivates the participant (sending `E19`) if they were disqualified for `MAX_MISSES`
 *   and decrementing `missesCount` brings them back within `maxAllowedMisses`.
 */
export async function adminUploadOrEditLateStoryInDb(
  input: AdminLateStoryInput
): Promise<AdminLateStoryResult> {
  const justCheck = validateJustification(input.justification);
  if (!justCheck.valid) {
    return { saved: false, error: justCheck.error };
  }

  const storyCheck = validateStage2StoryInput({
    title: input.title,
    body: input.body,
    minChars: input.edition.minChars,
    maxChars: input.edition.maxChars,
  });
  if (!storyCheck.valid) {
    return { saved: false, error: storyCheck.errors[0] };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const trimmedTitle = input.title.trim();

  const existingRows = await input.db
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        eq(stories.enrollmentId, input.enrollment.id),
        eq(stories.promptId, input.promptId)
      )
    );

  let storyId: string;
  let actionType: "LATE_STORY_UPLOAD" | "LATE_STORY_EDIT";
  let autoReactivated = false;

  if (existingRows.length > 0) {
    storyId = existingRows[0].id;
    actionType = "LATE_STORY_EDIT";
    await input.db
      .update(stories)
      .set({
        originalTitle: trimmedTitle,
        originalBody: input.body,
        originalCharCount: storyCheck.charCount,
        updatedAt: nowIso,
      })
      .where(eq(stories.id, storyId));
  } else {
    storyId = crypto.randomUUID();
    actionType = "LATE_STORY_UPLOAD";
    await input.db.insert(stories).values({
      id: storyId,
      editionId: input.edition.id,
      enrollmentId: input.enrollment.id,
      promptId: input.promptId,
      authorId: input.participant.id,
      originalTitle: trimmedTitle,
      originalBody: input.body,
      originalCharCount: storyCheck.charCount,
      submittedAt: nowIso,
      isSelectedForPostulation: false,
      isPostulated: false,
      participantPoints: 0,
      passedToJury: false,
      juryPoints: 0,
      totalPoints: 0,
      updatedAt: nowIso,
    });

    const nextMisses = Math.max(0, input.enrollment.missesCount - 1);
    const shouldReactivate =
      input.enrollment.status === "DISQUALIFIED" &&
      input.enrollment.disqualificationReason === "MAX_MISSES" &&
      nextMisses <= input.edition.maxAllowedMisses;

    if (shouldReactivate) {
      autoReactivated = true;
      await input.db
        .update(enrollments)
        .set({
          missesCount: nextMisses,
          status: "ACTIVE",
          disqualificationReason: null,
          disqualifiedAt: null,
        })
        .where(eq(enrollments.id, input.enrollment.id));

      await dispatchTemplateEmail({
        db: input.db,
        apiKey: input.brevoApiKey,
        editionId: input.edition.id,
        templateCode: "E19",
        recipientUserId: input.participant.id,
        recipientEmail: input.participant.email,
        recipientName: input.participant.name ?? input.participant.email,
        contextKey: `auto_reinstate_late_story_${storyId}`,
        variables: {
          NOMBRE:
            input.participant.firstName ?? input.participant.name ?? "Participante",
          APELLIDO: input.participant.lastName ?? "",
          EDICION: input.edition.title,
          TITULO_CUENTO: trimmedTitle,
          LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/concurso`,
        },
        nowIso,
      });
    } else if (input.enrollment.missesCount > 0) {
      await input.db
        .update(enrollments)
        .set({ missesCount: nextMisses })
        .where(eq(enrollments.id, input.enrollment.id));
    }
  }

  await input.db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    editionId: input.edition.id,
    actorId: input.actorAdmin.id,
    actionType,
    targetUserId: input.participant.id,
    targetStoryId: storyId,
    justification: justCheck.trimmed,
    metadataJson: JSON.stringify({
      promptId: input.promptId,
      autoReactivated,
    }),
    createdAt: nowIso,
  });

  return {
    saved: true,
    storyId,
    actionType,
    autoReactivated,
  };
}
