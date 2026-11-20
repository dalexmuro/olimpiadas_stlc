/**
 * Superadmin Role Management API Route (/api/admin/roles)
 * Step 2.2: List registered users, compute odd jury status, and update user roles with audit logging
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { isSuperadmin } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  changeUserRoleInDb,
  evaluateJuryCountStatus,
  filterUsersByQuery,
  type ManagedUserSummary,
} from "@/lib/role-management";

async function requireSuperadminContext(request: Request) {
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

  const actorRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  const actor = actorRows[0];

  if (!actor || !isSuperadmin(actor.role)) {
    return {
      ok: false as const,
      errorResponse: NextResponse.json(
        {
          ok: false,
          error:
            "Acceso denegado. Solo el superadministrador puede gestionar roles.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, db, actor };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await requireSuperadminContext(request);
  if (!ctx.ok) {
    return ctx.errorResponse;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  const allRows = await ctx.db.select().from(users);
  const summaries: ManagedUserSummary[] = allRows.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    name: u.name,
    email: u.email,
    country: u.country,
    role: u.role,
  }));

  const juryCount = summaries.filter((u) => u.role === "JURY").length;
  const juryStatus = evaluateJuryCountStatus(juryCount);
  const filtered = filterUsersByQuery(summaries, query);

  return NextResponse.json({
    ok: true,
    users: filtered,
    juryStatus,
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const ctx = await requireSuperadminContext(request);
  if (!ctx.ok) {
    return ctx.errorResponse;
  }

  const body = (await request.json()) as {
    targetUserId?: string;
    newRole?: UserRole;
    justification?: string;
  };

  const result = await changeUserRoleInDb({
    db: ctx.db,
    actorRole: ctx.actor.role,
    actorUserId: ctx.actor.id,
    targetUserId: String(body.targetUserId ?? ""),
    newRole: body.newRole as UserRole,
    justification: String(body.justification ?? ""),
  });

  if (!result.updated) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  const updatedRows = await ctx.db.select().from(users);
  const juryCount = updatedRows.filter((u) => u.role === "JURY").length;

  return NextResponse.json({
    ok: true,
    previousRole: result.previousRole,
    newRole: result.newRole,
    juryStatus: evaluateJuryCountStatus(juryCount),
  });
}
