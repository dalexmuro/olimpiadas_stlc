/**
 * Contest Edition Configuration, Parameter Validation & Strict 48h Buffer Calendar Validator
 * Step 2.3: /admin/ediciones (SUPERADMIN)
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { DEFAULT_JURY_BRACKETS_JSON, editions } from "@/db/schema";
import {
  caracasLocalToUtcIso,
  hasMinimumHoursGap,
  parseUtcMs,
} from "./timezone";

export const MANDATORY_STAGE_BUFFER_HOURS = 48 as const;

export interface JuryBracket {
  min: number;
  max: number;
  k: number;
}

export interface JuryMultiplierFormula {
  mode: "formula";
  /** Number of active participants per tier (e.g. 50 => 1–50, 51–100, 101–150...) */
  stepSize: number;
  /** Base multiplier increment per tier (e.g. 5 => 5x, 10x, 15x, 20x...) */
  baseMultiplier: number;
}

export type JuryMultiplierConfig =
  | JuryMultiplierFormula
  | readonly JuryBracket[];

export const DEFAULT_JURY_MULTIPLIER_FORMULA: Readonly<JuryMultiplierFormula> = {
  mode: "formula",
  stepSize: 50,
  baseMultiplier: 5,
} as const;

export const DEFAULT_JURY_BRACKETS: readonly JuryBracket[] = JSON.parse(
  DEFAULT_JURY_BRACKETS_JSON
) as JuryBracket[];

export function isJuryMultiplierFormula(
  value: unknown
): value is JuryMultiplierFormula {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<JuryMultiplierFormula>;
  return (
    candidate.mode === "formula" &&
    typeof candidate.stepSize === "number" &&
    typeof candidate.baseMultiplier === "number"
  );
}

/**
 * Calculates the automatic Jury point multiplier (K) using a linear step formula:
 * `K = (Math.floor((Math.max(1, x) - 1) / stepSize) + 1) * baseMultiplier`
 * Default (stepSize=50, baseMultiplier=5): 1–50 => 5x, 51–100 => 10x, 101–150 => 15x, ...
 */
export function calculateFormulaJuryMultiplier(
  activeParticipantsCount: number,
  formula: Pick<JuryMultiplierFormula, "stepSize" | "baseMultiplier"> = DEFAULT_JURY_MULTIPLIER_FORMULA
): { multiplier: number; first: number; second: number; third: number } {
  const safeCount = Math.max(0, Math.floor(activeParticipantsCount));
  const safeStep = Math.max(1, Math.floor(formula.stepSize));
  const safeBase = Math.max(1, Math.floor(formula.baseMultiplier));
  const tierIndex =
    safeCount <= 0 ? 0 : Math.floor((safeCount - 1) / safeStep);
  const multiplier = (tierIndex + 1) * safeBase;

  return {
    multiplier,
    first: 3 * multiplier,
    second: 2 * multiplier,
    third: 1 * multiplier,
  };
}

/**
 * Builds read-only preview rows illustrating how a formula scales across the first N tiers.
 */
export function buildJuryFormulaPreviewBrackets(
  formula: Pick<JuryMultiplierFormula, "stepSize" | "baseMultiplier"> = DEFAULT_JURY_MULTIPLIER_FORMULA,
  tiersCount: number = 4
): JuryBracket[] {
  const safeStep = Math.max(1, Math.floor(formula.stepSize));
  const safeBase = Math.max(1, Math.floor(formula.baseMultiplier));
  return Array.from({ length: tiersCount }, (_, idx) => ({
    min: idx * safeStep + 1,
    max: (idx + 1) * safeStep,
    k: (idx + 1) * safeBase,
  }));
}

export interface EditionScheduleUtc {
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
}

export interface EditionConfigInput extends EditionScheduleUtc {
  id?: string;
  title: string;
  slug: string;
  isActive?: boolean;
  minChars: number;
  maxChars: number;
  maxAllowedMisses: number;
  minSimilarityPct: number;
  juryFormula?: JuryMultiplierFormula;
  juryBrackets?: JuryBracket[];
}

