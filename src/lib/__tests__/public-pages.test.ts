import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import { getPublicSitePage, resolveNavbarLinks } from "../public-pages";

function createSitePageTestD1Binding(customRow?: unknown[]): D1DatabaseBinding {
  return {
    prepare: () => ({
      bind() {
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
      raw: async <T = unknown[]>() =>
        (customRow ? [customRow] : []) as unknown as T[],
    }),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
}

describe("Step 1.14 — Public Navigation & Static Pages (/bases-del-concurso, /quienes-somos)", () => {
  it("loads customized site_pages content from D1 when present", async () => {
    const db = createDbClient(
      createSitePageTestD1Binding([
        "bases-del-concurso",
        "Bases Personalizadas 2026",
        "<p>Reglas actualizadas por Superadmin</p>",
        "admin_1",
        "2026-11-18T17:00:00.000Z",
      ])
    );

    const page = await getPublicSitePage(db, "bases-del-concurso");
    expect(page.fromDatabase).toBe(true);
    expect(page.title).toBe("Bases Personalizadas 2026");
    expect(page.contentHtml).toContain("Reglas actualizadas");
  });

  it("falls back to DEFAULT_SITE_PAGES when D1 has no customized record or is null", async () => {
    const emptyDb = createDbClient(createSitePageTestD1Binding());
    const rulesPage = await getPublicSitePage(emptyDb, "bases-del-concurso");
    expect(rulesPage.fromDatabase).toBe(false);
    expect(rulesPage.title).toContain("Bases del Concurso");

    const aboutPage = await getPublicSitePage(null, "quienes-somos");
    expect(aboutPage.fromDatabase).toBe(false);
    expect(aboutPage.title).toContain("¿Quiénes somos?");
  });

  it("computes role-aware navigation links for guests, participants, jury, and admins", () => {
    const guestLinks = resolveNavbarLinks(null).map((l) => l.href);
    expect(guestLinks).toEqual([
      "/",
      "/bases-del-concurso",
      "/quienes-somos",
      "/resultados",
      "/ediciones",
    ]);

    const participantLinks = resolveNavbarLinks("PARTICIPANT").map(
      (l) => l.href
    );
    expect(participantLinks).toContain("/perfil");
    expect(participantLinks).not.toContain("/admin");

    const juryLinks = resolveNavbarLinks("JURY").map((l) => l.href);
    expect(juryLinks).toContain("/jurado");
    expect(juryLinks).toContain("/perfil");

    const adminLinks = resolveNavbarLinks("ADMIN").map((l) => l.href);
    expect(adminLinks).toContain("/admin");
    expect(adminLinks).toContain("/perfil");

    const superadminLinks = resolveNavbarLinks("SUPERADMIN").map((l) => l.href);
    expect(superadminLinks).toContain("/admin");
  });
});
