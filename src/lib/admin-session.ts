import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createDbClient, isValidD1Binding } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { isSuperadmin } from "@/lib/admin-access";
import { createAuthInstance, resolveRequestUrlFromHeaders } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";

/**
 * Resolves the authenticated user's current role from D1 inside Server Components.
 */
export async function getCurrentAdminRole(): Promise<UserRole | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as Partial<CloudflareEnv>;
    if (!isValidD1Binding(cfEnv.DB)) return null;

    const db = createDbClient(cfEnv.DB);
    const reqHeaders = await headers();
    const auth = createAuthInstance(
      db,
      cfEnv,
      resolveRequestUrlFromHeaders(reqHeaders)
    );
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user?.id) return null;

    const rows = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id));
    return rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Server-side guard for Superadmin-only routes (/admin/ediciones, /admin/roles, /admin/correos, /admin/paginas).
 * Redirects non-SUPERADMIN users back to /admin.
 */
export async function requireSuperadminOrRedirect(): Promise<void> {
  const role = await getCurrentAdminRole();
  if (!isSuperadmin(role)) {
    redirect("/admin");
  }
}
