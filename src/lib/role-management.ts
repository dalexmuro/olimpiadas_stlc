/**
 * Superadmin Role Management & Odd Jury Count Validation
 * Step 2.2: Assign/remove roles (PARTICIPANT, JURY, ADMIN, SUPERADMIN), enforce odd jury count warning, and log ROLE_CHANGE in audit_logs
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { auditLogs, USER_ROLES, users, type UserRole } from "@/db/schema";

export interface ManagedUserSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
  country: string | null;
  role: UserRole;
}

export interface JuryCountStatus {
  juryCount: number;
  isOdd: boolean;
  isValidForContest: boolean;
  message: string;
}

/**
 * Evaluates whether the current number of assigned `JURY` members is odd and > 0,
 * as required by the functional specification to guarantee automatic tie-breaking.
 */
export function evaluateJuryCountStatus(juryCount: number): JuryCountStatus {
  const safeCount = Math.max(0, Math.floor(juryCount));
  if (safeCount === 0) {
    return {
      juryCount: 0,
      isOdd: false,
      isValidForContest: false,
      message:
        "Aún no hay jurados asignados. Debes asignar un número impar de jurados (por ejemplo 3 o 5).",
    };
  }

  const isOdd = safeCount % 2 === 1;
  if (!isOdd) {
    return {
      juryCount: safeCount,
      isOdd: false,
      isValidForContest: false,
      message: `Actualmente hay ${safeCount} jurados (número par). El certamen requiere un número impar de jurados para garantizar desempates automáticos.`,
    };
  }

  return {
    juryCount: safeCount,
    isOdd: true,
    isValidForContest: true,
    message:
      safeCount === 1
        ? "Hay 1 jurado asignado (número impar válido)."
        : `Hay ${safeCount} jurados asignados (número impar válido).`,
  };
}

/**
 * Normalizes strings for accent-insensitive and case-insensitive search filtering.
 */
function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filters registered users by first name, last name, full name, email, or role.
 */
export function filterUsersByQuery(
  list: readonly ManagedUserSummary[],
  query: string
): ManagedUserSummary[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [...list];
  }

  return list.filter((u) => {
    const haystack = normalizeSearchText(
      `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.name ?? ""} ${u.email} ${u.role}`
    );
    return haystack.includes(normalizedQuery);
  });
}

export interface RoleChangeValidationInput {
  actorRole: UserRole | null | undefined;
  actorUserId: string;
  targetUserId: string;
  currentRole: UserRole;
  newRole: string;
  totalSuperadmins: number;
  justification: string;
}

export interface RoleChangeValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a role assignment request before modifying D1.
 */
export function validateRoleChangeRequest(
  input: RoleChangeValidationInput
): RoleChangeValidationResult {
  if (input.actorRole !== "SUPERADMIN") {
    return {
      valid: false,
      error: "Solo el superadministrador puede asignar o cambiar roles.",
    };
  }

  if (!(USER_ROLES as readonly string[]).includes(input.newRole)) {
    return {
      valid: false,
      error: `Rol no válido: "${input.newRole}".`,
    };
  }

  if (input.currentRole === input.newRole) {
    return {
      valid: false,
      error: "El usuario ya tiene asignado ese rol.",
    };
  }

  if (
    input.actorUserId === input.targetUserId &&
    input.currentRole === "SUPERADMIN" &&
    input.newRole !== "SUPERADMIN" &&
    input.totalSuperadmins <= 1
  ) {
    return {
      valid: false,
      error:
        "No puedes retirar el rol de superadministrador al único superadministrador activo.",
    };
  }

  if (!input.justification.trim()) {
    return {
      valid: false,
      error:
        "Debes ingresar una justificación para registrar el cambio de rol en el historial.",
    };
  }

  return { valid: true };
}

export interface ChangeUserRoleOptions {
  db: AppDatabase;
  actorRole: UserRole;
  actorUserId: string;
  targetUserId: string;
  newRole: UserRole;
  justification: string;
  editionId?: string | null;
  nowIso?: string;
  auditId?: string;
}

export interface ChangeUserRoleResult {
  updated: boolean;
  previousRole?: UserRole;
  newRole?: UserRole;
  error?: string;
}

/**
 * Updates a user's global role in Cloudflare D1 and records an immutable `ROLE_CHANGE` entry in `audit_logs`.
 */
export async function changeUserRoleInDb(
  options: ChangeUserRoleOptions
): Promise<ChangeUserRoleResult> {
  const allUsers = await options.db.select().from(users);
  const targetUser = allUsers.find((u) => u.id === options.targetUserId);

  if (!targetUser) {
    return {
      updated: false,
      error: "Usuario objetivo no encontrado.",
    };
  }

  const totalSuperadmins = allUsers.filter(
    (u) => u.role === "SUPERADMIN"
  ).length;

  const validation = validateRoleChangeRequest({
    actorRole: options.actorRole,
    actorUserId: options.actorUserId,
    targetUserId: options.targetUserId,
    currentRole: targetUser.role,
    newRole: options.newRole,
    totalSuperadmins,
    justification: options.justification,
  });

  if (!validation.valid) {
    return {
      updated: false,
      error: validation.error,
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const auditId =
    options.auditId ??
    `audit_role_${options.targetUserId}_${Date.now()}`;

  await options.db
    .update(users)
    .set({
      role: options.newRole,
      updatedAt: nowIso,
    })
    .where(eq(users.id, options.targetUserId));

  await options.db.insert(auditLogs).values({
    id: auditId,
    editionId: options.editionId ?? null,
    actorId: options.actorUserId,
    actionType: "ROLE_CHANGE",
    targetUserId: options.targetUserId,
    targetStoryId: null,
    justification: options.justification.trim(),
    metadataJson: JSON.stringify({
      previousRole: targetUser.role,
      newRole: options.newRole,
    }),
    createdAt: nowIso,
  });

  return {
    updated: true,
    previousRole: targetUser.role,
    newRole: options.newRole,
  };
}
