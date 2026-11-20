import { APP_BRAND, PUBLIC_NAVIGATION_LINKS } from "@/lib/app-metadata";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-rule bg-paper">
      <div className="container py-16">
        <p className="font-display text-3xl font-extrabold tracking-display text-ink sm:text-4xl">
          {APP_BRAND.contestName}
        </p>
        <p className="mt-3 max-w-xl text-sm text-muted">
          Certamen anual de cuentos cortos organizado por el club de escritura{" "}
          {APP_BRAND.clubName}. Hora oficial de referencia: Caracas, Venezuela (
          {APP_BRAND.officialUtcOffset}).
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-rule pt-6">
          <nav
            aria-label="Enlaces del pie de página"
            className="flex flex-wrap gap-6"
          >
            {PUBLIC_NAVIGATION_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="riso-nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          <p className="text-sm text-muted">
            <a
              href={`mailto:${APP_BRAND.supportEmail}`}
              className="riso-link"
            >
              {APP_BRAND.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
