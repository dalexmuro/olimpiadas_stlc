import { describe, expect, it } from "vitest";
import {
  APP_BRAND,
  PUBLIC_NAVIGATION_LINKS,
  formatPageTitle,
} from "../app-metadata";

describe("Step 1.2 — Next.js App Metadata & Public Navigation Configuration", () => {
  it("defines Spanish locale and America/Caracas (UTC-4) official timezone", () => {
    expect(APP_BRAND.contestName).toBe(
      "Olimpíadas Literarias de SiTeLoCuento"
    );
    expect(APP_BRAND.clubName).toBe("SiTeLoCuento");
    expect(APP_BRAND.defaultLocale).toBe("es");
    expect(APP_BRAND.officialTimezone).toBe("America/Caracas");
    expect(APP_BRAND.officialUtcOffset).toBe("UTC-4");
    expect(APP_BRAND.productionUrl).toBe("https://olimpiadas.sitelocuento.com");
  });

  it("includes all mandatory public navigation links", () => {
    const hrefs = PUBLIC_NAVIGATION_LINKS.map((item) => item.href);
    expect(hrefs).toEqual([
      "/",
      "/bases-del-concurso",
      "/quienes-somos",
      "/resultados",
      "/ediciones",
    ]);
  });

  it("formats page titles consistently with and without subtitles", () => {
    expect(formatPageTitle()).toBe("Olimpíadas Literarias de SiTeLoCuento");
    expect(formatPageTitle("   ")).toBe(
      "Olimpíadas Literarias de SiTeLoCuento"
    );
    expect(formatPageTitle("Bases del Concurso")).toBe(
      "Bases del Concurso | Olimpíadas Literarias de SiTeLoCuento"
    );
  });
});
