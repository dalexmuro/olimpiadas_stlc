/**
 * Stage 5 Participant Voting Domain Logic
 * Step 5.1: Deterministic FNV-1a 32-bit story randomization, read/preselection toggles, self-vote prevention, and Top 3 voting (E16)
 */

import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  enrollments,
  stories,
  storyReadsPreselections,
  votes,
  type EnrollmentStatus,
  type MediaType,
} from "@/db/schema";
import { dispatchTemplateEmail } from "./email";
import { parseUtcMs } from "./timezone";

export const PARTICIPANT_VOTE_POINTS = {
  first: 3,
  second: 2,
  third: 1,
} as const;

export const MIN_PRESELECTED_TO_VOTE = 3;

export interface AnonymousVotingStoryItem {
  id: string;
  promptNumber: number;
  promptTitle: string;
  promptBody: string;
  promptMediaType: MediaType | null;
  promptMediaUrl: string | null;
  title: string;
  body: string;
  isOwnStory: boolean;
  isRead: boolean;
  isPreselected: boolean;
}

/**
 * Computes unsigned 32-bit FNV-1a hash per Technical Specification §4.2.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Sorts stories in a deterministic per-voter pseudo-random order that stays
 * identical across sessions: `fnv1a32(voterId + ":" + story.id)`.
 */
export function sortStoriesDeterministicallyForVoter<T extends { id: string }>(
  voterId: string,
  storyList: T[]
): T[] {
  return [...storyList].sort((a, b) => {
    const hashA = fnv1a32(`${voterId}:${a.id}`);
    const hashB = fnv1a32(`${voterId}:${b.id}`);
    if (hashA !== hashB) return hashA - hashB;
    return a.id.localeCompare(b.id);
  });
}

export interface Top3VoteValidationInput {
  firstPlaceStoryId: string;
  secondPlaceStoryId: string;
  thirdPlaceStoryId: string;
  eligibleStoryIds: Set<string>;
  ownStoryId?: string | null;
}

export interface Top3VoteValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a Top 3 ballot selects 3 distinct eligible stories and never votes for own story.
 */
export function validateTop3VoteSelection(
  input: Top3VoteValidationInput
): Top3VoteValidationResult {
  const picks = [
    input.firstPlaceStoryId,
    input.secondPlaceStoryId,
    input.thirdPlaceStoryId,
  ];

  if (picks.some((id) => !id || !id.trim())) {
    return {
      valid: false,
      error: "Debes asignar el 1er, 2do y 3er lugar antes de confirmar tu voto.",
    };
  }

  if (new Set(picks).size !== 3) {
    return {
      valid: false,
      error: "Debes elegir tres cuentos distintos para tu podio.",
    };
  }

  if (input.ownStoryId && picks.includes(input.ownStoryId)) {
    return {
      valid: false,
      error: "No puedes votar por tu propio cuento.",
    };
  }

  for (const storyId of picks) {
    if (!input.eligibleStoryIds.has(storyId)) {
      return {
        valid: false,
        error: "Uno de los cuentos seleccionados no es elegible para votación.",
      };
    }
  }

  return { valid: true };
}

export interface ToggleStoryStateInput {
  db: AppDatabase;
  editionId: string;
  voterId: string;
  storyId: string;
  isOwnStory: boolean;
  isRead?: boolean;
  isPreselected?: boolean;
  nowIso?: string;
}

export interface ToggleStoryStateResult {
  updated: boolean;
  isRead?: boolean;
  isPreselected?: boolean;
  error?: string;
}

/**
 * Upserts a voter's "Leído" and/or "Preseleccionado" status on a story.
 * Enforces that participants cannot preselect their own story.
 */
export async function toggleStoryReadOrPreselectionInDb(
  input: ToggleStoryStateInput
): Promise<ToggleStoryStateResult> {
  if (input.isPreselected === true && input.isOwnStory) {
    return {
      updated: false,
      error: "No puedes preseleccionar tu propio cuento.",
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const existingRows = await input.db
    .select()
    .from(storyReadsPreselections)
    .where(
      and(
        eq(storyReadsPreselections.voterId, input.voterId),
        eq(storyReadsPreselections.storyId, input.storyId)
      )
    );

  const existing = existingRows[0];
  const nextRead = input.isRead ?? existing?.isRead ?? false;
  const nextPreselected = input.isOwnStory
    ? false
    : (input.isPreselected ?? existing?.isPreselected ?? false);

  if (existing) {
    await input.db
      .update(storyReadsPreselections)
      .set({
        isRead: nextRead,
        isPreselected: nextPreselected,
        updatedAt: nowIso,
      })
      .where(eq(storyReadsPreselections.id, existing.id));
  } else {
    await input.db.insert(storyReadsPreselections).values({
      id: crypto.randomUUID(),
      editionId: input.editionId,
      voterId: input.voterId,
      storyId: input.storyId,
      isRead: nextRead,
      isPreselected: nextPreselected,
      updatedAt: nowIso,
    });
  }

  return {
    updated: true,
    isRead: nextRead,
    isPreselected: nextPreselected,
  };
}

export interface CastParticipantVoteInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
    votingStartAt: string;
    votingEndAt: string;
  };
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    hasVoted: boolean;
    selectedStoryId: string | null;
  };
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
  eligibleStoryIds: Set<string>;
  firstPlaceStoryId: string;
  secondPlaceStoryId: string;
  thirdPlaceStoryId: string;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface CastParticipantVoteResult {
  voted: boolean;
  voteId?: string;
  votedAt?: string;
  emailSent?: boolean;
  error?: string;
}

