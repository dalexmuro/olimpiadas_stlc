/**
 * Custom Cloudflare Worker Entrypoint wrapping OpenNext + Cron `scheduled()`
 * Configured as `"main": "src/worker.ts"` in `wrangler.jsonc`.
 */

import openNextWorker from "../.open-next/worker.js";
import type { CloudflareEnv } from "./lib/cloudflare-env";
import { handleScheduledContestCron } from "./lib/worker-scheduled";

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const worker = {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    ctx: WorkerExecutionContext
  ): Promise<Response> {
    return openNextWorker.fetch(request, env, ctx);
  },

  async scheduled(
    _controller: { scheduledTime: number; cron: string },
    env: CloudflareEnv,
    ctx: WorkerExecutionContext
  ): Promise<void> {
    ctx.waitUntil(handleScheduledContestCron(env));
  },
};

export default worker;
