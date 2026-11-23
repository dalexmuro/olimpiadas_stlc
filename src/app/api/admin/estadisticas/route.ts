/**
 * Admin Real-Time Statistics API Route (/api/admin/estadisticas)
 * Step 6.2: Returns real-time contest KPIs, disqualification breakdown, prompt counts, voting progress, and full score table
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import {
  editionPrompts,
  editions,
  enrollments,
  stories,
  users,
  votes,
} from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { computeEditionStatistics } from "@/lib/admin-statistics";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "No autenticado." },
      { status: 401 }
    );
  }

  const actorRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  const actor = actorRows[0];

  if (!actor || !canAccessAdminPanel(actor.role)) {
    return NextResponse.json(
      { ok: false, error: "Acceso restringido a administradores." },
      { status: 403 }
    );
  }

  const activeEditions = await db
    .select()
    .from(editions)
    .where(eq(editions.isActive, true));
  const edition = activeEditions[0];

  if (!edition) {
    return NextResponse.json({
      ok: true,
      edition: null,
      stats: null,
    });
  }

  const [
    editionEnrollments,
    prompts,
    editionStories,
    juryVotes,
    jurors,
    allUsers,
  ] = await Promise.all([
    db
      .select()
      .from(enrollments)
      .where(eq(enrollments.editionId, edition.id)),
    db
      .select()
      .from(editionPrompts)
      .where(eq(editionPrompts.editionId, edition.id)),
    db.select().from(stories).where(eq(stories.editionId, edition.id)),
    db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.editionId, edition.id), eq(votes.voterRole, "JURY"))),
    db.select({ id: users.id }).from(users).where(eq(users.role, "JURY")),
    db.select().from(users),
  ]);

  const usersById = new Map(allUsers.map((u) => [u.id, u]));

  const stats = computeEditionStatistics({
    enrollments: editionEnrollments,
    prompts,
    stories: editionStories,
    juryVotesCount: juryVotes.length,
    totalJurorsCount: jurors.length,
    usersById,
  });

  return NextResponse.json({
    ok: true,
    edition: {
      id: edition.id,
      title: edition.title,
      juryPausedMissingVotes: edition.juryPausedMissingVotes,
      tieBreakerActive: edition.tieBreakerActive,
      winnersAnnounced: edition.winnersAnnounced,
    },
    stats,
    generatedAt: new Date().toISOString(),
  });
}
