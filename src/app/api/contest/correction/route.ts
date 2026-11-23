/**
 * Participant 24-Hour Correction Window Submission API Route (/api/contest/correction)
 * Step 4.3: Allows a participant in their exceptional 24h correction window to resubmit their story, creating Round 2 Alert (E13)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import {
  editions,
  enrollments,
  stories,
  storyModificationAlerts,
  users,
} from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { submitCorrectionWindowStoryInDb } from "@/lib/stage4-admin-review";

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

  const enrollmentRows = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.editionId, edition.id),
        eq(enrollments.userId, session.user.id)
      )
    );
  const enrollment = enrollmentRows[0];
  if (!enrollment || !enrollment.selectedStoryId) {
    return NextResponse.json(
      { ok: false, error: "No se encontró un cuento postulado para corregir." },
      { status: 404 }
    );
  }

  const [storyRows, r1Alerts, adminUsers] = await Promise.all([
    db.select().from(stories).where(eq(stories.id, enrollment.selectedStoryId)),
    db
      .select()
      .from(storyModificationAlerts)
      .where(
        and(
          eq(storyModificationAlerts.storyId, enrollment.selectedStoryId),
          eq(storyModificationAlerts.round, 1)
        )
      ),
    db
      .select()
      .from(users)
      .where(inArray(users.role, ["ADMIN", "SUPERADMIN"])),
  ]);

  const story = storyRows[0];
  if (!story) {
    return NextResponse.json(
      { ok: false, error: "Cuento no encontrado." },
      { status: 404 }
    );
  }

  const body = (await request.json()) as { title?: string; body?: string };
  const triggeredByAdminId =
    r1Alerts[0]?.triggeredByAdminId ?? adminUsers[0]?.id ?? session.user.id;

  const result = await submitCorrectionWindowStoryInDb({
    db,
    edition,
    enrollment,
    story,
    title: typeof body.title === "string" ? body.title : "",
    body: typeof body.body === "string" ? body.body : "",
    allAdmins: adminUsers,
    triggeredByAdminId,
    baseUrl: cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
    brevoApiKey: cfEnv.BREVO_API_KEY,
  });

  if (!result.submitted) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    round2AlertId: result.round2AlertId,
    similarityPct: result.similarityPct,
    notifiedAdmins: result.notifiedAdmins,
  });
}
