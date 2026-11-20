import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, D1PreparedStatementLike } from "@/lib/cloudflare-env";
import {
  evaluatePublishWinnersReadiness,
  publishWinnersInDb,
  sortPublishedEditionStoriesChronologically,
} from "../stage7-winners";

function createMockDb() {
  const executed: Array<{ sql: string; params: unknown[] }> = [];

  const mockD1: D1DatabaseBinding = {
    prepare(query: string): D1PreparedStatementLike {
      let boundParams: unknown[] = [];
      const stmt: D1PreparedStatementLike = {
        bind(...values: unknown[]) {
          boundParams = values;
          return stmt;
        },
        async first<T = Record<string, unknown>>() {
          return null as T | null;
        },
        async all<T = Record<string, unknown>>() {
          return { results: [] as T[], success: true };
        },
        async raw<T = unknown[]>() {
          executed.push({ sql: query, params: boundParams });
          return [] as T[];
        },
        async run<T = Record<string, unknown>>() {
          executed.push({ sql: query, params: boundParams });
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

  return { db: createDbClient(mockD1), executed };
}

describe("Stage 7 Winners Announcement & Public Archive (Step 6.1)", () => {
  it("evaluates publish readiness requiring all jury votes and no active tie-breakers", () => {
    expect(
      evaluatePublishWinnersReadiness({
        edition: {
          winnersAnnounced: false,
          tieBreakerActive: false,
          juryPausedMissingVotes: false,
        },
        totalJurorsCount: 3,
        juryVotesCount: 2,
        hasUnresolvedTieBreaker: false,
      }).ready
    ).toBe(false);

    expect(
      evaluatePublishWinnersReadiness({
        edition: {
          winnersAnnounced: false,
          tieBreakerActive: true,
          juryPausedMissingVotes: false,
        },
        totalJurorsCount: 3,
        juryVotesCount: 3,
        hasUnresolvedTieBreaker: true,
      }).ready
    ).toBe(false);

    expect(
      evaluatePublishWinnersReadiness({
        edition: {
          winnersAnnounced: false,
          tieBreakerActive: false,
          juryPausedMissingVotes: false,
        },
        totalJurorsCount: 3,
        juryVotesCount: 3,
        hasUnresolvedTieBreaker: false,
      }).ready
    ).toBe(true);
  });

  it("sorts published edition stories strictly chronologically by prompt number then submission date", () => {
    const sorted = sortPublishedEditionStoriesChronologically([
      { id: "c", promptNumber: 2, submittedAt: "2026-06-15T10:00:00.000Z" },
      { id: "b", promptNumber: 1, submittedAt: "2026-06-11T18:00:00.000Z" },
      { id: "a", promptNumber: 1, submittedAt: "2026-06-11T09:00:00.000Z" },
    ]);

    expect(sorted.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("publishes winners, writes PUBLISH_WINNERS audit log, and broadcasts E26 to deduplicated stakeholders", async () => {
    const { db, executed } = createMockDb();

    const res = await publishWinnersInDb({
      db,
      edition: {
        id: "ed-2026",
        title: "Olimpíadas Literarias 2026",
        slug: "olimpiadas-2026",
        winnersAnnounced: false,
        tieBreakerActive: false,
        juryPausedMissingVotes: false,
      },
      actorAdminId: "admin-1",
      totalJurorsCount: 3,
      juryVotesCount: 3,
      hasUnresolvedTieBreaker: false,
      recipients: [
        {
          id: "u1",
          email: "p1@example.com",
          firstName: "Ana",
          lastName: "A",
          name: "Ana A",
        },
        {
          id: "u2",
          email: "j1@example.com",
          firstName: "Luis",
          lastName: "B",
          name: "Luis B",
        },
        // Duplicate ID should be deduplicated
        {
          id: "u2",
          email: "j1@example.com",
          firstName: "Luis",
          lastName: "B",
          name: "Luis B",
        },
      ],
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });

    expect(res.published).toBe(true);
    expect(res.notifiedCount).toBe(2);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("audit_logs"))
    ).toBe(true);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("winners_announced"))
    ).toBe(true);
  });
});
