/**
 * Stage 3 Selection, Draft Editing & Definitive Postulation API Route (/api/contest/submission)
 * Step 4.2: Handles irreversible selection (`select`), draft saves (`save_draft`), and final postulation (`postulate` + E10)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { editions, enrollments, stories, users } from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  postulateStoryDefinitivelyInDb,
  saveStage3DraftInDb,
  selectStoryForPostulationInDb,
} from "@/lib/stage3-submission";

type SubmissionAction = "select" | "save_draft" | "postulate";

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

  const body = (await request.json()) as {
    action?: SubmissionAction;
    storyId?: string;
    title?: string;
    body?: string;
  };

  if (!body.action || !body.storyId) {
    return NextResponse.json(
      { ok: false, error: "Faltan la acción o el identificador del cuento." },
      { status: 400 }
    );
  }

  const [userRows, activeEditions] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)),
    db.select().from(editions).where(eq(editions.isActive, true)),
  ]);

  const user = userRows[0];
  const edition = activeEditions[0];
  if (!user || !edition) {
    return NextResponse.json(
      { ok: false, error: "No se encontró el usuario o la edición activa." },
      { status: 404 }
    );
  }

  const [enrollmentRows, storyRows] = await Promise.all([
    db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.editionId, edition.id),
          eq(enrollments.userId, user.id)
        )
      ),
    db
      .select()
      .from(stories)
      .where(and(eq(stories.id, body.storyId), eq(stories.editionId, edition.id))),
  ]);

  const enrollment = enrollmentRows[0];
  const story = storyRows[0];

  if (!enrollment) {
    return NextResponse.json(
      { ok: false, error: "No estás inscrito en la edición activa." },
      { status: 403 }
    );
  }

  if (!story || story.enrollmentId !== enrollment.id) {
    return NextResponse.json(
      { ok: false, error: "El cuento indicado no pertenece a tu cuenta." },
      { status: 404 }
    );
  }

  if (body.action === "select") {
    const result = await selectStoryForPostulationInDb({
      db,
      edition,
      enrollment,
      story,
    });
    if (!result.selected) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, storyId: result.storyId });
  }

  if (body.action === "save_draft") {
    const result = await saveStage3DraftInDb({
      db,
      edition,
      enrollment,
      story,
      title: typeof body.title === "string" ? body.title : "",
      body: typeof body.body === "string" ? body.body : "",
    });
    if (!result.saved) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      charCount: result.charCount,
      similarityPct: result.similarityPct,
      updatedAt: result.updatedAt,
    });
  }

  if (body.action === "postulate") {
    const result = await postulateStoryDefinitivelyInDb({
      db,
      edition,
      enrollment,
      story,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name ?? user.email,
      },
      title: typeof body.title === "string" ? body.title : "",
      body: typeof body.body === "string" ? body.body : "",
      baseUrl: cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
      brevoApiKey: cfEnv.BREVO_API_KEY,
    });
    if (!result.postulated) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      postulatedAt: result.postulatedAt,
      similarityPct: result.similarityPct,
      charCount: result.charCount,
      emailSent: result.emailSent,
    });
  }

  return NextResponse.json(
    { ok: false, error: "Acción no reconocida." },
    { status: 400 }
  );
}
