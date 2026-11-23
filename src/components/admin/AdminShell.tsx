import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";
import type { UserRole } from "@/db/schema";
import { getVisibleAdminTabs } from "@/lib/admin-access";

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

      <div className="container flex-1 py-12 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <aside
            aria-label="Navegación de administración"
            className="lg:col-span-3"
          >
            <div className="rounded-[24px] border border-rule bg-surface p-6 shadow-card">
              <p className="font-display text-lg font-bold tracking-display text-ink">
                Panel <span className="ta-serif-italic">organizador</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {role === "SUPERADMIN"
                  ? "Superadministrador"
                  : "Administrador del concurso"}
              </p>

              <nav className="mt-5 flex flex-col gap-1 border-t border-rule pt-4">
                {sharedTabs.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className="riso-nav-link self-start"
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>

              {superadminTabs.length > 0 && (
                <div className="mt-6 border-t border-rule pt-4">
                  <p className="text-xs font-semibold text-muted">
                    Configuración exclusiva
                  </p>
                  <nav className="mt-2 flex flex-col gap-1">
                    {superadminTabs.map((tab) => (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className="riso-nav-link self-start"
                      >
                        {tab.label}
                      </Link>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          </aside>

          <main id="contenido" className="min-w-0 lg:col-span-9">
            <PageReveal>{children}</PageReveal>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
