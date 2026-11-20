/**
 * Stage 3 Story Selection, Editing & Definitive Postulation Domain Logic
 * Step 4.2: Irreversible story selection, unlimited draft editing with live char & Myers Diff similarity checks, and definitive postulation (E10)
 */

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  enrollments,
  stories,
  type DisqualificationReason,
  type EnrollmentStatus,
  type MediaType,
} from "@/db/schema";
import { dispatchTemplateEmail } from "./email";
import { calculateStorySimilarity } from "./similarity";
import { validateStage2StoryInput } from "./stage2-writing";
import { parseUtcMs } from "./timezone";

export interface Stage3StoryItem {
  id: string;
  promptId: string;
  promptNumber: number;
  promptTitle: string;
  promptBody: string;
  promptMediaType: MediaType | null;
  promptMediaUrl: string | null;
  originalTitle: string;
  originalBody: string;
  originalCharCount: number;
  isSelectedForPostulation: boolean;
  isPostulated: boolean;
  editedTitle: string | null;
  editedBody: string | null;
  editedCharCount: number | null;
  similarityPct: number | null;
  postulatedAt: string | null;
}

export interface Stage3EditValidationInput {
  title: string;
  body: string;
  originalBody: string;
  minChars: number;
  maxChars: number;
  minSimilarityPct: number;
}

export interface Stage3EditValidationResult {
  valid: boolean;
  charCount: number;
  titleLength: number;
  similarityPct: number;
  isExactOriginal: boolean;
  meetsSimilarityThreshold: boolean;
  errors: string[];
}

/**
 * Validates Stage 3 edited title, character limits, and Myers Diff similarity threshold
 * against the participant's original Stage 2 story body.
 */
export function validateStage3EditInput(
  input: Stage3EditValidationInput
): Stage3EditValidationResult {
  const baseValidation = validateStage2StoryInput({
    title: input.title,
    body: input.body,
    minChars: input.minChars,
    maxChars: input.maxChars,
  });

  const similarity = calculateStorySimilarity(
    input.originalBody,
    input.body,
    input.minSimilarityPct
  );

  const errors = [...baseValidation.errors];
  if (!similarity.meetsThreshold) {
    errors.push(
      `La similitud con tu cuento original es de ${similarity.similarityPct.toFixed(1)}% y el mínimo exigido es ${input.minSimilarityPct}%. No puedes reemplazar tu cuento por otro distinto.`
    );
  }

  return {
    valid: errors.length === 0,
    charCount: baseValidation.charCount,
    titleLength: baseValidation.titleLength,
    similarityPct: similarity.similarityPct,
    isExactOriginal: similarity.isExactOriginal,
    meetsSimilarityThreshold: similarity.meetsThreshold,
    errors,
  };
}

export interface SelectStoryForPostulationInput {
  db: AppDatabase;
  edition: {
    id: string;
    submissionStartAt: string;
    submissionEndAt: string;
  };
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    selectedStoryId: string | null;
    postulatedAt: string | null;
  };
  story: {
    id: string;
    enrollmentId: string;
    originalTitle: string;
    originalBody: string;
    originalCharCount: number;
  };
  nowIso?: string;
}

export interface SelectStoryForPostulationResult {
  selected: boolean;
  storyId?: string;
  error?: string;
}

/**
 * Irreversibly locks the participant's chosen Stage 2 story for Stage 3 editing and postulation.
 */
