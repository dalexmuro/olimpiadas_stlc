import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, D1PreparedStatementLike } from "@/lib/cloudflare-env";
import { isWithinLeadingWindowHours, runContestCronTick } from "../cron-runner";

function createMockEmptyDb() {
  const mockD1: D1DatabaseBinding = {
    prepare(): D1PreparedStatementLike {
      const stmt: D1PreparedStatementLike = {
        bind() {
          return stmt;
        },
        async first<T = Record<string, unknown>>() {
          return null as T | null;
        },
        async all<T = Record<string, unknown>>() {
          return { results: [] as T[], success: true };
        },
        async raw<T = unknown[]>() {
          return [] as T[];
        },
        async run<T = Record<string, unknown>>() {
          return { success: true, results: [] as T[] };
        },
      };
      return stmt;
    },
    async batch<T = unknown>(statements: D1PreparedStatementLike[]) {
      return (await Promise.all(statements.map((s) => s.run()))) as unknown as T[];
    },
    async exec() {
      return { count: 1, duration: 0 };
    },
  };

  return createDbClient(mockD1);
}

describe("Cloudflare Cron Trigger Engine (Step 6.4)", () => {
  it("accurately evaluates 24h and 1h leading reminder windows", () => {
    const target = "2026-06-15T13:00:00.000Z";

    // 25h before -> false for 24h window
    expect(
      isWithinLeadingWindowHours(
        Date.parse("2026-06-14T12:00:00.000Z"),
        target,
        24
      )
    ).toBe(false);

    // 12h before -> true for 24h window, false for 1h window
    expect(
      isWithinLeadingWindowHours(
        Date.parse("2026-06-15T01:00:00.000Z"),
        target,
        24
      )
    ).toBe(true);
    expect(
      isWithinLeadingWindowHours(
        Date.parse("2026-06-15T01:00:00.000Z"),
        target,
        1
      )
    ).toBe(false);

    // 30m before -> true for 1h window
    expect(
      isWithinLeadingWindowHours(
        Date.parse("2026-06-15T12:30:00.000Z"),
        target,
        1
      )
    ).toBe(true);

    // After target -> false
    expect(
      isWithinLeadingWindowHours(
        Date.parse("2026-06-15T13:05:00.000Z"),
        target,
        1
      )
    ).toBe(false);
  });

  it("safely returns processed=false when no active edition exists", async () => {
    const db = createMockEmptyDb();
    const summary = await runContestCronTick({
      db,
      baseUrl: "https://olimpiadas.sitelocuento.com",
      nowIso: "2026-06-15T12:30:00.000Z",
    });

    expect(summary.processed).toBe(false);
    expect(summary.remindersSent).toBe(0);
    expect(summary.promptsClosed).toBe(0);
    expect(summary.disqualificationsApplied).toBe(0);
  });
});
