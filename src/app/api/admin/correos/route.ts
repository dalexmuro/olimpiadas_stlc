/**
 * Superadmin Email Templates API Route (/api/admin/correos)
 * Step 2.6: GET all 26 templates, PUT update template, POST send test email to Superadmin
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { users } from "@/db/schema";
import { isSuperadmin } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  listAllEmailTemplatesFromDb,
  sendTestTemplateEmail,
  updateEmailTemplateInDb,
} from "@/lib/email-template-editor";

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
            "Acceso denegado. Solo el superadministrador puede editar las plantillas de correo.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, db, actor, cfEnv };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await requireSuperadmin(request);
  if (!ctx.ok) return ctx.errorResponse;

  const templates = await listAllEmailTemplatesFromDb(ctx.db);
  return NextResponse.json({
    ok: true,
    templates,
    superadminEmail: ctx.actor.email,
  });
}

export async function PUT(request: Request): Promise<Response> {
  const ctx = await requireSuperadmin(request);
  if (!ctx.ok) return ctx.errorResponse;

  const body = (await request.json()) as {
    code?: string;
    subjectTemplate?: string;
    bodyHtmlTemplate?: string;
  };

  const result = await updateEmailTemplateInDb(ctx.db, {
    code: String(body.code ?? ""),
    subjectTemplate: String(body.subjectTemplate ?? ""),
    bodyHtmlTemplate: String(body.bodyHtmlTemplate ?? ""),
  });

  if (!result.updated) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireSuperadmin(request);
  if (!ctx.ok) return ctx.errorResponse;

  const body = (await request.json()) as {
    subjectTemplate?: string;
    bodyHtmlTemplate?: string;
  };

  const result = await sendTestTemplateEmail({
    recipientEmail: ctx.actor.email,
    recipientName: ctx.actor.firstName ?? ctx.actor.name ?? "Superadmin",
    subjectTemplate: String(body.subjectTemplate ?? ""),
    bodyHtmlTemplate: String(body.bodyHtmlTemplate ?? ""),
    apiKey: ctx.cfEnv.BREVO_API_KEY,
  });

  if (!result.sent) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    dryRun: result.dryRun,
    recipientEmail: ctx.actor.email,
    subject: result.subject,
  });
}
