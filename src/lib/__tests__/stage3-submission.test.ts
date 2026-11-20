import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, D1PreparedStatementLike } from "@/lib/cloudflare-env";
import {
  postulateStoryDefinitivelyInDb,
  saveStage3DraftInDb,
  selectStoryForPostulationInDb,
  validateStage3EditInput,
} from "../stage3-submission";

const EDITION = {
  id: "ed-2026",
  title: "Olimpíadas Literarias de SiTeLoCuento 2026",
  minChars: 40,
  maxChars: 500,
  minSimilarityPct: 70,
  submissionStartAt: "2026-07-01T13:00:00.000Z",
  submissionEndAt: "2026-07-05T13:00:00.000Z",
};

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

describe("Stage 3 Story Selection, Editing & Definitive Postulation (Step 4.2)", () => {
  it("validates character bounds and Myers Diff similarity threshold against original Stage 2 story", () => {
    const validEdit = validateStage3EditInput({
      title: "El faro silencioso",
      body: "El viejo faro permaneció apagado durante tres inviernos consecutivos mientras los barcos buscaban la costa en calma.",
      originalBody: ORIGINAL_BODY,
      minChars: 40,
      maxChars: 500,
      minSimilarityPct: 70,
    });
    expect(validEdit.valid).toBe(true);
    expect(validEdit.meetsSimilarityThreshold).toBe(true);
    expect(validEdit.similarityPct).toBeGreaterThan(80);

    const replacedStory = validateStage3EditInput({
      title: "Otro cuento totalmente distinto",
      body: "En una galaxia remota los robots cultivaban naranjas metálicas bajo dos soles púrpura sin recordar la Tierra.",
      originalBody: ORIGINAL_BODY,
      minChars: 40,
      maxChars: 500,
      minSimilarityPct: 70,
    });
    expect(replacedStory.valid).toBe(false);
    expect(replacedStory.meetsSimilarityThreshold).toBe(false);
    expect(replacedStory.errors[0]).toContain("mínimo exigido es 70%");
  });

  it("irreversibly selects a story for postulation and rejects a second selection attempt", async () => {
    const { db, executed } = createMockDb();

    const first = await selectStoryForPostulationInDb({
      db,
      edition: EDITION,
      enrollment: {
        id: "enr-1",
        status: "ACTIVE",
        selectedStoryId: null,
        postulatedAt: null,
      },
      story: {
        id: "story-1",
        enrollmentId: "enr-1",
        originalTitle: "El faro",
        originalBody: ORIGINAL_BODY,
        originalCharCount: ORIGINAL_BODY.length,
      },
      nowIso: "2026-07-02T15:00:00.000Z",
    });

    expect(first.selected).toBe(true);
    expect(first.storyId).toBe("story-1");
    expect(executed.filter((q) => q.sql.toLowerCase().includes("update")).length).toBe(2);

    const second = await selectStoryForPostulationInDb({
      db,
      edition: EDITION,
      enrollment: {
        id: "enr-1",
        status: "ACTIVE",
        selectedStoryId: "story-1",
        postulatedAt: null,
      },
      story: {
        id: "story-2",
        enrollmentId: "enr-1",
        originalTitle: "Otro",
        originalBody: ORIGINAL_BODY,
        originalCharCount: ORIGINAL_BODY.length,
      },
      nowIso: "2026-07-02T16:00:00.000Z",
    });

    expect(second.selected).toBe(false);
    expect(second.error).toContain("irreversible");
  });

  it("allows unlimited draft edits before postulation while enforcing similarity and length", async () => {
    const { db } = createMockDb();

    const draftOk = await saveStage3DraftInDb({
      db,
      edition: EDITION,
      enrollment: {
        id: "enr-1",
        status: "ACTIVE",
        selectedStoryId: "story-1",
      },
      story: {
        id: "story-1",
        enrollmentId: "enr-1",
        originalBody: ORIGINAL_BODY,
        isPostulated: false,
      },
      title: "El faro de tres inviernos",
      body: "El faro permaneció apagado durante tres inviernos largos mientras los barcos buscaban la costa en silencio.",
      nowIso: "2026-07-03T10:00:00.000Z",
    });

    expect(draftOk.saved).toBe(true);
    expect(draftOk.similarityPct).toBeGreaterThan(80);

    const lockedAfterPostulation = await saveStage3DraftInDb({
      db,
      edition: EDITION,
      enrollment: {
        id: "enr-1",
        status: "ACTIVE",
        selectedStoryId: "story-1",
      },
      story: {
        id: "story-1",
        enrollmentId: "enr-1",
        originalBody: ORIGINAL_BODY,
        isPostulated: true,
      },
      title: "Intento tardío",
      body: ORIGINAL_BODY,
      nowIso: "2026-07-03T11:00:00.000Z",
    });

    expect(lockedAfterPostulation.saved).toBe(false);
    expect(lockedAfterPostulation.error).toContain("postulado definitivamente");
  });

  it("postulates definitively (irreversible) and dispatches E10 confirmation email", async () => {
    const { db, executed } = createMockDb();

    const result = await postulateStoryDefinitivelyInDb({
      db,
      edition: EDITION,
      enrollment: {
        id: "enr-1",
        status: "ACTIVE",
        selectedStoryId: "story-1",
      },
      story: {
        id: "story-1",
        enrollmentId: "enr-1",
        originalBody: ORIGINAL_BODY,
        isPostulated: false,
      },
      user: {
        id: "user-1",
        email: "escritor@example.com",
        firstName: "Elena",
        lastName: "Mendoza",
        name: "Elena Mendoza",
      },
      title: "El faro apagado",
      body: ORIGINAL_BODY,
      baseUrl: "https://olimpiadas.sitelocuento.com",
      nowIso: "2026-07-04T10:00:00.000Z",
    });

    expect(result.postulated).toBe(true);
    expect(result.similarityPct).toBe(100);
    expect(result.emailSent).toBe(true);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("email_dispatch_logs"))
    ).toBe(true);
  });
});
