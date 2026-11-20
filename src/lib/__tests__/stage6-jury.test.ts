import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import { DEFAULT_JURY_BRACKETS_JSON } from "@/db/schema";
import type { D1DatabaseBinding, D1PreparedStatementLike } from "@/lib/cloudflare-env";
import {
  castJuryVoteInDb,
  castTieBreakerVoteInDb,
  closeStage5AndSelectJuryFinalistsInDb,
  detectPodiumTie,
  pauseJuryStageForMissingVotesInDb,
  selectTop10WithTies,
} from "../stage6-jury";

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

describe("Stage 6 Jury Evaluation & Conditional Tie-Breaker 6b (Step 5.2)", () => {
  it("selects Top 10 stories including all ties at the 10th-place score cutoff", () => {
    const pool = [
      { id: "s1", participantPoints: 30 },
      { id: "s2", participantPoints: 25 },
      { id: "s3", participantPoints: 22 },
      { id: "s4", participantPoints: 20 },
      { id: "s5", participantPoints: 18 },
      { id: "s6", participantPoints: 16 },
      { id: "s7", participantPoints: 15 },
      { id: "s8", participantPoints: 14 },
      { id: "s9", participantPoints: 12 },
      // 3-way tie at 10th position (10 pts)
      { id: "s10a", participantPoints: 10 },
      { id: "s10b", participantPoints: 10 },
      { id: "s10c", participantPoints: 10 },
      { id: "s13", participantPoints: 5 },
    ];

    const finalists = selectTop10WithTies(pool);
    expect(finalists.length).toBe(12);
    expect(finalists.some((s) => s.id === "s13")).toBe(false);
    expect(finalists.some((s) => s.id === "s10c")).toBe(true);
  });

  it("detects clean podiums as well as 1st/2nd and 3rd place ties", () => {
    const clean = detectPodiumTie([
      { id: "a", totalPoints: 40 },
      { id: "b", totalPoints: 35 },
      { id: "c", totalPoints: 30 },
      { id: "d", totalPoints: 20 },
    ]);
    expect(clean.hasTie).toBe(false);
    if (!clean.hasTie) {
      expect(clean.podium).toEqual({ first: "a", second: "b", third: "c" });
    }

    const tieFirst = detectPodiumTie([
      { id: "a", totalPoints: 40 },
      { id: "b", totalPoints: 40 },
      { id: "c", totalPoints: 30 },
    ]);
    expect(tieFirst.hasTie).toBe(true);
    if (tieFirst.hasTie) {
      expect(tieFirst.tiedPositions).toBe("1_2");
      expect(tieFirst.tiedStoryIds).toEqual(["a", "b"]);
    }

    const tieThird = detectPodiumTie([
      { id: "a", totalPoints: 40 },
      { id: "b", totalPoints: 35 },
      { id: "c", totalPoints: 30 },
      { id: "d", totalPoints: 30 },
    ]);
    expect(tieThird.hasTie).toBe(true);
    if (tieThird.hasTie) {
      expect(tieThird.tiedPositions).toBe("3_ONLY");
      expect(tieThird.tiedStoryIds).toEqual(["c", "d"]);
    }
  });

  it("closes Stage 5 disqualifying non-voters (E17) and marking Top 10+ties as passedToJury", async () => {
    const { db, executed } = createMockDb();

    const usersById = new Map([
      [
        "u1",
        {
          id: "u1",
          email: "voto@example.com",
          firstName: "Ana",
          lastName: "A",
          name: "Ana A",
        },
      ],
      [
        "u2",
        {
          id: "u2",
          email: "novoto@example.com",
          firstName: "Luis",
          lastName: "B",
          name: "Luis B",
        },
      ],
    ]);

    const res = await closeStage5AndSelectJuryFinalistsInDb({
      db,
      edition: { id: "ed-1", title: "Olimpíadas 2026" },
      activeEnrollments: [
        { id: "e1", userId: "u1", hasVoted: true },
        { id: "e2", userId: "u2", hasVoted: false },
      ],
      usersById,
      postulatedStories: [
        { id: "s1", enrollmentId: "e1", participantPoints: 20 },
        { id: "s2", enrollmentId: "e2", participantPoints: 99 },
      ],
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });

    expect(res.disqualifiedCount).toBe(1);
    expect(res.finalistStoryIds).toEqual(["s1"]);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("email_dispatch_logs"))
    ).toBe(true);
  });

  it("pauses Stage 6 closure when a juror is missing and notifies admins via E23", async () => {
    const { db, executed } = createMockDb();

    const res = await pauseJuryStageForMissingVotesInDb({
      db,
      edition: { id: "ed-1", title: "Olimpíadas 2026" },
      admins: [
        {
          id: "adm-1",
          email: "admin@example.com",
          firstName: "Super",
          lastName: "Admin",
          name: "Super Admin",
        },
      ],
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });

    expect(res.paused).toBe(true);
    expect(res.notifiedAdmins).toBe(1);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("jury_paused_missing_votes"))
    ).toBe(true);
  });

  it("applies automatic K multiplier, triggers Stage 6b tie-breaker (E24), and resolves the tie once all jurors vote", async () => {
    const { db } = createMockDb();
    const juror1 = {
      id: "j1",
      email: "j1@example.com",
      firstName: "Jurado",
      lastName: "Uno",
      name: "Jurado Uno",
    };

    // With 15 participants, default bracket gives K=5 (first=15, second=10, third=5)
    // Story s1 has 10 + 15 = 25; Story s2 has 15 + 10 = 25 -> exact 1st/2nd tie!
    const juryRes = await castJuryVoteInDb({
      db,
      edition: {
        id: "ed-1",
        title: "Olimpíadas 2026",
        juryBracketsJson: DEFAULT_JURY_BRACKETS_JSON,
      },
      juror: juror1,
      hasAlreadyVoted: false,
      eligibleFinalists: [
        { id: "s1", participantPoints: 10, juryPoints: 0 },
        { id: "s2", participantPoints: 15, juryPoints: 0 },
        { id: "s3", participantPoints: 5, juryPoints: 0 },
      ],
      activeParticipantsCount: 15,
      firstPlaceStoryId: "s1",
      secondPlaceStoryId: "s2",
      thirdPlaceStoryId: "s3",
      totalJurorsCount: 1,
      existingJuryVotesCount: 0,
      allJurors: [juror1],
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });

    expect(juryRes.voted).toBe(true);
    expect(juryRes.multiplier).toBe(5);
    expect(juryRes.allJurorsVoted).toBe(true);
    expect(juryRes.tieBreakerTriggered).toBe(true);
    expect(juryRes.tieBreakerRoundId).toBeTruthy();

    const tbRes = await castTieBreakerVoteInDb({
      db,
      editionId: "ed-1",
      round: {
        id: juryRes.tieBreakerRoundId ?? "tb-1",
        tiedStoryIds: ["s1", "s2"],
        isResolved: false,
      },
      jurorId: "j1",
      existingRoundVotes: [],
      totalJurorsCount: 1,
      allFinalists: [
        { id: "s1", totalPoints: 25 },
        { id: "s2", totalPoints: 25 },
        { id: "s3", totalPoints: 10 },
      ],
      firstChoiceStoryId: "s2",
    });

    expect(tbRes.voted).toBe(true);
    expect(tbRes.roundResolved).toBe(true);
  });
});
