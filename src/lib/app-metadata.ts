/**
 * Official Application Metadata & Brand Constants
 * Step 1.2: Next.js App Router + Tailwind CSS + OpenNext Cloudflare Initialization
 */

export const APP_BRAND = {
  contestName: "Olimpíadas Literarias de SiTeLoCuento",
  clubName: "SiTeLoCuento",
  defaultLocale: "es",
  officialTimezone: "America/Caracas",
  officialUtcOffset: "UTC-4",
  productionUrl: "https://olimpiadas.sitelocuento.com",
  stagingUrl: "https://dev-olimpiadas.sitelocuento.com",
  supportEmail: "olimpiadas@sitelocuento.com",
  description:
    "Plataforma web oficial del concurso anual de cuentos cortos Olimpíadas Literarias de SiTeLoCuento.",
} as const;

export interface NavigationLink {
  label: string;
  href: string;
}

export const PUBLIC_NAVIGATION_LINKS: readonly NavigationLink[] = [
  { label: "Inicio", href: "/" },
  { label: "Bases del Concurso", href: "/bases-del-concurso" },
  { label: "¿Quiénes somos?", href: "/quienes-somos" },
  { label: "Resultados", href: "/resultados" },
  { label: "Ediciones Anteriores", href: "/ediciones" },
] as const;

/**
 * Generates a formatted page title following the contest brand convention.
 */
export function formatPageTitle(pageSubtitle?: string): string {
  const cleanSubtitle = pageSubtitle?.trim();
  if (!cleanSubtitle) {
    return APP_BRAND.contestName;
  }
  return `${cleanSubtitle} | ${APP_BRAND.contestName}`;
}
