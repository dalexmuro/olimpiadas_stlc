/**
 * Runtime Secrets Validator for Cloudflare Workers (dev & prod)
 * Step 7.2: Validates required secrets per environment (Microsoft OAuth optional in dev, mandatory in prod)
 */

import type { AppEnvironment } from "./cloudflare-resources";

export interface SecretsValidationResult {
  valid: boolean;
  environment: AppEnvironment;
  presentKeys: string[];
  missingKeys: string[];
  optionalMissingKeys: string[];
}

const CORE_REQUIRED_SECRETS = [
  "BETTER_AUTH_SECRET",
  "BREVO_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SUPERADMIN_INITIAL_EMAIL",
] as const;

const MICROSOFT_OAUTH_SECRETS = [
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
] as const;

/**
 * Validates that an environment key-value map contains every required runtime secret.
 * Per project configuration, Microsoft OAuth is required in `prod` and optional in `dev`.
 */
export function validateRuntimeSecretsForEnv(
  environment: AppEnvironment,
  envMap: Record<string, string | undefined>
): SecretsValidationResult {
  const requiredKeys: readonly string[] =
    environment === "prod"
      ? [...CORE_REQUIRED_SECRETS, ...MICROSOFT_OAUTH_SECRETS]
      : [...CORE_REQUIRED_SECRETS];

  const optionalKeys: readonly string[] =
    environment === "dev" ? [...MICROSOFT_OAUTH_SECRETS] : [];

  const presentKeys: string[] = [];
  const missingKeys: string[] = [];
  const optionalMissingKeys: string[] = [];

  for (const key of requiredKeys) {
    const val = envMap[key]?.trim();
    if (val) {
      presentKeys.push(key);
    } else {
      missingKeys.push(key);
    }
  }

  for (const key of optionalKeys) {
    const val = envMap[key]?.trim();
    if (val) {
      presentKeys.push(key);
    } else {
      optionalMissingKeys.push(key);
    }
  }

  return {
    valid: missingKeys.length === 0,
    environment,
    presentKeys,
    missingKeys,
    optionalMissingKeys,
  };
}
