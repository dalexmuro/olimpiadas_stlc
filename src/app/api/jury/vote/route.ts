/**
 * Jury Blind Top 3 Vote API Route (/api/jury/vote)
 * Step 5.2: Records a juror's vote with automatic multiplier K, sends E22, and triggers Stage 6b tie-breaker (E24) if needed
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { editions, enrollments, stories, users, votes } from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { castJuryVoteInDb } from "@/lib/stage6-jury";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión como jurado." },
      { status: 401 }
    );
  }

  const [userRows, activeEditions] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)),
    db.select().from(editions).where(eq(editions.isActive, true)),
  ]);

  const juror = userRows[0];
  const edition = activeEditions[0];

  if (!juror || juror.role !== "JURY") {
    return NextResponse.json(
      { ok: false, error: "Acceso exclusivo para miembros del jurado." },
      { status: 403 }
    );
  }

  if (!edition) {
    return NextResponse.json(
      { ok: false, error: "No hay ninguna edición activa." },
      { status: 404 }
    );
  }

  const [finalists, allJurors, existingJuryVotes, votingParticipants] =
    await Promise.all([
      db
        .select()
        .from(stories)
        .where(
          and(
            eq(stories.editionId, edition.id),
            eq(stories.passedToJury, true)
          )
        ),
      db.select().from(users).where(eq(users.role, "JURY")),
      db
        .select()
        .from(votes)
        .where(
          and(eq(votes.editionId, edition.id), eq(votes.voterRole, "JURY"))
        ),
      db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.editionId, edition.id),
            eq(enrollments.hasVoted, true)
          )
        ),
    ]);

  const body = (await request.json()) as {
    firstPlaceStoryId?: string;
    secondPlaceStoryId?: string;
    thirdPlaceStoryId?: string;
  };

  const hasAlreadyVoted = existingJuryVotes.some(
    (v) => v.voterId === juror.id
  );

  const result = await castJuryVoteInDb({
    db,
    edition,
    juror,
    hasAlreadyVoted,
    eligibleFinalists: finalists.map((s) => ({
      id: s.id,
      participantPoints: s.participantPoints,
      juryPoints: s.juryPoints,
    })),
    activeParticipantsCount: votingParticipants.length,
    firstPlaceStoryId: body.firstPlaceStoryId ?? "",
    secondPlaceStoryId: body.secondPlaceStoryId ?? "",
    thirdPlaceStoryId: body.thirdPlaceStoryId ?? "",
    totalJurorsCount: allJurors.length,
    existingJuryVotesCount: existingJuryVotes.length,
    allJurors,
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
    multiplier: result.multiplier,
    allJurorsVoted: result.allJurorsVoted,
    tieBreakerTriggered: result.tieBreakerTriggered,
  });
}
