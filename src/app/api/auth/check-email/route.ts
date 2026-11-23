/**
 * Pre-registration Email Availability Check (/api/auth/check-email)
 * Verifies whether an email address is already registered in D1 before sign-up.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { users } from "@/db/schema";
import { EMAIL_REGEX } from "@/lib/auth-forms";
import type { CloudflareEnv } from "@/lib/cloudflare-env";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const normalizedEmail =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
    return NextResponse.json(
      { ok: false, exists: false, error: "Correo electrónico no válido." },
      { status: 400 }
    );
  }

  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  return NextResponse.json({
    ok: true,
    exists: rows.length > 0,
  });
}
