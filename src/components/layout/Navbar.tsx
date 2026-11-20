import { APP_BRAND } from "@/lib/app-metadata";
import type { UserRole } from "@/db/schema";
import { resolveNavbarLinks } from "@/lib/public-pages";

export interface NavbarProps {
  currentPath?: string;
  userRole?: UserRole | null;
  userName?: string | null;
}

export function Navbar({
  currentPath = "/",
  userRole = null,
  userName = null,
}: NavbarProps) {
  const links = resolveNavbarLinks(userRole);

  return (
    <header className="riso-nav-shell">
      <div className="riso-nav-pill">
        <a href="/" className="riso-wordmark">
          {APP_BRAND.contestName}
        </a>

        <nav
          aria-label="Navegación principal"
          className="flex flex-wrap items-center gap-5"
        >
          {links.map((link) => {
            const isActive = currentPath === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className="riso-nav-link"
              >
                {link.label}
              </a>
            );
          })}

          {!userRole ? (
            <div className="flex flex-wrap items-center gap-3">
              <a href="/login" className="riso-nav-link">
                Iniciar sesión
              </a>
              <a href="/registro" className="btn btn--primary">
                Crear cuenta
              </a>
            </div>
          ) : (
            <span className="text-sm font-medium text-muted">
              {userName ?? userRole}
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
