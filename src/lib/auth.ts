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
import {
  CLOSED_TAB_SESSION_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "./session-timeout";

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

/**
 * Splits a full display name (e.g. from Google/Microsoft OAuth) into firstName and lastName.
 */
export function splitDisplayName(name?: string | null): {
  firstName: string;
  lastName: string;
} {
  const cleaned = (name ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return { firstName: "", lastName: "" };
  }
  const parts = cleaned.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export interface SocialProfileFields {
  given_name?: string | null;
  family_name?: string | null;
  name?: string | null;
  picture?: string | null;
}

/**
 * Maps standard Google/Microsoft OIDC profile fields onto our custom user columns
 * while keeping every field editable by the user afterward.
 */
export function mapSocialProfileToUser(profile: SocialProfileFields): {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
} {
  const fallback = splitDisplayName(profile.name);
  const firstName = (profile.given_name ?? "").trim() || fallback.firstName;
  const lastName = (profile.family_name ?? "").trim() || fallback.lastName;
  const avatarUrl = (profile.picture ?? "").trim() || undefined;

  return {
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

export interface AuthRuntimeConfig {
  baseUrl: string;
  trustedOrigins?: string[];
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
 * Resolves the effective Better Auth base URL for a request.
 * Allows testing on `*.workers.dev` and `localhost` before custom domains are active
 * while keeping the configured `BETTER_AUTH_URL` as the default.
 */
export function resolveEffectiveAuthBaseUrl(
  configuredUrl: string,
  requestUrl?: string | null
): string {
  if (!requestUrl) return configuredUrl;
  try {
    const parsedRequest = new URL(requestUrl);
    if (
      parsedRequest.protocol !== "https:" &&
      parsedRequest.protocol !== "http:"
    ) {
      return configuredUrl;
    }

    const host = parsedRequest.hostname.toLowerCase();
    const configuredHost = new URL(configuredUrl).hostname.toLowerCase();
    const isAllowedDynamicOrigin =
      host === configuredHost ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".workers.dev");

    return isAllowedDynamicOrigin ? parsedRequest.origin : configuredUrl;
  } catch {
    return configuredUrl;
  }
}

/**
 * Builds an origin URL from incoming Next.js request headers (for Server Components).
 */
export function resolveRequestUrlFromHeaders(
  reqHeaders: Pick<Headers, "get">
): string | undefined {
  const host = reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host");
  if (!host) return undefined;
  const lowerHost = host.toLowerCase();
  const isLocal =
    lowerHost.startsWith("localhost") || lowerHost.startsWith("127.0.0.1");
  const proto =
    reqHeaders.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}/`;
}

/**
 * Extracts normalized authentication runtime configuration from Cloudflare bindings or `process.env`.
 */
export function resolveAuthRuntimeConfig(
  env?: Partial<CloudflareEnv>,
  requestUrl?: string | null
): AuthRuntimeConfig {
  const procEnv: Record<string, string | undefined> =
    typeof process !== "undefined" ? process.env : {};
  const configuredUrl =
    env?.BETTER_AUTH_URL ??
    procEnv.BETTER_AUTH_URL ??
    APP_BRAND.productionUrl;
  const baseUrl = resolveEffectiveAuthBaseUrl(configuredUrl, requestUrl);
  const trustedOrigins = Array.from(
    new Set([
      baseUrl,
      configuredUrl,
      APP_BRAND.productionUrl,
      APP_BRAND.stagingUrl,
    ])
  );

  return {
    baseUrl,
    trustedOrigins,
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
  const socialProviders: Record<string, Record<string, unknown>> = {};

  if (config.googleClientId && config.googleClientSecret) {
    socialProviders.google = {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      mapProfileToUser: (profile: SocialProfileFields) =>
        mapSocialProfileToUser(profile),
    };
  }

  if (config.microsoftClientId && config.microsoftClientSecret) {
    socialProviders.microsoft = {
      clientId: config.microsoftClientId,
      clientSecret: config.microsoftClientSecret,
      tenantId: MICROSOFT_OAUTH_TENANT,
      mapProfileToUser: (profile: SocialProfileFields) =>
        mapSocialProfileToUser(profile),
    };
  }

  const isLocalDev =
    typeof process !== "undefined" && process.env.NODE_ENV === "development";
  const useSecureCookies = !isLocalDev && config.baseUrl.startsWith("https://");

  return {
    baseURL: config.baseUrl,
    trustedOrigins: config.trustedOrigins ?? [config.baseUrl],
    secret: config.secret,
    session: {
      expiresIn: CLOSED_TAB_SESSION_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    advanced: {
      useSecureCookies,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user: Record<string, unknown>) => {
            const email = typeof user.email === "string" ? user.email : "";
            const name = typeof user.name === "string" ? user.name : "";
            const image = typeof user.image === "string" ? user.image : "";
            const parts = splitDisplayName(name);
            const firstName =
              typeof user.firstName === "string" && user.firstName.trim()
                ? user.firstName.trim()
                : parts.firstName;
            const lastName =
              typeof user.lastName === "string" && user.lastName.trim()
                ? user.lastName.trim()
                : parts.lastName;
            const avatarUrl =
              typeof user.avatarUrl === "string" && user.avatarUrl.trim()
                ? user.avatarUrl.trim()
                : image || undefined;

            return {
              data: {
                ...user,
                ...(firstName ? { firstName } : {}),
                ...(lastName ? { lastName } : {}),
                ...(avatarUrl ? { avatarUrl } : {}),
                role: resolveInitialUserRole(
                  email,
                  config.superadminInitialEmail
                ),
              },
            };
          },
        },
      },
    },
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
  env?: Partial<CloudflareEnv>,
  requestUrl?: string | null
) {
  const runtimeConfig = resolveAuthRuntimeConfig(env, requestUrl);
  const options = buildBetterAuthOptions(db, runtimeConfig);
  return betterAuth(options);
}
