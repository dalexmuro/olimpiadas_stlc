import { describe, expect, it } from "vitest";
import type { CloudflareEnv, D1DatabaseBinding, R2BucketBinding } from "../cloudflare-env";
import { handleScheduledContestCron } from "../worker-scheduled";

describe("Cloudflare Worker Scheduled Cron Handler (AUD-003)", () => {
  it("invokes runContestCronTick against Cloudflare D1 bindings", async () => {
    const queries: string[] = [];
    const mockDb: D1DatabaseBinding = {
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
          raw: async <T = unknown[]>() => [] as unknown as T[],
        };
      },
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    };

    const mockR2: R2BucketBinding = {
      get: async () => null,
      put: async () => null,
      delete: async () => undefined,
    };

    const env: CloudflareEnv = {
      DB: mockDb,
      MEDIA_BUCKET: mockR2,
      APP_ENV: "dev",
      BETTER_AUTH_URL: "https://dev-olimpiadas.sitelocuento.com",
      EMAIL_FROM_ADDRESS: "olimpiadas@sitelocuento.com",
      EMAIL_FROM_NAME: "Olimpíadas Literarias",
    };

    const summary = await handleScheduledContestCron(env);
    expect(summary.editionId).toBeUndefined();
    expect(queries.some((q) => q.includes('from "editions"'))).toBe(true);
  });
});
