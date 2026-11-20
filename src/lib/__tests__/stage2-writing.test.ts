import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, D1PreparedStatementLike } from "@/lib/cloudflare-env";
import {
  buildLocalDraftStorageKey,
  countStoryBodyChars,
  resolveStage2ViewState,
  submitStage2StoryInDb,
  validateStage2StoryInput,
  type Stage2PromptSnapshot,
} from "../stage2-writing";

const PROMPTS: Stage2PromptSnapshot[] = [
  {
    id: "p1",
    promptNumber: 1,
    title: "El reloj detenido",
    body: "Escribe sobre un reloj que se detuvo exactamente a las 4:00 PM.",
    mediaType: null,
    mediaUrl: null,
    publishedAt: "2026-06-10T13:00:00.000Z",
    closesAt: "2026-06-12T13:00:00.000Z",
  },
  {
    id: "p2",
    promptNumber: 2,
    title: "Cartas sin remitente",
    body: "Un sobre amarillo aparece debajo de la puerta.",
    mediaType: null,
    mediaUrl: null,
    publishedAt: "2026-06-14T13:00:00.000Z",
    closesAt: "2026-06-16T13:00:00.000Z",
  },
];

function createMockStoryDb(existingStoryId: string | null = null) {
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
          if (query.toLowerCase().includes("select") && existingStoryId) {
            return [[existingStoryId]] as unknown as T[];
          }
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

describe("Stage 2 Prompt Writing Marathon (Step 3.3)", () => {
  it("counts every character including spaces and validates min/max and title bounds", () => {
    expect(countStoryBodyChars("Hola mundo\n")).toBe(11);

    const tooShort = validateStage2StoryInput({
      title: "Mi cuento",
      body: "Muy corto",
      minChars: 50,
      maxChars: 200,
    });
    expect(tooShort.valid).toBe(false);
    expect(tooShort.errors[0]).toContain("mínimo permitido es 50");

    const tooLong = validateStage2StoryInput({
      title: "a".repeat(151),
      body: "x".repeat(205),
      minChars: 50,
      maxChars: 200,
    });
    expect(tooLong.valid).toBe(false);
    expect(tooLong.errors.length).toBe(2);

    const valid = validateStage2StoryInput({
      title: "La casa del árbol",
      body: "a".repeat(100),
      minChars: 50,
      maxChars: 200,
    });
    expect(valid.valid).toBe(true);
    expect(valid.charCount).toBe(100);
  });

  it("resolves OPEN_PROMPT, WAITING_NEXT_PROMPT, WAITING_SUBMISSION_STAGE, and DISQUALIFIED states", () => {
    const open = resolveStage2ViewState({
      enrollmentStatus: "ACTIVE",
      prompts: PROMPTS,
      submissionStartAt: "2026-06-19T13:00:00.000Z",
      nowIso: "2026-06-11T10:00:00.000Z",
    });
    expect(open.kind).toBe("OPEN_PROMPT");
    if (open.kind === "OPEN_PROMPT") {
      expect(open.prompt.id).toBe("p1");
    }

    const waitingNext = resolveStage2ViewState({
      enrollmentStatus: "ACTIVE",
      prompts: PROMPTS,
      submissionStartAt: "2026-06-19T13:00:00.000Z",
      nowIso: "2026-06-13T10:00:00.000Z",
    });
    expect(waitingNext.kind).toBe("WAITING_NEXT_PROMPT");
    if (waitingNext.kind === "WAITING_NEXT_PROMPT") {
      expect(waitingNext.nextPromptNumber).toBe(2);
    }

    const waitingSubmission = resolveStage2ViewState({
      enrollmentStatus: "ACTIVE",
      prompts: PROMPTS,
      submissionStartAt: "2026-06-19T13:00:00.000Z",
      nowIso: "2026-06-17T10:00:00.000Z",
    });
    expect(waitingSubmission.kind).toBe("WAITING_SUBMISSION_STAGE");

    const disqualified = resolveStage2ViewState({
      enrollmentStatus: "DISQUALIFIED",
      disqualificationReason: "MAX_MISSES",
      prompts: PROMPTS,
      submissionStartAt: "2026-06-19T13:00:00.000Z",
      nowIso: "2026-06-11T10:00:00.000Z",
    });
    expect(disqualified.kind).toBe("DISQUALIFIED");
    if (disqualified.kind === "DISQUALIFIED") {
      expect(disqualified.reasonLabel).toContain("límite máximo");
    }
  });

  it("inserts a new story when none exists and updates the existing story on unlimited re-edits", async () => {
    const { db: dbInsert, executed: execInsert } = createMockStoryDb(null);
    const resInsert = await submitStage2StoryInDb({
      db: dbInsert,
      edition: { id: "ed-1", minChars: 20, maxChars: 500 },
      enrollment: { id: "enr-1", status: "ACTIVE" },
      prompt: PROMPTS[0],
      userId: "user-1",
      title: "Primera versión",
      body: "Este es un cuento válido con suficientes caracteres para probar.",
      nowIso: "2026-06-11T10:00:00.000Z",
    });

    expect(resInsert.saved).toBe(true);
    expect(resInsert.updatedExisting).toBe(false);
    expect(execInsert.some((q) => q.sql.toLowerCase().includes("insert"))).toBe(
      true
    );

    const { db: dbUpdate, executed: execUpdate } = createMockStoryDb("story-99");
    const resUpdate = await submitStage2StoryInDb({
      db: dbUpdate,
      edition: { id: "ed-1", minChars: 20, maxChars: 500 },
      enrollment: { id: "enr-1", status: "ACTIVE" },
      prompt: PROMPTS[0],
      userId: "user-1",
      title: "Segunda versión corregida",
      body: "Texto actualizado antes del cierre de la consigna número uno.",
      nowIso: "2026-06-11T18:00:00.000Z",
    });

    expect(resUpdate.saved).toBe(true);
    expect(resUpdate.updatedExisting).toBe(true);
    expect(resUpdate.storyId).toBe("story-99");
    expect(execUpdate.some((q) => q.sql.toLowerCase().includes("update"))).toBe(
      true
    );
  });

  it("rejects submissions after prompt close or from disqualified participants and builds deterministic draft keys", async () => {
    const { db } = createMockStoryDb(null);

    const lateResult = await submitStage2StoryInDb({
      db,
      edition: { id: "ed-1", minChars: 10, maxChars: 500 },
      enrollment: { id: "enr-1", status: "ACTIVE" },
      prompt: PROMPTS[0],
      userId: "user-1",
      title: "Tarde",
      body: "Texto enviado después de cerrar la consigna.",
      nowIso: "2026-06-12T13:00:01.000Z",
    });
    expect(lateResult.saved).toBe(false);
    expect(lateResult.error).toContain("ya cerró");

    const dqResult = await submitStage2StoryInDb({
      db,
      edition: { id: "ed-1", minChars: 10, maxChars: 500 },
      enrollment: { id: "enr-1", status: "DISQUALIFIED" },
      prompt: PROMPTS[0],
      userId: "user-1",
      title: "Descalificado",
      body: "Texto enviado por participante descalificado.",
      nowIso: "2026-06-11T10:00:00.000Z",
    });
    expect(dqResult.saved).toBe(false);
    expect(dqResult.error).toContain("descalificada");

    expect(buildLocalDraftStorageKey("ed-1", "p1", "u1")).toBe(
      "stlc:draft:v1:ed-1:p1:u1"
    );
  });
});
