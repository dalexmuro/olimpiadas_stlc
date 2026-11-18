import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_ENVIRONMENTS,
  MAX_IMAGE_SIZE_BYTES,
  buildR2MediaKey,
  getCloudflareConfig,
  validateMediaUpload,
} from "../cloudflare-resources";

describe("Step 1.1 — Cloudflare R2 & D1 Resource Configuration", () => {
  it("defines valid Cloudflare account and isolated prod/dev resources", () => {
    expect(CLOUDFLARE_ACCOUNT_ID).toBe("72a8537e848ff38b562b789901671eec");

    const prod = getCloudflareConfig("prod");
    const dev = getCloudflareConfig("dev");

    expect(prod.r2BucketName).toBe("olimpiadas-media-prod");
    expect(dev.r2BucketName).toBe("olimpiadas-media-dev");
    expect(prod.d1DatabaseName).toBe("olimpiadas-db-prod");
    expect(dev.d1DatabaseName).toBe("olimpiadas-db-dev");
    expect(prod.d1DatabaseId).not.toBe(dev.d1DatabaseId);
    expect(prod.r2Region).toBe("WEUR");
    expect(dev.r2Region).toBe("WEUR");
    expect(CLOUDFLARE_ENVIRONMENTS.prod.domain).toBe(
      "olimpiadas.sitelocuento.com"
    );
    expect(CLOUDFLARE_ENVIRONMENTS.dev.domain).toBe(
      "dev-olimpiadas.sitelocuento.com"
    );
  });

  it("accepts valid JPG, PNG, and WEBP images up to 5 MB", () => {
    expect(
      validateMediaUpload({ mimeType: "image/jpeg", sizeBytes: 1024 })
    ).toEqual({ valid: true });
    expect(
      validateMediaUpload({
        mimeType: "image/png",
        sizeBytes: MAX_IMAGE_SIZE_BYTES,
      })
    ).toEqual({ valid: true });
    expect(
      validateMediaUpload({ mimeType: "image/webp", sizeBytes: 500_000 })
    ).toEqual({ valid: true });
  });

  it("rejects empty files, files over 5 MB, and unsupported MIME types", () => {
    const emptyResult = validateMediaUpload({
      mimeType: "image/jpeg",
      sizeBytes: 0,
    });
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.error).toContain("vacío");

    const oversizedResult = validateMediaUpload({
      mimeType: "image/png",
      sizeBytes: MAX_IMAGE_SIZE_BYTES + 1,
    });
    expect(oversizedResult.valid).toBe(false);
    expect(oversizedResult.error).toContain("5 MB");

    const invalidTypeResult = validateMediaUpload({
      mimeType: "application/pdf",
      sizeBytes: 2048,
    });
    expect(invalidTypeResult.valid).toBe(false);
    expect(invalidTypeResult.error).toContain("JPG, PNG y WEBP");
  });

  it("builds sanitized R2 object keys for avatars and prompts", () => {
    const avatarKey = buildR2MediaKey(
      "avatars",
      "user_123",
      "image/webp",
      1700000000000
    );
    expect(avatarKey).toBe("avatars/user_123/1700000000000.webp");

    const promptKey = buildR2MediaKey(
      "prompts",
      "prompt-abc",
      "image/jpeg",
      1700000000500
    );
    expect(promptKey).toBe("prompts/prompt-abc/1700000000500.jpg");
  });

  it("throws an error if entityId is empty after sanitization", () => {
    expect(() =>
      buildR2MediaKey("avatars", "   /.. ", "image/png", 1700000000000)
    ).toThrow("Entity ID cannot be empty");
  });
});
