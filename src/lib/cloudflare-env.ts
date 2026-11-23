/**
 * Cloudflare Worker Bindings & Runtime Environment Contract
 * Step 1.3: Wrangler Configuration & Typed Bindings for D1 (DB), R2 (MEDIA_BUCKET), and Cron
 */

import type { AppEnvironment } from "./cloudflare-resources";

/**
 * Minimal structural interface for Cloudflare D1Database binding
 * so code remains strictly typed across Node/Vitest and Cloudflare Edge runtimes.
 */
export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<{ success: boolean; results?: T[] }>;
  all<T = Record<string, unknown>>(): Promise<{ success: boolean; results: T[] }>;
  raw<T = unknown[]>(): Promise<T[]>;
}

export interface D1DatabaseBinding {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

/**
 * Minimal structural interface for Cloudflare R2Bucket binding.
 */
export interface R2ObjectBodyLike {
  readonly key: string;
  readonly size: number;
  readonly httpEtag: string;
  readonly httpMetadata?: { contentType?: string; cacheControl?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2PutOptionsLike {
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
}

export interface R2BucketBinding {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string | ReadableStream,
    options?: R2PutOptionsLike
  ): Promise<{ key: string; size: number } | null>;
  delete(keys: string | string[]): Promise<void>;
}

/**
 * Complete Cloudflare Worker Environment & Bindings contract.
 */
export interface CloudflareEnv {
  DB: D1DatabaseBinding;
  MEDIA_BUCKET: R2BucketBinding;
  APP_ENV: AppEnvironment;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET?: string;
  CRON_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  MICROSOFT_TENANT_ID?: string;
  BREVO_API_KEY?: string;
  EMAIL_FROM_ADDRESS: string;
  EMAIL_FROM_NAME: string;
  SUPERADMIN_INITIAL_EMAIL?: string;
}

export const REQUIRED_BINDING_NAMES = ["DB", "MEDIA_BUCKET"] as const;

export const REQUIRED_SECRET_KEYS = [
  "BETTER_AUTH_SECRET",
  "BREVO_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SUPERADMIN_INITIAL_EMAIL",
] as const;

export interface BindingValidationResult {
  valid: boolean;
  missingBindings: string[];
  missingSecrets: string[];
}

/**
 * Verifies that an incoming Cloudflare environment object contains the
 * required D1 (`DB`) and R2 (`MEDIA_BUCKET`) bindings and required secrets.
 */
export function validateCloudflareEnv(
  env: Partial<Record<string, unknown>>,
  options: { requireSecrets?: boolean } = {}
): BindingValidationResult {
  const missingBindings: string[] = [];
  const missingSecrets: string[] = [];

  for (const bindingName of REQUIRED_BINDING_NAMES) {
    const candidate = env[bindingName];
    if (!candidate || typeof candidate !== "object") {
      missingBindings.push(bindingName);
    }
  }

  if (options.requireSecrets) {
    for (const secretKey of REQUIRED_SECRET_KEYS) {
      const value = env[secretKey];
      if (typeof value !== "string" || value.trim().length === 0) {
        missingSecrets.push(secretKey);
      }
    }
  }

  return {
    valid: missingBindings.length === 0 && missingSecrets.length === 0,
    missingBindings,
    missingSecrets,
  };
}
