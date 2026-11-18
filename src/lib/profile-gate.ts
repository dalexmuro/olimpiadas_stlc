/**
 * Mandatory Profile Completion Gate & Persistence Service
 * Step 1.12: Interceptor and completion flow for OAuth users missing country or phone
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { users } from "@/db/schema";
import { evaluateProfileCompletion, type ProfileCompletionFields } from "./auth";
import { PHONE_REGEX, type FormValidationResult } from "./auth-forms";

export const COMPLETE_PROFILE_PATH = "/completar-perfil" as const;

const EXEMPT_PATH_PREFIXES = [
  "/completar-perfil",
  "/api/",
  "/login",
  "/registro",
  "/recuperar-clave",
  "/verificar-correo",
  "/bases-del-concurso",
  "/quienes-somos",
  "/resultados",
  "/ediciones",
] as const;

export interface CompleteProfileFormInput {
  firstName: string;
  lastName: string;
  country: string;
  phone: string;
}

/**
 * Validates the mandatory profile completion form (`firstName`, `lastName`, `country`, `phone`).
 */
export function validateProfileCompletionForm(
  input: CompleteProfileFormInput
): FormValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!input.firstName.trim()) {
    fieldErrors.firstName = "El nombre es obligatorio.";
  }

  if (!input.lastName.trim()) {
    fieldErrors.lastName = "El apellido es obligatorio.";
  }

  if (!input.country.trim()) {
    fieldErrors.country = "Selecciona tu país de residencia.";
  }

  const trimmedPhone = input.phone.trim();
  if (!trimmedPhone || !PHONE_REGEX.test(trimmedPhone)) {
    fieldErrors.phone =
      "Ingresa un número de teléfono válido (ej. +58 412 1234567).";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

/**
 * Determines whether an authenticated user must be intercepted and redirected to `/completar-perfil`
 * before accessing contest enrollment or dashboard screens.
 */
export function shouldRedirectToCompleteProfile(
  user: (ProfileCompletionFields & { profileCompleted?: boolean | null }) | null,
  currentPathname: string
): boolean {
  if (!user) {
    return false;
  }

  const normalizedPath = currentPathname.trim() || "/";
  const isExempt = EXEMPT_PATH_PREFIXES.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`) || normalizedPath.startsWith(prefix)
  );

  if (isExempt) {
    return false;
  }

  const hasAllFields = evaluateProfileCompletion(user);
  return !hasAllFields || user.profileCompleted === false;
}

export interface CompleteUserProfileResult {
  updated: boolean;
  fullName?: string;
  error?: string;
}

/**
 * Persists the mandatory profile fields into the `users` table in Cloudflare D1
 * and marks `profile_completed = true`.
 */
export async function completeUserProfile(
  db: AppDatabase,
  userId: string,
  input: CompleteProfileFormInput,
  nowIso: string = new Date().toISOString()
): Promise<CompleteUserProfileResult> {
  const validation = validateProfileCompletionForm(input);
  if (!validation.valid) {
    const firstError = Object.values(validation.fieldErrors)[0];
    return {
      updated: false,
      error: firstError ?? "Datos de perfil incompletos.",
    };
  }

  const cleanFirstName = input.firstName.trim();
  const cleanLastName = input.lastName.trim();
  const cleanCountry = input.country.trim();
  const cleanPhone = input.phone.trim();
  const fullName = `${cleanFirstName} ${cleanLastName}`;

  await db
    .update(users)
    .set({
      name: fullName,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      country: cleanCountry,
      phone: cleanPhone,
      profileCompleted: true,
      updatedAt: nowIso,
    })
    .where(eq(users.id, userId));

  return {
    updated: true,
    fullName,
  };
}
