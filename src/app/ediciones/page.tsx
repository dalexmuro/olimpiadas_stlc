/**
 * Public Past Editions Archive (/ediciones)
 * Step 6.1: Lists all published editions with links to their chronological story anthology
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";
import { createDbClient } from "@/db";
import { editions } from "@/db/schema";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { formatCaracasDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function EdicionesPage() {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);

  const publishedEditions = await db
    .select()
    .from(editions)
    .where(eq(editions.winnersAnnounced, true))
    .orderBy(desc(editions.winnersAnnouncedAt));

  const hasEditions = publishedEditions.length > 0;

  return (
    <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
      <Navbar currentPath="/ediciones" showEditions={hasEditions} />

      <main id="contenido" className="container flex-1 py-16 sm:py-24">
        <PageReveal className="max-w-4xl space-y-12">
          <header className="border-t border-rule pt-10">
            <h1>
              Archivo de <span className="ta-serif-italic">ediciones</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Consulta las obras completas y los ganadores de cada edición
              concluida de las Olimpíadas Literarias.
            </p>
          </header>

          {!hasEditions ? (
            <section className="border-t border-rule pt-8">
              <p className="lead text-muted">
                Aún no hay ediciones finalizadas en el archivo histórico.
              </p>
            </section>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {publishedEditions.map((ed) => (
                <li
                  key={ed.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-6"
                >
                  <div>
                    <h2 className="text-xl sm:text-2xl">{ed.title}</h2>
                    {ed.winnersAnnouncedAt && (
                      <p className="mt-1 text-xs text-muted num">
                        Anunciada el{" "}
                        {formatCaracasDateTime(ed.winnersAnnouncedAt)}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/ediciones/${ed.slug}`}
                    className="btn btn--secondary whitespace-nowrap"
                  >
                    Leer cuentos
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PageReveal>
      </main>

      <Footer />
    </div>
  );
}