export interface EditionValidationResult {
  valid: boolean;
  errors: string[];
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates strict sequential stage ordering with zero overlaps and both mandatory 48-hour buffers:
 * - Buffer 1: submissionStartAt >= writingEndAt + 48h
 * - Buffer 2: votingStartAt >= adminReviewEndAt + 48h
 */
export function validateEditionSchedule(
  schedule: EditionScheduleUtc
): EditionValidationResult {
  const errors: string[] = [];

  const requiredFields: Array<[keyof EditionScheduleUtc, string]> = [
    ["registrationStartAt", "Inicio de Inscripciones"],
    ["registrationEndAt", "Fin de Inscripciones"],
    ["writingStartAt", "Inicio de Envío de cuentos"],
    ["writingEndAt", "Fin de Envío de cuentos"],
    ["submissionStartAt", "Inicio de Postulación y Edición"],
    ["submissionEndAt", "Fin de Postulación y Edición"],
    ["adminReviewStartAt", "Inicio de Revisión por Administradores"],
    ["adminReviewEndAt", "Fin de Revisión por Administradores"],
    ["votingStartAt", "Inicio de Votaciones"],
    ["votingEndAt", "Fin de Votaciones"],
    ["juryStartAt", "Inicio de Evaluación del Jurado"],
    ["juryEndAt", "Fin de Evaluación del Jurado"],
  ];

  const timestamps: Partial<Record<keyof EditionScheduleUtc, number>> = {};
  for (const [key, label] of requiredFields) {
    try {
      timestamps[key] = parseUtcMs(schedule[key]);
    } catch {
      errors.push(`La fecha de "${label}" no es válida.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const ts = timestamps as Record<keyof EditionScheduleUtc, number>;

  if (ts.registrationStartAt >= ts.registrationEndAt) {
    errors.push(
      "El inicio de Inscripciones debe ser anterior al cierre de Inscripciones."
    );
  }
  if (ts.writingStartAt < ts.registrationEndAt) {
    errors.push(
      "El inicio de Envío de cuentos no puede solaparse con las Inscripciones."
    );
  }
  if (ts.writingStartAt >= ts.writingEndAt) {
    errors.push(
      "El inicio de Envío de cuentos debe ser anterior al cierre de la última consigna."
    );
  }
  if (
    !hasMinimumHoursGap(
      schedule.writingEndAt,
      schedule.submissionStartAt,
      MANDATORY_STAGE_BUFFER_HOURS
    )
  ) {
    errors.push(
      "Debe existir un margen mínimo obligatorio de 48 horas entre el cierre de Envío de cuentos y el inicio de Postulación y Edición."
    );
  }
  if (ts.submissionStartAt >= ts.submissionEndAt) {
    errors.push(
      "El inicio de Postulación y Edición debe ser anterior a su cierre."
    );
  }
  if (ts.adminReviewStartAt < ts.submissionEndAt) {
    errors.push(
      "La Revisión por Administradores debe iniciar después de cerrar Postulación y Edición."
    );
  }
  if (ts.adminReviewStartAt >= ts.adminReviewEndAt) {
    errors.push(
      "El inicio de Revisión por Administradores debe ser anterior a su cierre."
    );
  }
  if (
    !hasMinimumHoursGap(
      schedule.adminReviewEndAt,
      schedule.votingStartAt,
      MANDATORY_STAGE_BUFFER_HOURS
    )
  ) {
    errors.push(
      "Debe existir un margen mínimo obligatorio de 48 horas entre el fin de Revisión por Administradores y el inicio de Votaciones."
    );
  }
  if (ts.votingStartAt >= ts.votingEndAt) {
    errors.push("El inicio de Votaciones debe ser anterior a su cierre.");
  }
  if (ts.juryStartAt < ts.votingEndAt) {
    errors.push(
      "La Evaluación del Jurado debe iniciar después de cerrar las Votaciones de participantes."
    );
  }
  if (ts.juryStartAt >= ts.juryEndAt) {
    errors.push(
      "El inicio de Evaluación del Jurado debe ser anterior a su cierre."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates edition metadata, character limits, misses limit, similarity percentage, and jury brackets.
 */
export function validateEditionParameters(
  input: EditionConfigInput
): EditionValidationResult {
  const errors: string[] = [];

  if (!input.title.trim()) {
    errors.push("El título de la edición es obligatorio.");
  }

  const normalizedSlug = input.slug.trim().toLowerCase();
  if (!normalizedSlug || !SLUG_REGEX.test(normalizedSlug)) {
    errors.push(
      "El identificador (slug) debe contener solo letras minúsculas, números o guiones (ej. 2026)."
    );
  }

  if (!Number.isInteger(input.minChars) || input.minChars < 10) {
    errors.push("El mínimo de caracteres debe ser un entero de al menos 10.");
  }
  if (!Number.isInteger(input.maxChars) || input.maxChars <= input.minChars) {
    errors.push(
      "El máximo de caracteres debe ser mayor que el mínimo de caracteres."
    );
  }
  if (
    !Number.isInteger(input.maxAllowedMisses) ||
    input.maxAllowedMisses < 0
  ) {
    errors.push("El máximo de fallas permitidas debe ser 0 o mayor.");
  }
  if (
    !Number.isInteger(input.minSimilarityPct) ||
    input.minSimilarityPct < 1 ||
    input.minSimilarityPct > 100
  ) {
    errors.push(
      "El porcentaje mínimo de similitud debe estar entre 1 y 100."
    );
  }

  if (input.juryFormula) {
    if (
      !Number.isInteger(input.juryFormula.stepSize) ||
      input.juryFormula.stepSize < 1
    ) {
      errors.push(
        "La cantidad de participantes por escalón del jurado debe ser un entero mayor o igual a 1."
      );
    }
    if (
      !Number.isInteger(input.juryFormula.baseMultiplier) ||
      input.juryFormula.baseMultiplier < 1
    ) {
      errors.push(
        "El incremento del multiplicador del jurado debe ser un entero mayor o igual a 1."
      );
    }
  } else if (!Array.isArray(input.juryBrackets) || input.juryBrackets.length === 0) {
    errors.push("Debe configurarse la fórmula o al menos un tramo de puntaje para el jurado.");
  } else {
    const sorted = [...input.juryBrackets].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (b.min < 0 || b.max < b.min || !Number.isInteger(b.k) || b.k < 1) {
        errors.push(
          `El tramo de jurado #${i + 1} tiene valores inválidos (min <= max y k >= 1).`
        );
      }
      if (i > 0 && b.min <= sorted[i - 1].max) {
        errors.push(
          `Los tramos de puntaje del jurado no pueden solaparse (tramo #${i + 1}).`
        );
      }
    }
  }

