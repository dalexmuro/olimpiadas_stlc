import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import {
  DEFAULT_JURY_BRACKETS,
  activateEditionInDb,
  convertCaracasScheduleFormToUtc,
  createEditionInDb,
  resolveJuryMultiplier,
  validateEditionParameters,
  validateEditionSchedule,
  type EditionScheduleUtc,
} from "../edition-management";

function createEditionTestD1Binding(): {
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
        raw: async <T = unknown[]>() => [] as unknown as T[],
      };
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  return { binding, queries };
}

const VALID_CARACAS_SCHEDULE: EditionScheduleUtc = {
  registrationStartAt: "2026-06-01T09:00",
  registrationEndAt: "2026-06-15T23:59",
  writingStartAt: "2026-06-16T09:00",
  writingEndAt: "2026-06-30T09:00",
  submissionStartAt: "2026-07-02T09:00", // Exact 48h buffer after writingEndAt
  submissionEndAt: "2026-07-07T23:59",
  adminReviewStartAt: "2026-07-08T00:00",
  adminReviewEndAt: "2026-07-10T09:00",
  votingStartAt: "2026-07-12T09:00", // Exact 48h buffer after adminReviewEndAt
  votingEndAt: "2026-07-22T23:59",
  juryStartAt: "2026-07-23T09:00",
  juryEndAt: "2026-07-30T23:59",
};

describe("Step 2.3 — Edition Configuration & Strict 48h Buffer Calendar Validator", () => {
  it("accepts a valid sequential schedule in America/Caracas with both 48-hour buffers", () => {
    const utcSchedule = convertCaracasScheduleFormToUtc(VALID_CARACAS_SCHEDULE);
    expect(utcSchedule.registrationStartAt).toBe("2026-06-01T13:00:00.000Z");

    const result = validateEditionSchedule(utcSchedule);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects schedules violating either of the two mandatory 48-hour buffers or overlapping stages", () => {
    const brokenBuffer1 = convertCaracasScheduleFormToUtc({
      ...VALID_CARACAS_SCHEDULE,
      submissionStartAt: "2026-07-01T09:00", // Only 24h after writingEndAt
    });
    const res1 = validateEditionSchedule(brokenBuffer1);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.includes("48 horas"))).toBe(true);

    const brokenBuffer2 = convertCaracasScheduleFormToUtc({
      ...VALID_CARACAS_SCHEDULE,
      votingStartAt: "2026-07-12T08:59", // 47h 59m after adminReviewEndAt
    });
    const res2 = validateEditionSchedule(brokenBuffer2);
    expect(res2.valid).toBe(false);
    expect(
      res2.errors.some((e) => e.includes("Revisión por Administradores"))
    ).toBe(true);

    const overlapping = convertCaracasScheduleFormToUtc({
      ...VALID_CARACAS_SCHEDULE,
      writingStartAt: "2026-06-10T09:00", // Before registrationEndAt
    });
    const res3 = validateEditionSchedule(overlapping);
    expect(res3.valid).toBe(false);
    expect(res3.errors.some((e) => e.includes("solaparse"))).toBe(true);
  });

  it("validates character limits, similarity bounds, and overlapping jury brackets", () => {
    const utcSchedule = convertCaracasScheduleFormToUtc(VALID_CARACAS_SCHEDULE);

    const badParams = validateEditionParameters({
      title: "",
      slug: "Edicion 2026!",
      minChars: 500,
      maxChars: 200,
      maxAllowedMisses: -1,
      minSimilarityPct: 120,
      juryBrackets: [
        { min: 0, max: 30, k: 5 },
        { min: 25, max: 60, k: 10 }, // Overlaps with 0..30
      ],
      ...utcSchedule,
    });

    expect(badParams.valid).toBe(false);
    expect(badParams.errors.length).toBeGreaterThanOrEqual(5);
  });

  it("resolves automatic Jury point multipliers across participant brackets", () => {
    expect(resolveJuryMultiplier(20, DEFAULT_JURY_BRACKETS)).toEqual({
      multiplier: 5,
      first: 15,
      second: 10,
      third: 5,
    });
    expect(resolveJuryMultiplier(45, DEFAULT_JURY_BRACKETS)).toEqual({
      multiplier: 10,
      first: 30,
      second: 20,
      third: 10,
    });
    expect(resolveJuryMultiplier(85, DEFAULT_JURY_BRACKETS)).toEqual({
      multiplier: 15,
      first: 45,
      second: 30,
      third: 15,
    });
    expect(resolveJuryMultiplier(120, DEFAULT_JURY_BRACKETS)).toEqual({
      multiplier: 20,
      first: 60,
      second: 40,
      third: 20,
    });
  });

  it("persists a valid edition in D1 and ensures single active edition activation", async () => {
    const { binding, queries } = createEditionTestD1Binding();
    const db = createDbClient(binding);
    const utcSchedule = convertCaracasScheduleFormToUtc(VALID_CARACAS_SCHEDULE);

    const saved = await createEditionInDb(
      db,
      {
        id: "ed_2026",
        title: "Olimpíadas Literarias de SiTeLoCuento 2026",
        slug: "2026",
        isActive: true,
        minChars: 100,
        maxChars: 3000,
        maxAllowedMisses: 2,
        minSimilarityPct: 70,
        juryBrackets: [...DEFAULT_JURY_BRACKETS],
        ...utcSchedule,
      },
      "2026-11-20T12:00:00.000Z"
    );

    expect(saved).toEqual({ saved: true, editionId: "ed_2026" });
    expect(queries.some((q) => q.includes('update "editions"'))).toBe(true);
    expect(queries.some((q) => q.includes('insert into "editions"'))).toBe(true);

    const activated = await activateEditionInDb(db, "ed_2026");
    expect(activated).toEqual({ activated: true });
  });
});
