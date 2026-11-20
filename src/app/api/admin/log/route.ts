/**
 * Admin Immutable Audit Log API Route (/api/admin/log)
 * Step 6.3: Lists all administrative actions in reverse chronological order
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";

export async function GET(request: Request): Promise<Response> {
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

  const actorRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  const actor = actorRows[0];
  if (!actor || !canAccessAdminPanel(actor.role)) {
    return NextResponse.json(
      { ok: false, error: "Acceso restringido a administradores." },
      { status: 403 }
    );
  }

  const [logs, allUsers] = await Promise.all([
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)),
    db.select().from(users),
  ]);

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const formatName = (id: string | null) => {
    if (!id) return null;
    const u = userById.get(id);
    if (!u) return id;
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email;
  };

  return NextResponse.json({
    ok: true,
    entries: logs.map((entry) => ({
      id: entry.id,
      actionType: entry.actionType,
      actorName: formatName(entry.actorId) ?? "Sistema",
      targetUserName: formatName(entry.targetUserId),
      justification: entry.justification,
      createdAt: entry.createdAt,
    })),
  });
}
