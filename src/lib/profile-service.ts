/**
 * User Profile Management & R2 Avatar Storage Service
 * Step 1.13: Edit personal data, email (with re-verification), password validation, and R2 avatar upload
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { MIN_PASSWORD_LENGTH } from "./auth";
import {
  EMAIL_REGEX,
  evaluatePasswordStrength,
  PHONE_REGEX,
  type FormValidationResult,
} from "./auth-forms";
import type { R2BucketBinding } from "./cloudflare-env";
import {
  buildR2MediaKey,
  validateMediaUpload,
  type AllowedImageMimeType,
} from "./cloudflare-resources";
import { dispatchTemplateEmail } from "./email";

export interface ProfileUpdateInput {
  firstName: string;
  lastName: string;
  country: string;
  phone: string;
  email: string;
}

/**
 * Validates the personal profile update form (`firstName`, `lastName`, `country`, `phone`, `email`).
 */
export function validateProfileUpdateForm(
  input: ProfileUpdateInput
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

  const trimmedEmail = input.email.trim();
  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    fieldErrors.email = "Ingresa un correo electrónico válido.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

/**
 * Validates the password change form on `/perfil`.
 */
export function validatePasswordChangeForm(
  input: PasswordChangeInput
): FormValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!input.currentPassword) {
    fieldErrors.currentPassword = "Ingresa tu contraseña actual.";
  }

  const passwordCheck = evaluatePasswordStrength(input.newPassword);
  if (!passwordCheck.isStrong) {
    fieldErrors.newPassword =
      passwordCheck.errorMessage ??
      `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres, una mayúscula, una minúscula y un número.`;
  }

  if (input.newPassword !== input.confirmNewPassword) {
    fieldErrors.confirmNewPassword = "Las contraseñas nuevas no coinciden.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export interface UpdateUserProfileOptions {
  db: AppDatabase;
  userId: string;
  currentEmail: string;
  input: ProfileUpdateInput;
  baseUrl: string;
  brevoApiKey?: string;
  dryRunEmails?: boolean;
  nowIso?: string;
}

export interface UpdateUserProfileResult {
  updated: boolean;
  emailChanged: boolean;
  verificationSent: boolean;
  error?: string;
}

/**
 * Updates the user's personal profile fields in D1.
 * If the user changed their email address:
 * - Verifies the new email is not already taken by another user.
 * - Marks `email_verified = false` and dispatches the `E01` verification email.
 */
