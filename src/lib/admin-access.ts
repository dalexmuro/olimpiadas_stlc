/**
 * Admin Panel Authorization & Navigation Tabs
 * Step 2.1: Protected /admin layout access control for ADMIN and SUPERADMIN roles
 */

import type { UserRole } from "@/db/schema";

export type AdminTabAccessTier =
  | "shared"
  | "admin_readonly"
  | "superadmin_only";

export interface AdminNavTab {
  href: string;
  label: string;
  description: string;
  accessTier: AdminTabAccessTier;
  superadminOnly: boolean;
}

export const ADMIN_NAV_TABS: readonly AdminNavTab[] = [
  {
    href: "/admin",
    label: "Resumen",
    description: "Vista general del panel de administración.",
    accessTier: "shared",
    superadminOnly: false,
  },
  {
    href: "/admin/banco-consignas",
    label: "Banco de consignas",
    description: "Proponer consignas futuras, comentar y votar de forma anónima.",
    accessTier: "shared",
    superadminOnly: false,
  },
  {
    href: "/admin/consignas-edicion",
    label: "Consignas activas",
    description: "Paquete de consignas de la edición actual y validación de administradores.",
    accessTier: "shared",
    superadminOnly: false,
  },
  {
    href: "/admin/cuentos",
    label: "Cuentos y alertas",
    description: "Leer cuentos postulados, comparar ediciones y revisar alertas.",
    accessTier: "shared",
    superadminOnly: false,
  },
  {
    href: "/admin/estadisticas",
    label: "Estadísticas",
    description: "Métricas en tiempo real, participación y tabla final de puntajes.",
    accessTier: "shared",
    superadminOnly: false,
  },
  {
    href: "/admin/participantes",
    label: "Participantes",
    description: "Reincorporar, descalificar o cargar cuentos tardíos con justificación.",
    accessTier: "shared",
    superadminOnly: false,
  },
  {
    href: "/admin/log",
    label: "Historial de acciones",
    description: "Registro inmutable de todas las intervenciones administrativas.",
    accessTier: "shared",
    superadminOnly: false,
  },
  {
    href: "/admin/ediciones",
    label: "Ediciones y fechas",
    description: "Crear ediciones anuales, parámetros y calendario en hora de Caracas.",
    accessTier: "admin_readonly",
    superadminOnly: true,
  },
  {
    href: "/admin/correos",
    label: "Plantillas de correo",
    description: "Editar asuntos, cuerpos y etiquetas dinámicas de los 26 correos.",
    accessTier: "admin_readonly",
    superadminOnly: true,
  },
  {
    href: "/admin/paginas",
    label: "Páginas públicas",
    description: "Editar el contenido de Bases del Concurso y ¿Quiénes somos?.",
    accessTier: "admin_readonly",
    superadminOnly: true,
  },
  {
    href: "/admin/roles",
    label: "Gestión de roles",
    description: "Asignar o retirar roles de administrador, jurado y superadministrador.",
    accessTier: "superadmin_only",
    superadminOnly: true,
  },
] as const;

/**
 * Returns true if the role is allowed to enter the `/admin` area (`ADMIN` or `SUPERADMIN`).
 */
export function canAccessAdminPanel(role?: UserRole | null): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

/**
 * Returns true only for `SUPERADMIN`.
 */
export function isSuperadmin(role?: UserRole | null): boolean {
  return role === "SUPERADMIN";
}

/**
 * Returns the list of admin navigation tabs visible for the given role.
 * Regular ADMIN sees `shared` (editable) and `admin_readonly` (view-only) tabs;
 * `superadmin_only` tabs (e.g. Gestión de roles) are visible exclusively to SUPERADMIN.
 */
export function getVisibleAdminTabs(role?: UserRole | null): AdminNavTab[] {
  if (!canAccessAdminPanel(role)) {
    return [];
  }
  if (role === "SUPERADMIN") {
    return [...ADMIN_NAV_TABS];
  }
  return ADMIN_NAV_TABS.filter((tab) => tab.accessTier !== "superadmin_only");
}

/**
 * Verifies whether a given role is permitted to visit a specific `/admin/*` pathname.
 */
export function canAccessAdminRoute(
  role: UserRole | null | undefined,
  pathname: string
): boolean {
  if (!canAccessAdminPanel(role)) {
    return false;
  }
  if (role === "SUPERADMIN") {
    return true;
  }

  const normalized = pathname.replace(/\/+$/, "") || "/admin";
  const matchedTab = ADMIN_NAV_TABS.find(
    (tab) =>
      tab.href !== "/admin" &&
      (normalized === tab.href || normalized.startsWith(`${tab.href}/`))
  );

  if (matchedTab?.accessTier === "superadmin_only") {
    return false;
  }

  return true;
}

/**
 * Verifies whether a given role is permitted to edit/mutate data on a specific `/admin/*` route.
 */
export function canEditAdminRoute(
  role: UserRole | null | undefined,
  pathname: string
): boolean {
  if (!canAccessAdminPanel(role)) {
    return false;
  }
  if (role === "SUPERADMIN") {
    return true;
  }

  const normalized = pathname.replace(/\/+$/, "") || "/admin";
  const matchedTab = ADMIN_NAV_TABS.find(
    (tab) =>
      tab.href !== "/admin" &&
      (normalized === tab.href || normalized.startsWith(`${tab.href}/`))
  );

  return !matchedTab || matchedTab.accessTier === "shared";
}
