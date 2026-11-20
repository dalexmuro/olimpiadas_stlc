/**
 * Stage 1: Annual Contest Edition Registration & E03 Confirmation Email
 * Step 3.2: Eligibility validation, enrollments persistence, and automated E03 dispatch
 */

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { enrollments, type UserRole } from "@/db/schema";
import {
  resolveCurrentContestStage,
  type EditionStageSnapshot,
} from "./contest-stage";
import { dispatchTemplateEmail } from "./email";

export interface EnrollmentEligibilityInput {
  userRole: UserRole;
  profileCompleted: boolean;
  acceptedRules: boolean;
  alreadyEnrolled: boolean;
  edition: EditionStageSnapshot;
  nowIso?: string;
}

export interface EnrollmentEligibilityResult {
  eligible: boolean;
  error?: string;
}

/**
 * Validates whether a user can enroll in the active contest edition during Stage 1.
 * Enforces:
 * - Role exclusivity (only `PARTICIPANT` can enroll; `ADMIN`, `SUPERADMIN`, `JURY` cannot participate)
 * - Completed mandatory profile
 * - Active Stage 1 (`REGISTRATION`) window in `America/Caracas`
 * - Explicit acceptance of the Contest Rules (*Bases del Concurso*)
 * - Single enrollment per edition
 */
export function validateEnrollmentEligibility(
  input: EnrollmentEligibilityInput
): EnrollmentEligibilityResult {
  if (input.userRole !== "PARTICIPANT") {
    return {
      eligible: false,
      error:
        "Por transparencia, los administradores, superadministradores y miembros del jurado no pueden participar como concursantes.",
    };
  }

  if (!input.profileCompleted) {
    return {
      eligible: false,
      error:
        "Debes completar todos los datos obligatorios de tu perfil antes de inscribirte.",
    };
  }

  const stage = resolveCurrentContestStage(input.edition, input.nowIso);
  if (stage !== "REGISTRATION") {
    return {
      eligible: false,
      error:
        "El período de inscripciones para esta edición no está abierto en este momento.",
    };
  }

  if (input.alreadyEnrolled) {
    return {
      eligible: false,
      error: "Ya estás inscrito en esta edición del certamen.",
    };
  }

  if (!input.acceptedRules) {
    return {
      eligible: false,
      error:
        "Debes marcar la casilla aceptando las Bases del Concurso para inscribirte.",
    };
  }

  return { eligible: true };
}

export interface EnrollParticipantOptions {
  db: AppDatabase;
  editionId: string;
  edition: EditionStageSnapshot;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    role: UserRole;
    profileCompleted: boolean;
  };
  acceptedRules: boolean;
  baseUrl: string;
  brevoApiKey?: string;
  dryRunEmails?: boolean;
  nowIso?: string;
  enrollmentId?: string;
}

export interface EnrollParticipantResult {
  enrolled: boolean;
  enrollmentId?: string;
  emailSent: boolean;
  error?: string;
}

/**
 * Creates a participant enrollment in Cloudflare D1 `enrollments` and sends email `E03`.
 */
export async function enrollParticipantInEdition(
  options: EnrollParticipantOptions
): Promise<EnrollParticipantResult> {
  const existing = await options.db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.editionId, options.editionId),
        eq(enrollments.userId, options.user.id)
      )
    );

  const nowIso = options.nowIso ?? new Date().toISOString();

  const check = validateEnrollmentEligibility({
    userRole: options.user.role,
    profileCompleted: options.user.profileCompleted,
    acceptedRules: options.acceptedRules,
    alreadyEnrolled: existing.length > 0,
    edition: options.edition,
    nowIso,
  });

  if (!check.eligible) {
    return {
      enrolled: false,
      emailSent: false,
      error: check.error,
    };
  }

  const enrollmentId =
    options.enrollmentId ?? `enr_${options.editionId}_${options.user.id}`;

  await options.db.insert(enrollments).values({
    id: enrollmentId,
    editionId: options.editionId,
    userId: options.user.id,
    acceptedRules: true,
    status: "ACTIVE",
    disqualificationReason: null,
    disqualifiedAt: null,
    missesCount: 0,
    selectedStoryId: null,
    postulatedAt: null,
    inCorrectionWindow: false,
    correctionDeadlineAt: null,
    correctionSubmittedAt: null,
    hasVoted: false,
    votedAt: null,
    enrolledAt: nowIso,
  });

  const dispatchRes = await dispatchTemplateEmail({
    db: options.db,
    templateCode: "E03",
    recipientUserId: options.user.id,
    recipientEmail: options.user.email,
    recipientName: options.user.firstName ?? options.user.name ?? undefined,
    contextKey: `enrollment:${options.editionId}`,
    editionId: options.editionId,
    variables: {
      NOMBRE: options.user.firstName ?? options.user.name ?? "Participante",
      APELLIDO: options.user.lastName ?? "",
      EDICION: options.edition.title,
      LINK_PLATAFORMA: options.baseUrl,
    },
    apiKey: options.brevoApiKey,
    dryRun: options.dryRunEmails,
    nowIso,
  });

  return {
    enrolled: true,
    enrollmentId,
    emailSent: dispatchRes.dispatched,
  };
}