export async function updateUserProfileInDb(
  options: UpdateUserProfileOptions
): Promise<UpdateUserProfileResult> {
  const validation = validateProfileUpdateForm(options.input);
  if (!validation.valid) {
    const firstError = Object.values(validation.fieldErrors)[0];
    return {
      updated: false,
      emailChanged: false,
      verificationSent: false,
      error: firstError ?? "Datos de perfil no válidos.",
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const cleanFirstName = options.input.firstName.trim();
  const cleanLastName = options.input.lastName.trim();
  const cleanCountry = options.input.country.trim();
  const cleanPhone = options.input.phone.trim();
  const cleanNewEmail = options.input.email.trim().toLowerCase();
  const normalizedCurrentEmail = options.currentEmail.trim().toLowerCase();
  const emailChanged = cleanNewEmail !== normalizedCurrentEmail;

  if (emailChanged) {
    const existingWithEmail = await options.db
      .select()
      .from(users)
      .where(eq(users.email, cleanNewEmail));

    const conflictUser = existingWithEmail.find(
      (u) => u.id !== options.userId
    );
    if (conflictUser) {
      return {
        updated: false,
        emailChanged: true,
        verificationSent: false,
        error: "Ese correo electrónico ya está en uso por otra cuenta.",
      };
    }
  }

  const fullName = `${cleanFirstName} ${cleanLastName}`;

  await options.db
    .update(users)
    .set({
      name: fullName,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      country: cleanCountry,
      phone: cleanPhone,
      email: cleanNewEmail,
      ...(emailChanged ? { emailVerified: false } : {}),
      profileCompleted: true,
      updatedAt: nowIso,
    })
    .where(eq(users.id, options.userId));

  let verificationSent = false;
  if (emailChanged) {
    const dispatchResult = await dispatchTemplateEmail({
      db: options.db,
      templateCode: "E01",
      recipientUserId: options.userId,
      recipientEmail: cleanNewEmail,
      recipientName: fullName,
      contextKey: `email_change:${cleanNewEmail}:${nowIso}`,
      variables: {
        NOMBRE: cleanFirstName,
        APELLIDO: cleanLastName,
        EMAIL: cleanNewEmail,
        LINK_PLATAFORMA: `${options.baseUrl}/verificar-correo`,
      },
      apiKey: options.brevoApiKey,
      dryRun: options.dryRunEmails,
      nowIso,
    });
    verificationSent = dispatchResult.dispatched;
  }

  return {
    updated: true,
    emailChanged,
    verificationSent,
  };
}

export interface UploadAvatarInput {
  db: AppDatabase;
  mediaBucket: R2BucketBinding;
  userId: string;
  mimeType: string;
  bytes: ArrayBuffer;
  timestampMs?: number;
  nowIso?: string;
}

export interface UploadAvatarResult {
  uploaded: boolean;
  avatarUrl?: string;
  objectKey?: string;
  error?: string;
}

/**
 * Validates an avatar image (JPG/PNG/WEBP, <= 5 MB), stores it in Cloudflare R2 (`MEDIA_BUCKET`),
 * and updates `avatar_url` and `image` on the user's D1 record.
 */
export async function uploadAvatarToR2(
  input: UploadAvatarInput
): Promise<UploadAvatarResult> {
  const validation = validateMediaUpload({
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
    bytes: input.bytes,
  });

  if (!validation.valid) {
    return {
      uploaded: false,
      error: validation.error,
    };
  }

  const timestampMs = input.timestampMs ?? Date.now();
  const nowIso = input.nowIso ?? new Date(timestampMs).toISOString();
  const objectKey = buildR2MediaKey(
    "avatars",
    input.userId,
    input.mimeType as AllowedImageMimeType,
    timestampMs
  );

  await input.mediaBucket.put(objectKey, input.bytes, {
    httpMetadata: {
      contentType: input.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const avatarUrl = `/api/media/${objectKey}`;

  await input.db
    .update(users)
    .set({
      avatarUrl,
      image: avatarUrl,
      updatedAt: nowIso,
    })
    .where(eq(users.id, input.userId));

  return {
    uploaded: true,
    avatarUrl,
    objectKey,
  };
}

export interface DeleteUserAccountResult {
  deleted: boolean;
  anonymized?: boolean;
  error?: string;
}

/**
 * Permanently deletes a user's account, sessions, OAuth links, and verification tokens.
 * Protects against deleting the last remaining SUPERADMIN account, and falls back
 * to full anonymization if historical contest rows reference the user via foreign keys.
 */
export async function deleteUserAccountInDb(options: {
  db: AppDatabase;
  userId: string;
  email: string;
  nowIso?: string;
}): Promise<DeleteUserAccountResult> {
  const { db, userId, email } = options;
  const nowIso = options.nowIso ?? new Date().toISOString();

  const targetRows = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  const targetUser = targetRows[0];

  if (targetUser?.role === "SUPERADMIN") {
    const superadmins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "SUPERADMIN"));
    if (superadmins.length <= 1) {
      return {
        deleted: false,
        error:
          "No puedes eliminar la última cuenta de superadministrador. Asigna primero otro superadministrador.",
      };
    }
  }

  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db
    .delete(verifications)
    .where(eq(verifications.identifier, email.trim().toLowerCase()));

  try {
    await db.delete(users).where(eq(users.id, userId));
    return { deleted: true, anonymized: false };
  } catch {
    // Historical contest records reference this user — erase all PII and revoke access
    await db
      .update(users)
      .set({
        name: "Cuenta eliminada",
        firstName: "Cuenta",
        lastName: "eliminada",
        email: `eliminada-${userId}@deleted.local`,
        emailVerified: false,
        country: null,
        phone: null,
        avatarUrl: null,
        image: null,
        profileCompleted: false,
        role: "PARTICIPANT",
        updatedAt: nowIso,
      })
      .where(eq(users.id, userId));
    return { deleted: true, anonymized: true };
  }
}
