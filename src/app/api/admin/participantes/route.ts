/**
 * Admin Participant Interventions API Route (/api/admin/participantes)
 * Step 6.3: Lists enrolled participants and executes manual disqualify (E18), reinstate (E19), and late story upload/edit
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
  users,
} from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import {
  adminUploadOrEditLateStoryInDb,
  manualDisqualifyParticipantInDb,
  manualReinstateParticipantInDb,
} from "@/lib/admin-interventions";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";

async function requireAdmin(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 }),
    };
  }

  const actorRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
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

  return { ok: true as const, db, cfEnv, actor };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await requireAdmin(request);
  if (!ctx.ok) return ctx.error;
  const { db } = ctx;

  const activeEditions = await db
    .select()
    .from(editions)
    .where(eq(editions.isActive, true));
  const edition = activeEditions[0];
  if (!edition) {
    return NextResponse.json({
      ok: true,
      edition: null,
      participants: [],
      prompts: [],
    });
  }

  const [editionEnrollments, prompts, editionStories, allUsers] =
    await Promise.all([
      db
        .select()
        .from(enrollments)
        .where(eq(enrollments.editionId, edition.id)),
      db
        .select()
        .from(editionPrompts)
        .where(eq(editionPrompts.editionId, edition.id))
        .orderBy(asc(editionPrompts.promptNumber)),
      db.select().from(stories).where(eq(stories.editionId, edition.id)),
      db.select().from(users),
    ]);

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const storiesCountByEnrollment = new Map<string, number>();
  for (const s of editionStories) {
    storiesCountByEnrollment.set(
      s.enrollmentId,
      (storiesCountByEnrollment.get(s.enrollmentId) ?? 0) + 1
    );
  }

  const participants = editionEnrollments.map((e) => {
    const u = userById.get(e.userId);
    return {
      enrollmentId: e.id,
      userId: e.userId,
      fullName:
        [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
        u?.name ||
        u?.email ||
        "Participante",
      email: u?.email ?? "",
      status: e.status,
      disqualificationReason: e.disqualificationReason,
      missesCount: e.missesCount,
      storiesCount: storiesCountByEnrollment.get(e.id) ?? 0,
      hasPostulated: Boolean(e.postulatedAt),
      hasVoted: e.hasVoted,
    };
  });

  return NextResponse.json({
    ok: true,
    edition: {
      id: edition.id,
      title: edition.title,
      minChars: edition.minChars,
      maxChars: edition.maxChars,
      maxAllowedMisses: edition.maxAllowedMisses,
    },
    participants,
    prompts: prompts.map((p) => ({
      id: p.id,
      promptNumber: p.promptNumber,
      title: p.title,
    })),
  });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireAdmin(request);
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
    action?: "disqualify" | "reinstate" | "late_story";
    enrollmentId?: string;
    justification?: string;
    promptId?: string;
    title?: string;
    body?: string;
  };

  if (!body.action || !body.enrollmentId) {
    return NextResponse.json(
      { ok: false, error: "Faltan la acción o el participante." },
      { status: 400 }
    );
  }

  const enrollmentRows = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.id, body.enrollmentId),
        eq(enrollments.editionId, edition.id)
      )
    );
  const enrollment = enrollmentRows[0];
  if (!enrollment) {
    return NextResponse.json(
      { ok: false, error: "Inscripción no encontrada." },
      { status: 404 }
    );
  }

  const [participantRows, adminUsers] = await Promise.all([
    db.select().from(users).where(eq(users.id, enrollment.userId)),
    db
      .select()
      .from(users)
      .where(inArray(users.role, ["ADMIN", "SUPERADMIN"])),
  ]);
  const participant = participantRows[0];
  if (!participant) {
    return NextResponse.json(
      { ok: false, error: "Usuario participante no encontrado." },
      { status: 404 }
    );
  }

  const baseUrl = cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl;

  if (body.action === "disqualify") {
    const res = await manualDisqualifyParticipantInDb({
      db,
      edition,
      enrollment,
      participant,
      actorAdmin: actor,
      allAdmins: adminUsers,
      justification: body.justification ?? "",
      baseUrl,
      brevoApiKey: cfEnv.BREVO_API_KEY,
    });
    if (!res.disqualified) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, notifiedAdmins: res.notifiedAdmins });
  }

  if (body.action === "reinstate") {
    const res = await manualReinstateParticipantInDb({
      db,
      edition,
      enrollment,
      participant,
      actorAdmin: actor,
      justification: body.justification ?? "",
      baseUrl,
      brevoApiKey: cfEnv.BREVO_API_KEY,
    });
    if (!res.reinstated) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, emailSent: res.emailSent });
  }

  if (body.action === "late_story") {
    if (!body.promptId) {
      return NextResponse.json(
        { ok: false, error: "Selecciona la consigna para el cuento tardío." },
        { status: 400 }
      );
    }
    const res = await adminUploadOrEditLateStoryInDb({
      db,
      edition,
      enrollment,
      participant,
      promptId: body.promptId,
      actorAdmin: actor,
      title: body.title ?? "",
      body: body.body ?? "",
      justification: body.justification ?? "",
      baseUrl,
      brevoApiKey: cfEnv.BREVO_API_KEY,
    });
    if (!res.saved) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      storyId: res.storyId,
      actionType: res.actionType,
      autoReactivated: res.autoReactivated,
    });
  }

  return NextResponse.json(
    { ok: false, error: "Acción no reconocida." },
    { status: 400 }
  );
}
