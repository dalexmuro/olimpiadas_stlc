/**
 * Superadmin Editions API Route (/api/admin/ediciones)
 * Step 2.3: List, create, and activate contest editions with strict 48h buffer validation
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { editions, users } from "@/db/schema";
import { isSuperadmin } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  activateEditionInDb,
  convertCaracasScheduleFormToUtc,
  createEditionInDb,
  DEFAULT_JURY_BRACKETS,
  type EditionScheduleUtc,
  type JuryBracket,
} from "@/lib/edition-management";

async function requireSuperadmin(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return {
      ok: false as const,
      errorResponse: NextResponse.json(
        { ok: false, error: "No autenticado." },
        { status: 401 }
      ),
    };
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  const actor = rows[0];

  if (!actor || !isSuperadmin(actor.role)) {
    return {
      ok: false as const,
      errorResponse: NextResponse.json(
        {
          ok: false,
          error:
            "Acceso denegado. Solo el superadministrador puede gestionar ediciones.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, db, actor };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await requireSuperadmin(request);
  if (!ctx.ok) return ctx.errorResponse;

  const list = await ctx.db.select().from(editions);
  return NextResponse.json({ ok: true, editions: list });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireSuperadmin(request);
  if (!ctx.ok) return ctx.errorResponse;

  const body = (await request.json()) as {
    title?: string;
    slug?: string;
    isActive?: boolean;
    minChars?: number;
    maxChars?: number;
    maxAllowedMisses?: number;
    minSimilarityPct?: number;
    juryBrackets?: JuryBracket[];
    scheduleCaracas?: EditionScheduleUtc;
  };

  if (!body.scheduleCaracas) {
    return NextResponse.json(
      { ok: false, errors: ["Faltan las fechas del calendario de etapas."] },
      { status: 400 }
    );
  }

  let utcSchedule: EditionScheduleUtc;
  try {
    utcSchedule = convertCaracasScheduleFormToUtc(body.scheduleCaracas);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        errors: [
          err instanceof Error
            ? err.message
            : "Formato de fecha en hora de Caracas inválido.",
        ],
      },
      { status: 400 }
    );
  }

  const result = await createEditionInDb(ctx.db, {
    title: String(body.title ?? ""),
    slug: String(body.slug ?? ""),
    isActive: Boolean(body.isActive),
    minChars: Number(body.minChars ?? 100),
    maxChars: Number(body.maxChars ?? 3000),
    maxAllowedMisses: Number(body.maxAllowedMisses ?? 2),
    minSimilarityPct: Number(body.minSimilarityPct ?? 70),
    juryBrackets: body.juryBrackets ?? [...DEFAULT_JURY_BRACKETS],
    ...utcSchedule,
  });

  if (!result.saved) {
    return NextResponse.json(
      { ok: false, errors: result.errors },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { ok: true, editionId: result.editionId },
    { status: 201 }
  );
}

export async function PATCH(request: Request): Promise<Response> {
  const ctx = await requireSuperadmin(request);
  if (!ctx.ok) return ctx.errorResponse;

  const body = (await request.json()) as { editionId?: string };
  if (!body.editionId) {
    return NextResponse.json(
      { ok: false, error: "Debes indicar el ID de la edición a activar." },
      { status: 400 }
    );
  }

  await activateEditionInDb(ctx.db, body.editionId);
  return NextResponse.json({ ok: true });
}
