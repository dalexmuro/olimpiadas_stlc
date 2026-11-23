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
            className="ta-admin-aside lg:col-span-3"
          >
            <div className="overflow-hidden rounded-[24px] border border-rule bg-surface shadow-card">
              <div className="p-5">
                <p className="font-display text-base font-bold tracking-display text-ink">
                  Panel de <span className="ta-serif-italic">administración</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {role === "SUPERADMIN"
                    ? "Superadministrador"
                    : "Administrador del concurso"}
                </p>

                <nav className="mt-4 flex flex-col gap-0.5 border-t border-rule pt-3">
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
              </div>

              {superadminTabs.length > 0 && (
                <div className="border-t border-rule bg-accent-soft px-5 py-5">
                  <p className="text-xs font-semibold text-accent-deep">
                    Configuración exclusiva
                  </p>
                  <nav className="mt-3 flex flex-col gap-0.5">
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

          <main id="contenido" className="ta-admin-main min-w-0 lg:col-span-9">
            <PageReveal>{children}</PageReveal>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
