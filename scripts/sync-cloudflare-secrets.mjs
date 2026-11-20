/**
 * Sync local .env secrets to Cloudflare Workers (`dev` or `prod`) via `wrangler secret bulk`.
 * Usage:
 *   node scripts/sync-cloudflare-secrets.mjs dev [--dry-run]
 *   node scripts/sync-cloudflare-secrets.mjs prod [--dry-run]
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const targetEnv = process.argv[2];
const isDryRun = process.argv.includes("--dry-run");

if (targetEnv !== "dev" && targetEnv !== "prod") {
  console.error("Uso: node scripts/sync-cloudflare-secrets.mjs <dev|prod> [--dry-run]");
  process.exit(1);
}

const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error("No se encontró el archivo .env en la raíz del proyecto.");
  process.exit(1);
}

const SECRET_KEYS = [
  "BETTER_AUTH_SECRET",
  "BREVO_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "SUPERADMIN_INITIAL_EMAIL",
];

const raw = readFileSync(envPath, "utf8");
const parsed = {};
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  parsed[key] = val;
}

const payload = {};
const missing = [];
for (const key of SECRET_KEYS) {
  const val = parsed[key];
  if (val && val.trim().length > 0) {
    payload[key] = val.trim();
  } else if (
    targetEnv === "prod" ||
    !key.startsWith("MICROSOFT_")
  ) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error(
    `Faltan secretos obligatorios en .env para "${targetEnv}": ${missing.join(", ")}`
  );
  process.exit(1);
}

console.log(
  `Secretos preparados para "${targetEnv}" (${Object.keys(payload).length} claves): ${Object.keys(payload).join(", ")}`
);

if (isDryRun) {
  console.log("Modo --dry-run activo: no se enviaron secretos a Cloudflare.");
  process.exit(0);
}

const args = ["wrangler", "secret", "bulk"];
if (targetEnv === "dev") {
  args.push("--env", "dev");
}

const result = spawnSync("npx", args, {
  input: JSON.stringify(payload),
  stdio: ["pipe", "inherit", "inherit"],
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
