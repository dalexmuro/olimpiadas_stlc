import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DRIZZLE_CONFIG_OPTIONS } from "../../../drizzle.config";
import { createDbClient, isValidD1Binding } from "../index";
import type { D1DatabaseBinding } from "@/lib/cloudflare-env";

function createMockD1Binding(): D1DatabaseBinding {
  return {
    prepare: () => ({
      bind() {
        return this;
      },
      first: async () => null,
      run: async () => ({ success: true, results: [] }),
      all: async () => ({ success: true, results: [] }),
    }),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
}

describe("Step 1.4 — Drizzle ORM & D1 Configuration", () => {
  it("configures drizzle-kit for SQLite / D1 with migrations directory matching wrangler.jsonc", () => {
    expect(DRIZZLE_CONFIG_OPTIONS.dialect).toBe("sqlite");
    expect(DRIZZLE_CONFIG_OPTIONS.schema).toBe("./src/db/schema.ts");
    expect(DRIZZLE_CONFIG_OPTIONS.out).toBe("./drizzle/migrations");

    const wranglerRaw = fs.readFileSync(
      path.resolve(process.cwd(), "wrangler.jsonc"),
      "utf-8"
    );
    const wrangler = JSON.parse(wranglerRaw) as {
      d1_databases: Array<{ migrations_dir: string }>;
    };
    expect(wrangler.d1_databases[0].migrations_dir).toBe("drizzle/migrations");
  });

  it("validates D1DatabaseBinding structure properly", () => {
    expect(isValidD1Binding(null)).toBe(false);
    expect(isValidD1Binding({})).toBe(false);
    expect(isValidD1Binding({ prepare: () => ({}) })).toBe(false);
    expect(isValidD1Binding(createMockD1Binding())).toBe(true);
  });

  it("creates a Drizzle D1 database client from a valid D1 binding and rejects invalid ones", () => {
    const db = createDbClient(createMockD1Binding());
    expect(db).toBeDefined();
    expect(typeof db.select).toBe("function");
    expect(typeof db.insert).toBe("function");
    expect(typeof db.update).toBe("function");
    expect(typeof db.delete).toBe("function");

    expect(() =>
      createDbClient({} as unknown as D1DatabaseBinding)
    ).toThrow("Invalid Cloudflare D1 binding");
  });
});
