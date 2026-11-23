import { FooterBounce } from "@/components/layout/FooterBounce";
import { APP_BRAND } from "@/lib/app-metadata";

interface FooterProps {
  flushTop?: boolean;
}

export function Footer({ flushTop = false }: FooterProps) {
  return (
    <footer
      className={`${flushTop ? "mt-0" : "mt-32 sm:mt-44"} border-t border-rule bg-paper pb-24`}
    >
      <div className="container pt-12 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-display text-2xl font-bold tracking-display text-ink sm:text-3xl">
              {APP_BRAND.contestName}
            </p>
            <p className="mt-3 text-sm text-muted">
              Un espacio de {APP_BRAND.clubName} para escribir sin miedo, jugar
              con consignas y compartir historias.
            </p>
          </div>

          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Consultas y soporte:</span>
            <a
              href={`mailto:${APP_BRAND.supportEmail}`}
              className="riso-link"
            >
              {APP_BRAND.supportEmail}
            </a>
          </p>
        </div>
      </div>

      <FooterBounce />
    </footer>
  );
}
