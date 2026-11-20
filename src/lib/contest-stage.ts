/**
 * Contest Stage Machine, Visual Timeline Builder & Participant Status Resolver
 * Step 3.1: ContestHeader logic, stage timeline (PAST/CURRENT/UPCOMING), status labels, and non-enrolled restriction
 */

import type { EnrollmentStatus } from "@/db/schema";
import { formatCaracasDateTime, parseUtcMs } from "./timezone";

export type ContestStageKey =
  | "BEFORE_REGISTRATION"
  | "REGISTRATION"
  | "WRITING"
  | "BUFFER_BEFORE_SUBMISSION"
  | "SUBMISSION"
  | "ADMIN_REVIEW"
  | "BUFFER_BEFORE_VOTING"
  | "VOTING"
  | "JURY_EVALUATION"
  | "JURY_TIE_BREAKER"
  | "WINNERS_ANNOUNCED";

export interface EditionStageSnapshot {
  title: string;
  registrationStartAt: string;
  registrationEndAt: string;
  writingStartAt: string;
  writingEndAt: string;
  submissionStartAt: string;
  submissionEndAt: string;
  adminReviewStartAt: string;
  adminReviewEndAt: string;
  votingStartAt: string;
  votingEndAt: string;
  juryStartAt: string;
  juryEndAt: string;
  juryPausedMissingVotes?: boolean;
  tieBreakerActive?: boolean;
  winnersAnnounced?: boolean;
}

export type TimelineItemState = "PAST" | "CURRENT" | "UPCOMING";

export interface ContestTimelineItem {
  id: string;
  label: string;
  dateRangeLabel: string;
  state: TimelineItemState;
}

export interface ParticipantEnrollmentSnapshot {
  status: EnrollmentStatus;
  selectedStoryId?: string | null;
  postulatedAt?: string | null;
  inCorrectionWindow?: boolean;
  hasVoted?: boolean;
}

/**
 * Resolves the exact current stage of a Contest Edition at `nowIso`.
 */
export function resolveCurrentContestStage(
  edition: EditionStageSnapshot,
  nowIso: Date | string = new Date()
): ContestStageKey {
  if (edition.winnersAnnounced) {
    return "WINNERS_ANNOUNCED";
  }
  if (edition.tieBreakerActive) {
    return "JURY_TIE_BREAKER";
  }

  const nowMs = parseUtcMs(nowIso);
  const regStart = parseUtcMs(edition.registrationStartAt);
  const regEnd = parseUtcMs(edition.registrationEndAt);
  const writeStart = parseUtcMs(edition.writingStartAt);
  const writeEnd = parseUtcMs(edition.writingEndAt);
  const subStart = parseUtcMs(edition.submissionStartAt);
  const subEnd = parseUtcMs(edition.submissionEndAt);
  const revStart = parseUtcMs(edition.adminReviewStartAt);
  const revEnd = parseUtcMs(edition.adminReviewEndAt);
  const voteStart = parseUtcMs(edition.votingStartAt);
  const voteEnd = parseUtcMs(edition.votingEndAt);
  const juryStart = parseUtcMs(edition.juryStartAt);

  if (nowMs < regStart) return "BEFORE_REGISTRATION";
  if (nowMs <= regEnd) return "REGISTRATION";
  if (nowMs < writeStart) return "REGISTRATION";
  if (nowMs <= writeEnd) return "WRITING";
  if (nowMs < subStart) return "BUFFER_BEFORE_SUBMISSION";
  if (nowMs <= subEnd) return "SUBMISSION";
  if (nowMs < revStart) return "ADMIN_REVIEW";
  if (nowMs <= revEnd) return "ADMIN_REVIEW";
  if (nowMs < voteStart) return "BUFFER_BEFORE_VOTING";
  if (nowMs <= voteEnd) return "VOTING";
  if (nowMs >= juryStart) return "JURY_EVALUATION";

  return "VOTING";
}

const STAGE_INDEX_MAP: Record<ContestStageKey, number> = {
  BEFORE_REGISTRATION: -1,
  REGISTRATION: 0,
  WRITING: 1,
  BUFFER_BEFORE_SUBMISSION: 1.5,
  SUBMISSION: 2,
  ADMIN_REVIEW: 3,
  BUFFER_BEFORE_VOTING: 3.5,
  VOTING: 4,
  JURY_EVALUATION: 5,
  JURY_TIE_BREAKER: 5,
  WINNERS_ANNOUNCED: 6,
};

