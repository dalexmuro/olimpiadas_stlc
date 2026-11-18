import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import {
  COMPLETE_PROFILE_PATH,
  completeUserProfile,
  shouldRedirectToCompleteProfile,
  validateProfileCompletionForm,
} from "../profile-gate";

function createProfileGateD1Binding(): {
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

describe("Step 1.12 — Mandatory Profile Completion Gate (/completar-perfil)", () => {
  it("validates mandatory profile fields (firstName, lastName, country, phone)", () => {
    const invalid = validateProfileCompletionForm({
      firstName: " ",
      lastName: "",
      country: "",
      phone: "abc",
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.fieldErrors.firstName).toBeDefined();
    expect(invalid.fieldErrors.lastName).toBeDefined();
    expect(invalid.fieldErrors.country).toBeDefined();
    expect(invalid.fieldErrors.phone).toBeDefined();

    const valid = validateProfileCompletionForm({
      firstName: "Julio",
      lastName: "Cortázar",
      country: "Argentina",
      phone: "+54 11 4567 8901",
    });
    expect(valid.valid).toBe(true);
    expect(valid.fieldErrors).toEqual({});
  });

  it("redirects incomplete OAuth users to /completar-perfil while allowing exempt paths", () => {
    const incompleteOAuthUser = {
      firstName: "Julio",
      lastName: "Cortázar",
      country: null,
      phone: null,
      profileCompleted: false,
    };

    expect(shouldRedirectToCompleteProfile(incompleteOAuthUser, "/")).toBe(
      true
    );
    expect(shouldRedirectToCompleteProfile(incompleteOAuthUser, "/panel")).toBe(
      true
    );
    // Avoid infinite redirect loop on /completar-perfil or public static pages
    expect(
      shouldRedirectToCompleteProfile(
        incompleteOAuthUser,
        COMPLETE_PROFILE_PATH
      )
    ).toBe(false);
    expect(
      shouldRedirectToCompleteProfile(
        incompleteOAuthUser,
        "/bases-del-concurso"
      )
    ).toBe(false);
    expect(shouldRedirectToCompleteProfile(null, "/")).toBe(false);

    const completeUser = {
      firstName: "Julio",
      lastName: "Cortázar",
      country: "Argentina",
      phone: "+54 11 4567 8901",
      profileCompleted: true,
    };
    expect(shouldRedirectToCompleteProfile(completeUser, "/")).toBe(false);
  });

  it("persists completed profile data into D1 users table and sets profile_completed = true", async () => {
    const { binding, queries } = createProfileGateD1Binding();
    const db = createDbClient(binding);

    const failedResult = await completeUserProfile(db, "user_oauth_1", {
      firstName: "Julio",
      lastName: "",
      country: "Argentina",
      phone: "+54 11 4567 8901",
    });
    expect(failedResult.updated).toBe(false);
    expect(queries).toHaveLength(0);

    const successResult = await completeUserProfile(
      db,
      "user_oauth_1",
      {
        firstName: "  Julio ",
        lastName: " Cortázar ",
        country: "Argentina",
        phone: "+54 11 4567 8901",
      },
      "2026-11-18T16:00:00.000Z"
    );

    expect(successResult).toEqual({
      updated: true,
      fullName: "Julio Cortázar",
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('update "users"');
  });
});
