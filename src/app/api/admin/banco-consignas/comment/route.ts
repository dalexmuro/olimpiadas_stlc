/**
 * Prompt Bank Comments API Route (/api/admin/banco-consignas/comment)
 * Step 2.4: Add visible admin comments on proposed prompts
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { users } from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { addPromptCommentInDb } from "@/lib/prompt-bank";

export async function POST(request: Request): Promise<Response> {
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

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  const actor = rows[0];
  if (!actor || !canAccessAdminPanel(actor.role)) {
    return NextResponse.json(
      { ok: false, error: "Acceso restringido a administradores." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    promptBankId?: string;
    commentText?: string;
  };
  if (!body.promptBankId) {
    return NextResponse.json(
      { ok: false, error: "Consigna no especificada." },
      { status: 400 }
    );
  }

  const result = await addPromptCommentInDb(db, {
    promptBankId: body.promptBankId,
    authorId: actor.id,
    commentText: String(body.commentText ?? ""),
  });

  if (!result.created) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { ok: true, commentId: result.commentId },
    { status: 201 }
  );
}
