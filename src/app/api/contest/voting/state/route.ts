/**
 * Story Read & Preselection State API Route (/api/contest/voting/state)
 * Step 5.1: Persists "Leído" and "Preseleccionado" toggles per voter/story
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { editions, enrollments, stories } from "@/db/schema";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { toggleStoryReadOrPreselectionInDb } from "@/lib/stage5-voting";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para continuar." },
      { status: 401 }
    );
  }

  const activeEditions = await db
    .select()
    .from(editions)
    .where(eq(editions.isActive, true));
  const edition = activeEditions[0];
  if (!edition) {
    return NextResponse.json(
      { ok: false, error: "No hay ninguna edición activa." },
      { status: 404 }
    );
  }

  const body = (await request.json()) as {
    storyId?: string;
    isRead?: boolean;
    isPreselected?: boolean;
  };

  if (!body.storyId) {
    return NextResponse.json(
      { ok: false, error: "Falta el identificador del cuento." },
      { status: 400 }
    );
  }

  const [storyRows, enrollmentRows] = await Promise.all([
    db
      .select()
      .from(stories)
      .where(
        and(eq(stories.id, body.storyId), eq(stories.editionId, edition.id))
      ),
    db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.editionId, edition.id),
          eq(enrollments.userId, session.user.id)
        )
      ),
  ]);

  const story = storyRows[0];
  if (!story || !story.isPostulated) {
    return NextResponse.json(
      { ok: false, error: "Cuento no encontrado." },
      { status: 404 }
    );
  }

  const enrollment = enrollmentRows[0];
  if (enrollment?.hasVoted && body.isPreselected !== undefined) {
    return NextResponse.json(
      {
        ok: false,
        error: "Ya enviaste tu voto definitivo; los cuentos están en modo lectura.",
      },
      { status: 400 }
    );
  }

  const result = await toggleStoryReadOrPreselectionInDb({
    db,
    editionId: edition.id,
    voterId: session.user.id,
    storyId: story.id,
    isOwnStory: story.authorId === session.user.id,
    isRead: typeof body.isRead === "boolean" ? body.isRead : undefined,
    isPreselected:
      typeof body.isPreselected === "boolean" ? body.isPreselected : undefined,
  });

  if (!result.updated) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    isRead: result.isRead,
    isPreselected: result.isPreselected,
  });
}
