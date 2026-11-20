/**
 * Edition Prompt Package & Admin Majority Validation Service
 * Step 2.5: Assign/return prompts from Prompt Bank, validate non-overlapping prompt schedule,
 * send E25 validation request, evaluate admin majority, and allow Superadmin overrides at any time.
 */

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  auditLogs,
  editionPackageVotes,
  editionPrompts,
  editions,
  promptBank,
  users,
  type MediaType,
} from "@/db/schema";
import { dispatchTemplateEmail } from "./email";
import { validatePromptBankInput } from "./prompt-bank";
import { addHoursToUtcIso, parseUtcMs } from "./timezone";

export interface ScheduledPromptSlot {
  promptNumber: number;
  publishedAt: string;
  closesAt: string;
}

export interface PromptScheduleValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that all scheduled prompts for an edition:
 * - Have strictly positive, non-duplicate prompt numbers
 * - Have `publishedAt < closesAt`
 * - Do not overlap (`Prompt[i].closesAt <= Prompt[i+1].publishedAt`)
 * - Fit within `[writingStartAt, writingEndAt]` if an edition window is supplied.
 */
export function validateEditionPromptsSchedule(
  slots: readonly ScheduledPromptSlot[],
  editionWindow?: { writingStartAt: string; writingEndAt: string }
): PromptScheduleValidationResult {
  const errors: string[] = [];

  if (slots.length === 0) {
    return {
      valid: false,
      errors: ["La edición debe tener al menos una consigna programada."],
    };
  }

  const seenNumbers = new Set<number>();
  const sorted = [...slots].sort((a, b) => a.promptNumber - b.promptNumber);

  const windowStartMs = editionWindow
    ? parseUtcMs(editionWindow.writingStartAt)
    : null;
  const windowEndMs = editionWindow
    ? parseUtcMs(editionWindow.writingEndAt)
    : null;

  for (let i = 0; i < sorted.length; i++) {
    const slot = sorted[i];
    if (!Number.isInteger(slot.promptNumber) || slot.promptNumber < 1) {
      errors.push(`Número de consigna inválido: ${slot.promptNumber}.`);
    }
    if (seenNumbers.has(slot.promptNumber)) {
      errors.push(
        `El número de consigna #${slot.promptNumber} está duplicado.`
      );
    }
    seenNumbers.add(slot.promptNumber);

    const startMs = parseUtcMs(slot.publishedAt);
    const endMs = parseUtcMs(slot.closesAt);

    if (startMs >= endMs) {
      errors.push(
        `La Consigna #${slot.promptNumber} debe abrir antes de su hora de cierre.`
      );
    }

    if (windowStartMs !== null && startMs < windowStartMs) {
      errors.push(
        `La Consigna #${slot.promptNumber} abre antes del inicio de la etapa de envío de cuentos.`
      );
    }

    if (windowEndMs !== null && endMs > windowEndMs) {
      errors.push(
        `La Consigna #${slot.promptNumber} cierra después del fin de la etapa de envío de cuentos.`
      );
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      const prevEndMs = parseUtcMs(prev.closesAt);
      if (startMs < prevEndMs) {
        errors.push(
          `La Consigna #${slot.promptNumber} se solapa con la Consigna #${prev.promptNumber}. Una consigna debe cerrar antes de que abra la siguiente.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface PackageMajorityStatus {
  approvals: number;
  rejections: number;
  totalAdmins: number;
  majorityThreshold: number;
  isAccepted: boolean;
}

/**
 * Evaluates simple majority approval among all users with role `ADMIN`.
 */
export function evaluatePackageMajority(
  votes: ReadonlyArray<{ approved: boolean }>,
  totalAdmins: number
): PackageMajorityStatus {
  const safeTotal = Math.max(0, Math.floor(totalAdmins));
  const approvals = votes.filter((v) => v.approved).length;
  const rejections = votes.filter((v) => !v.approved).length;
  const majorityThreshold = safeTotal > 0 ? Math.floor(safeTotal / 2) + 1 : 1;

  return {
    approvals,
    rejections,
    totalAdmins: safeTotal,
    majorityThreshold,
    isAccepted: safeTotal > 0 && approvals >= majorityThreshold,
  };
}

/**
 * Assigns an `AVAILABLE` prompt from the Prompt Bank into the edition schedule,
 * transitioning its bank status to `ASSIGNED_TO_EDITION`.
 */
export async function assignPromptFromBankToEdition(
  db: AppDatabase,
  options: {
    editionId: string;
    promptBankId: string;
    promptNumber: number;
    publishedAtUtc: string;
    durationHours: number;
    editedTitle?: string;
    editedBody?: string;
    editionPromptId?: string;
    nowIso?: string;
  }
): Promise<{ assigned: boolean; editionPromptId?: string; error?: string }> {
  if (options.durationHours <= 0) {
    return {
      assigned: false,
      error: "La duración abierta de la consigna debe ser mayor a 0 horas.",
    };
  }

  const bankRows = await db
    .select()
    .from(promptBank)
    .where(eq(promptBank.id, options.promptBankId));
  const bankItem = bankRows[0];

  if (!bankItem) {
    return { assigned: false, error: "Consigna no encontrada en el banco." };
  }

  if (bankItem.status !== "AVAILABLE") {
    return {
      assigned: false,
      error: "Esta consigna ya no está disponible en el banco.",
    };
  }

  const finalTitle = (options.editedTitle ?? bankItem.title).trim();
  const finalBody = (options.editedBody ?? bankItem.body).trim();
  const closesAtUtc = addHoursToUtcIso(
    options.publishedAtUtc,
    options.durationHours
  );

  const existingPrompts = await db
    .select()
    .from(editionPrompts)
    .where(eq(editionPrompts.editionId, options.editionId));

  const candidateSlots: ScheduledPromptSlot[] = [
    ...existingPrompts.map((p) => ({
      promptNumber: p.promptNumber,
      publishedAt: p.publishedAt,
      closesAt: p.closesAt,
    })),
    {
      promptNumber: options.promptNumber,
      publishedAt: options.publishedAtUtc,
      closesAt: closesAtUtc,
    },
  ];

  const scheduleCheck = validateEditionPromptsSchedule(candidateSlots);
  if (!scheduleCheck.valid) {
    return { assigned: false, error: scheduleCheck.errors[0] };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const editionPromptId =
    options.editionPromptId ?? `ep_${options.editionId}_${options.promptNumber}_${Date.now()}`;

  await db.insert(editionPrompts).values({
    id: editionPromptId,
    editionId: options.editionId,
    sourcePromptBankId: bankItem.id,
    promptNumber: options.promptNumber,
    title: finalTitle,
    body: finalBody,
    mediaType: bankItem.mediaType,
    mediaUrl: bankItem.mediaUrl,
    publishedAt: options.publishedAtUtc,
    closesAt: closesAtUtc,
    closesProcessed: false,
  });

  await db
    .update(promptBank)
    .set({
      status: "ASSIGNED_TO_EDITION",
      assignedEditionId: options.editionId,
      updatedAt: nowIso,
    })
    .where(eq(promptBank.id, bankItem.id));

  return { assigned: true, editionPromptId };
}

/**
 * Removes an unpublished prompt from the edition proposal and returns it to the Prompt Bank (`AVAILABLE`).
 */
export async function removePromptFromEditionToBank(
  db: AppDatabase,
  options: {
    editionPromptId: string;
    nowIso?: string;
  }
): Promise<{ removed: boolean; returnedToBank: boolean; error?: string }> {
  const rows = await db
    .select()
    .from(editionPrompts)
    .where(eq(editionPrompts.id, options.editionPromptId));
  const promptRow = rows[0];

  if (!promptRow) {
    return {
      removed: false,
      returnedToBank: false,
      error: "Consigna de la edición no encontrada.",
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  if (parseUtcMs(nowIso) >= parseUtcMs(promptRow.publishedAt)) {
    return {
      removed: false,
      returnedToBank: false,
      error:
        "No se puede devolver al banco una consigna que ya fue publicada en la edición.",
    };
  }

  await db
    .delete(editionPrompts)
    .where(eq(editionPrompts.id, options.editionPromptId));

  let returnedToBank = false;
  if (promptRow.sourcePromptBankId) {
    await db
      .update(promptBank)
      .set({
        status: "AVAILABLE",
        assignedEditionId: null,
        updatedAt: nowIso,
      })
      .where(eq(promptBank.id, promptRow.sourcePromptBankId));
    returnedToBank = true;
  }

  return { removed: true, returnedToBank };
}

/**
 * Superadmin Override: Modifies any edition prompt's content or schedule at any time
 * (even after the contest has started) and logs `PROMPT_OVERRIDE` in `audit_logs`.
 */
export async function superadminOverrideEditionPrompt(
  db: AppDatabase,
  options: {
    editionPromptId: string;
    superadminId: string;
    title: string;
    body: string;
    mediaType?: MediaType | null;
    mediaUrl?: string | null;
    publishedAtUtc?: string;
    closesAtUtc?: string;
    justification: string;
    nowIso?: string;
  }
): Promise<{ updated: boolean; error?: string }> {
  if (!options.justification.trim()) {
    return {
      updated: false,
      error: "Debes escribir una justificación para modificar una consigna oficial.",
    };
  }

  const validation = validatePromptBankInput({
    title: options.title,
    body: options.body,
    mediaType: options.mediaType,
    mediaUrl: options.mediaUrl,
  });
  if (!validation.valid) {
    return { updated: false, error: validation.error };
  }

  const rows = await db
    .select()
    .from(editionPrompts)
    .where(eq(editionPrompts.id, options.editionPromptId));
  const existing = rows[0];
  if (!existing) {
    return { updated: false, error: "Consigna oficial no encontrada." };
  }

  const nextPublishedAt = options.publishedAtUtc ?? existing.publishedAt;
  const nextClosesAt = options.closesAtUtc ?? existing.closesAt;
  if (parseUtcMs(nextPublishedAt) >= parseUtcMs(nextClosesAt)) {
    return {
      updated: false,
      error: "La fecha de apertura debe ser anterior a la fecha de cierre.",
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();

  await db
    .update(editionPrompts)
    .set({
      title: options.title.trim(),
      body: options.body.trim(),
      mediaType: options.mediaType ?? null,
      mediaUrl: validation.normalizedMediaUrl,
      publishedAt: nextPublishedAt,
      closesAt: nextClosesAt,
    })
    .where(eq(editionPrompts.id, options.editionPromptId));

  await db.insert(auditLogs).values({
    id: `audit_prompt_override_${options.editionPromptId}_${Date.now()}`,
    editionId: existing.editionId,
    actorId: options.superadminId,
    actionType: "PROMPT_OVERRIDE",
    targetUserId: null,
    targetStoryId: null,
    justification: options.justification.trim(),
    metadataJson: JSON.stringify({
      editionPromptId: options.editionPromptId,
      promptNumber: existing.promptNumber,
    }),
    createdAt: nowIso,
  });

  return { updated: true };
}

/**
 * Submits the edition's assembled prompt package for Administrator majority validation
 * and dispatches email `E25` to every user with role `ADMIN`.
 */
export async function submitPromptPackageForValidation(
  db: AppDatabase,
  options: {
    editionId: string;
    editionTitle: string;
    baseUrl: string;
    brevoApiKey?: string;
    dryRunEmails?: boolean;
    nowIso?: string;
  }
): Promise<{ submitted: boolean; notifiedAdmins: number; error?: string }> {
  const prompts = await db
    .select()
    .from(editionPrompts)
    .where(eq(editionPrompts.editionId, options.editionId));

  if (prompts.length === 0) {
    return {
      submitted: false,
      notifiedAdmins: 0,
      error: "Agrega al menos una consigna a la edición antes de enviar a validación.",
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();

  await db
    .delete(editionPackageVotes)
    .where(eq(editionPackageVotes.editionId, options.editionId));

  await db
    .update(editions)
    .set({
      promptPackageStatus: "PENDING_VALIDATION",
      updatedAt: nowIso,
    })
    .where(eq(editions.id, options.editionId));

  const admins = await db
    .select()
    .from(users)
    .where(eq(users.role, "ADMIN"));

  let notifiedAdmins = 0;
  for (const admin of admins) {
    const dispatchRes = await dispatchTemplateEmail({
      db,
      templateCode: "E25",
      recipientUserId: admin.id,
      recipientEmail: admin.email,
      recipientName: admin.firstName ?? admin.name ?? admin.email,
      contextKey: `package_validation:${options.editionId}:${nowIso}`,
      editionId: options.editionId,
      variables: {
        NOMBRE: admin.firstName ?? admin.name ?? "Administrador",
        EDICION: options.editionTitle,
        LINK_PLATAFORMA: `${options.baseUrl}/admin/consignas-edicion`,
      },
      apiKey: options.brevoApiKey,
      dryRun: options.dryRunEmails,
      nowIso,
    });
    if (dispatchRes.dispatched) {
      notifiedAdmins += 1;
    }
  }

  return { submitted: true, notifiedAdmins };
}

/**
 * Records an Administrator's validation vote on the edition's prompt package
 * and promotes `promptPackageStatus` to `ACCEPTED` once a simple majority approves.
 */
export async function voteEditionPromptPackage(
  db: AppDatabase,
  options: {
    editionId: string;
    adminId: string;
    approved: boolean;
    nowIso?: string;
  }
): Promise<{ voted: boolean; majority: PackageMajorityStatus }> {
  const nowIso = options.nowIso ?? new Date().toISOString();

  const existing = await db
    .select()
    .from(editionPackageVotes)
    .where(
      and(
        eq(editionPackageVotes.editionId, options.editionId),
        eq(editionPackageVotes.adminId, options.adminId)
      )
    );

  if (existing.length > 0) {
    await db
      .update(editionPackageVotes)
      .set({ approved: options.approved, votedAt: nowIso })
      .where(
        and(
          eq(editionPackageVotes.editionId, options.editionId),
          eq(editionPackageVotes.adminId, options.adminId)
        )
      );
  } else {
    await db.insert(editionPackageVotes).values({
      id: `epv_${options.editionId}_${options.adminId}`,
      editionId: options.editionId,
      adminId: options.adminId,
      approved: options.approved,
      votedAt: nowIso,
    });
  }

  const [allVotes, allAdmins] = await Promise.all([
    db
      .select()
      .from(editionPackageVotes)
      .where(eq(editionPackageVotes.editionId, options.editionId)),
    db.select().from(users).where(eq(users.role, "ADMIN")),
  ]);

  const majority = evaluatePackageMajority(allVotes, allAdmins.length);

  if (majority.isAccepted) {
    await db
      .update(editions)
      .set({ promptPackageStatus: "ACCEPTED", updatedAt: nowIso })
      .where(eq(editions.id, options.editionId));
  }

  return { voted: true, majority };
}
