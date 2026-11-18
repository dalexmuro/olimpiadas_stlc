import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDbClient } from "../index";
import type { D1DatabaseBinding } from "@/lib/cloudflare-env";
import {
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_SITE_PAGES,
  EMAIL_TEMPLATE_TAGS,
  buildSeedSqlStatements,
  seedInitialData,
  shouldPromoteToSuperadmin,
} from "../seed";

function createRecordingD1Binding(existingUsersRawRows: unknown[][] = []): {
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
        raw: async <T = unknown[]>() => existingUsersRawRows as unknown as T[],
      };
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  return { binding, queries };
}

describe("Step 1.7 — Database Seed (E01-E26 Templates, Site Pages & Superadmin Promotion)", () => {
  it("defines all 26 email templates (E01 to E26) in exact sequence with valid tags", () => {
    expect(DEFAULT_EMAIL_TEMPLATES).toHaveLength(26);

    const expectedCodes = Array.from({ length: 26 }, (_, idx) =>
      `E${String(idx + 1).padStart(2, "0")}`
    );
    expect(DEFAULT_EMAIL_TEMPLATES.map((t) => t.code)).toEqual(expectedCodes);

    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      expect(tpl.name.length).toBeGreaterThan(5);
      expect(tpl.description.length).toBeGreaterThan(10);
      expect(tpl.subjectTemplate.length).toBeGreaterThan(5);
      expect(tpl.bodyHtmlTemplate).toContain("<p>");
      expect(tpl.availableTags.length).toBeGreaterThanOrEqual(1);

      for (const tag of tpl.availableTags) {
        expect(EMAIL_TEMPLATE_TAGS).toContain(tag);
      }
    }
  });

  it("defines initial content for both static public pages (Bases del Concurso & Quienes somos)", () => {
    expect(DEFAULT_SITE_PAGES).toHaveLength(2);
    expect(DEFAULT_SITE_PAGES.map((p) => p.slug)).toEqual([
      "bases-del-concurso",
      "quienes-somos",
    ]);

    for (const page of DEFAULT_SITE_PAGES) {
      expect(page.title).toContain("SiTeLoCuento");
      expect(page.contentHtml).toContain("<h2>");
    }
  });

  it("evaluates SUPERADMIN_INITIAL_EMAIL promotion case-insensitively", () => {
    expect(
      shouldPromoteToSuperadmin("dalexmuro@gmail.com", "dalexmuro@gmail.com")
    ).toBe(true);
    expect(
      shouldPromoteToSuperadmin(
        "  DALEXMURO@GMAIL.COM ",
        "dalexmuro@gmail.com"
      )
    ).toBe(true);
    expect(
      shouldPromoteToSuperadmin("otro@ejemplo.com", "dalexmuro@gmail.com")
    ).toBe(false);
    expect(shouldPromoteToSuperadmin("dalexmuro@gmail.com", "")).toBe(false);
    expect(shouldPromoteToSuperadmin("dalexmuro@gmail.com", undefined)).toBe(
      false
    );
  });

  it("executes seedInitialData and promotes existing matching superadmin user", async () => {
    const { binding, queries } = createRecordingD1Binding([
      [
        "user_1",
        "Dalex",
        "dalexmuro@gmail.com",
        1,
        null,
        "Dalex",
        "Muro",
        "VE",
        "+58000",
        null,
        1,
        "PARTICIPANT",
        "2026-11-18T00:00:00.000Z",
        "2026-11-18T00:00:00.000Z",
      ],
    ]);
    const db = createDbClient(binding);

    const result = await seedInitialData(db, {
      initialSuperadminEmail: "dalexmuro@gmail.com",
      nowIso: "2026-11-18T12:00:00.000Z",
    });

    expect(result).toEqual({
      templatesSeeded: 26,
      pagesSeeded: 2,
      superadminPromoted: true,
    });
    // 26 template inserts + 2 site_pages inserts + 1 user select + 1 user update = 30 queries
    expect(queries).toHaveLength(30);
  });

  it("generates idempotent SQL seed statements for D1 CLI and remote execution", () => {
    const statements = buildSeedSqlStatements({
      initialSuperadminEmail: "dalexmuro@gmail.com",
      nowIso: "2026-11-18T12:00:00.000Z",
    });

    expect(statements).toHaveLength(29);
    expect(statements[0]).toContain("INSERT OR IGNORE INTO email_templates");
    expect(statements[26]).toContain("INSERT OR IGNORE INTO site_pages");
    expect(statements[28]).toContain("UPDATE users SET role = 'SUPERADMIN'");
    expect(statements[28]).toContain("'dalexmuro@gmail.com'");

    const seedFilePath = path.resolve(process.cwd(), "drizzle/seed.sql");
    fs.writeFileSync(seedFilePath, statements.join("\n") + "\n", "utf-8");
    expect(fs.existsSync(seedFilePath)).toBe(true);
  });
});
