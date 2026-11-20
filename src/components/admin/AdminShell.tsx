import type { ReactNode } from "react";
import type { UserRole } from "@/db/schema";
import { getVisibleAdminTabs } from "@/lib/admin-access";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export interface AdminShellProps {
  role: UserRole;
  userName?: string | null;
  children: ReactNode;
}

export function AdminShell({ role, userName, children }: AdminShellProps) {
  const tabs = getVisibleAdminTabs(role);
  const sharedTabs = tabs.filter((t) => !t.superadminOnly);
  const superadminTabs = tabs.filter((t) => t.superadminOnly);

  return (
    <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
      <Navbar currentPath="/admin" userRole={role} userName={userName} />

      <div className="container flex-1 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <aside
            aria-label="Navegación de administración"
            className="lg:col-span-3"
          >
            <div className="rounded-card border border-ink bg-paper p-5">
              <p className="font-display text-lg font-extrabold text-ink">
                Panel organizador
              </p>
              <p className="mt-1 text-sm text-muted">
                {role === "SUPERADMIN"
                  ? "Superadministrador"
                  : "Administrador del concurso"}
              </p>

              <nav className="mt-5 flex flex-col gap-2 border-t border-rule pt-4">
                {sharedTabs.map((tab) => (
                  <a
                    key={tab.href}
                    href={tab.href}
                    className="riso-nav-link self-start"
                  >
                    {tab.label}
                  </a>
                ))}
              </nav>

              {superadminTabs.length > 0 && (
                <div className="mt-6 border-t border-rule pt-4">
                  <p className="text-sm font-medium text-muted">
                    Configuración exclusiva
                  </p>
                  <nav className="mt-3 flex flex-col gap-2">
                    {superadminTabs.map((tab) => (
                      <a
                        key={tab.href}
                        href={tab.href}
                        className="riso-nav-link self-start"
                      >
                        {tab.label}
                      </a>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 lg:col-span-9">{children}</main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
