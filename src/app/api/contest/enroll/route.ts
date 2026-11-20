/**
 * Stage 1 Participant Enrollment API Route (/api/contest/enroll)
 * Step 3.2: Enrolls the authenticated participant in the active edition and dispatches E03
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { editions, users } from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { enrollParticipantInEdition } from "@/lib/stage1-registration";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para inscribirte." },
      { status: 401 }
    );
  }

  const [userRows, activeEditions] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)),
    db.select().from(editions).where(eq(editions.isActive, true)),
  ]);

  const user = userRows[0];
  const edition = activeEditions[0];

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  if (!edition) {
    return NextResponse.json(
      { ok: false, error: "No hay ninguna edición activa en este momento." },
      { status: 400 }
    );
  }

  const body = (await request.json()) as { acceptedRules?: boolean };

  const result = await enrollParticipantInEdition({
    db,
    editionId: edition.id,
    edition,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      role: user.role,
      profileCompleted: user.profileCompleted,
    },
    acceptedRules: Boolean(body.acceptedRules),
    baseUrl: cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
    brevoApiKey: cfEnv.BREVO_API_KEY,
  });

  if (!result.enrolled) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      enrollmentId: result.enrollmentId,
      emailSent: result.emailSent,
    },
    { status: 201 }
  );
}
