import Link from "next/link";
import { PublishWinnersButton } from "@/components/admin/PublishWinnersButton";
import { getVisibleAdminTabs } from "@/lib/admin-access";
import { getCurrentAdminRole } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const role = await getCurrentAdminRole();
  const sections = getVisibleAdminTabs(role).filter(
    (tab) => tab.href !== "/admin"
  );

  return (
    <div className="space-y-8">
      <section className="border-t border-rule pt-6">
        <h1>
          Panel de <span className="ta-serif-italic">administración</span>
        </h1>
        <p className="lead mt-3 text-muted">
          Gestiona consignas, ediciones, participantes y resultados de las
          Olimpíadas Literarias.
        </p>

        <div className="mt-6">
          <PublishWinnersButton />
        </div>

        <div className="mt-8 border-b border-rule">
          {sections.map((section) => (
            <div key={section.href} className="riso-row">
              <div>
                <h3>
                  <Link href={section.href} className="riso-link">
                    {section.label}
                  </Link>
                </h3>
              </div>
              <p className="text-sm text-ink-2">{section.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