  const scheduleCheck = validateEditionSchedule(input);
  errors.push(...scheduleCheck.errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Resolves the automatic Jury point multiplier (K) and podium weights (3K, 2K, 1K)
 * for a given number of active participants reaching the voting stage.
 * Supports both the parametric step formula (default: +5x every 50 participants)
 * and legacy explicit bracket arrays stored on older editions.
 */
export function resolveJuryMultiplier(
  activeParticipantsCount: number,
  config: JuryMultiplierConfig = DEFAULT_JURY_MULTIPLIER_FORMULA
): { multiplier: number; first: number; second: number; third: number } {
  if (isJuryMultiplierFormula(config)) {
    return calculateFormulaJuryMultiplier(activeParticipantsCount, config);
  }

  const safeCount = Math.max(0, Math.floor(activeParticipantsCount));
  const sorted = [...config].sort((a, b) => a.min - b.min);
  const matched =
    sorted.find((b) => safeCount >= b.min && safeCount <= b.max) ??
    sorted[sorted.length - 1] ?? { min: 0, max: 99999, k: 5 };

  return {
    multiplier: matched.k,
    first: 3 * matched.k,
    second: 2 * matched.k,
    third: 1 * matched.k,
  };
}

/**
 * Converts a full set of Caracas local form datetime strings (`YYYY-MM-DDTHH:mm`)
 * into UTC ISO timestamps for storage and validation.
 */
export function convertCaracasScheduleFormToUtc(
  caracasForm: EditionScheduleUtc
): EditionScheduleUtc {
  return {
    registrationStartAt: caracasLocalToUtcIso(caracasForm.registrationStartAt),
    registrationEndAt: caracasLocalToUtcIso(caracasForm.registrationEndAt),
    writingStartAt: caracasLocalToUtcIso(caracasForm.writingStartAt),
    writingEndAt: caracasLocalToUtcIso(caracasForm.writingEndAt),
    submissionStartAt: caracasLocalToUtcIso(caracasForm.submissionStartAt),
    submissionEndAt: caracasLocalToUtcIso(caracasForm.submissionEndAt),
    adminReviewStartAt: caracasLocalToUtcIso(caracasForm.adminReviewStartAt),
    adminReviewEndAt: caracasLocalToUtcIso(caracasForm.adminReviewEndAt),
    votingStartAt: caracasLocalToUtcIso(caracasForm.votingStartAt),
    votingEndAt: caracasLocalToUtcIso(caracasForm.votingEndAt),
    juryStartAt: caracasLocalToUtcIso(caracasForm.juryStartAt),
    juryEndAt: caracasLocalToUtcIso(caracasForm.juryEndAt),
  };
}

export interface SaveEditionResult {
  saved: boolean;
  editionId?: string;
  errors?: string[];
}

/**
 * Creates a new contest edition in Cloudflare D1 after running full parameter & 48h buffer validation.
 * If `isActive` is true, deactivates other editions so only one edition is active at a time.
 */
export async function createEditionInDb(
  db: AppDatabase,
  input: EditionConfigInput,
  nowIso: string = new Date().toISOString()
): Promise<SaveEditionResult> {
  const validation = validateEditionParameters(input);
  if (!validation.valid) {
    return {
      saved: false,
      errors: validation.errors,
    };
  }

  const cleanSlug = input.slug.trim().toLowerCase();
  const editionId = input.id?.trim() || `edition_${cleanSlug}_${Date.now()}`;
  const shouldActivate = Boolean(input.isActive);

  if (shouldActivate) {
    await db
      .update(editions)
      .set({ isActive: false, updatedAt: nowIso })
      .where(eq(editions.isActive, true));
  }

  await db.insert(editions).values({
    id: editionId,
    title: input.title.trim(),
    slug: cleanSlug,
    isActive: shouldActivate,
    minChars: input.minChars,
    maxChars: input.maxChars,
    maxAllowedMisses: input.maxAllowedMisses,
    minSimilarityPct: input.minSimilarityPct,
    juryBracketsJson: JSON.stringify(
      input.juryFormula ?? input.juryBrackets ?? DEFAULT_JURY_MULTIPLIER_FORMULA
    ),
    promptPackageStatus: "DRAFT",
    registrationStartAt: input.registrationStartAt,
    registrationEndAt: input.registrationEndAt,
    writingStartAt: input.writingStartAt,
    writingEndAt: input.writingEndAt,
    submissionStartAt: input.submissionStartAt,
    submissionEndAt: input.submissionEndAt,
    adminReviewStartAt: input.adminReviewStartAt,
    adminReviewEndAt: input.adminReviewEndAt,
    votingStartAt: input.votingStartAt,
    votingEndAt: input.votingEndAt,
    juryStartAt: input.juryStartAt,
    juryEndAt: input.juryEndAt,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return {
    saved: true,
    editionId,
  };
}

/**
 * Activates a single edition in D1, ensuring all other editions are deactivated.
 */
export async function activateEditionInDb(
  db: AppDatabase,
  editionId: string,
  nowIso: string = new Date().toISOString()
): Promise<{ activated: boolean }> {
  await db
    .update(editions)
    .set({ isActive: false, updatedAt: nowIso })
    .where(eq(editions.isActive, true));

  await db
    .update(editions)
    .set({ isActive: true, updatedAt: nowIso })
    .where(eq(editions.id, editionId));

  return { activated: true };
}
