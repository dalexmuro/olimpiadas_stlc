import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_TABS,
  canAccessAdminPanel,
  canAccessAdminRoute,
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

  it("shows 7 shared tabs to ADMIN and all 11 tabs (including 4 exclusive tabs) to SUPERADMIN", () => {
    expect(ADMIN_NAV_TABS).toHaveLength(11);

    const adminTabs = getVisibleAdminTabs("ADMIN");
    expect(adminTabs).toHaveLength(7);
    expect(adminTabs.every((t) => !t.superadminOnly)).toBe(true);

    const superadminTabs = getVisibleAdminTabs("SUPERADMIN");
    expect(superadminTabs).toHaveLength(11);
    expect(superadminTabs.filter((t) => t.superadminOnly).map((t) => t.href)).toEqual([
      "/admin/ediciones",
      "/admin/roles",
      "/admin/correos",
      "/admin/paginas",
    ]);

    expect(getVisibleAdminTabs("PARTICIPANT")).toEqual([]);
    expect(getVisibleAdminTabs("JURY")).toEqual([]);
  });

  it("blocks regular ADMIN from superadmin-only subroutes while allowing shared routes", () => {
    expect(canAccessAdminRoute("ADMIN", "/admin")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/banco-consignas")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/cuentos")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/participantes")).toBe(true);
    expect(canAccessAdminRoute("ADMIN", "/admin/log")).toBe(true);

    // Superadmin-only subroutes blocked for regular ADMIN
    expect(canAccessAdminRoute("ADMIN", "/admin/ediciones")).toBe(false);
    expect(canAccessAdminRoute("ADMIN", "/admin/roles")).toBe(false);
    expect(canAccessAdminRoute("ADMIN", "/admin/correos")).toBe(false);
    expect(canAccessAdminRoute("ADMIN", "/admin/paginas")).toBe(false);

    // SUPERADMIN allowed everywhere
    expect(canAccessAdminRoute("SUPERADMIN", "/admin/ediciones")).toBe(true);
    expect(canAccessAdminRoute("SUPERADMIN", "/admin/roles")).toBe(true);
    expect(canAccessAdminRoute("SUPERADMIN", "/admin/correos")).toBe(true);
    expect(canAccessAdminRoute("SUPERADMIN", "/admin/paginas")).toBe(true);

    // Non-admins blocked everywhere
    expect(canAccessAdminRoute("PARTICIPANT", "/admin")).toBe(false);
    expect(canAccessAdminRoute("JURY", "/admin/cuentos")).toBe(false);
  });
});
