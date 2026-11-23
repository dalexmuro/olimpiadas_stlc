/**
 * Participant Definitive Top 3 Vote API Route (/api/contest/voting/cast)
 * Step 5.1: Records participant's Top 3 ballot (3/2/1 pts) and sends email E16
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { editions, enrollments, stories, users } from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { castParticipantVoteInDb } from "@/lib/stage5-voting";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para votar." },
      { status: 401 }
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
      { ok: false, error: "Usuario o edición activa no encontrada." },
      { status: 404 }
    );
  }

  const [enrollmentRows, allEditionEnrollments, postulatedStories] =
    await Promise.all([
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

  const enrollment = enrollmentRows[0];
  if (!enrollment) {
    return NextResponse.json(
      { ok: false, error: "No estás inscrito en la edición activa." },
      { status: 403 }
    );
  }

  const activeEnrollmentIds = new Set(allEditionEnrollments.map((e) => e.id));
  const eligibleStoryIds = new Set(
    postulatedStories
      .filter((s) => activeEnrollmentIds.has(s.enrollmentId))
      .map((s) => s.id)
  );

  const body = (await request.json()) as {
    firstPlaceStoryId?: string;
    secondPlaceStoryId?: string;
    thirdPlaceStoryId?: string;
  };

  const result = await castParticipantVoteInDb({
    db,
    edition,
    enrollment,
    user,
    eligibleStoryIds,
    firstPlaceStoryId: body.firstPlaceStoryId ?? "",
    secondPlaceStoryId: body.secondPlaceStoryId ?? "",
    thirdPlaceStoryId: body.thirdPlaceStoryId ?? "",
    baseUrl: cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
    brevoApiKey: cfEnv.BREVO_API_KEY,
  });

  if (!result.voted) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    voteId: result.voteId,
    votedAt: result.votedAt,
    emailSent: result.emailSent,
  });
}
