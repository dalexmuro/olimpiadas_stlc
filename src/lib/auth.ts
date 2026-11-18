/**
 * Better Auth Configuration & Helpers for Cloudflare D1
 * Step 1.10: Email/Password (Verification E01 + Reset E02), Google OAuth, and Microsoft OAuth (tenant: "common")
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AppDatabase } from "@/db";
import {
  accounts,
  sessions,
  users,
  verifications,
  type UserRole,
} from "@/db/schema";
import { shouldPromoteToSuperadmin } from "@/db/seed";
import { APP_BRAND } from "./app-metadata";
import type { CloudflareEnv } from "./cloudflare-env";
import { dispatchTemplateEmail } from "./email";

export const MICROSOFT_OAUTH_TENANT = "common" as const;
export const MIN_PASSWORD_LENGTH = 8 as const;

export interface ProfileCompletionFields {
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
  phone?: string | null;
}

/**
 * Checks whether all mandatory participant profile fields (`firstName`, `lastName`, `country`, `phone`)
 * are present and non-empty after trimming.
 */
export function evaluateProfileCompletion(
  fields: ProfileCompletionFields
): boolean {
  const hasFirstName = Boolean(fields.firstName && fields.firstName.trim());
  const hasLastName = Boolean(fields.lastName && fields.lastName.trim());
  const hasCountry = Boolean(fields.country && fields.country.trim());
  const hasPhone = Boolean(fields.phone && fields.phone.trim());

  return hasFirstName && hasLastName && hasCountry && hasPhone;
}

/**
 * Determines the initial role for a newly created user account.
 * Promotes `SUPERADMIN_INITIAL_EMAIL` automatically to `SUPERADMIN`; all other users start as `PARTICIPANT`.
 */
export function resolveInitialUserRole(
  email: string,
  initialSuperadminEmail?: string | null
): UserRole {
  return shouldPromoteToSuperadmin(email, initialSuperadminEmail)
    ? "SUPERADMIN"
    : "PARTICIPANT";
}

