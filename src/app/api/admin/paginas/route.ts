/**
 * Superadmin Static Public Pages API Route (/api/admin/paginas)
 * Step 2.7: GET and PUT for Bases del Concurso and ¿Quiénes somos?
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { users } from "@/db/schema";
import { canAccessAdminPanel, isSuperadmin } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import type { PublicPageSlug } from "@/lib/public-pages";
import {
  listEditableSitePagesFromDb,
  updateSitePageInDb,
} from "@/lib/site-pages-editor";

async function requireAdminActor(
  request: Request,
  options: { requireSuperadminWrite: boolean }
) {
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
  const allowed = options.requireSuperadminWrite
    ? actor && isSuperadmin(actor.role)
    : actor && canAccessAdminPanel(actor.role);

  if (!allowed) {
    return {
      ok: false as const,
      errorResponse: NextResponse.json(
        {
          ok: false,
          error: options.requireSuperadminWrite
            ? "Acceso denegado. Solo el superadministrador puede editar páginas públicas."
            : "Acceso restringido a administradores.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, db, actor };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await requireAdminActor(request, {
    requireSuperadminWrite: false,
  });
  if (!ctx.ok) return ctx.errorResponse;

  const pages = await listEditableSitePagesFromDb(ctx.db);
  return NextResponse.json({
    ok: true,
    canEdit: isSuperadmin(ctx.actor.role),
    pages,
  });
}

export async function PUT(request: Request): Promise<Response> {
  const ctx = await requireAdminActor(request, {
    requireSuperadminWrite: true,
  });
  if (!ctx.ok) return ctx.errorResponse;

  const body = (await request.json()) as {
    slug?: PublicPageSlug;
    title?: string;
    contentHtml?: string;
  };

  const result = await updateSitePageInDb(ctx.db, {
    slug: body.slug as PublicPageSlug,
    title: String(body.title ?? ""),
    contentHtml: String(body.contentHtml ?? ""),
    updatedById: ctx.actor.id,
  });

  if (!result.updated) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
