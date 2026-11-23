/**
 * Cloudflare Worker Scheduled Event Handler
 * Connects wrangler.jsonc `triggers.crons` directly to `runContestCronTick`.
 */

import { createDbClient } from "@/db";
import { APP_BRAND } from "./app-metadata";
import type { CloudflareEnv } from "./cloudflare-env";
import { runContestCronTick, type CronTickSummary } from "./cron-runner";

export async function handleScheduledContestCron(
  env: CloudflareEnv
): Promise<CronTickSummary> {
  const db = createDbClient(env.DB);
  return runContestCronTick({
    db,
    baseUrl: env.BETTER_AUTH_URL ?? APP_BRAND.productionUrl,
    brevoApiKey: env.BREVO_API_KEY,
  });
}
