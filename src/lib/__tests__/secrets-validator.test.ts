import { describe, expect, it } from "vitest";
import { validateRuntimeSecretsForEnv } from "../secrets-validator";

describe("Cloudflare Runtime Secrets Validator (Step 7.2)", () => {
  it("accepts dev environment without Microsoft OAuth while reporting them as optional missing", () => {
    const res = validateRuntimeSecretsForEnv("dev", {
      BETTER_AUTH_SECRET: "secret-dev",
      BREVO_API_KEY: "xkeysib-dev",
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsec",
      SUPERADMIN_INITIAL_EMAIL: "dalexmuro@gmail.com",
    });

    expect(res.valid).toBe(true);
    expect(res.missingKeys).toEqual([]);
    expect(res.optionalMissingKeys).toEqual([
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
    ]);
  });

  it("requires all 7 secrets including Microsoft OAuth in prod", () => {
    const missingMs = validateRuntimeSecretsForEnv("prod", {
      BETTER_AUTH_SECRET: "secret-prod",
      BREVO_API_KEY: "xkeysib-prod",
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsec",
      SUPERADMIN_INITIAL_EMAIL: "dalexmuro@gmail.com",
    });

    expect(missingMs.valid).toBe(false);
    expect(missingMs.missingKeys).toEqual([
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
    ]);

    const completeProd = validateRuntimeSecretsForEnv("prod", {
      BETTER_AUTH_SECRET: "secret-prod",
      BREVO_API_KEY: "xkeysib-prod",
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsec",
      MICROSOFT_CLIENT_ID: "msid",
      MICROSOFT_CLIENT_SECRET: "mssec",
      SUPERADMIN_INITIAL_EMAIL: "dalexmuro@gmail.com",
    });

    expect(completeProd.valid).toBe(true);
    expect(completeProd.presentKeys.length).toBe(7);
  });
});
