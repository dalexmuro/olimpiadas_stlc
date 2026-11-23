/**
 * Protected Cron Trigger Endpoint (/api/cron/run)
 * Step 6.4: Allows Cloudflare Worker scheduled() or authorized ops calls to invoke `runContestCronTick`
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import { APP_BRAND } from "@/lib/app-metadata";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { runContestCronTick } from "@/lib/cron-runner";
import { constantTimeEqual } from "@/lib/security";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  const expectedSecret = (cfEnv.CRON_SECRET ?? "").trim();
  const authHeader = request.headers.get("authorization") ?? "";

  const isAuthorized =
    expectedSecret.length > 0 &&
    (await constantTimeEqual(authHeader, `Bearer ${expectedSecret}`));

  if (!isAuthorized) {
    return NextResponse.json(
      { ok: false, error: "No autorizado para ejecutar el motor cron." },
      { status: 401 }
    );
  }

  const db = createDbClient(cfEnv.DB);
  const summary = await runContestCronTick({
    db,
    baseUrl: cfEnv.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
    brevoApiKey: cfEnv.BREVO_API_KEY,
  });

  return NextResponse.json({
    ok: true,
    summary,
  });
}
