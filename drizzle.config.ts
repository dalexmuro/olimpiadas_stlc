import { defineConfig } from "drizzle-kit";

export const DRIZZLE_CONFIG_OPTIONS = {
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
} as const;

export default defineConfig({
  schema: DRIZZLE_CONFIG_OPTIONS.schema,
  out: DRIZZLE_CONFIG_OPTIONS.out,
  dialect: DRIZZLE_CONFIG_OPTIONS.dialect,
});
