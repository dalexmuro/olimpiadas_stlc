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

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;

  const expectedSecret = cfEnv.BETTER_AUTH_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
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
