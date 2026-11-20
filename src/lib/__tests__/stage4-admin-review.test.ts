import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, D1PreparedStatementLike } from "@/lib/cloudflare-env";
import {
  evaluateAlertVoteOutcome,
  openCorrectionWindowForPendingAlertInDb,
  submitCorrectionWindowStoryInDb,
  triggerModificationAlertInDb,
  voteOnModificationAlertInDb,
} from "../stage4-admin-review";

const ORIGINAL_BODY =
  "El faro permaneció apagado durante tres inviernos consecutivos mientras los barcos buscaban la costa en silencio.";

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

describe("Stage 4 Admin Review, Alerts & 24h Correction Window (Step 4.3)", () => {
  it("approves an alert automatically once 2 admin VALIDATE votes are recorded", () => {
    expect(evaluateAlertVoteOutcome([{ decision: "REJECT" }]).isApproved).toBe(false);
    expect(
      evaluateAlertVoteOutcome([
        { decision: "REJECT" },
        { decision: "VALIDATE" },
      ]).isApproved
    ).toBe(false);
    const approved = evaluateAlertVoteOutcome([
      { decision: "REJECT" },
      { decision: "VALIDATE" },
      { decision: "VALIDATE" },
    ]);
    expect(approved.isApproved).toBe(true);
    expect(approved.validateCount).toBe(2);
    expect(approved.rejectCount).toBe(1);
  });

  it("triggers a Round 1 alert with automatic REJECT vote, audit log, and E11 emails to other admins", async () => {
    const { db, executed } = createMockDb();

    const result = await triggerModificationAlertInDb({
      db,
      edition: { id: "ed-1", title: "Olimpíadas 2026" },
      story: {
        id: "story-1",
        authorId: "author-1",
        editedTitle: "El faro",
        originalTitle: "El faro",
      },
      actorAdmin: {
        id: "admin-1",
        email: "admin1@example.com",
        firstName: "Ana",
        lastName: "Pérez",
        name: "Ana Pérez",
      },
      otherAdmins: [
        {
          id: "admin-2",
          email: "admin2@example.com",
          firstName: "Luis",
          lastName: "Gómez",
          name: "Luis Gómez",
        },
      ],
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });

    expect(result.triggered).toBe(true);
    expect(result.notifiedCount).toBe(1);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("story_modification_alerts"))
    ).toBe(true);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("story_alert_votes"))
    ).toBe(true);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("audit_logs"))
    ).toBe(true);
  });

  it("resolves a pending alert to APPROVED on the second VALIDATE vote and blocks duplicate admin votes", async () => {
    const { db } = createMockDb();

    const dup = await voteOnModificationAlertInDb({
      db,
      editionId: "ed-1",
      alert: { id: "al-1", storyId: "story-1", round: 1, status: "PENDING" },
      storyAuthorId: "author-1",
      actorAdminId: "admin-1",
      decision: "VALIDATE",
      existingVotes: [{ adminId: "admin-1", decision: "REJECT" }],
    });
    expect(dup.voted).toBe(false);

    const approved = await voteOnModificationAlertInDb({
      db,
      editionId: "ed-1",
      alert: { id: "al-1", storyId: "story-1", round: 1, status: "PENDING" },
      storyAuthorId: "author-1",
      actorAdminId: "admin-3",
      decision: "VALIDATE",
      existingVotes: [
        { adminId: "admin-1", decision: "REJECT" },
        { adminId: "admin-2", decision: "VALIDATE" },
      ],
    });
    expect(approved.voted).toBe(true);
    expect(approved.newStatus).toBe("APPROVED");
    expect(approved.validateCount).toBe(2);
  });

  it("opens the 24h correction window (E12) and processes Round 2 correction submission (E13)", async () => {
    const { db } = createMockDb();

    const windowRes = await openCorrectionWindowForPendingAlertInDb({
      db,
      edition: {
        id: "ed-1",
        title: "Olimpíadas 2026",
        adminReviewEndAt: "2026-07-10T13:00:00.000Z",
      },
      alertId: "al-1",
      enrollmentId: "enr-1",
      participant: {
        id: "user-1",
        email: "autor@example.com",
        firstName: "Elena",
        lastName: "Mendoza",
        name: "Elena Mendoza",
      },
      storyTitle: "El faro",
      baseUrl: "https://olimpiadas.sitelocuento.com",
      nowIso: "2026-07-10T13:05:00.000Z",
    });

    expect(windowRes.opened).toBe(true);
    expect(windowRes.correctionDeadlineAt).toBe("2026-07-11T13:00:00.000Z");
    expect(windowRes.emailSent).toBe(true);

    const r2Res = await submitCorrectionWindowStoryInDb({
      db,
      edition: {
        id: "ed-1",
        title: "Olimpíadas 2026",
        minChars: 40,
        maxChars: 500,
        minSimilarityPct: 70,
      },
      enrollment: {
        id: "enr-1",
        status: "ACTIVE",
        selectedStoryId: "story-1",
        inCorrectionWindow: true,
        correctionDeadlineAt: "2026-07-11T13:00:00.000Z",
        correctionSubmittedAt: null,
      },
      story: {
        id: "story-1",
        enrollmentId: "enr-1",
        originalBody: ORIGINAL_BODY,
      },
      title: "El faro corregido",
      body: ORIGINAL_BODY,
      allAdmins: [
        {
          id: "admin-1",
          email: "admin1@example.com",
          firstName: "Ana",
          lastName: "Pérez",
          name: "Ana Pérez",
        },
      ],
      triggeredByAdminId: "admin-1",
      baseUrl: "https://olimpiadas.sitelocuento.com",
      nowIso: "2026-07-10T20:00:00.000Z",
    });

    expect(r2Res.submitted).toBe(true);
    expect(r2Res.round2AlertId).toBeTruthy();
    expect(r2Res.notifiedAdmins).toBe(1);
  });
});