/**
 * Records a participant's definitive Top 3 vote (3 pts / 2 pts / 1 pt),
 * updates story point totals and enrollment status, and dispatches email `E16`.
 */
export async function castParticipantVoteInDb(
  input: CastParticipantVoteInput
): Promise<CastParticipantVoteResult> {
  if (input.enrollment.status !== "ACTIVE") {
    return {
      voted: false,
      error: "No puedes votar porque tu participación está descalificada.",
    };
  }

  if (input.enrollment.hasVoted) {
    return {
      voted: false,
      error: "Ya registraste tu voto definitivo en esta edición.",
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = parseUtcMs(nowIso);
  if (
    nowMs < parseUtcMs(input.edition.votingStartAt) ||
    nowMs > parseUtcMs(input.edition.votingEndAt)
  ) {
    return {
      voted: false,
      error: "La etapa de votaciones no está abierta en este momento.",
    };
  }

  const validation = validateTop3VoteSelection({
    firstPlaceStoryId: input.firstPlaceStoryId,
    secondPlaceStoryId: input.secondPlaceStoryId,
    thirdPlaceStoryId: input.thirdPlaceStoryId,
    eligibleStoryIds: input.eligibleStoryIds,
    ownStoryId: input.enrollment.selectedStoryId,
  });

  if (!validation.valid) {
    return {
      voted: false,
      error: validation.error,
    };
  }

  const voteId = crypto.randomUUID();
  await input.db.insert(votes).values({
    id: voteId,
    editionId: input.edition.id,
    voterId: input.user.id,
    voterRole: "PARTICIPANT",
    firstPlaceStoryId: input.firstPlaceStoryId,
    secondPlaceStoryId: input.secondPlaceStoryId,
    thirdPlaceStoryId: input.thirdPlaceStoryId,
    firstPlacePoints: PARTICIPANT_VOTE_POINTS.first,
    secondPlacePoints: PARTICIPANT_VOTE_POINTS.second,
    thirdPlacePoints: PARTICIPANT_VOTE_POINTS.third,
    createdAt: nowIso,
  });

  await Promise.all([
    input.db
      .update(stories)
      .set({
        participantPoints: sql`${stories.participantPoints} + ${PARTICIPANT_VOTE_POINTS.first}`,
        updatedAt: nowIso,
      })
      .where(eq(stories.id, input.firstPlaceStoryId)),
    input.db
      .update(stories)
      .set({
        participantPoints: sql`${stories.participantPoints} + ${PARTICIPANT_VOTE_POINTS.second}`,
        updatedAt: nowIso,
      })
      .where(eq(stories.id, input.secondPlaceStoryId)),
    input.db
      .update(stories)
      .set({
        participantPoints: sql`${stories.participantPoints} + ${PARTICIPANT_VOTE_POINTS.third}`,
        updatedAt: nowIso,
      })
      .where(eq(stories.id, input.thirdPlaceStoryId)),
  ]);

  await input.db
    .update(enrollments)
    .set({
      hasVoted: true,
      votedAt: nowIso,
    })
    .where(eq(enrollments.id, input.enrollment.id));

  const emailRes = await dispatchTemplateEmail({
    db: input.db,
    apiKey: input.brevoApiKey,
    editionId: input.edition.id,
    templateCode: "E16",
    recipientUserId: input.user.id,
    recipientEmail: input.user.email,
    recipientName: input.user.name ?? input.user.email,
    contextKey: `stage5_vote_cast_${input.edition.id}`,
    variables: {
      NOMBRE: input.user.firstName ?? input.user.name ?? "Participante",
      APELLIDO: input.user.lastName ?? "",
      EDICION: input.edition.title,
      LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/concurso`,
    },
    nowIso,
  });

  return {
    voted: true,
    voteId,
    votedAt: nowIso,
    emailSent: emailRes.dispatched,
  };
}
