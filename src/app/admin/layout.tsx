import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { createDbClient, isValidD1Binding } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { createAuthInstance, resolveRequestUrlFromHeaders } from "@/lib/auth";
import { canAccessAdminPanel } from "@/lib/admin-access";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { AdminShell } from "@/components/admin/AdminShell";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  let userRole: UserRole | null = null;
  let userName: string | null = null;
  let authenticated = false;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as Partial<CloudflareEnv>;
    if (isValidD1Binding(cfEnv.DB)) {
      const db = createDbClient(cfEnv.DB);
      const reqHeaders = await headers();
      const auth = createAuthInstance(
        db,
        cfEnv,
        resolveRequestUrlFromHeaders(reqHeaders)
      );
      const session = await auth.api.getSession({ headers: reqHeaders });

      if (session?.user?.id) {
        authenticated = true;
        const rows = await db
          .select()
          .from(users)
          .where(eq(users.id, session.user.id));
        const dbUser = rows[0];
        userRole = dbUser?.role ?? null;
        userName = dbUser?.name ?? session.user.email;
      }
    }
  } catch {
    authenticated = false;
  }

  if (!authenticated) {
    redirect("/login");
  }

  if (!canAccessAdminPanel(userRole)) {
    return (
      <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
        <Navbar currentPath="/admin" userRole={userRole} userName={userName} />
        <main id="contenido" className="container flex-1 py-20">
          <div className="max-w-xl border-t border-rule pt-8">
            <h1>
              Acceso <span className="ta-serif-italic">restringido</span>
            </h1>
            <p className="mt-4 text-muted">
              Esta sección está reservada exclusivamente para los administradores
              y el superadministrador del certamen.
            </p>
            <div className="mt-8">
              <a href="/" className="btn btn--secondary">
                Volver al inicio
              </a>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <AdminShell role={userRole as UserRole} userName={userName}>
      {children}
    </AdminShell>
  );
}
