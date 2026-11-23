/**
 * Jury Stage 6b Tie-Breaker Vote API Route (/api/jury/tie-breaker)
 * Step 5.2: Records a juror's tie-breaker vote and resolves the round once all jurors vote
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import {
  editions,
  stories,
  tieBreakerRounds,
  tieBreakerVotes,
  users,
} from "@/db/schema";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { castTieBreakerVoteInDb } from "@/lib/stage6-jury";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

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

  const [openRounds, allJurors, finalists] = await Promise.all([
    db
      .select()
      .from(tieBreakerRounds)
      .where(
        and(
          eq(tieBreakerRounds.editionId, edition.id),
          eq(tieBreakerRounds.isResolved, false)
        )
      ),
    db.select().from(users).where(eq(users.role, "JURY")),
    db
      .select()
      .from(stories)
      .where(
        and(eq(stories.editionId, edition.id), eq(stories.passedToJury, true))
      ),
  ]);

  const activeRound = openRounds[0];
  if (!activeRound) {
    return NextResponse.json(
      { ok: false, error: "No hay ninguna ronda de desempate activa." },
      { status: 400 }
    );
  }

  const existingRoundVotes = await db
    .select()
    .from(tieBreakerVotes)
    .where(eq(tieBreakerVotes.tieBreakerRoundId, activeRound.id));

  const body = (await request.json()) as {
    firstChoiceStoryId?: string;
    secondChoiceStoryId?: string | null;
  };

  let tiedStoryIds: string[] = [];
  try {
    tiedStoryIds = JSON.parse(activeRound.tiedStoryIdsJson) as string[];
  } catch {
    tiedStoryIds = [];
  }

  const result = await castTieBreakerVoteInDb({
    db,
    editionId: edition.id,
    round: {
      id: activeRound.id,
      tiedStoryIds,
      isResolved: activeRound.isResolved,
    },
    jurorId: juror.id,
    existingRoundVotes,
    totalJurorsCount: allJurors.length,
    allFinalists: finalists.map((s) => ({
      id: s.id,
      totalPoints: s.totalPoints,
    })),
    firstChoiceStoryId: body.firstChoiceStoryId ?? "",
    secondChoiceStoryId: body.secondChoiceStoryId ?? null,
  });

  if (!result.voted) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    roundResolved: result.roundResolved,
  });
}
