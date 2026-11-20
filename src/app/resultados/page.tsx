/**
 * Public Winners Page (/resultados)
 * Step 6.1: Displays 1st, 2nd, and 3rd place winners of the latest announced edition with author photo, name, story link, and archive link (zero scores)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Trophy } from "lucide-react";
import { createDbClient } from "@/db";
import { editionPrompts, editions, stories, users } from "@/db/schema";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { formatCaracasDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const PODIUM_LABELS: Record<number, string> = {
  1: "1er lugar",
  2: "2do lugar",
  3: "3er lugar",
};

export default async function ResultadosPage() {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);

  const announcedEditions = await db
    .select()
    .from(editions)
    .where(eq(editions.winnersAnnounced, true))
    .orderBy(desc(editions.winnersAnnouncedAt));

  const latestEdition = announcedEditions[0];

  if (!latestEdition) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <h1>Resultados oficiales</h1>
          <p className="lead mt-3 text-ink-2">
            Todavía no hay una edición con ganadores publicados. Vuelve al
            concluir la evaluación del jurado para conocer el podio oficial.
          </p>
          <div className="mt-6">
            <a href="/bases-del-concurso" className="btn btn--secondary">
              Consultar las bases
            </a>
          </div>
        </section>
      </main>
    );
  }

  const [podiumStories, editionPromptRows] = await Promise.all([
    db
      .select()
      .from(stories)
      .where(
        and(
          eq(stories.editionId, latestEdition.id),
          inArray(stories.podiumPlace, [1, 2, 3])
        )
      ),
    db
      .select()
      .from(editionPrompts)
      .where(eq(editionPrompts.editionId, latestEdition.id)),
  ]);

  const authorIds = podiumStories.map((s) => s.authorId);
  const authorRows =
    authorIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, authorIds))
      : [];

  const authorById = new Map(authorRows.map((u) => [u.id, u]));
  const promptById = new Map(editionPromptRows.map((p) => [p.id, p]));

  const sortedPodium = [...podiumStories].sort(
    (a, b) => (a.podiumPlace ?? 99) - (b.podiumPlace ?? 99)
  );

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-12">
      <header className="border-b-2 border-ink pb-6">
        <div className="flex items-center gap-2 text-accent-2">
          <Trophy className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-semibold">Podio oficial</span>
        </div>
        <h1 className="mt-2">{latestEdition.title}</h1>
        {latestEdition.winnersAnnouncedAt && (
          <p className="mt-2 text-sm text-muted num">
            Resultados anunciados el{" "}
            {formatCaracasDateTime(latestEdition.winnersAnnouncedAt)}.
          </p>
        )}
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {sortedPodium.map((story) => {
          const author = authorById.get(story.authorId);
          const prompt = promptById.get(story.promptId);
          const authorName =
            [author?.firstName, author?.lastName].filter(Boolean).join(" ") ||
            author?.name ||
            "Autor";
          const initials = authorName
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("");

          return (
            <article
              key={story.id}
              className="flex flex-col justify-between rounded-card border-2 border-ink bg-paper p-6"
            >
              <div>
                <p className="text-sm font-semibold text-accent-2">
                  {PODIUM_LABELS[story.podiumPlace ?? 0] ?? "Finalista"}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  {author?.image ? (
                    <img
                      src={author.image}
                      alt={`Foto de ${authorName}`}
                      className="h-14 w-14 rounded-full border border-ink object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-14 w-14 items-center justify-center rounded-full border border-ink bg-paper-2 font-display text-lg font-extrabold text-ink"
                    >
                      {initials}
                    </div>
                  )}
                  <div>
                    <p className="font-display text-base font-extrabold text-ink">
                      {authorName}
                    </p>
                    {author?.country && (
                      <p className="text-xs text-muted">{author.country}</p>
                    )}
                  </div>
                </div>

                <h2 className="mt-5 text-xl">
                  {story.editedTitle ?? story.originalTitle}
                </h2>
                {prompt && (
                  <p className="mt-2 text-xs text-muted">
                    Consigna {prompt.promptNumber}: {prompt.title}
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-rule pt-4">
                <a
                  href={`/cuentos/${story.id}`}
                  className="btn btn--primary w-full text-center"
                >
                  Leer cuento y consigna
                </a>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-card border border-ink bg-paper-2 p-8">
        <h2>Explora todos los cuentos de la edición</h2>
        <p className="lead mt-2 text-ink-2">
          Lee todas las obras que llegaron a la fase final de{" "}
          {latestEdition.title}, ordenadas cronológicamente por consigna.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href={`/ediciones/${latestEdition.slug}`}
            className="btn btn--primary"
          >
            Ver todos los cuentos
          </a>
          <a href="/ediciones" className="btn btn--secondary">
            Archivo de ediciones
          </a>
        </div>
      </section>
    </main>
  );
}
