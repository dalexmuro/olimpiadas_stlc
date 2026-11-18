/**
 * Better Auth API Route Handler (/api/auth/[...all])
 * Step 1.10: Handles sign-up, sign-in, email verification, password reset, and Google/Microsoft OAuth callbacks
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDbClient } from "@/db";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";

async function handleAuthRequest(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);
  return auth.handler(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleAuthRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleAuthRequest(request);
}
