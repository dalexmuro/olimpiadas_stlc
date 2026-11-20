/**
 * Stage 2 Prompt Writing Marathon Domain Logic
 * Step 3.3: Prompt state resolver, live character validation, localStorage draft keys, and idempotent story upsert
 */

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  stories,
  type DisqualificationReason,
  type EnrollmentStatus,
  type MediaType,
} from "@/db/schema";
import { parseUtcMs } from "./timezone";

export const MAX_STORY_TITLE_LENGTH = 150;

export interface Stage2PromptSnapshot {
  id: string;
  promptNumber: number;
  title: string;
  body: string;
  mediaType: MediaType | null;
  mediaUrl: string | null;
  publishedAt: string;
  closesAt: string;
}

export interface Stage2ExistingStorySnapshot {
  id: string;
  promptId: string;
  originalTitle: string;
  originalBody: string;
  originalCharCount: number;
  submittedAt: string;
}

export type Stage2ViewState =
  | {
      kind: "DISQUALIFIED";
      reason: DisqualificationReason | null;
      reasonLabel: string;
    }
  | {
      kind: "OPEN_PROMPT";
      prompt: Stage2PromptSnapshot;
    }
  | {
      kind: "WAITING_NEXT_PROMPT";
      nextPromptNumber: number;
      nextOpensAt: string;
    }
  | {
      kind: "WAITING_SUBMISSION_STAGE";
      submissionStartAt: string;
    };

export interface StoryValidationInput {
  title: string;
  body: string;
  minChars: number;
  maxChars: number;
}

export interface StoryValidationResult {
  valid: boolean;
  charCount: number;
  titleLength: number;
  errors: string[];
}

export interface SubmitStage2StoryInput {
  db: AppDatabase;
  edition: {
    id: string;
    minChars: number;
    maxChars: number;
  };
  enrollment: {
    id: string;
    status: EnrollmentStatus;
  };
  prompt: Pick<Stage2PromptSnapshot, "id" | "publishedAt" | "closesAt">;
  userId: string;
  title: string;
  body: string;
  nowIso?: string;
}

export interface SubmitStage2StoryResult {
  saved: boolean;
  storyId?: string;
  updatedExisting?: boolean;
  charCount?: number;
  submittedAt?: string;
  error?: string;
}

/**
 * Counts every character in the story body, including spaces and line breaks.
 */
export function countStoryBodyChars(body: string): number {
  return body.length;
}

/**
 * Validates Stage 2 story title (1..150 chars trimmed) and body ([minChars, maxChars] exact length).
 */
export function validateStage2StoryInput(
  input: StoryValidationInput
): StoryValidationResult {
  const errors: string[] = [];
  const trimmedTitle = input.title.trim();
  const titleLength = trimmedTitle.length;
  const charCount = countStoryBodyChars(input.body);

  if (titleLength === 0) {
    errors.push("El título del cuento es obligatorio.");
  } else if (titleLength > MAX_STORY_TITLE_LENGTH) {
    errors.push(
      `El título no puede superar los ${MAX_STORY_TITLE_LENGTH} caracteres.`
    );
  }

  if (charCount < input.minChars) {
    errors.push(
      `Tu cuento tiene ${charCount} caracteres y el mínimo permitido es ${input.minChars}.`
    );
  } else if (charCount > input.maxChars) {
    errors.push(
      `Tu cuento tiene ${charCount} caracteres y el máximo permitido es ${input.maxChars}.`
    );
  }

  return {
    valid: errors.length === 0,
    charCount,
    titleLength,
    errors,
  };
}

/**
 * Human-readable Spanish explanation for each disqualification reason.
 */
export function getDisqualificationReasonLabel(
  reason: DisqualificationReason | null
): string {
  switch (reason) {
    case "MAX_MISSES":
      return "Superaste el límite máximo de consignas sin entregar durante la etapa de escritura.";
    case "NO_POSTULATION":
      return "No postulaste definitivamente tu cuento antes del cierre de la etapa de selección y edición.";
    case "MODIFICATION_REJECTED":
      return "Las modificaciones de tu cuento no superaron la validación de los administradores.";
    case "NO_VOTE":
      return "No enviaste tu votación antes del cierre de la etapa de votaciones.";
    case "MANUAL_ADMIN":
      return "Tu participación fue cerrada por decisión del equipo administrador.";
    default:
      return "Tu participación en esta edición ha sido cerrada.";
  }
}

/**
 * Determines which Stage 2 screen to render for a participant at `nowIso`.
 * Closed prompts and their stories are intentionally never exposed during Stage 2.
 */
