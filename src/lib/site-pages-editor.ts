/**
 * Superadmin Static Public Pages Editor Service
 * Step 2.7: Edit Bases del Concurso (/bases-del-concurso) and ¿Quiénes somos? (/quienes-somos)
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { sitePages } from "@/db/schema";
import {
  getPublicSitePage,
  type PublicPageSlug,
  type ResolvedSitePage,
} from "./public-pages";

export const EDITABLE_SITE_PAGE_SLUGS: readonly PublicPageSlug[] = [
  "bases-del-concurso",
  "quienes-somos",
] as const;

export const MAX_SITE_PAGE_TITLE_CHARS = 150 as const;

/**
 * Validates slug, title, and HTML content before updating a static public page.
 */
export function validateSitePageUpdate(input: {
  slug: string;
  title: string;
  contentHtml: string;
}): { valid: boolean; error?: string } {
  if (!(EDITABLE_SITE_PAGE_SLUGS as readonly string[]).includes(input.slug)) {
    return {
      valid: false,
      error: `Página pública no válida: "${input.slug}".`,
    };
  }

  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    return { valid: false, error: "El título de la página es obligatorio." };
  }
  if (cleanTitle.length > MAX_SITE_PAGE_TITLE_CHARS) {
    return {
      valid: false,
      error: `El título no puede superar los ${MAX_SITE_PAGE_TITLE_CHARS} caracteres.`,
    };
  }

  if (!input.contentHtml.trim()) {
    return {
      valid: false,
      error: "El contenido de la página no puede estar vacío.",
    };
  }

  return { valid: true };
}

/**
 * Lists both editable public pages from D1 (with default seed fallback).
 */
export async function listEditableSitePagesFromDb(
  db: AppDatabase
): Promise<ResolvedSitePage[]> {
  const [rulesPage, aboutPage] = await Promise.all([
    getPublicSitePage(db, "bases-del-concurso"),
    getPublicSitePage(db, "quienes-somos"),
  ]);
  return [rulesPage, aboutPage];
}

/**
 * Updates or inserts a static public page in Cloudflare D1 `site_pages`.
 */
export async function updateSitePageInDb(
  db: AppDatabase,
  options: {
    slug: PublicPageSlug;
    title: string;
    contentHtml: string;
    updatedById: string;
    nowIso?: string;
  }
): Promise<{ updated: boolean; error?: string }> {
  const validation = validateSitePageUpdate(options);
  if (!validation.valid) {
    return { updated: false, error: validation.error };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const existing = await db
    .select()
    .from(sitePages)
    .where(eq(sitePages.slug, options.slug));

  if (existing.length > 0) {
    await db
      .update(sitePages)
      .set({
        title: options.title.trim(),
        contentHtml: options.contentHtml.trim(),
        updatedById: options.updatedById,
        updatedAt: nowIso,
      })
      .where(eq(sitePages.slug, options.slug));
  } else {
    await db.insert(sitePages).values({
      slug: options.slug,
      title: options.title.trim(),
      contentHtml: options.contentHtml.trim(),
      updatedById: options.updatedById,
      updatedAt: nowIso,
    });
  }

  return { updated: true };
}
