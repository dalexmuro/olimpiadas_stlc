import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_TABS,
  canAccessAdminPanel,
  canAccessAdminRoute,
  canEditAdminRoute,
  getVisibleAdminTabs,
  isSuperadmin,
} from "../admin-access";

describe("Step 2.1 — Protected /admin Layout & Role-Based Tab Access", () => {
  it("grants panel access only to ADMIN and SUPERADMIN roles", () => {
    expect(canAccessAdminPanel("ADMIN")).toBe(true);
    expect(canAccessAdminPanel("SUPERADMIN")).toBe(true);
    expect(canAccessAdminPanel("PARTICIPANT")).toBe(false);
    expect(canAccessAdminPanel("JURY")).toBe(false);
    expect(canAccessAdminPanel(null)).toBe(false);
    expect(canAccessAdminPanel(undefined)).toBe(false);

    expect(isSuperadmin("SUPERADMIN")).toBe(true);
    expect(isSuperadmin("ADMIN")).toBe(false);
  });

  it("shows 7 shared + 3 read-only tabs to ADMIN and all 11 tabs (with Gestión de roles last) to SUPERADMIN", () => {
    expect(ADMIN_NAV_TABS).toHaveLength(11);
    expect(ADMIN_NAV_TABS[ADMIN_NAV_TABS.length - 1].href).toBe("/admin/roles");

    const adminTabs = getVisibleAdminTabs("ADMIN");
    expect(adminTabs).toHaveLength(10);
    expect(
      adminTabs.filter((t) => t.accessTier === "shared")
    ).toHaveLength(7);
    expect(
      adminTabs.filter((t) => t.accessTier === "admin_readonly").map((t) => t.href)
    ).toEqual(["/admin/ediciones", "/admin/correos", "/admin/paginas"]);
    expect(adminTabs.some((t) => t.href === "/admin/roles")).toBe(false);

    const superadminTabs = getVisibleAdminTabs("SUPERADMIN");
    expect(superadminTabs).toHaveLength(11);
    expect(
      superadminTabs.filter((t) => t.accessTier === "superadmin_only").map((t) => t.href)
    ).toEqual(["/admin/roles"]);

    expect(getVisibleAdminTabs("PARTICIPANT")).toEqual([]);
    expect(getVisibleAdminTabs("JURY")).toEqual([]);
  });

  it("allows ADMIN read-only access to ediciones/correos/paginas, blocks /admin/roles, and restricts editing to SUPERADMIN", () => {
    expect(canAccessAdminRoute("ADMIN", "/admin")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/banco-consignas")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/ediciones")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/correos")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/paginas")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/roles")).toBe(false);

    expect(canEditAdminRoute("ADMIN", "/admin/banco-consignas")).toBe(true);
    expect(canEditAdminRoute("ADMIN", "/admin/ediciones")).toBe(false);
    expect(canEditAdminRoute("ADMIN", "/admin/correos")).toBe(false);
    expect(canEditAdminRoute("ADMIN", "/admin/paginas")).toBe(false);
    expect(canEditAdminRoute("ADMIN", "/admin/roles")).toBe(false);

    expect(canAccessAdminRoute("SUPERADMIN", "/admin/roles")).toBe(true);
    expect(canEditAdminRoute("SUPERADMIN", "/admin/ediciones")).toBe(true);
    expect(canEditAdminRoute("SUPERADMIN", "/admin/correos")).toBe(true);
    expect(canEditAdminRoute("SUPERADMIN", "/admin/paginas")).toBe(true);
    expect(canEditAdminRoute("SUPERADMIN", "/admin/roles")).toBe(true);

    expect(canAccessAdminRoute("PARTICIPANT", "/admin")).toBe(false);
    expect(canEditAdminRoute("PARTICIPANT", "/admin/cuentos")).toBe(false);
  });
});
