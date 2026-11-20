/**
 * Edition Prompt Package Validation Route (/api/admin/consignas-edicion/validate)
 * Step 2.5: POST submits package for validation & sends E25 (SUPERADMIN);
 * PUT records an ADMIN's Approve/Reject vote and checks simple majority.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { editions, users } from "@/db/schema";
import { canAccessAdminPanel, isSuperadmin } from "@/lib/admin-access";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  submitPromptPackageForValidation,
  voteEditionPromptPackage,
} from "@/lib/edition-prompts";

async function requireAdminSession(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

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
  if (!actor || !canAccessAdminPanel(actor.role)) {
    return {
      ok: false as const,
      errorResponse: NextResponse.json(
        { ok: false, error: "Acceso restringido a administradores." },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, db, actor, cfEnv };
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireAdminSession(request);
  if (!ctx.ok) return ctx.errorResponse;

  if (!isSuperadmin(ctx.actor.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Solo el superadministrador puede enviar el paquete de consignas a validación.",
      },
      { status: 403 }
    );
  }

  const body = (await request.json()) as { editionId?: string };
  const edRows = await ctx.db
    .select()
    .from(editions)
    .where(eq(editions.id, String(body.editionId ?? "")));
  const edition = edRows[0];

  if (!edition) {
    return NextResponse.json(
      { ok: false, error: "Edición no encontrada." },
      { status: 404 }
    );
  }

  const result = await submitPromptPackageForValidation(ctx.db, {
    editionId: edition.id,
    editionTitle: edition.title,
    baseUrl: ctx.cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
    brevoApiKey: ctx.cfEnv.BREVO_API_KEY,
  });

  if (!result.submitted) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    notifiedAdmins: result.notifiedAdmins,
  });
}

export async function PUT(request: Request): Promise<Response> {
  const ctx = await requireAdminSession(request);
  if (!ctx.ok) return ctx.errorResponse;

  const body = (await request.json()) as {
    editionId?: string;
    approved?: boolean;
  };

  if (!body.editionId || typeof body.approved !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "Debes indicar la edición y tu voto de validación." },
      { status: 400 }
    );
  }

  const result = await voteEditionPromptPackage(ctx.db, {
    editionId: body.editionId,
    adminId: ctx.actor.id,
    approved: body.approved,
  });

  return NextResponse.json({ ok: true, majority: result.majority });
}
