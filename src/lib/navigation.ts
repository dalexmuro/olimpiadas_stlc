/**
 * Bottom Navigation Menu Link Builder
 * Shared pure helper used by `Navbar.tsx` and unit-tested for role visibility rules.
 */

import type { UserRole } from "@/db/schema";

export interface BottomMenuLink {
  label: string;
  hint: string;
  href: string;
}

export function buildBottomMenuLinks(options: {
  isHome: boolean;
  showEditions: boolean;
  userRole: UserRole | null;
}): BottomMenuLink[] {
  const { isHome, showEditions, userRole } = options;
  const isAdmin = userRole === "ADMIN" || userRole === "SUPERADMIN";

  return [
    ...(!isHome ? [{ label: "Inicio", hint: "Portada", href: "/" }] : []),
    {
      label: "Bases del Concurso",
      hint: "Reglamento",
      href: "/bases-del-concurso",
    },
    { label: "Quiénes somos", hint: "El club", href: "/quienes-somos" },
    ...(showEditions
      ? [{ label: "Ediciones", hint: "Archivo", href: "/ediciones" }]
      : []),
    ...(userRole
      ? [{ label: "Perfil", hint: "Tu cuenta", href: "/perfil" }]
      : []),
    ...(isAdmin
      ? [
          {
            label: "Panel de Administración",
            hint: "Gestión",
            href: "/admin",
          },
        ]
      : []),
  ];
}
