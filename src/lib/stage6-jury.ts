/**
 * Stage 6 Jury Evaluation, Top 10 + Ties Cutoff & Conditional Tie-Breaker 6b
 * Step 5.2: Stage 5 cutoff (NO_VOTE + Top 10+ties), Jury blind Top 3 with multiplier K, missing-juror pause (E23), and tie-breaker (E24)
 */

import { eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  editions,
  enrollments,
  stories,
  tieBreakerRounds,
  tieBreakerVotes,
  votes,
} from "@/db/schema";
import {
  DEFAULT_JURY_BRACKETS,
  resolveJuryMultiplier,
  type JuryBracket,
} from "./edition-management";
import { dispatchTemplateEmail } from "./email";
import { validateTop3VoteSelection } from "./stage5-voting";

export const JURY_CUTOFF_TARGET = 10;

export interface ScoredStoryRef {
  id: string;
  participantPoints: number;
}

/**
 * Technical Specification §4.3:
 * Groups eligible stories by descending `participantPoints` and includes full
 * score tiers until at least 10 stories are selected (including all ties at the cutoff).
 */
export function selectTop10WithTies<T extends ScoredStoryRef>(
  eligibleStories: T[]
): T[] {
  if (eligibleStories.length <= JURY_CUTOFF_TARGET) {
    return [...eligibleStories].sort(
      (a, b) => b.participantPoints - a.participantPoints
    );
  }

  const tierMap = new Map<number, T[]>();
  for (const story of eligibleStories) {
    const bucket = tierMap.get(story.participantPoints) ?? [];
    bucket.push(story);
    tierMap.set(story.participantPoints, bucket);
  }

  const descendingScores = Array.from(tierMap.keys()).sort((a, b) => b - a);
  const selected: T[] = [];

  for (const score of descendingScores) {
    const bucket = tierMap.get(score) ?? [];
    selected.push(...bucket);
    if (selected.length >= JURY_CUTOFF_TARGET) {
      break;
    }
  }

  return selected;
}

export interface FinalistScoreEntry {
  id: string;
  totalPoints: number;
  tieBreakerRank?: number | null;
}

export type PodiumTieResult =
  | {
      hasTie: false;
      podium: {
        first: string | null;
        second: string | null;
        third: string | null;
      };
    }
  | {
      hasTie: true;
      tiedPositions: "1_2" | "2_3" | "3_ONLY" | "1_2_3";
      tiedStoryIds: string[];
    };

/**
 * Checks whether the top 3 final scores have any unresolved tie affecting 1st, 2nd, or 3rd place.
 */
export function detectPodiumTie(
  finalists: FinalistScoreEntry[]
): PodiumTieResult {
  if (finalists.length === 0) {
    return {
      hasTie: false,
      podium: { first: null, second: null, third: null },
    };
  }

  const sorted = [...finalists].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const rankA = a.tieBreakerRank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.tieBreakerRank ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });

  // Group into tiers where entries share the exact same totalPoints AND have no distinct tieBreakerRank
  const tiers: FinalistScoreEntry[][] = [];
  for (const entry of sorted) {
    const lastTier = tiers[tiers.length - 1];
    if (
      lastTier &&
      lastTier[0].totalPoints === entry.totalPoints &&
      (lastTier[0].tieBreakerRank ?? null) === (entry.tieBreakerRank ?? null)
    ) {
      lastTier.push(entry);
    } else {
      tiers.push([entry]);
    }
  }

  const t0 = tiers[0] ?? [];
  if (t0.length >= 3) {
    return {
      hasTie: true,
      tiedPositions: "1_2_3",
      tiedStoryIds: t0.map((s) => s.id),
    };
  }
  if (t0.length === 2) {
    return {
      hasTie: true,
      tiedPositions: "1_2",
      tiedStoryIds: t0.map((s) => s.id),
    };
  }

  const t1 = tiers[1] ?? [];
  if (t1.length >= 2) {
    return {
      hasTie: true,
      tiedPositions: "2_3",
      tiedStoryIds: t1.map((s) => s.id),
    };
  }

  const t2 = tiers[2] ?? [];
  if (t2.length >= 2) {
    return {
      hasTie: true,
      tiedPositions: "3_ONLY",
      tiedStoryIds: t2.map((s) => s.id),
    };
  }

  return {
    hasTie: false,
    podium: {
      first: t0[0]?.id ?? null,
      second: t1[0]?.id ?? null,
      third: t2[0]?.id ?? null,
    },
  };
}

