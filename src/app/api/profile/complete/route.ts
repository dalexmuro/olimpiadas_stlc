/**
 * Profile Completion API Route (/api/profile/complete)
 * Step 1.12: Saves mandatory personal fields for authenticated users (especially Google/Microsoft OAuth users)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  completeUserProfile,
  validateProfileCompletionForm,
  type CompleteProfileFormInput,
} from "@/lib/profile-gate";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as Partial<CompleteProfileFormInput>;
  const input: CompleteProfileFormInput = {
    firstName: String(body.firstName ?? ""),
    lastName: String(body.lastName ?? ""),
    country: String(body.country ?? ""),
    phone: String(body.phone ?? ""),
  };

  const validation = validateProfileCompletionForm(input);
  if (!validation.valid) {
    return NextResponse.json(
      { ok: false, fieldErrors: validation.fieldErrors },
      { status: 400 }
    );
  }

  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para completar tu perfil." },
      { status: 401 }
    );
  }

  const result = await completeUserProfile(db, session.user.id, input);
  if (!result.updated) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, fullName: result.fullName });
}
