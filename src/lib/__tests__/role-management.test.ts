import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import {
  changeUserRoleInDb,
  evaluateJuryCountStatus,
  filterUsersByQuery,
  validateRoleChangeRequest,
  type ManagedUserSummary,
} from "../role-management";

function createRoleTestD1Binding(rawUserRows: unknown[][]): {
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
          if (query.includes('from "users"')) {
            return rawUserRows as unknown as T[];
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

describe("Step 2.2 — Superadmin Role Management & Odd Jury Validation", () => {
  it("validates odd jury count requirement for automatic tie-breaking", () => {
    expect(evaluateJuryCountStatus(0).isValidForContest).toBe(false);
    expect(evaluateJuryCountStatus(2).isValidForContest).toBe(false);
    expect(evaluateJuryCountStatus(2).isOdd).toBe(false);
    expect(evaluateJuryCountStatus(4).message).toContain("número par");

    expect(evaluateJuryCountStatus(3).isValidForContest).toBe(true);
    expect(evaluateJuryCountStatus(3).isOdd).toBe(true);
    expect(evaluateJuryCountStatus(5).isValidForContest).toBe(true);
  });

  it("filters users case-insensitively and accent-insensitively by name, email, or role", () => {
    const sample: ManagedUserSummary[] = [
      {
        id: "u1",
        firstName: "María",
        lastName: "Pérez",
        name: "María Pérez",
        email: "maria@sitelocuento.com",
        country: "Venezuela",
        role: "JURY",
      },
      {
        id: "u2",
        firstName: "Carlos",
        lastName: "López",
        name: "Carlos López",
        email: "carlos@sitelocuento.com",
        country: "Colombia",
        role: "PARTICIPANT",
      },
    ];

    expect(filterUsersByQuery(sample, "")).toHaveLength(2);
    expect(filterUsersByQuery(sample, "maria")).toHaveLength(1);
    expect(filterUsersByQuery(sample, "lopez")[0].id).toBe("u2");
    expect(filterUsersByQuery(sample, "jury")[0].id).toBe("u1");
  });

  it("enforces SUPERADMIN authority, mandatory justification, and prevents removing the last SUPERADMIN", () => {
    expect(
      validateRoleChangeRequest({
        actorRole: "ADMIN",
        actorUserId: "a1",
        targetUserId: "u2",
        currentRole: "PARTICIPANT",
        newRole: "JURY",
        totalSuperadmins: 1,
        justification: "Nombrado jurado",
      }).valid
    ).toBe(false);

    expect(
      validateRoleChangeRequest({
        actorRole: "SUPERADMIN",
        actorUserId: "sa1",
        targetUserId: "sa1",
        currentRole: "SUPERADMIN",
        newRole: "ADMIN",
        totalSuperadmins: 1,
        justification: "Prueba",
      }).error
    ).toContain("único superadministrador");

    expect(
      validateRoleChangeRequest({
        actorRole: "SUPERADMIN",
        actorUserId: "sa1",
        targetUserId: "u2",
        currentRole: "PARTICIPANT",
        newRole: "JURY",
        totalSuperadmins: 1,
        justification: "   ",
      }).error
    ).toContain("justificación");
  });

  it("updates role in D1 users table and logs ROLE_CHANGE entry in audit_logs", async () => {
    const { binding, queries } = createRoleTestD1Binding([
      [
        "sa1",
        "Super Admin",
        "superadmin@example.com",
        1,
        null,
        "Dalex",
        "Muro",
        "VE",
        "+58000",
        null,
        1,
        "SUPERADMIN",
        "2026-11-18T00:00:00.000Z",
        "2026-11-18T00:00:00.000Z",
      ],
      [
        "u2",
        "Laura Writer",
        "laura@sitelocuento.com",
        1,
        null,
        "Laura",
        "Writer",
        "VE",
        "+58111",
        null,
        1,
        "PARTICIPANT",
        "2026-11-18T00:00:00.000Z",
        "2026-11-18T00:00:00.000Z",
      ],
    ]);
    const db = createDbClient(binding);

    const result = await changeUserRoleInDb({
      db,
      actorRole: "SUPERADMIN",
      actorUserId: "sa1",
      targetUserId: "u2",
      newRole: "JURY",
      justification: "Designada jurado oficial para la edición 2026",
      nowIso: "2026-11-20T11:30:00.000Z",
      auditId: "audit_role_test_1",
    });

    expect(result).toEqual({
      updated: true,
      previousRole: "PARTICIPANT",
      newRole: "JURY",
    });
    expect(queries.some((q) => q.includes('update "users"'))).toBe(true);
    expect(queries.some((q) => q.includes('insert into "audit_logs"'))).toBe(
      true
    );
  });
});
