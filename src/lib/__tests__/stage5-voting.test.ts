import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, D1PreparedStatementLike } from "@/lib/cloudflare-env";
import {
  castParticipantVoteInDb,
  fnv1a32,
  sortStoriesDeterministicallyForVoter,
  toggleStoryReadOrPreselectionInDb,
  validateTop3VoteSelection,
} from "../stage5-voting";

const EDITION = {
  id: "ed-2026",
  title: "Olimpíadas Literarias de SiTeLoCuento 2026",
  votingStartAt: "2026-07-15T13:00:00.000Z",
  votingEndAt: "2026-07-22T13:00:00.000Z",
};

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

describe("Stage 5 Participant Voting (Step 5.1)", () => {
  it("randomizes story order deterministically per voter using fnv1a32", () => {
    const items = [
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
      { id: "s4" },
      { id: "s5" },
      { id: "s6" },
    ];

    expect(fnv1a32("user-a:s1")).toBe(fnv1a32("user-a:s1"));
    expect(fnv1a32("user-a:s1")).not.toBe(fnv1a32("user-b:s1"));

    const orderA1 = sortStoriesDeterministicallyForVoter("user-a", items).map(
      (i) => i.id
    );
    const orderA2 = sortStoriesDeterministicallyForVoter("user-a", items).map(
      (i) => i.id
    );
    const orderB = sortStoriesDeterministicallyForVoter("user-b", items).map(
      (i) => i.id
    );

    expect(orderA1).toEqual(orderA2);
    expect(orderA1).not.toEqual(orderB);
  });

  it("validates Top 3 ballot uniqueness, eligibility, and blocks self-voting", () => {
    const eligible = new Set(["s1", "s2", "s3", "s4"]);

    expect(
      validateTop3VoteSelection({
        firstPlaceStoryId: "s2",
        secondPlaceStoryId: "s3",
        thirdPlaceStoryId: "s4",
        eligibleStoryIds: eligible,
        ownStoryId: "s1",
      }).valid
    ).toBe(true);

    const selfVote = validateTop3VoteSelection({
      firstPlaceStoryId: "s1",
      secondPlaceStoryId: "s2",
      thirdPlaceStoryId: "s3",
      eligibleStoryIds: eligible,
      ownStoryId: "s1",
    });
    expect(selfVote.valid).toBe(false);
    expect(selfVote.error).toContain("propio cuento");

    const duplicate = validateTop3VoteSelection({
      firstPlaceStoryId: "s2",
      secondPlaceStoryId: "s2",
      thirdPlaceStoryId: "s3",
      eligibleStoryIds: eligible,
      ownStoryId: "s1",
    });
    expect(duplicate.valid).toBe(false);
  });

  it("blocks preselecting own story while allowing read/preselection toggles on others", async () => {
    const { db } = createMockDb();

    const blocked = await toggleStoryReadOrPreselectionInDb({
      db,
      editionId: "ed-2026",
      voterId: "u1",
      storyId: "s1",
      isOwnStory: true,
      isPreselected: true,
    });
    expect(blocked.updated).toBe(false);
    expect(blocked.error).toContain("propio cuento");

    const ok = await toggleStoryReadOrPreselectionInDb({
      db,
      editionId: "ed-2026",
      voterId: "u1",
      storyId: "s2",
      isOwnStory: false,
      isRead: true,
      isPreselected: true,
    });
    expect(ok.updated).toBe(true);
    expect(ok.isRead).toBe(true);
    expect(ok.isPreselected).toBe(true);
  });

  it("records definitive Top 3 vote (3/2/1 pts), dispatches E16, and blocks double voting", async () => {
    const { db, executed } = createMockDb();

    const result = await castParticipantVoteInDb({
      db,
      edition: EDITION,
      enrollment: {
        id: "enr-1",
        status: "ACTIVE",
        hasVoted: false,
        selectedStoryId: "s1",
      },
      user: {
        id: "user-1",
        email: "votante@example.com",
        firstName: "Carlos",
        lastName: "Ruiz",
        name: "Carlos Ruiz",
      },
      eligibleStoryIds: new Set(["s1", "s2", "s3", "s4"]),
      firstPlaceStoryId: "s2",
      secondPlaceStoryId: "s3",
      thirdPlaceStoryId: "s4",
      baseUrl: "https://olimpiadas.sitelocuento.com",
      nowIso: "2026-07-18T15:00:00.000Z",
    });

    expect(result.voted).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(executed.some((q) => q.sql.toLowerCase().includes("into \"votes\""))).toBe(
      true
    );

    const secondAttempt = await castParticipantVoteInDb({
      db,
      edition: EDITION,
      enrollment: {
        id: "enr-1",
        status: "ACTIVE",
        hasVoted: true,
        selectedStoryId: "s1",
      },
      user: {
        id: "user-1",
        email: "votante@example.com",
        firstName: "Carlos",
        lastName: "Ruiz",
        name: "Carlos Ruiz",
      },
      eligibleStoryIds: new Set(["s1", "s2", "s3", "s4"]),
      firstPlaceStoryId: "s2",
      secondPlaceStoryId: "s3",
      thirdPlaceStoryId: "s4",
      baseUrl: "https://olimpiadas.sitelocuento.com",
      nowIso: "2026-07-18T16:00:00.000Z",
    });

    expect(secondAttempt.voted).toBe(false);
    expect(secondAttempt.error).toContain("Ya registraste tu voto");
  });
});
