/**
 * Stage 2 Participant Story Submission API Route (/api/contest/stories)
 * Step 3.3: Reads current open prompt state (hiding closed prompts) and upserts the participant's story
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { editionPrompts, editions, enrollments, stories } from "@/db/schema";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  resolveStage2ViewState,
  submitStage2StoryInDb,
  type Stage2ExistingStorySnapshot,
} from "@/lib/stage2-writing";

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para ver esta sección." },
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
      { ok: false, error: "No hay ninguna edición activa en este momento." },
      { status: 404 }
    );
  }

  const [enrollmentRows, promptRows] = await Promise.all([
    db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.editionId, edition.id),
          eq(enrollments.userId, session.user.id)
        )
      ),
    db
      .select()
      .from(editionPrompts)
      .where(eq(editionPrompts.editionId, edition.id))
      .orderBy(asc(editionPrompts.promptNumber)),
  ]);

  const enrollment = enrollmentRows[0];
  if (!enrollment) {
    return NextResponse.json(
      { ok: false, error: "No estás inscrito en la edición activa." },
      { status: 403 }
    );
  }

  const viewState = resolveStage2ViewState({
    enrollmentStatus: enrollment.status,
    disqualificationReason: enrollment.disqualificationReason,
    prompts: promptRows.map((p) => ({
      id: p.id,
      promptNumber: p.promptNumber,
      title: p.title,
      body: p.body,
      mediaType: p.mediaType,
      mediaUrl: p.mediaUrl,
      publishedAt: p.publishedAt,
      closesAt: p.closesAt,
    })),
    submissionStartAt: edition.submissionStartAt,
  });

  let currentStory: Stage2ExistingStorySnapshot | null = null;
  if (viewState.kind === "OPEN_PROMPT") {
    const storyRows = await db
      .select({
        id: stories.id,
        promptId: stories.promptId,
        originalTitle: stories.originalTitle,
        originalBody: stories.originalBody,
        originalCharCount: stories.originalCharCount,
        submittedAt: stories.submittedAt,
      })
      .from(stories)
      .where(
        and(
          eq(stories.enrollmentId, enrollment.id),
          eq(stories.promptId, viewState.prompt.id)
        )
      );
    currentStory = storyRows[0] ?? null;
  }

  return NextResponse.json({
    ok: true,
    viewState,
    currentStory,
    limits: {
      minChars: edition.minChars,
      maxChars: edition.maxChars,
      missesCount: enrollment.missesCount,
      maxAllowedMisses: edition.maxAllowedMisses,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para enviar un cuento." },
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
      { ok: false, error: "No hay ninguna edición activa en este momento." },
      { status: 404 }
    );
  }

  const body = (await request.json()) as {
    promptId?: string;
    title?: string;
    body?: string;
  };

  if (!body.promptId) {
    return NextResponse.json(
      { ok: false, error: "Falta el identificador de la consigna." },
      { status: 400 }
    );
  }

  const [enrollmentRows, promptRows] = await Promise.all([
    db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.editionId, edition.id),
          eq(enrollments.userId, session.user.id)
        )
      ),
    db
      .select()
      .from(editionPrompts)
      .where(
        and(
          eq(editionPrompts.id, body.promptId),
          eq(editionPrompts.editionId, edition.id)
        )
      ),
  ]);

  const enrollment = enrollmentRows[0];
  const prompt = promptRows[0];

  if (!enrollment) {
    return NextResponse.json(
      { ok: false, error: "No estás inscrito en la edición activa." },
      { status: 403 }
    );
  }

  if (!prompt) {
    return NextResponse.json(
      { ok: false, error: "La consigna indicada no existe en esta edición." },
      { status: 404 }
    );
  }

  const result = await submitStage2StoryInDb({
    db,
    edition: {
      id: edition.id,
      minChars: edition.minChars,
      maxChars: edition.maxChars,
    },
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
    },
    prompt: {
      id: prompt.id,
      publishedAt: prompt.publishedAt,
      closesAt: prompt.closesAt,
    },
    userId: session.user.id,
    title: typeof body.title === "string" ? body.title : "",
    body: typeof body.body === "string" ? body.body : "",
  });

  if (!result.saved) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      storyId: result.storyId,
      updatedExisting: result.updatedExisting,
      charCount: result.charCount,
      submittedAt: result.submittedAt,
    },
    { status: result.updatedExisting ? 200 : 201 }
  );
}
