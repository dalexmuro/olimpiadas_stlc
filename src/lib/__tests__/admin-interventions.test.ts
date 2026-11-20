import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, D1PreparedStatementLike } from "@/lib/cloudflare-env";
import {
  adminUploadOrEditLateStoryInDb,
  manualDisqualifyParticipantInDb,
  manualReinstateParticipantInDb,
  validateJustification,
} from "../admin-interventions";

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

const ADMIN = {
  id: "adm-1",
  email: "admin@example.com",
  firstName: "Ana",
  lastName: "Admin",
  name: "Ana Admin",
};

const PARTICIPANT = {
  id: "usr-1",
  email: "autor@example.com",
  firstName: "Carlos",
  lastName: "Ruiz",
  name: "Carlos Ruiz",
};

describe("Admin Participant Interventions & Audit Log (Step 6.3)", () => {
  it("requires a non-empty justification of at least 5 characters", () => {
    expect(validateJustification("   ").valid).toBe(false);
    expect(validateJustification("abc").valid).toBe(false);
    expect(validateJustification("Entrega tardía aprobada por el equipo").valid).toBe(
      true
    );
  });

  it("manually disqualifies an active participant, writes DISQUALIFY_USER log, and sends E18 to participant and admins", async () => {
    const { db, executed } = createMockDb();

    const res = await manualDisqualifyParticipantInDb({
      db,
      edition: { id: "ed-1", title: "Olimpíadas 2026" },
      enrollment: { id: "enr-1", status: "ACTIVE" },
      participant: PARTICIPANT,
      actorAdmin: ADMIN,
      allAdmins: [ADMIN],
      justification: "Incumplimiento comprobado de las bases del concurso.",
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });

    expect(res.disqualified).toBe(true);
    expect(res.notifiedAdmins).toBe(1);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("audit_logs"))
    ).toBe(true);
  });

  it("manually reinstates a disqualified participant, writes REINSTATE_USER log, and sends E19", async () => {
    const { db, executed } = createMockDb();

    const res = await manualReinstateParticipantInDb({
      db,
      edition: { id: "ed-1", title: "Olimpíadas 2026" },
      enrollment: { id: "enr-1", status: "DISQUALIFIED" },
      participant: PARTICIPANT,
      actorAdmin: ADMIN,
      justification: "Error técnico verificado durante el envío.",
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });

    expect(res.reinstated).toBe(true);
    expect(res.emailSent).toBe(true);
    expect(
      executed.some((q) => q.sql.toLowerCase().includes("audit_logs"))
    ).toBe(true);
  });

  it("uploads a late story validating min/max chars and auto-reactivates a MAX_MISSES disqualified participant with E19", async () => {
    const { db } = createMockDb();

    const tooShort = await adminUploadOrEditLateStoryInDb({
      db,
      edition: {
        id: "ed-1",
        title: "Olimpíadas 2026",
        minChars: 50,
        maxChars: 500,
        maxAllowedMisses: 2,
      },
      enrollment: {
        id: "enr-1",
        status: "DISQUALIFIED",
        disqualificationReason: "MAX_MISSES",
        missesCount: 3,
      },
      participant: PARTICIPANT,
      promptId: "p3",
      actorAdmin: ADMIN,
      title: "Corto",
      body: "Muy breve",
      justification: "Falla eléctrica reportada a tiempo.",
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });
    expect(tooShort.saved).toBe(false);

    const ok = await adminUploadOrEditLateStoryInDb({
      db,
      edition: {
        id: "ed-1",
        title: "Olimpíadas 2026",
        minChars: 30,
        maxChars: 500,
        maxAllowedMisses: 2,
      },
      enrollment: {
        id: "enr-1",
        status: "DISQUALIFIED",
        disqualificationReason: "MAX_MISSES",
        missesCount: 3,
      },
      participant: PARTICIPANT,
      promptId: "p3",
      actorAdmin: ADMIN,
      title: "El puente de piedra",
      body: "El participante envió este cuento por correo antes del corte debido a un apagón eléctrico.",
      justification: "Falla eléctrica reportada y verificada por el equipo.",
      baseUrl: "https://olimpiadas.sitelocuento.com",
    });

    expect(ok.saved).toBe(true);
    expect(ok.actionType).toBe("LATE_STORY_UPLOAD");
    expect(ok.autoReactivated).toBe(true);
  });
});
