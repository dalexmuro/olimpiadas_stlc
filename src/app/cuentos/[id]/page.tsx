/**
 * Public Story Reader Page (/cuentos/[id])
 * Step 6.1: Displays a published story alongside its full prompt (text, image, or video) and author name for announced editions (never exposes scores)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";
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
    <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
      <Navbar currentPath="/ediciones" showEditions />

      <main id="contenido" className="container flex-1 py-16 sm:py-24">
        <PageReveal className="mx-auto max-w-3xl space-y-12">
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <Link href="/resultados" className="ta-inline-link">
              Resultados
            </Link>
            <Link href={`/ediciones/${edition.slug}`} className="ta-inline-link">
              Todos los cuentos de {edition.title}
            </Link>
          </nav>

          <article className="rounded-[28px] border border-rule bg-surface p-8 shadow-card sm:p-12">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {prompt && (
                <span className="font-semibold text-accent-2">
                  Consigna {prompt.promptNumber}
                </span>
              )}
              {story.podiumPlace && PODIUM_BADGES[story.podiumPlace] && (
                <span className="rounded-pill bg-accent px-2.5 py-0.5 font-semibold text-accent-ink">
                  {PODIUM_BADGES[story.podiumPlace]}
                </span>
              )}
            </div>

            <h1 className="mt-4">
              {story.editedTitle ?? story.originalTitle}
            </h1>
            <p className="mt-3 text-sm text-muted">
              Por <strong className="text-ink">{authorName}</strong> (
              {edition.title})
            </p>

            <div className="mt-10 whitespace-pre-wrap border-t border-rule pt-8 text-base leading-relaxed text-ink sm:text-lg">
              {story.editedBody ?? story.originalBody}
            </div>
          </article>

          {prompt && (
            <section className="rounded-[24px] border border-rule bg-paper-2 p-8 sm:p-10">
              <p className="text-xs font-semibold text-accent-2">
                Consigna {prompt.promptNumber}
              </p>
              <h2 className="mt-2 text-2xl">{prompt.title}</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-2 sm:text-base">
                {prompt.body}
              </p>

              {prompt.mediaType === "IMAGE" && prompt.mediaUrl && (
                <figure className="mt-6">
                  <img
                    src={prompt.mediaUrl}
                    alt={`Imagen de la consigna ${prompt.promptNumber}`}
                    className="max-h-80 w-auto rounded-[16px] border border-rule object-contain"
                  />
                </figure>
              )}

              {videoEmbedUrl && (
                <div className="mt-6 aspect-video w-full overflow-hidden rounded-[16px] border border-rule">
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
        </PageReveal>
      </main>

      <Footer />
    </div>
  );
}
