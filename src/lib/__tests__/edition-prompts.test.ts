import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import {
  assignPromptFromBankToEdition,
  evaluatePackageMajority,
  removePromptFromEditionToBank,
  submitPromptPackageForValidation,
  superadminOverrideEditionPrompt,
  validateEditionPromptsSchedule,
  voteEditionPromptPackage,
} from "../edition-prompts";

function createEditionPromptsTestD1(options: {
  bankRows?: unknown[][];
  editionPromptRows?: unknown[][];
  packageVoteRows?: unknown[][];
  adminUserRows?: unknown[][];
} = {}): {
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
          if (query.includes('from "prompt_bank"') && options.bankRows) {
            return options.bankRows as unknown as T[];
          }
          if (
            query.includes('from "edition_prompts"') &&
            options.editionPromptRows
          ) {
            return options.editionPromptRows as unknown as T[];
          }
          if (
            query.includes('from "edition_package_votes"') &&
            options.packageVoteRows
          ) {
            return options.packageVoteRows as unknown as T[];
          }
          if (query.includes('from "users"') && options.adminUserRows) {
            return options.adminUserRows as unknown as T[];
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

describe("Step 2.5 — Edition Prompt Package & Admin Majority Validation", () => {
  it("validates non-overlapping prompt schedules within the edition writing window", () => {
    const valid = validateEditionPromptsSchedule(
      [
        {
          promptNumber: 1,
          publishedAt: "2026-06-16T13:00:00.000Z",
          closesAt: "2026-06-17T13:00:00.000Z",
        },
        {
          promptNumber: 2,
          publishedAt: "2026-06-18T13:00:00.000Z",
          closesAt: "2026-06-19T13:00:00.000Z",
        },
      ],
      {
        writingStartAt: "2026-06-16T13:00:00.000Z",
        writingEndAt: "2026-06-30T13:00:00.000Z",
      }
    );
    expect(valid.valid).toBe(true);

    const overlapping = validateEditionPromptsSchedule([
      {
        promptNumber: 1,
        publishedAt: "2026-06-16T13:00:00.000Z",
        closesAt: "2026-06-18T13:00:00.000Z",
      },
      {
        promptNumber: 2,
        publishedAt: "2026-06-17T13:00:00.000Z", // Overlaps with Prompt 1
        closesAt: "2026-06-19T13:00:00.000Z",
      },
    ]);
    expect(overlapping.valid).toBe(false);
    expect(overlapping.errors[0]).toContain("solapa");
  });

  it("evaluates simple majority among administrators", () => {
    // 4 admins -> majority is 3
    expect(
      evaluatePackageMajority([{ approved: true }, { approved: true }], 4)
    ).toEqual({
      approvals: 2,
      rejections: 0,
      totalAdmins: 4,
      majorityThreshold: 3,
      isAccepted: false,
    });

    expect(
      evaluatePackageMajority(
        [{ approved: true }, { approved: true }, { approved: true }],
        4
      ).isAccepted
    ).toBe(true);
  });

  it("assigns prompt from bank to edition (ASSIGNED_TO_EDITION) and returns unpublished prompt to bank (AVAILABLE)", async () => {
    const { binding, queries } = createEditionPromptsTestD1({
      bankRows: [
        [
          "pb_1",
          "admin_1",
          "La estación",
          "Un tren que no se detiene.",
          null,
          null,
          "AVAILABLE",
          null,
          "2026-11-20T00:00:00.000Z",
          "2026-11-20T00:00:00.000Z",
        ],
      ],
      editionPromptRows: [],
    });
    const db = createDbClient(binding);

    const assigned = await assignPromptFromBankToEdition(db, {
      editionId: "ed_2026",
      promptBankId: "pb_1",
      promptNumber: 1,
      publishedAtUtc: "2026-06-16T13:00:00.000Z",
      durationHours: 24,
      editionPromptId: "ep_1",
    });

    expect(assigned).toEqual({ assigned: true, editionPromptId: "ep_1" });
    expect(
      queries.some((q) => q.includes('insert into "edition_prompts"'))
    ).toBe(true);
    expect(queries.some((q) => q.includes('update "prompt_bank"'))).toBe(true);

    // Return unpublished prompt back to bank
    const returnCtx = createEditionPromptsTestD1({
      editionPromptRows: [
        [
          "ep_1",
          "ed_2026",
          "pb_1",
          1,
          "La estación",
          "Un tren que no se detiene.",
          null,
          null,
          "2026-06-16T13:00:00.000Z",
          "2026-06-17T13:00:00.000Z",
          0,
        ],
      ],
    });
    const removed = await removePromptFromEditionToBank(
      createDbClient(returnCtx.binding),
      {
        editionPromptId: "ep_1",
        nowIso: "2026-06-01T13:00:00.000Z",
      }
    );
    expect(removed).toEqual({ removed: true, returnedToBank: true });
    expect(
      returnCtx.queries.some((q) => q.includes('delete from "edition_prompts"'))
    ).toBe(true);
    expect(
      returnCtx.queries.some((q) => q.includes('update "prompt_bank"'))
    ).toBe(true);
  });

  it("allows Superadmin override on any edition prompt and records PROMPT_OVERRIDE in audit_logs", async () => {
    const { binding, queries } = createEditionPromptsTestD1({
      editionPromptRows: [
        [
          "ep_1",
          "ed_2026",
          "pb_1",
          1,
          "Original",
          "Cuerpo original",
          null,
          null,
          "2026-06-16T13:00:00.000Z",
          "2026-06-17T13:00:00.000Z",
          0,
        ],
      ],
    });
    const db = createDbClient(binding);

    const res = await superadminOverrideEditionPrompt(db, {
      editionPromptId: "ep_1",
      superadminId: "sa_1",
      title: "Título corregido de emergencia",
      body: "Texto corregido durante el certamen.",
      justification: "Corrección tipográfica urgente aprobada por coordinación.",
    });

    expect(res).toEqual({ updated: true });
    expect(
      queries.some((q) => q.includes('update "edition_prompts"'))
    ).toBe(true);
    expect(queries.some((q) => q.includes('insert into "audit_logs"'))).toBe(
      true
    );
  });

  it("dispatches E25 to all ADMIN users on package submission and marks ACCEPTED upon majority", async () => {
    const adminRows = [
      [
        "a1",
        "Admin Uno",
        "a1@sitelocuento.com",
        1,
        null,
        "Admin",
        "Uno",
        "VE",
        "+581",
        null,
        1,
        "ADMIN",
        "2026-11-18T00:00:00.000Z",
        "2026-11-18T00:00:00.000Z",
      ],
      [
        "a2",
        "Admin Dos",
        "a2@sitelocuento.com",
        1,
        null,
        "Admin",
        "Dos",
        "VE",
        "+582",
        null,
        1,
        "ADMIN",
        "2026-11-18T00:00:00.000Z",
        "2026-11-18T00:00:00.000Z",
      ],
    ];

    const submitCtx = createEditionPromptsTestD1({
      editionPromptRows: [
        [
          "ep_1",
          "ed_2026",
          "pb_1",
          1,
          "Consigna 1",
          "Texto",
          null,
          null,
          "2026-06-16T13:00:00.000Z",
          "2026-06-17T13:00:00.000Z",
          0,
        ],
      ],
      adminUserRows: adminRows,
    });

    const submitted = await submitPromptPackageForValidation(
      createDbClient(submitCtx.binding),
      {
        editionId: "ed_2026",
        editionTitle: "Olimpíadas 2026",
        baseUrl: "https://olimpiadas.sitelocuento.com",
        dryRunEmails: true,
        nowIso: "2026-11-20T12:00:00.000Z",
      }
    );

    expect(submitted).toEqual({ submitted: true, notifiedAdmins: 2 });

    // Majority vote check (2 approvals out of 2 admins -> ACCEPTED)
    const voteCtx = createEditionPromptsTestD1({
      packageVoteRows: [
        ["epv_1", "ed_2026", "a1", 1, "2026-11-20T12:05:00.000Z"],
        ["epv_2", "ed_2026", "a2", 1, "2026-11-20T12:06:00.000Z"],
      ],
      adminUserRows: adminRows,
    });

    const voted = await voteEditionPromptPackage(
      createDbClient(voteCtx.binding),
      {
        editionId: "ed_2026",
        adminId: "a2",
        approved: true,
      }
    );

    expect(voted.majority.isAccepted).toBe(true);
    expect(
      voteCtx.queries.some((q) => q.includes('update "editions"'))
    ).toBe(true);
  });
});
