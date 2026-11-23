import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CLOUDFLARE_ENVIRONMENTS } from "../cloudflare-resources";
import { validateCloudflareEnv } from "../cloudflare-env";

interface WranglerD1Entry {
  binding: string;
  database_name: string;
  database_id: string;
  migrations_dir: string;
}

interface WranglerR2Entry {
  binding: string;
  bucket_name: string;
}

interface WranglerConfigShape {
  name: string;
  main: string;
  compatibility_flags: string[];
  d1_databases: WranglerD1Entry[];
  r2_buckets: WranglerR2Entry[];
  triggers: { crons: string[] };
  vars: Record<string, string>;
  env: {
    dev: {
      name: string;
      d1_databases: WranglerD1Entry[];
      r2_buckets: WranglerR2Entry[];
      triggers: { crons: string[] };
      vars: Record<string, string>;
    };
  };
}

describe("Step 1.3 — Wrangler Configuration & Bindings Validation", () => {
  it("keeps wrangler.jsonc synchronized with CLOUDFLARE_ENVIRONMENTS for prod and dev", () => {
    const wranglerPath = path.resolve(process.cwd(), "wrangler.jsonc");
    const rawContent = fs.readFileSync(wranglerPath, "utf-8");
    const parsed = JSON.parse(rawContent) as WranglerConfigShape;

    expect(parsed.main).toBe(".open-next/worker.js");
    expect(parsed.compatibility_flags).toContain("nodejs_compat");

    // Production bindings
    expect(parsed.d1_databases).toHaveLength(1);
    expect(parsed.d1_databases[0]).toEqual({
      binding: "DB",
      database_name: CLOUDFLARE_ENVIRONMENTS.prod.d1DatabaseName,
      database_id: CLOUDFLARE_ENVIRONMENTS.prod.d1DatabaseId,
      migrations_dir: "drizzle/migrations",
    });
    expect(parsed.r2_buckets).toEqual([
      {
        binding: "MEDIA_BUCKET",
        bucket_name: CLOUDFLARE_ENVIRONMENTS.prod.r2BucketName,
      },
    ]);
    expect(parsed.triggers.crons).toEqual([
      CLOUDFLARE_ENVIRONMENTS.prod.cronSchedule,
    ]);

    // Development bindings
    const devEnv = parsed.env.dev;
    expect(devEnv.d1_databases).toHaveLength(1);
    expect(devEnv.d1_databases[0]).toEqual({
      binding: "DB",
      database_name: CLOUDFLARE_ENVIRONMENTS.dev.d1DatabaseName,
      database_id: CLOUDFLARE_ENVIRONMENTS.dev.d1DatabaseId,
      migrations_dir: "drizzle/migrations",
    });
    expect(devEnv.r2_buckets).toEqual([
      {
        binding: "MEDIA_BUCKET",
        bucket_name: CLOUDFLARE_ENVIRONMENTS.dev.r2BucketName,
      },
    ]);
    expect(devEnv.triggers.crons).toEqual([
      CLOUDFLARE_ENVIRONMENTS.dev.cronSchedule,
    ]);
  });

  it("validates presence of DB and MEDIA_BUCKET bindings", () => {
    const emptyResult = validateCloudflareEnv({});
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.missingBindings).toEqual(["DB", "MEDIA_BUCKET"]);

    const validBindingsOnly = validateCloudflareEnv({
      DB: { prepare: () => ({}) },
      MEDIA_BUCKET: { get: async () => null },
    });
    expect(validBindingsOnly.valid).toBe(true);
    expect(validBindingsOnly.missingBindings).toEqual([]);
  });

  it("validates required runtime secrets when requireSecrets is true", () => {
    const missingSecretsResult = validateCloudflareEnv(
      {
        DB: { prepare: () => ({}) },
        MEDIA_BUCKET: { get: async () => null },
        BETTER_AUTH_SECRET: "secret-123",
      },
      { requireSecrets: true }
    );

    expect(missingSecretsResult.valid).toBe(false);
    expect(missingSecretsResult.missingSecrets).toContain("BREVO_API_KEY");
    expect(missingSecretsResult.missingSecrets).toContain("GOOGLE_CLIENT_ID");

    const completeEnvResult = validateCloudflareEnv(
      {
        DB: { prepare: () => ({}) },
        MEDIA_BUCKET: { get: async () => null },
        BETTER_AUTH_SECRET: "secret-123",
        BREVO_API_KEY: "xkeysib-123",
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "google-secret",
        SUPERADMIN_INITIAL_EMAIL: "superadmin@example.com",
      },
      { requireSecrets: true }
    );

    expect(completeEnvResult.valid).toBe(true);
    expect(completeEnvResult.missingSecrets).toEqual([]);
  });
});
