/**
 * Admin Story Review & Excessive Modification Alerts API Route (/api/admin/cuentos)
 * Step 4.3: Lists postulated stories with author/diff data, triggers Round 1 alerts (E11), and records admin votes
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import {
  editionPrompts,
  editions,
  enrollments,
  stories,
  storyAlertVotes,
  storyModificationAlerts,
  users,
  type AlertDecision,
} from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  evaluateAlertVoteOutcome,
  triggerModificationAlertInDb,
  voteOnModificationAlertInDb,
} from "@/lib/stage4-admin-review";

async function requireAdminSession(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 }),
    };
  }

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  const actor = userRows[0];

  if (!actor || !canAccessAdminPanel(actor.role)) {
    return {
      ok: false as const,
      error: NextResponse.json(
        { ok: false, error: "Acceso restringido a administradores." },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, db, cfEnv, actor };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await requireAdminSession(request);
  if (!ctx.ok) return ctx.error;
  const { db, actor } = ctx;

  const activeEditions = await db
    .select()
    .from(editions)
    .where(eq(editions.isActive, true));
  const edition = activeEditions[0];

  if (!edition) {
    return NextResponse.json({
      ok: true,
      edition: null,
      stories: [],
      pendingAlertsForMe: [],
    });
  }

  const [postulatedStories, editionPromptRows, enrollmentRows, allUsers] =
    await Promise.all([
      db
        .select()
        .from(stories)
        .where(
          and(eq(stories.editionId, edition.id), eq(stories.isPostulated, true))
        ),
      db
        .select()
        .from(editionPrompts)
        .where(eq(editionPrompts.editionId, edition.id))
        .orderBy(asc(editionPrompts.promptNumber)),
      db
        .select()
        .from(enrollments)
        .where(eq(enrollments.editionId, edition.id)),
      db.select().from(users),
    ]);

  const storyIds = postulatedStories.map((s) => s.id);
  const alerts =
    storyIds.length > 0
      ? await db
          .select()
          .from(storyModificationAlerts)
          .where(inArray(storyModificationAlerts.storyId, storyIds))
      : [];

  const alertIds = alerts.map((a) => a.id);
  const votes =
    alertIds.length > 0
      ? await db
          .select()
          .from(storyAlertVotes)
          .where(inArray(storyAlertVotes.alertId, alertIds))
      : [];

  const promptById = new Map(editionPromptRows.map((p) => [p.id, p]));
  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const enrollmentById = new Map(enrollmentRows.map((e) => [e.id, e]));

  const votesByAlertId = new Map<string, typeof votes>();
  for (const v of votes) {
    const list = votesByAlertId.get(v.alertId) ?? [];
    list.push(v);
    votesByAlertId.set(v.alertId, list);
  }

  const alertsByStoryId = new Map<string, typeof alerts>();
  for (const a of alerts) {
    const list = alertsByStoryId.get(a.storyId) ?? [];
    list.push(a);
    alertsByStoryId.set(a.storyId, list);
  }

  const formattedStories = postulatedStories.map((s) => {
    const author = userById.get(s.authorId);
    const prompt = promptById.get(s.promptId);
    const enrollment = enrollmentById.get(s.enrollmentId);
    const storyAlerts = (alertsByStoryId.get(s.id) ?? [])
      .sort((a, b) => b.round - a.round)
      .map((a) => {
        const alertVotes = votesByAlertId.get(a.id) ?? [];
        const outcome = evaluateAlertVoteOutcome(alertVotes);
        const myVote =
          alertVotes.find((v) => v.adminId === actor.id)?.decision ?? null;
        return {
          id: a.id,
          storyId: a.storyId,
          round: a.round,
          status: a.status,
          triggeredByAdminId: a.triggeredByAdminId,
          createdAt: a.createdAt,
          validateCount: outcome.validateCount,
          rejectCount: outcome.rejectCount,
          myVote,
        };
      });

    return {
      id: s.id,
      promptNumber: prompt?.promptNumber ?? 0,
      promptTitle: prompt?.title ?? "",
      authorId: s.authorId,
      authorName:
        [author?.firstName, author?.lastName].filter(Boolean).join(" ") ||
        author?.name ||
        author?.email ||
        "Autor",
      enrollmentStatus: enrollment?.status ?? "ACTIVE",
      originalTitle: s.originalTitle,
      originalBody: s.originalBody,
      editedTitle: s.editedTitle ?? s.originalTitle,
      editedBody: s.editedBody ?? s.originalBody,
      similarityPct: s.similarityPct ?? 100,
      postulatedAt: s.postulatedAt,
      alerts: storyAlerts,
    };
  });

  const pendingAlertsForMe = formattedStories
    .flatMap((story) =>
      story.alerts
        .filter((a) => a.status === "PENDING" && a.myVote === null)
        .map((alert) => ({
          alertId: alert.id,
          round: alert.round,
          storyId: story.id,
          storyTitle: story.editedTitle,
          authorName: story.authorName,
          promptNumber: story.promptNumber,
          similarityPct: story.similarityPct,
          validateCount: alert.validateCount,
          rejectCount: alert.rejectCount,
        }))
    );

  return NextResponse.json({
    ok: true,
    edition: {
      id: edition.id,
      title: edition.title,
      minSimilarityPct: edition.minSimilarityPct,
    },
    stories: formattedStories,
    pendingAlertsForMe,
  });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireAdminSession(request);
  if (!ctx.ok) return ctx.error;
  const { db, cfEnv, actor } = ctx;

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
    action?: "trigger_alert" | "vote_alert";
    storyId?: string;
    alertId?: string;
    decision?: AlertDecision;
    justification?: string;
  };

  if (body.action === "trigger_alert") {
    if (!body.storyId) {
      return NextResponse.json(
        { ok: false, error: "Falta el identificador del cuento." },
        { status: 400 }
      );
    }

    const [storyRows, adminUsers] = await Promise.all([
      db
        .select()
        .from(stories)
        .where(
          and(eq(stories.id, body.storyId), eq(stories.editionId, edition.id))
        ),
      db
        .select()
        .from(users)
        .where(inArray(users.role, ["ADMIN", "SUPERADMIN"])),
    ]);

    const story = storyRows[0];
    if (!story) {
      return NextResponse.json(
        { ok: false, error: "Cuento no encontrado en la edición activa." },
        { status: 404 }
      );
    }

    const result = await triggerModificationAlertInDb({
      db,
      edition: { id: edition.id, title: edition.title },
      story,
      actorAdmin: actor,
      otherAdmins: adminUsers.filter((u) => u.id !== actor.id),
      justification: body.justification,
      baseUrl: cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
      brevoApiKey: cfEnv.BREVO_API_KEY,
    });

    if (!result.triggered) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      alertId: result.alertId,
      notifiedCount: result.notifiedCount,
    });
  }

  if (body.action === "vote_alert") {
    if (
      !body.alertId ||
      (body.decision !== "VALIDATE" && body.decision !== "REJECT")
    ) {
      return NextResponse.json(
        { ok: false, error: "Faltan la alerta o la decisión válida." },
        { status: 400 }
      );
    }

    const alertRows = await db
      .select()
      .from(storyModificationAlerts)
      .where(eq(storyModificationAlerts.id, body.alertId));
    const alert = alertRows[0];
    if (!alert) {
      return NextResponse.json(
        { ok: false, error: "Alerta no encontrada." },
        { status: 404 }
      );
    }

    const [storyRows, existingVotes] = await Promise.all([
      db.select().from(stories).where(eq(stories.id, alert.storyId)),
      db
        .select()
        .from(storyAlertVotes)
        .where(eq(storyAlertVotes.alertId, alert.id)),
    ]);
    const story = storyRows[0];
    if (!story) {
      return NextResponse.json(
        { ok: false, error: "Cuento asociado no encontrado." },
        { status: 404 }
      );
    }

    const result = await voteOnModificationAlertInDb({
      db,
      editionId: edition.id,
      alert,
      storyAuthorId: story.authorId,
      actorAdminId: actor.id,
      decision: body.decision,
      existingVotes,
    });

    if (!result.voted) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      newStatus: result.newStatus,
      validateCount: result.validateCount,
      rejectCount: result.rejectCount,
    });
  }

  return NextResponse.json(
    { ok: false, error: "Acción no reconocida." },
    { status: 400 }
  );
}
