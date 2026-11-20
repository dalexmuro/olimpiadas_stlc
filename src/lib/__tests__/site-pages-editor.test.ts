import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import {
  EDITABLE_SITE_PAGE_SLUGS,
  listEditableSitePagesFromDb,
  updateSitePageInDb,
  validateSitePageUpdate,
} from "../site-pages-editor";

function createSitePagesEditorD1(existingRow?: unknown[]): {
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
        raw: async <T = unknown[]>() =>
          (existingRow ? [existingRow] : []) as unknown as T[],
      };
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  return { binding, queries };
}

describe("Step 2.7 — Superadmin Static Public Pages Editor (/admin/paginas)", () => {
  it("validates allowed slugs, non-empty titles, and HTML body", () => {
    expect(EDITABLE_SITE_PAGE_SLUGS).toEqual([
      "bases-del-concurso",
      "quienes-somos",
    ]);

    expect(
      validateSitePageUpdate({
        slug: "pagina-desconocida",
        title: "Título",
        contentHtml: "<p>Contenido</p>",
      }).valid
    ).toBe(false);

    expect(
      validateSitePageUpdate({
        slug: "bases-del-concurso",
        title: " ",
        contentHtml: "<p>Contenido</p>",
      }).valid
    ).toBe(false);

    expect(
      validateSitePageUpdate({
        slug: "quienes-somos",
        title: "¿Quiénes somos?",
        contentHtml: "<p>Club literario SiTeLoCuento</p>",
      }).valid
    ).toBe(true);
  });

  it("lists both editable public pages and updates existing D1 records cleanly", async () => {
    const { binding, queries } = createSitePagesEditorD1([
      "bases-del-concurso",
      "Bases Oficiales 2026",
      "<h2>Reglas 2026</h2>",
      "sa_1",
      "2026-11-20T13:00:00.000Z",
    ]);
    const db = createDbClient(binding);

    const list = await listEditableSitePagesFromDb(db);
    expect(list).toHaveLength(2);
    expect(list[0].slug).toBe("bases-del-concurso");
    expect(list[1].slug).toBe("quienes-somos");

    const updated = await updateSitePageInDb(db, {
      slug: "bases-del-concurso",
      title: "Bases Actualizadas 2026",
      contentHtml: "<h2>Nuevas reglas</h2><p>Detalle actualizado.</p>",
      updatedById: "sa_1",
      nowIso: "2026-11-20T13:30:00.000Z",
    });

    expect(updated).toEqual({ updated: true });
    expect(queries.some((q) => q.includes('update "site_pages"'))).toBe(true);
  });
});
