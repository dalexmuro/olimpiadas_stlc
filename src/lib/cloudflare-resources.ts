/**
 * Cloudflare Infrastructure Resource Definitions & Media Bucket Validation
 * Step 1.1: Cloudflare D1 Databases & R2 Media Buckets Configuration
 */

export type AppEnvironment = "prod" | "dev";

export interface CloudflareEnvironmentConfig {
  environment: AppEnvironment;
  domain: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  r2Region: string;
  cronSchedule: string;
}

/**
 * Returns the Cloudflare Account ID from the runtime environment when configured.
 * Never hardcode account identifiers in tracked source code.
 */
export function getCloudflareAccountId(): string | undefined {
  return typeof process !== "undefined"
    ? process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || undefined
    : undefined;
}

export const CLOUDFLARE_ENVIRONMENTS: Record<
  AppEnvironment,
  CloudflareEnvironmentConfig
> = {
  prod: {
    environment: "prod",
    domain: "olimpiadas.sitelocuento.com",
    d1DatabaseName: "olimpiadas-db-prod",
    d1DatabaseId: "62d0469d-8c03-42a9-ac45-98b320f85b02",
    r2BucketName: "olimpiadas-media-prod",
    r2Region: "WEUR",
    cronSchedule: "*/5 * * * *",
  },
  dev: {
    environment: "dev",
    domain: "dev-olimpiadas.sitelocuento.com",
    d1DatabaseName: "olimpiadas-db-dev",
    d1DatabaseId: "b03d7071-ddc3-4111-96e1-12c18da7245a",
    r2BucketName: "olimpiadas-media-dev",
    r2Region: "WEUR",
    cronSchedule: "*/15 * * * *",
  },
};

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Maximum uploaded image size: 5 MB (in bytes) */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type MediaCategory = "avatars" | "prompts";

export interface MediaValidationInput {
  mimeType: string;
  sizeBytes: number;
}

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Returns the Cloudflare configuration for the requested environment.
 */
export function getCloudflareConfig(
  env: AppEnvironment
): CloudflareEnvironmentConfig {
  return CLOUDFLARE_ENVIRONMENTS[env];
}

/**
 * Validates whether an uploaded image file meets the R2 media storage constraints
 * defined in the functional and technical specifications (JPG/PNG/WEBP, <= 5 MB).
 */
export function validateMediaUpload(
  input: MediaValidationInput
): MediaValidationResult {
  if (input.sizeBytes <= 0) {
    return {
      valid: false,
      error: "El archivo está vacío.",
    };
  }

  if (input.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: "La imagen supera el tamaño máximo permitido de 5 MB.",
    };
  }

  const isAllowedType = (
    ALLOWED_IMAGE_MIME_TYPES as readonly string[]
  ).includes(input.mimeType);

  if (!isAllowedType) {
    return {
      valid: false,
      error: "Formato de imagen no válido. Solo se permiten JPG, PNG y WEBP.",
    };
  }

  return { valid: true };
}

const MIME_TO_EXTENSION: Record<AllowedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Builds a deterministic, safe R2 object key for storing avatars or prompt images.
 */
export function buildR2MediaKey(
  category: MediaCategory,
  entityId: string,
  mimeType: AllowedImageMimeType,
  timestampMs: number
): string {
  const cleanId = entityId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleanId) {
    throw new Error("Entity ID cannot be empty when building an R2 object key.");
  }
  const ext = MIME_TO_EXTENSION[mimeType];
  return `${category}/${cleanId}/${timestampMs}.${ext}`;
}
