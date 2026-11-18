/**
 * Cloudflare R2 Media Serving Route (/api/media/[...key])
 * Step 1.13: Serves avatars and prompt images directly from MEDIA_BUCKET with immutable cache headers
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "@/lib/cloudflare-env";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> }
): Promise<Response> {
  const { key } = await context.params;
  const objectKey = key.join("/");

  if (!objectKey || objectKey.includes("..")) {
    return new Response("Clave de archivo inválida.", { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const object = await cfEnv.MEDIA_BUCKET.get(objectKey);

  if (!object) {
    return new Response("Archivo no encontrado.", { status: 404 });
  }

  const body = await object.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control":
        object.httpMetadata?.cacheControl ??
        "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
}
