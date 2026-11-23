/**
 * Authenticated User Profile API Route (/api/profile)
 * Step 1.13: GET current profile and PUT personal data & email (with re-verification)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { users } from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance, splitDisplayName } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  deleteUserAccountInDb,
  updateUserProfileInDb,
  type ProfileUpdateInput,
} from "@/lib/profile-service";

export async function GET(request: Request): Promise<Response> {
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
  const user = rows[0];

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  const fallbackName = splitDisplayName(user.name);

  return NextResponse.json({
    ok: true,
    profile: {
      id: user.id,
      firstName: user.firstName?.trim() || fallbackName.firstName,
      lastName: user.lastName?.trim() || fallbackName.lastName,
      country: user.country ?? "",
      phone: user.phone ?? "",
      email: user.email,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl ?? user.image ?? null,
      role: user.role,
    },
  });
}

export async function PUT(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para editar tu perfil." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as Partial<ProfileUpdateInput>;
  const input: ProfileUpdateInput = {
    firstName: String(body.firstName ?? ""),
    lastName: String(body.lastName ?? ""),
    country: String(body.country ?? ""),
    phone: String(body.phone ?? ""),
    email: String(body.email ?? ""),
  };

  const result = await updateUserProfileInDb({
    db,
    userId: session.user.id,
    currentEmail: session.user.email,
    input,
    baseUrl: cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
    brevoApiKey: cfEnv.BREVO_API_KEY,
  });

  if (!result.updated) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    emailChanged: result.emailChanged,
    verificationSent: result.verificationSent,
  });
}

export async function DELETE(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para eliminar tu cuenta." },
      { status: 401 }
    );
  }

  const result = await deleteUserAccountInDb({
    db,
    userId: session.user.id,
    email: session.user.email,
  });

  if (!result.deleted) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "No se pudo eliminar la cuenta." },
      { status: 400 }
    );
  }

  try {
    await auth.api.signOut({ headers: request.headers });
  } catch {
    // Session row was already deleted in D1
  }

  return NextResponse.json({ ok: true, anonymized: result.anonymized ?? false });
}
