/**
 * Admin Manual Winners Publication API Route (/api/admin/publish-winners)
 * Step 6.1: Checks readiness (GET) and triggers winners publication + E26 broadcast (POST)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import {
  editions,
  enrollments,
  tieBreakerRounds,
  users,
  votes,
} from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  evaluatePublishWinnersReadiness,
  publishWinnersInDb,
} from "@/lib/stage7-winners";

async function loadPublishContext(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: NextResponse.json(
        { ok: false, error: "No autenticado." },
        { status: 401 }
      ),
    };
  }

  const [actorRows, activeEditions] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)),
    db.select().from(editions).where(eq(editions.isActive, true)),
  ]);

  const actor = actorRows[0];
  if (!actor || !canAccessAdminPanel(actor.role)) {
    return {
      ok: false as const,
      error: NextResponse.json(
        { ok: false, error: "Acceso restringido a administradores." },
        { status: 403 }
      ),
    };
  }

  const edition = activeEditions[0];
  if (!edition) {
    return {
      ok: false as const,
      error: NextResponse.json(
        { ok: false, error: "No hay ninguna edición activa." },
        { status: 404 }
      ),
    };
  }

  const [jurors, juryVotes, openTieBreakers] = await Promise.all([
    db.select().from(users).where(eq(users.role, "JURY")),
    db
      .select()
      .from(votes)
      .where(and(eq(votes.editionId, edition.id), eq(votes.voterRole, "JURY"))),
    db
      .select()
      .from(tieBreakerRounds)
      .where(
        and(
          eq(tieBreakerRounds.editionId, edition.id),
          eq(tieBreakerRounds.isResolved, false)
        )
      ),
  ]);

  return {
    ok: true as const,
    db,
    cfEnv,
    actor,
    edition,
    totalJurorsCount: jurors.length,
    juryVotesCount: juryVotes.length,
    hasUnresolvedTieBreaker: openTieBreakers.length > 0,
  };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await loadPublishContext(request);
  if (!ctx.ok) return ctx.error;

  const readiness = evaluatePublishWinnersReadiness({
    edition: ctx.edition,
    totalJurorsCount: ctx.totalJurorsCount,
    juryVotesCount: ctx.juryVotesCount,
    hasUnresolvedTieBreaker: ctx.hasUnresolvedTieBreaker,
  });

  return NextResponse.json({
    ok: true,
    editionTitle: ctx.edition.title,
    winnersAnnounced: ctx.edition.winnersAnnounced,
    ready: readiness.ready,
    reason: readiness.reason ?? null,
    juryVotesCount: ctx.juryVotesCount,
    totalJurorsCount: ctx.totalJurorsCount,
  });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await loadPublishContext(request);
  if (!ctx.ok) return ctx.error;

  const [editionEnrollments, staffUsers] = await Promise.all([
    ctx.db
      .select({ userId: enrollments.userId })
      .from(enrollments)
      .where(eq(enrollments.editionId, ctx.edition.id)),
    ctx.db
      .select()
      .from(users)
      .where(inArray(users.role, ["JURY", "ADMIN", "SUPERADMIN"])),
  ]);

  const participantIds = editionEnrollments.map((e) => e.userId);
  const participantUsers =
    participantIds.length > 0
      ? await ctx.db
          .select()
          .from(users)
          .where(inArray(users.id, participantIds))
      : [];

  const result = await publishWinnersInDb({
    db: ctx.db,
    edition: ctx.edition,
    actorAdminId: ctx.actor.id,
    totalJurorsCount: ctx.totalJurorsCount,
    juryVotesCount: ctx.juryVotesCount,
    hasUnresolvedTieBreaker: ctx.hasUnresolvedTieBreaker,
    recipients: [...participantUsers, ...staffUsers],
    baseUrl: ctx.cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
    brevoApiKey: ctx.cfEnv.BREVO_API_KEY,
  });

  if (!result.published) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    announcedAt: result.announcedAt,
    notifiedCount: result.notifiedCount,
  });
}
