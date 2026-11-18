import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import {
  MICROSOFT_OAUTH_TENANT,
  MIN_PASSWORD_LENGTH,
  buildBetterAuthOptions,
  evaluateProfileCompletion,
  resolveAuthRuntimeConfig,
  resolveInitialUserRole,
} from "../auth";

function createAuthTestD1Binding(): {
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

describe("Step 1.10 — Better Auth Configuration (Email/Password, Google, Microsoft OAuth)", () => {
  it("evaluates mandatory profile completion fields accurately", () => {
    expect(
      evaluateProfileCompletion({
        firstName: "Ana",
        lastName: "Gómez",
        country: "Venezuela",
        phone: "+584121234567",
      })
    ).toBe(true);

    // Missing country or phone (e.g., first login via Google or Microsoft OAuth)
    expect(
      evaluateProfileCompletion({
        firstName: "Ana",
        lastName: "Gómez",
        country: "",
        phone: "+584121234567",
      })
    ).toBe(false);

    expect(
      evaluateProfileCompletion({
        firstName: "Ana",
        lastName: "Gómez",
        country: "Venezuela",
        phone: null,
      })
    ).toBe(false);
  });

  it("resolves initial user role with automatic SUPERADMIN promotion", () => {
    expect(
      resolveInitialUserRole("dalexmuro@gmail.com", "dalexmuro@gmail.com")
    ).toBe("SUPERADMIN");
    expect(
      resolveInitialUserRole("participante@ejemplo.com", "dalexmuro@gmail.com")
    ).toBe("PARTICIPANT");
  });

  it("configures Google and Microsoft (tenant: common) OAuth providers when credentials exist", () => {
    const { binding } = createAuthTestD1Binding();
    const db = createDbClient(binding);

    const options = buildBetterAuthOptions(db, {
      baseUrl: "https://olimpiadas.sitelocuento.com",
      secret: "test-secret-key-minimum-32-chars-long",
      googleClientId: "google-client-id",
      googleClientSecret: "google-client-secret",
      microsoftClientId: "ms-client-id",
      microsoftClientSecret: "ms-client-secret",
      dryRunEmails: true,
    });

    expect(options.emailAndPassword.enabled).toBe(true);
    expect(options.emailAndPassword.requireEmailVerification).toBe(true);
    expect(options.emailAndPassword.minPasswordLength).toBe(
      MIN_PASSWORD_LENGTH
    );
    expect(options.emailVerification.sendOnSignUp).toBe(true);

    expect(options.socialProviders.google).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    });
    expect(options.socialProviders.microsoft).toEqual({
      clientId: "ms-client-id",
      clientSecret: "ms-client-secret",
      tenantId: MICROSOFT_OAUTH_TENANT,
    });
  });

  it("dispatches E01 for email verification and E02 for password reset", async () => {
    const { binding, queries } = createAuthTestD1Binding();
    const db = createDbClient(binding);

    const options = buildBetterAuthOptions(db, {
      baseUrl: "https://olimpiadas.sitelocuento.com",
      secret: "test-secret-key-minimum-32-chars-long",
      dryRunEmails: true,
    });

    await options.emailVerification.sendVerificationEmail({
      user: { id: "u_1", email: "nuevo@ejemplo.com", name: "Pedro" },
      url: "https://olimpiadas.sitelocuento.com/api/auth/verify?token=tok1",
      token: "tok1",
    });

    await options.emailAndPassword.sendResetPassword({
      user: { id: "u_1", email: "nuevo@ejemplo.com", name: "Pedro" },
      url: "https://olimpiadas.sitelocuento.com/recuperar-clave?token=tok2",
      token: "tok2",
    });

    const insertQueries = queries.filter((q) =>
      q.includes('insert into "email_dispatch_logs"')
    );
    expect(insertQueries).toHaveLength(2);
  });

  it("resolves auth runtime config from CloudflareEnv bindings with sensible defaults", () => {
    const resolved = resolveAuthRuntimeConfig({
      BETTER_AUTH_URL: "https://dev-olimpiadas.sitelocuento.com",
      EMAIL_FROM_ADDRESS: "olimpiadas@sitelocuento.com",
      EMAIL_FROM_NAME: "Olimpíadas Literarias de SiTeLoCuento",
    });

    expect(resolved.baseUrl).toBe("https://dev-olimpiadas.sitelocuento.com");
    expect(resolved.emailFromAddress).toBe("olimpiadas@sitelocuento.com");
  });
});
