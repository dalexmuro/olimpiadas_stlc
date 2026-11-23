/**
 * Rolling Session Keep-Alive Endpoint (POST /api/auth/keep-alive)
 * Extends the active D1 session expiration by CLOSED_TAB_SESSION_SECONDS (15 minutes)
 * while the user is actively using the app or confirms "Seguir conectado".
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { sessions } from "@/db/schema";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { CLOSED_TAB_SESSION_SECONDS } from "@/lib/session-timeout";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.session?.id || !session.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sesión expirada o no autenticada." },
      { status: 401 }
    );
  }

  const now = new Date();
  const nextExpiresAt = new Date(
    now.getTime() + CLOSED_TAB_SESSION_SECONDS * 1000
  ).toISOString();

  await db
    .update(sessions)
    .set({
      expiresAt: nextExpiresAt,
      updatedAt: now.toISOString(),
    })
    .where(eq(sessions.id, session.session.id));

  return NextResponse.json({
    ok: true,
    expiresAt: nextExpiresAt,
  });
}
