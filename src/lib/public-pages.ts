/**
 * Public Pages Data Loader & Navigation Helpers
 * Step 1.14: Dynamic lookup for /bases-del-concurso and /quienes-somos with seed fallback, plus role-aware navigation
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { sitePages, type UserRole } from "@/db/schema";
import { DEFAULT_SITE_PAGES, type SitePageSeedItem } from "@/db/seed";
import { PUBLIC_NAVIGATION_LINKS, type NavigationLink } from "./app-metadata";

export type PublicPageSlug = SitePageSeedItem["slug"];

export interface ResolvedSitePage {
  slug: PublicPageSlug;
  title: string;
  contentHtml: string;
  updatedAt: string | null;
  fromDatabase: boolean;
}

/**
 * Loads a static public page (`bases-del-concurso` or `quienes-somos`) from Cloudflare D1 `site_pages`,
 * falling back seamlessly to `DEFAULT_SITE_PAGES` if no database record is returned.
 */
export async function getPublicSitePage(
  db: AppDatabase | null,
  slug: PublicPageSlug
): Promise<ResolvedSitePage> {
  const fallback = DEFAULT_SITE_PAGES.find((p) => p.slug === slug);
  if (!fallback) {
    throw new Error(`Unknown public site page slug "${slug}".`);
  }

  if (db) {
    try {
      const rows = await db
        .select()
        .from(sitePages)
        .where(eq(sitePages.slug, slug));
      const row = rows[0];
      if (row) {
        return {
          slug,
          title: row.title,
          contentHtml: row.contentHtml,
          updatedAt: row.updatedAt,
          fromDatabase: true,
        };
      }
    } catch {
      // Fallback to default seed content when local/offline preview has no DB binding
    }
  }

  return {
    slug,
    title: fallback.title,
    contentHtml: fallback.contentHtml,
    updatedAt: null,
    fromDatabase: false,
  };
}

/**
 * Computes navigation links visible in the main Navbar based on user authentication and role.
 */
export function resolveNavbarLinks(
  role?: UserRole | null
): NavigationLink[] {
  const links: NavigationLink[] = [...PUBLIC_NAVIGATION_LINKS];

  if (role === "ADMIN" || role === "SUPERADMIN") {
    links.push({ label: "Panel Admin", href: "/admin" });
  } else if (role === "JURY") {
    links.push({ label: "Evaluación Jurado", href: "/jurado" });
  }

  if (role) {
    links.push({ label: "Mi Perfil", href: "/perfil" });
  }

  return links;
}
