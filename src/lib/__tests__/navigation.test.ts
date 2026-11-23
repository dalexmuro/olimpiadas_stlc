import { describe, expect, it } from "vitest";
import { buildBottomMenuLinks } from "../navigation";

describe("Bottom Menu Navigation Links by Role", () => {
  it("omits Perfil and Panel de Administración when unauthenticated", () => {
    const links = buildBottomMenuLinks({
      isHome: true,
      showEditions: false,
      userRole: null,
    });
    const hrefs = links.map((l) => l.href);

    expect(hrefs).toEqual(["/bases-del-concurso", "/quienes-somos"]);
    expect(hrefs).not.toContain("/perfil");
    expect(hrefs).not.toContain("/admin");
  });

  it("includes Perfil but hides Panel de Administración for PARTICIPANT and JURY", () => {
    for (const role of ["PARTICIPANT", "JURY"] as const) {
      const links = buildBottomMenuLinks({
        isHome: false,
        showEditions: true,
        userRole: role,
      });
      const hrefs = links.map((l) => l.href);

      expect(hrefs).toContain("/");
      expect(hrefs).toContain("/ediciones");
      expect(hrefs).toContain("/perfil");
      expect(hrefs).not.toContain("/admin");
    }
  });

  it("includes both Perfil and Panel de Administración for ADMIN and SUPERADMIN", () => {
    for (const role of ["ADMIN", "SUPERADMIN"] as const) {
      const links = buildBottomMenuLinks({
        isHome: true,
        showEditions: false,
        userRole: role,
      });

      expect(links.find((l) => l.href === "/perfil")?.label).toBe("Perfil");
      expect(links.find((l) => l.href === "/admin")?.label).toBe(
        "Panel de Administración"
      );
    }
  });
});
