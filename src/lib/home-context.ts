/**
 * Homepage Live Status & Role-Aware CTA Helpers
 * Connects the public landing page to the active edition stage and authenticated user role.
 */

import type { UserRole } from "@/db/schema";
import { APP_BRAND } from "./app-metadata";
import {
  resolveCurrentContestStage,
  type ContestStageKey,
  type EditionStageSnapshot,
} from "./contest-stage";

export interface HomeEditionStatus {
  editionTitle: string;
  stageLabel: string;
  timezoneHint: string;
  isActive: boolean;
}

export interface HomeClosingCta {
  heading: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string | null;
  secondaryHref: string | null;
}

const STAGE_PUBLIC_LABELS: Record<ContestStageKey, string> = {
  BEFORE_REGISTRATION: "Inscripciones próximamente",
  REGISTRATION: "Inscripciones abiertas",
  WRITING: "Primera Etapa: Escritura en curso",
  BUFFER_BEFORE_SUBMISSION: "Preparando postulaciones",
  SUBMISSION: "Segunda Etapa: Postulación y edición",
  ADMIN_REVIEW: "Revisión editorial en curso",
  BUFFER_BEFORE_VOTING: "Preparando votaciones",
  VOTING: "Tercera Etapa: Votaciones abiertas",
  JURY_EVALUATION: "Evaluación del jurado en curso",
  JURY_TIE_BREAKER: "Desempate del jurado en curso",
  WINNERS_ANNOUNCED: "Ganadores publicados",
};

/**
 * Formats the live edition status pill displayed on the public homepage.
 */
export function formatHomeStageStatus(
  edition: EditionStageSnapshot | null,
  now: Date | string = new Date()
): HomeEditionStatus {
  const timezoneHint = `Hora oficial Caracas (${APP_BRAND.officialUtcOffset})`;

  if (!edition) {
    return {
      editionTitle: APP_BRAND.clubName,
      stageLabel: "¡Prepárate! La próxima edición se anuncia muy pronto",
      timezoneHint,
      isActive: false,
    };
  }

  const stage = resolveCurrentContestStage(edition, now);
  return {
    editionTitle: edition.title,
    stageLabel: STAGE_PUBLIC_LABELS[stage],
    timezoneHint,
    isActive: true,
  };
}

/**
 * Resolves role-aware closing CTA copy and destination for the homepage.
 */
export function resolveHomeClosingCta(
  userRole?: UserRole | null
): HomeClosingCta {
  if (userRole === "ADMIN" || userRole === "SUPERADMIN") {
    return {
      heading: "¿Listo para gestionar la edición?",
      description:
        "Accede al panel de administración para revisar consignas, cuentos y estadísticas en tiempo real.",
      primaryLabel: "Ir al panel admin",
      primaryHref: "/admin",
      secondaryLabel: "Ver bases del concurso",
      secondaryHref: "/bases-del-concurso",
    };
  }

  if (userRole === "JURY") {
    return {
      heading: "Tu mesa de lectura está lista",
      description:
        "Ingresa al espacio del jurado para leer los cuentos finalistas y emitir tu veredicto.",
      primaryLabel: "Ir a evaluación del jurado",
      primaryHref: "/jurado",
      secondaryLabel: "Ver bases del concurso",
      secondaryHref: "/bases-del-concurso",
    };
  }

  if (userRole === "PARTICIPANT") {
    return {
      heading: "¿Listo para continuar tu historia?",
      description:
        "Entra al espacio del concurso para revisar las consignas, tu estado de inscripción y tus cuentos.",
      primaryLabel: "Ir al concurso",
      primaryHref: "/concurso",
      secondaryLabel: "Ver bases del concurso",
      secondaryHref: "/bases-del-concurso",
    };
  }

  return {
    heading: "¿Listo para escribir tu próxima historia?",
    description:
      "Anímate a escribir en comunidad: crea tu cuenta permanente y vive la próxima edición desde el primer día.",
    primaryLabel: "Crear mi cuenta",
    primaryHref: "/registro",
    secondaryLabel: "Leer bases del concurso",
    secondaryHref: "/bases-del-concurso",
  };
}