export function parseJuryBracketsJson(rawJson: string): readonly JuryBracket[] {
  try {
    const parsed = JSON.parse(rawJson) as JuryBracket[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fallback to defaults
  }
  return DEFAULT_JURY_BRACKETS;
}

export interface CloseStage5Input {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
  };
  activeEnrollments: Array<{
    id: string;
    userId: string;
    hasVoted: boolean;
  }>;
  usersById: Map<
    string,
    {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      name: string | null;
    }
  >;
  postulatedStories: Array<{
    id: string;
    enrollmentId: string;
    participantPoints: number;
  }>;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface CloseStage5Result {
  disqualifiedCount: number;
  finalistStoryIds: string[];
}

/**
 * Closes Stage 5:
 * 1. Disqualifies any ACTIVE participant who did not vote (`NO_VOTE`) and sends `E17`.
 * 2. Computes Top 10 + Ties among remaining active participants' postulated stories and marks `passed_to_jury = 1`.
 */
export async function closeStage5AndSelectJuryFinalistsInDb(
  input: CloseStage5Input
): Promise<CloseStage5Result> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nonVoters = input.activeEnrollments.filter((e) => !e.hasVoted);
  const nonVoterEnrollmentIds = new Set(nonVoters.map((e) => e.id));

  for (const enr of nonVoters) {
    await input.db
      .update(enrollments)
      .set({
        status: "DISQUALIFIED",
        disqualificationReason: "NO_VOTE",
        disqualifiedAt: nowIso,
      })
      .where(eq(enrollments.id, enr.id));

    const user = input.usersById.get(enr.userId);
    if (user) {
      await dispatchTemplateEmail({
        db: input.db,
        apiKey: input.brevoApiKey,
        editionId: input.edition.id,
        templateCode: "E17",
        recipientUserId: user.id,
        recipientEmail: user.email,
        recipientName: user.name ?? user.email,
        contextKey: `dq_no_vote_${input.edition.id}`,
        variables: {
          NOMBRE: user.firstName ?? user.name ?? "Participante",
          APELLIDO: user.lastName ?? "",
          EDICION: input.edition.title,
          LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/concurso`,
        },
        nowIso,
      });
    }
  }

  const survivingEnrollmentIds = new Set(
    input.activeEnrollments
      .filter((e) => !nonVoterEnrollmentIds.has(e.id))
      .map((e) => e.id)
  );

  const eligibleStories = input.postulatedStories.filter((s) =>
    survivingEnrollmentIds.has(s.enrollmentId)
  );
  const finalists = selectTop10WithTies(eligibleStories);
  const finalistStoryIds = finalists.map((s) => s.id);

  if (finalistStoryIds.length > 0) {
    await input.db
      .update(stories)
      .set({
        passedToJury: true,
        updatedAt: nowIso,
      })
      .where(inArray(stories.id, finalistStoryIds));
  }

  return {
    disqualifiedCount: nonVoters.length,
    finalistStoryIds,
  };
}

export interface JuryRecipient {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

export interface PauseJuryMissingVotesInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
  };
  admins: JuryRecipient[];
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

/**
 * Pauses Stage 6 closure when `jury_end_at` is reached with pending jurors
 * and notifies all admins via email `E23`.
 */
export async function pauseJuryStageForMissingVotesInDb(
  input: PauseJuryMissingVotesInput
): Promise<{ paused: boolean; notifiedAdmins: number }> {
  const nowIso = input.nowIso ?? new Date().toISOString();

  await input.db
    .update(editions)
    .set({
      juryPausedMissingVotes: true,
      updatedAt: nowIso,
    })
    .where(eq(editions.id, input.edition.id));

  let notifiedAdmins = 0;
  for (const admin of input.admins) {
    const res = await dispatchTemplateEmail({
      db: input.db,
      apiKey: input.brevoApiKey,
      editionId: input.edition.id,
      templateCode: "E23",
      recipientUserId: admin.id,
      recipientEmail: admin.email,
      recipientName: admin.name ?? admin.email,
      contextKey: `jury_paused_missing_votes_${input.edition.id}`,
      variables: {
        NOMBRE: admin.firstName ?? admin.name ?? "Administrador",
        APELLIDO: admin.lastName ?? "",
        EDICION: input.edition.title,
        LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/admin/estadisticas`,
      },
      nowIso,
    });
    if (res.dispatched) notifiedAdmins += 1;
  }

  return { paused: true, notifiedAdmins };
}

export interface CastJuryVoteInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
    juryBracketsJson: string;
  };
  juror: JuryRecipient;
  hasAlreadyVoted: boolean;
  eligibleFinalists: Array<{
    id: string;
    participantPoints: number;
    juryPoints: number;
  }>;
  activeParticipantsCount: number;
  firstPlaceStoryId: string;
  secondPlaceStoryId: string;
  thirdPlaceStoryId: string;
  totalJurorsCount: number;
  existingJuryVotesCount: number;
  allJurors: JuryRecipient[];
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface CastJuryVoteResult {
  voted: boolean;
  multiplier?: number;
  allJurorsVoted?: boolean;
  tieBreakerTriggered?: boolean;
  tieBreakerRoundId?: string;
  error?: string;
}

