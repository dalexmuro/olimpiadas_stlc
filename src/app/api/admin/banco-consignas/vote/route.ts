/**
 * Anonymous Prompt Bank Voting API Route (/api/admin/banco-consignas/vote)
 * Step 2.4: Cast +1 (like) or -1 (dislike) anonymously
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { users } from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  castAnonymousPromptVoteInDb,
  type PromptVoteValue,
} from "@/lib/prompt-bank";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

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
    voteValue?: number;
  };
  if (
    !body.promptBankId ||
    (body.voteValue !== 1 && body.voteValue !== -1)
  ) {
    return NextResponse.json(
      { ok: false, error: "Voto inválido. Usa +1 o -1." },
      { status: 400 }
    );
  }

  await castAnonymousPromptVoteInDb(db, {
    promptBankId: body.promptBankId,
    adminId: actor.id,
    voteValue: body.voteValue as PromptVoteValue,
  });

  return NextResponse.json({ ok: true });
}