function computeTimelineState(
  itemIndex: number,
  currentStageIndex: number
): TimelineItemState {
  if (currentStageIndex > itemIndex) return "PAST";
  if (Math.floor(currentStageIndex) === itemIndex && currentStageIndex === itemIndex) {
    return "CURRENT";
  }
  // During a 48h buffer (1.5 or 3.5), previous stage is PAST and upcoming stage is UPCOMING
  return "UPCOMING";
}

/**
 * Builds the 7-stage visual timeline for the participant header:
 * - Past stages: `PAST` (rendered crossed out)
 * - Active stage: `CURRENT` (rendered bold)
 * - Future stages: `UPCOMING` (rendered muted)
 */
export function buildContestTimeline(
  edition: EditionStageSnapshot,
  nowIso: Date | string = new Date()
): ContestTimelineItem[] {
  const currentStage = resolveCurrentContestStage(edition, nowIso);
  const currentIdx = STAGE_INDEX_MAP[currentStage];

  const shortDate = (iso: string) =>
    formatCaracasDateTime(iso, { includeTimezoneLabel: false });

  return [
    {
      id: "registration",
      label: "Inscripciones",
      dateRangeLabel: `${shortDate(edition.registrationStartAt)} a ${shortDate(edition.registrationEndAt)}`,
      state: computeTimelineState(0, currentIdx),
    },
    {
      id: "writing",
      label: "Envío de cuentos",
      dateRangeLabel: `${shortDate(edition.writingStartAt)} a ${shortDate(edition.writingEndAt)}`,
      state: computeTimelineState(1, currentIdx),
    },
    {
      id: "submission",
      label: "Postulación y edición",
      dateRangeLabel: `${shortDate(edition.submissionStartAt)} a ${shortDate(edition.submissionEndAt)}`,
      state: computeTimelineState(2, currentIdx),
    },
    {
      id: "admin-review",
      label: "Revisión de administradores",
      dateRangeLabel: `${shortDate(edition.adminReviewStartAt)} a ${shortDate(edition.adminReviewEndAt)}`,
      state: computeTimelineState(3, currentIdx),
    },
    {
      id: "voting",
      label: "Votaciones",
      dateRangeLabel: `${shortDate(edition.votingStartAt)} a ${shortDate(edition.votingEndAt)}`,
      state: computeTimelineState(4, currentIdx),
    },
    {
      id: "jury",
      label:
        currentStage === "JURY_TIE_BREAKER"
          ? "Evaluación del jurado (Desempate)"
          : "Evaluación del jurado",
      dateRangeLabel: `${shortDate(edition.juryStartAt)} a ${shortDate(edition.juryEndAt)}`,
      state: computeTimelineState(5, currentIdx),
    },
    {
      id: "winners",
      label: "Anuncio de ganadores",
      dateRangeLabel: edition.winnersAnnounced
        ? "Resultados publicados"
        : "Al concluir la evaluación del jurado",
      state: computeTimelineState(6, currentIdx),
    },
  ];
}

/**
 * Resolves the human-readable Spanish status badge for a logged-in participant.
 */
export function resolveParticipantStatusLabel(
  stage: ContestStageKey,
  enrollment: ParticipantEnrollmentSnapshot | null
): string {
  if (stage === "WINNERS_ANNOUNCED") {
    return "Concurso finalizado";
  }

  if (!enrollment) {
    return "No inscrito";
  }

  if (enrollment.status === "DISQUALIFIED") {
    return "Descalificado";
  }

  if (enrollment.hasVoted) {
    return "Votación enviada";
  }

  if (enrollment.inCorrectionWindow) {
    return "Revisión solicitada (24h)";
  }

  if (stage === "ADMIN_REVIEW") {
    return "En revisión por los administradores";
  }

  if (stage === "BUFFER_BEFORE_VOTING" && enrollment.postulatedAt) {
    return "Esperando votaciones";
  }

  if (enrollment.postulatedAt) {
    return "Cuento postulado";
  }

  if (enrollment.selectedStoryId) {
    return "Editando cuento a postular";
  }

  return "Participando";
}

/**
 * Enforces the non-enrolled user restriction:
 * Once Stage 1 (Registration) closes, a registered user who is NOT enrolled
 * can only view/edit their profile and cannot access participant contest screens.
 */
export function canUserAccessContestWorkspace(
  stage: ContestStageKey,
  isEnrolled: boolean
): boolean {
  if (isEnrolled) {
    return true;
  }
  return stage === "REGISTRATION" || stage === "BEFORE_REGISTRATION";
}