/**
 * Records a juror's blind Top 3 vote using the automatic multiplier K (3K / 2K / 1K),
 * sends confirmation `E22`, and when the last juror votes either assigns podium places
 * or automatically activates conditional Stage 6b Tie-Breaker (`E24`).
 */
export async function castJuryVoteInDb(
  input: CastJuryVoteInput
): Promise<CastJuryVoteResult> {
  if (input.hasAlreadyVoted) {
    return {
      voted: false,
      error: "Ya enviaste tu votación de jurado para esta edición.",
    };
  }

  const eligibleIds = new Set(input.eligibleFinalists.map((s) => s.id));
  const validation = validateTop3VoteSelection({
    firstPlaceStoryId: input.firstPlaceStoryId,
    secondPlaceStoryId: input.secondPlaceStoryId,
    thirdPlaceStoryId: input.thirdPlaceStoryId,
    eligibleStoryIds: eligibleIds,
  });

  if (!validation.valid) {
    return { voted: false, error: validation.error };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const brackets = parseJuryBracketsJson(input.edition.juryBracketsJson);
  const weights = resolveJuryMultiplier(input.activeParticipantsCount, brackets);

  await input.db.insert(votes).values({
    id: crypto.randomUUID(),
    editionId: input.edition.id,
    voterId: input.juror.id,
    voterRole: "JURY",
    firstPlaceStoryId: input.firstPlaceStoryId,
    secondPlaceStoryId: input.secondPlaceStoryId,
    thirdPlaceStoryId: input.thirdPlaceStoryId,
    firstPlacePoints: weights.first,
    secondPlacePoints: weights.second,
    thirdPlacePoints: weights.third,
    createdAt: nowIso,
  });

  const deltaByStoryId = new Map<string, number>([
    [input.firstPlaceStoryId, weights.first],
    [input.secondPlaceStoryId, weights.second],
    [input.thirdPlaceStoryId, weights.third],
  ]);

  await Promise.all(
    Array.from(deltaByStoryId.entries()).map(([storyId, pts]) =>
      input.db
        .update(stories)
        .set({
          juryPoints: sql`${stories.juryPoints} + ${pts}`,
          totalPoints: sql`${stories.participantPoints} + ${stories.juryPoints} + ${pts}`,
          updatedAt: nowIso,
        })
        .where(eq(stories.id, storyId))
    )
  );

  await dispatchTemplateEmail({
    db: input.db,
    apiKey: input.brevoApiKey,
    editionId: input.edition.id,
    templateCode: "E22",
    recipientUserId: input.juror.id,
    recipientEmail: input.juror.email,
    recipientName: input.juror.name ?? input.juror.email,
    contextKey: `stage6_jury_vote_${input.edition.id}`,
    variables: {
      NOMBRE: input.juror.firstName ?? input.juror.name ?? "Jurado",
      APELLIDO: input.juror.lastName ?? "",
      EDICION: input.edition.title,
      LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/jurado`,
    },
    nowIso,
  });

  const allJurorsVoted =
    input.existingJuryVotesCount + 1 >= input.totalJurorsCount;

  if (!allJurorsVoted) {
    return {
      voted: true,
      multiplier: weights.multiplier,
      allJurorsVoted: false,
      tieBreakerTriggered: false,
    };
  }

  // Recompute updated totalPoints in memory to check for podium ties
  const updatedFinalists: FinalistScoreEntry[] = input.eligibleFinalists.map(
    (s) => {
      const added = deltaByStoryId.get(s.id) ?? 0;
      return {
        id: s.id,
        totalPoints: s.participantPoints + s.juryPoints + added,
      };
    }
  );

  const tieCheck = detectPodiumTie(updatedFinalists);

  if (tieCheck.hasTie) {
    const tieBreakerRoundId = crypto.randomUUID();
    await input.db.insert(tieBreakerRounds).values({
      id: tieBreakerRoundId,
      editionId: input.edition.id,
      roundNumber: 1,
      tiedPositions: tieCheck.tiedPositions,
      tiedStoryIdsJson: JSON.stringify(tieCheck.tiedStoryIds),
      isResolved: false,
      createdAt: nowIso,
      resolvedAt: null,
    });

    await input.db
      .update(editions)
      .set({
        juryPausedMissingVotes: false,
        tieBreakerActive: true,
        updatedAt: nowIso,
      })
      .where(eq(editions.id, input.edition.id));

    for (const j of input.allJurors) {
      await dispatchTemplateEmail({
        db: input.db,
        apiKey: input.brevoApiKey,
        editionId: input.edition.id,
        templateCode: "E24",
        recipientUserId: j.id,
        recipientEmail: j.email,
        recipientName: j.name ?? j.email,
        contextKey: `stage6b_tie_breaker_${tieBreakerRoundId}`,
        variables: {
          NOMBRE: j.firstName ?? j.name ?? "Jurado",
          APELLIDO: j.lastName ?? "",
          EDICION: input.edition.title,
          LINK_PLATAFORMA: `${input.baseUrl.replace(/\/$/, "")}/jurado`,
        },
        nowIso,
      });
    }

    return {
      voted: true,
      multiplier: weights.multiplier,
      allJurorsVoted: true,
      tieBreakerTriggered: true,
      tieBreakerRoundId,
    };
  }

  // Clean podium without ties
  await input.db
    .update(editions)
    .set({
      juryPausedMissingVotes: false,
      updatedAt: nowIso,
    })
    .where(eq(editions.id, input.edition.id));

  const podiumAssignments: Array<[string | null, number]> = [
    [tieCheck.podium.first, 1],
    [tieCheck.podium.second, 2],
    [tieCheck.podium.third, 3],
  ];
  for (const [storyId, place] of podiumAssignments) {
    if (!storyId) continue;
    await input.db
      .update(stories)
      .set({ podiumPlace: place, updatedAt: nowIso })
      .where(eq(stories.id, storyId));
  }

  return {
    voted: true,
    multiplier: weights.multiplier,
    allJurorsVoted: true,
    tieBreakerTriggered: false,
  };
}

export interface CastTieBreakerVoteInput {
  db: AppDatabase;
  editionId: string;
  round: {
    id: string;
    tiedStoryIds: string[];
    isResolved: boolean;
  };
  jurorId: string;
  existingRoundVotes: Array<{
    jurorId: string;
    firstChoiceStoryId: string;
    secondChoiceStoryId: string | null;
  }>;
  totalJurorsCount: number;
  allFinalists: Array<{
    id: string;
    totalPoints: number;
  }>;
  firstChoiceStoryId: string;
  secondChoiceStoryId?: string | null;
  nowIso?: string;
}

export interface CastTieBreakerVoteResult {
  voted: boolean;
  roundResolved?: boolean;
  error?: string;
}

/**
 * Records a juror's tie-breaker vote in Stage 6b and resolves the tie automatically
 * as soon as all jurors have voted.
 */
export async function castTieBreakerVoteInDb(
  input: CastTieBreakerVoteInput
): Promise<CastTieBreakerVoteResult> {
  if (input.round.isResolved) {
    return { voted: false, error: "Esta ronda de desempate ya fue resuelta." };
  }

  if (input.existingRoundVotes.some((v) => v.jurorId === input.jurorId)) {
    return { voted: false, error: "Ya registraste tu voto en este desempate." };
  }

  const tiedSet = new Set(input.round.tiedStoryIds);
  if (!tiedSet.has(input.firstChoiceStoryId)) {
    return {
      voted: false,
      error: "Tu primera elección no pertenece a los cuentos empatados.",
    };
  }

  const requiresSecondChoice = input.round.tiedStoryIds.length >= 3;
  const secondChoice = requiresSecondChoice
    ? (input.secondChoiceStoryId ?? null)
    : null;

  if (requiresSecondChoice) {
    if (
      !secondChoice ||
      !tiedSet.has(secondChoice) ||
      secondChoice === input.firstChoiceStoryId
    ) {
      return {
        voted: false,
        error:
          "Cuando hay 3 o más cuentos empatados debes elegir una primera y una segunda opción distintas.",
      };
    }
  }

  const nowIso = input.nowIso ?? new Date().toISOString();

  await input.db.insert(tieBreakerVotes).values({
    id: crypto.randomUUID(),
    tieBreakerRoundId: input.round.id,
    jurorId: input.jurorId,
    firstChoiceStoryId: input.firstChoiceStoryId,
    secondChoiceStoryId: secondChoice,
    votedAt: nowIso,
  });

  const allVotes = [
    ...input.existingRoundVotes,
    {
      jurorId: input.jurorId,
      firstChoiceStoryId: input.firstChoiceStoryId,
      secondChoiceStoryId: secondChoice,
    },
  ];

  if (allVotes.length < input.totalJurorsCount) {
    return { voted: true, roundResolved: false };
  }

  // Tally tie-breaker scores
  const scoreMap = new Map<string, number>();
  for (const id of input.round.tiedStoryIds) {
    scoreMap.set(id, 0);
  }
  for (const v of allVotes) {
    const firstWeight = requiresSecondChoice ? 2 : 1;
    scoreMap.set(
      v.firstChoiceStoryId,
      (scoreMap.get(v.firstChoiceStoryId) ?? 0) + firstWeight
    );
    if (v.secondChoiceStoryId) {
      scoreMap.set(
        v.secondChoiceStoryId,
        (scoreMap.get(v.secondChoiceStoryId) ?? 0) + 1
      );
    }
  }

  const rankedTied = [...input.round.tiedStoryIds].sort(
    (a, b) => (scoreMap.get(b) ?? 0) - (scoreMap.get(a) ?? 0)
  );

  for (let i = 0; i < rankedTied.length; i += 1) {
    await input.db
      .update(stories)
      .set({
        tieBreakerRank: i + 1,
        updatedAt: nowIso,
      })
      .where(eq(stories.id, rankedTied[i]));
  }

  const rankById = new Map(rankedTied.map((id, idx) => [id, idx + 1]));
  const finalSorted = [...input.allFinalists].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return (
      (rankById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (rankById.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  });

  for (let place = 1; place <= 3; place += 1) {
    const winner = finalSorted[place - 1];
    if (winner) {
      await input.db
        .update(stories)
        .set({ podiumPlace: place, updatedAt: nowIso })
        .where(eq(stories.id, winner.id));
    }
  }

  await input.db
    .update(tieBreakerRounds)
    .set({
      isResolved: true,
      resolvedAt: nowIso,
    })
    .where(eq(tieBreakerRounds.id, input.round.id));

  await input.db
    .update(editions)
    .set({
      tieBreakerActive: false,
      tieBreakerCompleted: true,
      updatedAt: nowIso,
    })
    .where(eq(editions.id, input.editionId));

  return { voted: true, roundResolved: true };
}
