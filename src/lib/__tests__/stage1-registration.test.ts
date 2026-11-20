import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import type { EditionStageSnapshot } from "../contest-stage";
import {
  enrollParticipantInEdition,
  validateEnrollmentEligibility,
} from "../stage1-registration";

const ACTIVE_EDITION: EditionStageSnapshot = {
  title: "Olimpíadas Literarias de SiTeLoCuento 2026",
  registrationStartAt: "2026-06-01T13:00:00.000Z",
  registrationEndAt: "2026-06-15T13:00:00.000Z",
  writingStartAt: "2026-06-16T13:00:00.000Z",
  writingEndAt: "2026-06-30T13:00:00.000Z",
  submissionStartAt: "2026-07-02T13:00:00.000Z",
  submissionEndAt: "2026-07-07T13:00:00.000Z",
  adminReviewStartAt: "2026-07-08T13:00:00.000Z",
  adminReviewEndAt: "2026-07-10T13:00:00.000Z",
  votingStartAt: "2026-07-12T13:00:00.000Z",
  votingEndAt: "2026-07-22T13:00:00.000Z",
  juryStartAt: "2026-07-23T13:00:00.000Z",
  juryEndAt: "2026-07-30T13:00:00.000Z",
};

function createEnrollTestD1(existingEnrollmentRows: unknown[][] = []): {
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
        raw: async <T = unknown[]>() => {
          if (query.includes('from "enrollments"')) {
            return existingEnrollmentRows as unknown as T[];
          }
          return [] as unknown as T[];
        },
      };
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  return { binding, queries };
}

describe("Step 3.2 — Stage 1 Registration & Automated E03 Email", () => {
  const duringRegistration = "2026-06-05T15:00:00.000Z";

  it("blocks ADMIN, SUPERADMIN, and JURY from enrolling, and enforces profile completion and rules acceptance", () => {
    expect(
      validateEnrollmentEligibility({
        userRole: "ADMIN",
        profileCompleted: true,
        acceptedRules: true,
        alreadyEnrolled: false,
        edition: ACTIVE_EDITION,
        nowIso: duringRegistration,
      }).eligible
    ).toBe(false);

    expect(
      validateEnrollmentEligibility({
        userRole: "JURY",
        profileCompleted: true,
        acceptedRules: true,
        alreadyEnrolled: false,
        edition: ACTIVE_EDITION,
        nowIso: duringRegistration,
      }).eligible
    ).toBe(false);

    expect(
      validateEnrollmentEligibility({
        userRole: "PARTICIPANT",
        profileCompleted: false,
        acceptedRules: true,
        alreadyEnrolled: false,
        edition: ACTIVE_EDITION,
        nowIso: duringRegistration,
      }).error
    ).toContain("perfil");

    expect(
      validateEnrollmentEligibility({
        userRole: "PARTICIPANT",
        profileCompleted: true,
        acceptedRules: false,
        alreadyEnrolled: false,
        edition: ACTIVE_EDITION,
        nowIso: duringRegistration,
      }).error
    ).toContain("Bases del Concurso");

    // Outside registration window
    expect(
      validateEnrollmentEligibility({
        userRole: "PARTICIPANT",
        profileCompleted: true,
        acceptedRules: true,
        alreadyEnrolled: false,
        edition: ACTIVE_EDITION,
        nowIso: "2026-06-20T15:00:00.000Z",
      }).eligible
    ).toBe(false);
  });

  it("creates enrollment in D1 and dispatches E03 confirmation email", async () => {
    const { binding, queries } = createEnrollTestD1();
    const db = createDbClient(binding);

    const res = await enrollParticipantInEdition({
      db,
      editionId: "ed_2026",
      edition: ACTIVE_EDITION,
      user: {
        id: "u_part_1",
        email: "escritor@sitelocuento.com",
        firstName: "Mateo",
        lastName: "Silva",
        name: "Mateo Silva",
        role: "PARTICIPANT",
        profileCompleted: true,
      },
      acceptedRules: true,
      baseUrl: "https://olimpiadas.sitelocuento.com",
      dryRunEmails: true,
      nowIso: duringRegistration,
      enrollmentId: "enr_2026_1",
    });

    expect(res).toEqual({
      enrolled: true,
      enrollmentId: "enr_2026_1",
      emailSent: true,
    });
    expect(
      queries.some((q) => q.includes('insert into "enrollments"'))
    ).toBe(true);
    expect(
      queries.some((q) => q.includes('insert into "email_dispatch_logs"'))
    ).toBe(true);
  });

  it("prevents duplicate enrollment in the same edition", async () => {
    const { binding } = createEnrollTestD1([
      [
        "enr_existing",
        "ed_2026",
        "u_part_1",
        1,
        "ACTIVE",
        null,
        null,
        0,
        null,
        null,
        0,
        null,
        null,
        0,
        null,
        "2026-06-02T12:00:00.000Z",
      ],
    ]);
    const db = createDbClient(binding);

    const res = await enrollParticipantInEdition({
      db,
      editionId: "ed_2026",
      edition: ACTIVE_EDITION,
      user: {
        id: "u_part_1",
        email: "escritor@sitelocuento.com",
        firstName: "Mateo",
        lastName: "Silva",
        name: "Mateo Silva",
        role: "PARTICIPANT",
        profileCompleted: true,
      },
      acceptedRules: true,
      baseUrl: "https://olimpiadas.sitelocuento.com",
      dryRunEmails: true,
      nowIso: duringRegistration,
    });

    expect(res.enrolled).toBe(false);
    expect(res.error).toContain("Ya estás inscrito");
  });
});
