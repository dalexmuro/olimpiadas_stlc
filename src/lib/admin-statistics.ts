/**
 * Real-Time Admin Statistics Aggregation Logic
 * Step 6.2: Computes enrollment totals, disqualification breakdown, stories per prompt, voting progress, and admin-only final score table
 */

import type { DisqualificationReason, EnrollmentStatus } from "@/db/schema";

export interface DisqualificationBreakdown {
  MAX_MISSES: number;
  NO_POSTULATION: number;
  MODIFICATION_REJECTED: number;
  NO_VOTE: number;
  MANUAL_ADMIN: number;
}

export interface PromptStoryCountItem {
  promptId: string;
  promptNumber: number;
  title: string;
  storiesCount: number;
}

export interface AdminScoreRow {
  storyId: string;
  promptNumber: number;
  title: string;
  authorName: string;
  enrollmentStatus: EnrollmentStatus;
  participantPoints: number;
  juryPoints: number;
  totalPoints: number;
  passedToJury: boolean;
  tieBreakerRank: number | null;
  podiumPlace: number | null;
}

export interface EditionStatisticsSnapshot {
  totalEnrolled: number;
  activeCount: number;
  disqualifiedCount: number;
  postulatedCount: number;
  participantsVotedCount: number;
  participantsPendingVoteCount: number;
  disqualificationBreakdown: DisqualificationBreakdown;
  storiesPerPrompt: PromptStoryCountItem[];
  juryProgress: {
    votedCount: number;
    totalJurorsCount: number;
    pendingCount: number;
  };
  scoreTable: AdminScoreRow[];
}

export interface ComputeEditionStatisticsInput {
  enrollments: Array<{
    id: string;
    userId: string;
    status: EnrollmentStatus;
    disqualificationReason: DisqualificationReason | null;
    postulatedAt: string | null;
    hasVoted: boolean;
  }>;
  prompts: Array<{
    id: string;
    promptNumber: number;
    title: string;
  }>;
  stories: Array<{
    id: string;
    enrollmentId: string;
    promptId: string;
    authorId: string;
    originalTitle: string;
    editedTitle: string | null;
    isPostulated: boolean;
    participantPoints: number;
    juryPoints: number;
    totalPoints: number;
    passedToJury: boolean;
    tieBreakerRank: number | null;
    podiumPlace: number | null;
  }>;
  juryVotesCount: number;
  totalJurorsCount: number;
  usersById: Map<
    string,
    { firstName: string | null; lastName: string | null; name: string | null; email: string }
  >;
}

/**
 * Pure aggregator for `/admin/estadisticas` (strictly for ADMIN / SUPERADMIN).
 */
export function computeEditionStatistics(
  input: ComputeEditionStatisticsInput
): EditionStatisticsSnapshot {
  const disqualificationBreakdown: DisqualificationBreakdown = {
    MAX_MISSES: 0,
    NO_POSTULATION: 0,
    MODIFICATION_REJECTED: 0,
    NO_VOTE: 0,
    MANUAL_ADMIN: 0,
  };

  let activeCount = 0;
  let disqualifiedCount = 0;
  let postulatedCount = 0;
  let participantsVotedCount = 0;

  const enrollmentById = new Map(input.enrollments.map((e) => [e.id, e]));

  for (const enr of input.enrollments) {
    if (enr.status === "ACTIVE") {
      activeCount += 1;
      if (enr.hasVoted) {
        participantsVotedCount += 1;
      }
    } else {
      disqualifiedCount += 1;
      if (enr.disqualificationReason) {
        disqualificationBreakdown[enr.disqualificationReason] += 1;
      }
    }

    if (enr.postulatedAt) {
      postulatedCount += 1;
    }
  }

  const promptStoryCounts = new Map<string, number>();
  for (const s of input.stories) {
    promptStoryCounts.set(s.promptId, (promptStoryCounts.get(s.promptId) ?? 0) + 1);
  }

  const promptById = new Map(input.prompts.map((p) => [p.id, p]));
  const storiesPerPrompt: PromptStoryCountItem[] = [...input.prompts]
    .sort((a, b) => a.promptNumber - b.promptNumber)
    .map((p) => ({
      promptId: p.id,
      promptNumber: p.promptNumber,
      title: p.title,
      storiesCount: promptStoryCounts.get(p.id) ?? 0,
    }));

  const scoreTable: AdminScoreRow[] = input.stories
    .filter((s) => s.isPostulated)
    .map((s) => {
      const author = input.usersById.get(s.authorId);
      const prompt = promptById.get(s.promptId);
      const enr = enrollmentById.get(s.enrollmentId);
      const authorName =
        [author?.firstName, author?.lastName].filter(Boolean).join(" ") ||
        author?.name ||
        author?.email ||
        "Autor";

      return {
        storyId: s.id,
        promptNumber: prompt?.promptNumber ?? 0,
        title: s.editedTitle ?? s.originalTitle,
        authorName,
        enrollmentStatus: enr?.status ?? "ACTIVE",
        participantPoints: s.participantPoints,
        juryPoints: s.juryPoints,
        totalPoints: s.totalPoints || s.participantPoints + s.juryPoints,
        passedToJury: s.passedToJury,
        tieBreakerRank: s.tieBreakerRank,
        podiumPlace: s.podiumPlace,
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.participantPoints !== a.participantPoints) {
        return b.participantPoints - a.participantPoints;
      }
      const rankA = a.tieBreakerRank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.tieBreakerRank ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

  return {
    totalEnrolled: input.enrollments.length,
    activeCount,
    disqualifiedCount,
    postulatedCount,
    participantsVotedCount,
    participantsPendingVoteCount: Math.max(
      0,
      activeCount - participantsVotedCount
    ),
    disqualificationBreakdown,
    storiesPerPrompt,
    juryProgress: {
      votedCount: input.juryVotesCount,
      totalJurorsCount: input.totalJurorsCount,
      pendingCount: Math.max(0, input.totalJurorsCount - input.juryVotesCount),
    },
    scoreTable,
  };
}
