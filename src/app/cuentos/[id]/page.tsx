/**
 * Public Story Reader Page (/cuentos/[id])
 * Step 6.1: Displays a published story alongside its full prompt (text, image, or video) and author name for announced editions (never exposes scores)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { createDbClient } from "@/db";
import { editionPrompts, editions, stories, users } from "@/db/schema";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { parseVideoEmbedUrl } from "@/lib/prompt-bank";

export const dynamic = "force-dynamic";

const PODIUM_BADGES: Record<number, string> = {
  1: "1er lugar",
  2: "2do lugar",
  3: "3er lugar",
};

export default async function PublicStoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);

  const storyRows = await db.select().from(stories).where(eq(stories.id, id));
  const story = storyRows[0];
  if (!story || !story.isPostulated) {
    notFound();
  }

  const [editionRows, promptRows, authorRows] = await Promise.all([
    db.select().from(editions).where(eq(editions.id, story.editionId)),
    db
      .select()
      .from(editionPrompts)
      .where(eq(editionPrompts.id, story.promptId)),
    db.select().from(users).where(eq(users.id, story.authorId)),
  ]);

  const edition = editionRows[0];
  if (!edition || !edition.winnersAnnounced) {
    notFound();
  }

  const prompt = promptRows[0];
  const author = authorRows[0];
  const authorName =
    [author?.firstName, author?.lastName].filter(Boolean).join(" ") ||
    author?.name ||
    "Autor";

  const videoEmbedUrl =
    prompt?.mediaType === "VIDEO" && prompt.mediaUrl
      ? parseVideoEmbedUrl(prompt.mediaUrl)
      : null;

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-12">
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        <a href="/resultados" className="riso-link font-medium">
          Resultados
        </a>
        <a href={`/ediciones/${edition.slug}`} className="riso-link font-medium">
          Todos los cuentos de {edition.title}
        </a>
      </nav>

      <article className="rounded-card border border-ink bg-paper p-8">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {prompt && (
            <span className="font-semibold text-accent-2">
              Consigna {prompt.promptNumber}
            </span>
          )}
          {story.podiumPlace && PODIUM_BADGES[story.podiumPlace] && (
            <span className="bg-accent px-2 py-0.5 font-semibold text-accent-ink">
              {PODIUM_BADGES[story.podiumPlace]}
            </span>
          )}
        </div>

        <h1 className="mt-3">{story.editedTitle ?? story.originalTitle}</h1>
        <p className="mt-2 text-sm text-ink-2">
          Por <strong>{authorName}</strong> ({edition.title})
        </p>

        <div className="mt-8 whitespace-pre-wrap border-t border-rule pt-6 text-base leading-relaxed text-ink">
          {story.editedBody ?? story.originalBody}
        </div>
      </article>

      {prompt && (
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <p className="text-xs font-semibold text-accent-2">
            Consigna {prompt.promptNumber}
          </p>
          <h2 className="mt-1">{prompt.title}</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
            {prompt.body}
          </p>

          {prompt.mediaType === "IMAGE" && prompt.mediaUrl && (
            <figure className="mt-5">
              <img
                src={prompt.mediaUrl}
                alt={`Imagen de la consigna ${prompt.promptNumber}`}
                className="max-h-80 w-auto border border-rule object-contain"
              />
            </figure>
          )}

          {videoEmbedUrl && (
            <div className="mt-5 aspect-video w-full overflow-hidden border border-rule">
              <iframe
                src={videoEmbedUrl}
                title={`Video de la consigna ${prompt.promptNumber}`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