export function resolveStage2ViewState(params: {
  enrollmentStatus: EnrollmentStatus;
  disqualificationReason?: DisqualificationReason | null;
  prompts: Stage2PromptSnapshot[];
  submissionStartAt: string;
  nowIso?: Date | string;
}): Stage2ViewState {
  if (params.enrollmentStatus === "DISQUALIFIED") {
    return {
      kind: "DISQUALIFIED",
      reason: params.disqualificationReason ?? null,
      reasonLabel: getDisqualificationReasonLabel(
        params.disqualificationReason ?? null
      ),
    };
  }

  const nowMs = parseUtcMs(params.nowIso ?? new Date());
  const sorted = [...params.prompts].sort(
    (a, b) => parseUtcMs(a.publishedAt) - parseUtcMs(b.publishedAt)
  );

  const openPrompt = sorted.find(
    (p) => nowMs >= parseUtcMs(p.publishedAt) && nowMs < parseUtcMs(p.closesAt)
  );
  if (openPrompt) {
    return {
      kind: "OPEN_PROMPT",
      prompt: openPrompt,
    };
  }

  const nextPrompt = sorted.find((p) => parseUtcMs(p.publishedAt) > nowMs);
  if (nextPrompt) {
    return {
      kind: "WAITING_NEXT_PROMPT",
      nextPromptNumber: nextPrompt.promptNumber,
      nextOpensAt: nextPrompt.publishedAt,
    };
  }

  return {
    kind: "WAITING_SUBMISSION_STAGE",
    submissionStartAt: params.submissionStartAt,
  };
}

/**
 * Deterministic localStorage key for auto-saving Stage 2 drafts on the client.
 */
export function buildLocalDraftStorageKey(
  editionId: string,
  promptId: string,
  userId: string
): string {
  return `stlc:draft:v1:${editionId}:${promptId}:${userId}`;
}

/**
 * Saves or updates a participant's story for an open Stage 2 prompt.
 * Unlimited edits are permitted while the prompt is open; only the latest submission is kept.
 */
export async function submitStage2StoryInDb(
  input: SubmitStage2StoryInput
): Promise<SubmitStage2StoryResult> {
  if (input.enrollment.status !== "ACTIVE") {
    return {
      saved: false,
      error: "No puedes enviar cuentos porque tu participación está descalificada.",
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = parseUtcMs(nowIso);
  const openMs = parseUtcMs(input.prompt.publishedAt);
  const closeMs = parseUtcMs(input.prompt.closesAt);

  if (nowMs < openMs) {
    return {
      saved: false,
      error: "Esta consigna todavía no se encuentra abierta.",
    };
  }

  if (nowMs >= closeMs) {
    return {
      saved: false,
      error: "El plazo para enviar cuentos a esta consigna ya cerró.",
    };
  }

  const validation = validateStage2StoryInput({
    title: input.title,
    body: input.body,
    minChars: input.edition.minChars,
    maxChars: input.edition.maxChars,
  });

  if (!validation.valid) {
    return {
      saved: false,
      error: validation.errors[0],
    };
  }

  const trimmedTitle = input.title.trim();

  const existingRows = await input.db
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        eq(stories.enrollmentId, input.enrollment.id),
        eq(stories.promptId, input.prompt.id)
      )
    );

  if (existingRows.length > 0) {
    const existingId = existingRows[0].id;
    await input.db
      .update(stories)
      .set({
        originalTitle: trimmedTitle,
        originalBody: input.body,
        originalCharCount: validation.charCount,
        submittedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(stories.id, existingId));

    return {
      saved: true,
      storyId: existingId,
      updatedExisting: true,
      charCount: validation.charCount,
      submittedAt: nowIso,
    };
  }

  const newStoryId = crypto.randomUUID();
  await input.db.insert(stories).values({
    id: newStoryId,
    editionId: input.edition.id,
    enrollmentId: input.enrollment.id,
    promptId: input.prompt.id,
    authorId: input.userId,
    originalTitle: trimmedTitle,
    originalBody: input.body,
    originalCharCount: validation.charCount,
    submittedAt: nowIso,
    isSelectedForPostulation: false,
    isPostulated: false,
    participantPoints: 0,
    passedToJury: false,
    juryPoints: 0,
    totalPoints: 0,
    updatedAt: nowIso,
  });

  return {
    saved: true,
    storyId: newStoryId,
    updatedExisting: false,
    charCount: validation.charCount,
    submittedAt: nowIso,
  };
}
