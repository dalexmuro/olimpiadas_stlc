import { PublishWinnersButton } from "@/components/admin/PublishWinnersButton";
import { ADMIN_NAV_TABS } from "@/lib/admin-access";

export default function AdminDashboardPage() {
  const sections = ADMIN_NAV_TABS.filter((tab) => tab.href !== "/admin");

  return (
    <div className="space-y-8">
      <section className="border-t-2 border-ink pt-6">
        <h1>Panel de administración</h1>
        <p className="lead mt-4 text-ink-2">
          Gestiona consignas, ediciones, participantes y resultados de las
          Olimpíadas Literarias de SiTeLoCuento.
        </p>

        <div className="mt-8">
          <PublishWinnersButton />
        </div>

        <div className="mt-10 border-b border-rule">
          {sections.map((section) => (
            <div key={section.href} className="riso-row">
              <div>
                <h3>
                  <a href={section.href} className="riso-link">
                    {section.label}
                  </a>
                </h3>
                {section.superadminOnly && (
                  <p className="mt-1 text-xs text-muted">
                    Exclusivo para superadministrador
                  </p>
                )}
              </div>
              <p className="text-ink-2">{section.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
