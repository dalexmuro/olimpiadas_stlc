/**
 * Public Past Editions Archive (/ediciones)
 * Step 6.1: Lists all published editions with links to their chronological story anthology
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq } from "drizzle-orm";
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

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-12">
      <header className="border-b-2 border-ink pb-4">
        <h1>Archivo de ediciones</h1>
        <p className="mt-2 text-sm text-ink-2">
          Consulta las obras completas y los ganadores de cada edición concluida
          de las Olimpíadas Literarias de SiTeLoCuento.
        </p>
      </header>

      {publishedEditions.length === 0 ? (
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <p className="lead text-ink-2">
            Aún no hay ediciones finalizadas en el archivo histórico.
          </p>
        </section>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {publishedEditions.map((ed) => (
            <li
              key={ed.id}
              className="flex flex-wrap items-center justify-between gap-4 py-5"
            >
              <div>
                <h2 className="text-xl">{ed.title}</h2>
                {ed.winnersAnnouncedAt && (
                  <p className="mt-1 text-xs text-muted num">
                    Anunciada el {formatCaracasDateTime(ed.winnersAnnouncedAt)}
                  </p>
                )}
              </div>
              <a
                href={`/ediciones/${ed.slug}`}
                className="btn btn--secondary whitespace-nowrap"
              >
                Leer cuentos
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