export interface AuthRuntimeConfig {
  baseUrl: string;
  secret: string;
  googleClientId?: string;
  googleClientSecret?: string;
  microsoftClientId?: string;
  microsoftClientSecret?: string;
  brevoApiKey?: string;
  emailFromAddress?: string;
  emailFromName?: string;
  superadminInitialEmail?: string;
  dryRunEmails?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Extracts normalized authentication runtime configuration from Cloudflare bindings or `process.env`.
 */
export function resolveAuthRuntimeConfig(
  env?: Partial<CloudflareEnv>
): AuthRuntimeConfig {
  const procEnv: Record<string, string | undefined> =
    typeof process !== "undefined" ? process.env : {};
  return {
    baseUrl:
      env?.BETTER_AUTH_URL ??
      procEnv.BETTER_AUTH_URL ??
      APP_BRAND.productionUrl,
    secret:
      env?.BETTER_AUTH_SECRET ??
      procEnv.BETTER_AUTH_SECRET ??
      "dev-fallback-secret-minimum-32-chars-olimpiadas-stlc",
    googleClientId: env?.GOOGLE_CLIENT_ID ?? procEnv.GOOGLE_CLIENT_ID,
    googleClientSecret:
      env?.GOOGLE_CLIENT_SECRET ?? procEnv.GOOGLE_CLIENT_SECRET,
    microsoftClientId: env?.MICROSOFT_CLIENT_ID ?? procEnv.MICROSOFT_CLIENT_ID,
    microsoftClientSecret:
      env?.MICROSOFT_CLIENT_SECRET ?? procEnv.MICROSOFT_CLIENT_SECRET,
    brevoApiKey: env?.BREVO_API_KEY ?? procEnv.BREVO_API_KEY,
    emailFromAddress:
      env?.EMAIL_FROM_ADDRESS ??
      procEnv.EMAIL_FROM_ADDRESS ??
      APP_BRAND.supportEmail,
    emailFromName:
      env?.EMAIL_FROM_NAME ?? procEnv.EMAIL_FROM_NAME ?? APP_BRAND.contestName,
    superadminInitialEmail:
      env?.SUPERADMIN_INITIAL_EMAIL ?? procEnv.SUPERADMIN_INITIAL_EMAIL,
  };
}

/**
 * Builds the Better Auth configuration object wired to Drizzle D1 and Brevo E01/E02 emails.
 */
export function buildBetterAuthOptions(
  db: AppDatabase,
  config: AuthRuntimeConfig
) {
  const socialProviders: Record<string, Record<string, string>> = {};

  if (config.googleClientId && config.googleClientSecret) {
    socialProviders.google = {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    };
  }

  if (config.microsoftClientId && config.microsoftClientSecret) {
    socialProviders.microsoft = {
      clientId: config.microsoftClientId,
      clientSecret: config.microsoftClientSecret,
      tenantId: MICROSOFT_OAUTH_TENANT,
    };
  }

  return {
    baseURL: config.baseUrl,
    secret: config.secret,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      async sendResetPassword(data: {
        user: { id: string; email: string; name?: string | null };
        url: string;
        token: string;
      }) {
        await dispatchTemplateEmail({
          db,
          templateCode: "E02",
          recipientUserId: data.user.id,
          recipientEmail: data.user.email,
          recipientName: data.user.name ?? undefined,
          contextKey: `reset_password:${data.token}`,
          variables: {
            NOMBRE: data.user.name ?? data.user.email,
            EMAIL: data.user.email,
            LINK_PLATAFORMA: data.url,
          },
          apiKey: config.brevoApiKey,
          dryRun: config.dryRunEmails,
          fromAddress: config.emailFromAddress,
          fromName: config.emailFromName,
          fetchImpl: config.fetchImpl,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail(data: {
        user: { id: string; email: string; name?: string | null };
        url: string;
        token: string;
      }) {
        await dispatchTemplateEmail({
          db,
          templateCode: "E01",
          recipientUserId: data.user.id,
          recipientEmail: data.user.email,
          recipientName: data.user.name ?? undefined,
          contextKey: `verify_email:${data.token}`,
          variables: {
            NOMBRE: data.user.name ?? data.user.email,
            APELLIDO: "",
            EMAIL: data.user.email,
            LINK_PLATAFORMA: data.url,
          },
          apiKey: config.brevoApiKey,
          dryRun: config.dryRunEmails,
          fromAddress: config.emailFromAddress,
          fromName: config.emailFromName,
          fetchImpl: config.fetchImpl,
        });
      },
    },
    socialProviders,
    user: {
      additionalFields: {
        firstName: {
          type: "string" as const,
          required: false,
          fieldName: "firstName",
        },
        lastName: {
          type: "string" as const,
          required: false,
          fieldName: "lastName",
        },
        country: {
          type: "string" as const,
          required: false,
          fieldName: "country",
        },
        phone: {
          type: "string" as const,
          required: false,
          fieldName: "phone",
        },
        avatarUrl: {
          type: "string" as const,
          required: false,
          fieldName: "avatarUrl",
        },
        profileCompleted: {
          type: "boolean" as const,
          required: false,
          defaultValue: false,
          fieldName: "profileCompleted",
        },
        role: {
          type: "string" as const,
          required: false,
          defaultValue: "PARTICIPANT",
          input: false,
          fieldName: "role",
        },
      },
    },
  };
}

/**
 * Instantiates a Better Auth server instance bound to the given Drizzle D1 client and runtime config.
 */
export function createAuthInstance(
  db: AppDatabase,
  env?: Partial<CloudflareEnv>
) {
  const runtimeConfig = resolveAuthRuntimeConfig(env);
  const options = buildBetterAuthOptions(db, runtimeConfig);
  return betterAuth(options);
}
