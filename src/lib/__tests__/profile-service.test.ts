import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, R2BucketBinding } from "../cloudflare-env";
import { MAX_IMAGE_SIZE_BYTES } from "../cloudflare-resources";
import {
  deleteUserAccountInDb,
  updateUserProfileInDb,
  uploadAvatarToR2,
  validatePasswordChangeForm,
  validateProfileUpdateForm,
} from "../profile-service";

function createProfileServiceTestD1Binding(options: {
  existingUsersWithEmail?: unknown[][];
} = {}): {
  binding: D1DatabaseBinding;
  queries: string[];
} {
  const queries: string[] = [];
  const binding: D1DatabaseBinding = {
    prepare: (query: string) => {
      queries.push(query);
      return {
        bind(..._values: unknown[]) {
          return this;
        },
        first: async <T = Record<string, unknown>>() => null as T | null,
        run: async <T = Record<string, unknown>>() => ({
          success: true,
          results: [] as T[],
        }),
        all: async <T = Record<string, unknown>>() => ({
          success: true,
          results: [] as T[],
        }),
        raw: async <T = unknown[]>() => {
          if (
            query.includes('from "users"') &&
            options.existingUsersWithEmail
          ) {
            return options.existingUsersWithEmail as unknown as T[];
          }
          return [] as unknown as T[];
        },
      };
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  return { binding, queries };
}

function createMockR2Bucket(): {
  bucket: R2BucketBinding;
  storedObjects: Map<string, { size: number; contentType?: string }>;
} {
  const storedObjects = new Map<string, { size: number; contentType?: string }>();
  const bucket: R2BucketBinding = {
    get: async () => null,
    put: async (key, value, options) => {
      const byteLength =
        value instanceof ArrayBuffer ? value.byteLength : 0;
      storedObjects.set(key, {
        size: byteLength,
        contentType: options?.httpMetadata?.contentType,
      });
      return { key, size: byteLength };
    },
    delete: async () => undefined,
  };
  return { bucket, storedObjects };
}

describe("Step 1.13 — Profile Management, Email Re-Verification & R2 Avatar Upload", () => {
  it("validates personal profile update fields and password change fields", () => {
    expect(
      validateProfileUpdateForm({
        firstName: "Isabel",
        lastName: "Allende",
        country: "Chile",
        phone: "+56 9 8765 4321",
        email: "isabel@sitelocuento.com",
      }).valid
    ).toBe(true);

    const invalidPwd = validatePasswordChangeForm({
      currentPassword: "",
      newPassword: "123",
      confirmNewPassword: "456",
    });
    expect(invalidPwd.valid).toBe(false);
    expect(invalidPwd.fieldErrors.currentPassword).toBeDefined();
    expect(invalidPwd.fieldErrors.newPassword).toBeDefined();
    expect(invalidPwd.fieldErrors.confirmNewPassword).toBeDefined();

    expect(
      validatePasswordChangeForm({
        currentPassword: "OldPassword123",
        newPassword: "NewPassword456",
        confirmNewPassword: "NewPassword456",
      }).valid
    ).toBe(true);
  });

  it("updates personal data without sending verification email if email did not change", async () => {
    const { binding, queries } = createProfileServiceTestD1Binding();
    const db = createDbClient(binding);

    const result = await updateUserProfileInDb({
      db,
      userId: "user_1",
      currentEmail: "isabel@sitelocuento.com",
      input: {
        firstName: "Isabel",
        lastName: "Allende",
        country: "Chile",
        phone: "+56 9 8765 4321",
        email: "isabel@sitelocuento.com",
      },
      baseUrl: "https://olimpiadas.sitelocuento.com",
      dryRunEmails: true,
    });

    expect(result).toEqual({
      updated: true,
      emailChanged: false,
      verificationSent: false,
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('update "users"');
  });

  it("re-verifies new email with E01 when email changes, and blocks duplicate emails", async () => {
    // 1. Email already taken by another user (user_other)
    const conflictDb = createDbClient(
      createProfileServiceTestD1Binding({
        existingUsersWithEmail: [
          [
            "user_other",
            "Otro",
            "ocupado@sitelocuento.com",
            1,
            null,
            "Otro",
            "Autor",
            "VE",
            "+58000",
            null,
            1,
            "PARTICIPANT",
            "2026-11-18T00:00:00.000Z",
            "2026-11-18T00:00:00.000Z",
          ],
        ],
      }).binding
    );

    const conflictResult = await updateUserProfileInDb({
      db: conflictDb,
      userId: "user_1",
      currentEmail: "isabel@sitelocuento.com",
      input: {
        firstName: "Isabel",
        lastName: "Allende",
        country: "Chile",
        phone: "+56 9 8765 4321",
        email: "ocupado@sitelocuento.com",
      },
      baseUrl: "https://olimpiadas.sitelocuento.com",
      dryRunEmails: true,
    });
    expect(conflictResult.updated).toBe(false);
    expect(conflictResult.error).toContain("ya está en uso");

    // 2. Valid new email triggers E01 re-verification
    const { binding, queries } = createProfileServiceTestD1Binding();
    const db = createDbClient(binding);

    const changedResult = await updateUserProfileInDb({
      db,
      userId: "user_1",
      currentEmail: "isabel@sitelocuento.com",
      input: {
        firstName: "Isabel",
        lastName: "Allende",
        country: "Chile",
        phone: "+56 9 8765 4321",
        email: "nueva.isabel@sitelocuento.com",
      },
      baseUrl: "https://olimpiadas.sitelocuento.com",
      dryRunEmails: true,
      nowIso: "2026-11-18T17:00:00.000Z",
    });

    expect(changedResult).toEqual({
      updated: true,
      emailChanged: true,
      verificationSent: true,
    });
    expect(
      queries.some((q) => q.includes('insert into "email_dispatch_logs"'))
    ).toBe(true);
  });

  it("uploads valid avatar images <= 5 MB to Cloudflare R2 and updates avatar_url", async () => {
    const { binding, queries } = createProfileServiceTestD1Binding();
    const db = createDbClient(binding);
    const { bucket, storedObjects } = createMockR2Bucket();

    const oversizedBuffer = new ArrayBuffer(MAX_IMAGE_SIZE_BYTES + 10);
    const rejected = await uploadAvatarToR2({
      db,
      mediaBucket: bucket,
      userId: "user_1",
      mimeType: "image/png",
      bytes: oversizedBuffer,
    });
    expect(rejected.uploaded).toBe(false);
    expect(rejected.error).toContain("5 MB");
    expect(storedObjects.size).toBe(0);

    const validBuffer = new ArrayBuffer(4096);
    const uploaded = await uploadAvatarToR2({
      db,
      mediaBucket: bucket,
      userId: "user_1",
      mimeType: "image/webp",
      bytes: validBuffer,
      timestampMs: 1700000000123,
    });

    expect(uploaded).toEqual({
      uploaded: true,
      objectKey: "avatars/user_1/1700000000123.webp",
      avatarUrl: "/api/media/avatars/user_1/1700000000123.webp",
    });
    expect(storedObjects.get("avatars/user_1/1700000000123.webp")).toEqual({
      size: 4096,
      contentType: "image/webp",
    });
    expect(queries.some((q) => q.includes('update "users"'))).toBe(true);
  });

  it("deletes user sessions, OAuth accounts, verifications, and user record", async () => {
    const { binding, queries } = createProfileServiceTestD1Binding();
    const db = createDbClient(binding);

    const result = await deleteUserAccountInDb({
      db,
      userId: "user_9",
      email: "lector@ejemplo.com",
    });

    expect(result.deleted).toBe(true);
    expect(result.anonymized).toBe(false);
    expect(queries.some((q) => q.includes('delete from "sessions"'))).toBe(
      true
    );
    expect(queries.some((q) => q.includes('delete from "accounts"'))).toBe(
      true
    );
    expect(queries.some((q) => q.includes('delete from "users"'))).toBe(true);
  });
});
