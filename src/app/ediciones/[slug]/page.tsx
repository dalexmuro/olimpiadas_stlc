/**
 * Public Chronological Edition Anthology (/ediciones/[slug])
 * Step 6.1: Lists every finalist/active postulated story in chronological order by prompt and submission time, showing author name and 1st/2nd/3rd badges with zero scores
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { createDbClient } from "@/db";
import {
  editionPrompts,
  editions,
  enrollments,
  stories,
  users,
} from "@/db/schema";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { sortPublishedEditionStoriesChronologically } from "@/lib/stage7-winners";

export const dynamic = "force-dynamic";

const PODIUM_BADGES: Record<number, string> = {
  1: "1er lugar",
  2: "2do lugar",
  3: "3er lugar",
};

export default async function EditionArchiveDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);

  const editionRows = await db
    .select()
    .from(editions)
    .where(and(eq(editions.slug, slug), eq(editions.winnersAnnounced, true)));

  const edition = editionRows[0];
  if (!edition) {
    notFound();
  }

  const [promptRows, activeEnrollments, postulatedStories] = await Promise.all([
    db
      .select()
      .from(editionPrompts)
      .where(eq(editionPrompts.editionId, edition.id)),
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.editionId, edition.id),
          eq(enrollments.status, "ACTIVE")
        )
      ),
    db
      .select()
      .from(stories)
      .where(
        and(eq(stories.editionId, edition.id), eq(stories.isPostulated, true))
      ),
  ]);

  const activeEnrollmentIds = new Set(activeEnrollments.map((e) => e.id));
  const survivingStories = postulatedStories.filter((s) =>
    activeEnrollmentIds.has(s.enrollmentId)
  );

  const authorIds = Array.from(new Set(survivingStories.map((s) => s.authorId)));
  const authorRows =
    authorIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, authorIds))
      : [];

  const promptById = new Map(promptRows.map((p) => [p.id, p]));
  const authorById = new Map(authorRows.map((u) => [u.id, u]));

  const sortedStories = sortPublishedEditionStoriesChronologically(
    survivingStories.map((s) => {
      const prompt = promptById.get(s.promptId);
      const author = authorById.get(s.authorId);
      return {
        id: s.id,
        title: s.editedTitle ?? s.originalTitle,
        promptNumber: prompt?.promptNumber ?? 0,
        promptTitle: prompt?.title ?? "",
        submittedAt: s.submittedAt,
        podiumPlace: s.podiumPlace,
        authorName:
          [author?.firstName, author?.lastName].filter(Boolean).join(" ") ||
          author?.name ||
          "Autor",
      };
    })
  );

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-12">
      <header className="border-b-2 border-ink pb-4">
        <a href="/ediciones" className="riso-link text-sm font-medium">
          Volver al archivo de ediciones
        </a>
        <h1 className="mt-2">{edition.title}</h1>
        <p className="mt-2 text-sm text-ink-2">
          Todos los cuentos que llegaron al final de esta edición, ordenados
          cronológicamente por consigna y fecha de envío.
        </p>
      </header>

      <ul className="divide-y divide-rule border-y border-rule">
        {sortedStories.map((story) => (
          <li
            key={story.id}
            className="flex flex-wrap items-center justify-between gap-4 py-5"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-accent-2">
                  Consigna {story.promptNumber}
                </span>
                {story.podiumPlace && PODIUM_BADGES[story.podiumPlace] && (
                  <span className="bg-accent px-2 py-0.5 font-semibold text-accent-ink">
                    {PODIUM_BADGES[story.podiumPlace]}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl">{story.title}</h2>
              <p className="mt-1 text-xs text-muted">
                Por <strong>{story.authorName}</strong>
              </p>
            </div>
            <a
              href={`/cuentos/${story.id}`}
              className="btn btn--secondary whitespace-nowrap"
            >
              Leer cuento
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
