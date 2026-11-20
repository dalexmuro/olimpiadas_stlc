/**
 * Prompt Image Upload API Route (/api/upload/prompt-image)
 * Step 2.4: Uploads optional prompt image (JPG/PNG/WEBP <= 5 MB) to Cloudflare R2
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { users } from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { uploadPromptImageToR2 } from "@/lib/prompt-bank";

export async function POST(request: Request): Promise<Response> {
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

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  const actor = rows[0];
  if (!actor || !canAccessAdminPanel(actor.role)) {
    return NextResponse.json(
      { ok: false, error: "Acceso restringido a administradores." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Selecciona una imagen válida." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const result = await uploadPromptImageToR2({
    mediaBucket: cfEnv.MEDIA_BUCKET,
    promptScopeId: actor.id,
    mimeType: file.type,
    bytes,
  });

  if (!result.uploaded) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, imageUrl: result.imageUrl });
}
