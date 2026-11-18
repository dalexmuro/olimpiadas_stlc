/**
 * Drizzle ORM Client Factory for Cloudflare D1
 * Step 1.4: Install and configure Drizzle ORM pointing to Cloudflare D1
 */

import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { D1DatabaseBinding } from "@/lib/cloudflare-env";
import * as schema from "./schema";

export type AppDatabase = DrizzleD1Database<typeof schema>;

/**
 * Validates that the provided object is a usable Cloudflare D1 binding.
 */
export function isValidD1Binding(
  binding: unknown
): binding is D1DatabaseBinding {
  if (!binding || typeof binding !== "object") {
    return false;
  }
  const candidate = binding as Record<string, unknown>;
  return (
    typeof candidate.prepare === "function" &&
    typeof candidate.batch === "function" &&
    typeof candidate.exec === "function"
  );
}

/**
 * Instantiates a type-safe Drizzle ORM database client bound to a Cloudflare D1 database.
 */
export function createDbClient(d1Binding: D1DatabaseBinding): AppDatabase {
  if (!isValidD1Binding(d1Binding)) {
    throw new Error(
      "Invalid Cloudflare D1 binding passed to createDbClient(). Expected an object implementing prepare(), batch(), and exec()."
    );
  }
  return drizzle(d1Binding as unknown as Parameters<typeof drizzle>[0], {
    schema,
  });
}
