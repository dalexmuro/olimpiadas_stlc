/**
 * Avatar Upload API Route (/api/upload/avatar)
 * Step 1.13: Uploads user profile photo (<= 5 MB, JPG/PNG/WEBP) to Cloudflare R2
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { uploadAvatarToR2 } from "@/lib/profile-service";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv, request.url);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Debes iniciar sesión para subir tu foto." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Selecciona un archivo de imagen válido." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const result = await uploadAvatarToR2({
    db,
    mediaBucket: cfEnv.MEDIA_BUCKET,
    userId: session.user.id,
    mimeType: file.type,
    bytes,
  });

  if (!result.uploaded) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    avatarUrl: result.avatarUrl,
  });
}