export async function selectStoryForPostulationInDb(
  input: SelectStoryForPostulationInput
): Promise<SelectStoryForPostulationResult> {
  if (input.enrollment.status !== "ACTIVE") {
    return {
      selected: false,
      error: "No puedes seleccionar un cuento porque tu participación está descalificada.",
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = parseUtcMs(nowIso);
  if (
    nowMs < parseUtcMs(input.edition.submissionStartAt) ||
    nowMs > parseUtcMs(input.edition.submissionEndAt)
  ) {
    return {
      selected: false,
      error: "La etapa de selección y edición no está abierta en este momento.",
    };
  }

  if (input.enrollment.selectedStoryId) {
    return {
      selected: false,
      error:
        "Ya seleccionaste un cuento para postular. Esta elección es irreversible.",
    };
  }

  if (input.story.enrollmentId !== input.enrollment.id) {
    return {
      selected: false,
      error: "El cuento indicado no pertenece a tu inscripción.",
    };
  }

  await input.db
    .update(stories)
    .set({
      isSelectedForPostulation: true,
      editedTitle: input.story.originalTitle,
      editedBody: input.story.originalBody,
      editedCharCount: input.story.originalCharCount,
      similarityPct: 100,
      updatedAt: nowIso,
    })
    .where(
      and(
        eq(stories.id, input.story.id),
        eq(stories.enrollmentId, input.enrollment.id)
      )
    );

  await input.db
    .update(enrollments)
    .set({
      selectedStoryId: input.story.id,
    })
    .where(eq(enrollments.id, input.enrollment.id));

  return {
    selected: true,
    storyId: input.story.id,
  };
}

export interface SaveStage3DraftInput {
  db: AppDatabase;
  edition: {
    id: string;
    minChars: number;
    maxChars: number;
    minSimilarityPct: number;
    submissionStartAt: string;
    submissionEndAt: string;
  };
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    selectedStoryId: string | null;
    inCorrectionWindow?: boolean;
    correctionDeadlineAt?: string | null;
  };
  story: {
    id: string;
    enrollmentId: string;
    originalBody: string;
    isPostulated: boolean;
  };
  title: string;
  body: string;
  nowIso?: string;
}

export interface SaveStage3DraftResult {
  saved: boolean;
  charCount?: number;
  similarityPct?: number;
  updatedAt?: string;
  error?: string;
}

/**
 * Saves an edited draft of the participant's selected story (unlimited edits before definitive postulation).
 */
export async function saveStage3DraftInDb(
  input: SaveStage3DraftInput
): Promise<SaveStage3DraftResult> {
  if (input.enrollment.status !== "ACTIVE") {
    return {
      saved: false,
      error: "No puedes editar tu cuento porque tu participación está descalificada.",
    };
  }

  if (input.enrollment.selectedStoryId !== input.story.id) {
    return {
      saved: false,
      error: "Solo puedes editar el cuento que seleccionaste para postular.",
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = parseUtcMs(nowIso);

  const inStage3Window =
    nowMs >= parseUtcMs(input.edition.submissionStartAt) &&
    nowMs <= parseUtcMs(input.edition.submissionEndAt);
  const inCorrectionWindow =
    Boolean(input.enrollment.inCorrectionWindow) &&
    Boolean(input.enrollment.correctionDeadlineAt) &&
    nowMs <= parseUtcMs(input.enrollment.correctionDeadlineAt as string);

  if (!inStage3Window && !inCorrectionWindow) {
    return {
      saved: false,
      error: "El período de edición ya no se encuentra abierto.",
    };
  }

  if (input.story.isPostulated && !inCorrectionWindow) {
    return {
      saved: false,
      error: "Tu cuento ya fue postulado definitivamente y no admite cambios.",
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
      saved: false,
      error: validation.errors[0],
    };
  }

  await input.db
    .update(stories)
    .set({
      editedTitle: input.title.trim(),
      editedBody: input.body,
      editedCharCount: validation.charCount,
      similarityPct: validation.similarityPct,
      updatedAt: nowIso,
    })
    .where(eq(stories.id, input.story.id));

  return {
    saved: true,
    charCount: validation.charCount,
    similarityPct: validation.similarityPct,
    updatedAt: nowIso,
  };
}

export interface PostulateStoryDefinitivelyInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
    minChars: number;
    maxChars: number;
    minSimilarityPct: number;
    submissionStartAt: string;
    submissionEndAt: string;
  };
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    disqualificationReason?: DisqualificationReason | null;
    selectedStoryId: string | null;
  };
  story: {
    id: string;
    enrollmentId: string;
    originalBody: string;
    isPostulated: boolean;
  };
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string;
  };
  title: string;
  body: string;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface PostulateStoryDefinitivelyResult {
  postulated: boolean;
  postulatedAt?: string;
  similarityPct?: number;
  charCount?: number;
  emailSent?: boolean;
  error?: string;
}

/**
 * Irreversibly postulates the participant's selected story (`is_postulated = 1`)
 * and dispatches confirmation email `E10`.
 */
export async function postulateStoryDefinitivelyInDb(
  input: PostulateStoryDefinitivelyInput
): Promise<PostulateStoryDefinitivelyResult> {
  if (input.enrollment.status !== "ACTIVE") {
    return {
      postulated: false,
      error: "No puedes postular un cuento porque tu participación está descalificada.",
    };
  }

  if (input.enrollment.selectedStoryId !== input.story.id) {
    return {
      postulated: false,
      error: "Debes seleccionar este cuento antes de postularlo definitivamente.",
    };
  }

  if (input.story.isPostulated) {
    return {
      postulated: false,
      error: "Tu cuento ya fue postulado definitivamente.",
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = parseUtcMs(nowIso);
  if (
    nowMs < parseUtcMs(input.edition.submissionStartAt) ||
    nowMs > parseUtcMs(input.edition.submissionEndAt)
  ) {
    return {
      postulated: false,
      error: "El plazo para postular definitivamente ya cerró.",
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
      postulated: false,
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
      isPostulated: true,
      postulatedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(stories.id, input.story.id));

  await input.db
    .update(enrollments)
    .set({
      postulatedAt: nowIso,
    })
    .where(eq(enrollments.id, input.enrollment.id));

  const emailResult = await dispatchTemplateEmail({
    db: input.db,
    apiKey: input.brevoApiKey,
    editionId: input.edition.id,
    templateCode: "E10",
    recipientUserId: input.user.id,
    recipientEmail: input.user.email,
    recipientName: input.user.name,
    contextKey: `stage3_postulated_${input.edition.id}`,
    variables: {
      NOMBRE: input.user.firstName ?? input.user.name,
      APELLIDO: input.user.lastName ?? "",
      EMAIL: input.user.email,
      EDICION: input.edition.title,
      TITULO_CUENTO: trimmedTitle,
      LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/concurso`,
    },
  });

  return {
    postulated: true,
    postulatedAt: nowIso,
    similarityPct: validation.similarityPct,
    charCount: validation.charCount,
    emailSent: emailResult.dispatched,
  };
}
