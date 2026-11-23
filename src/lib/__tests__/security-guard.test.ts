import { describe, expect, it } from "vitest";
import {
  checkForbiddenFilePath,
  scanFileContent,
} from "../../../scripts/security-guard-core.mjs";

describe("Pre-commit & CI Security Guard Rules", () => {
  it("blocks forbidden env files, DB dumps, certificates, and prod configs while allowing safe files", () => {
    expect(checkForbiddenFilePath(".env").map((v) => v.ruleId)).toContain(
      "FORBIDDEN_ENV_FILE"
    );
    expect(checkForbiddenFilePath(".env.production").map((v) => v.ruleId)).toContain(
      "FORBIDDEN_ENV_FILE"
    );
    expect(checkForbiddenFilePath(".env.example")).toEqual([]);

    expect(checkForbiddenFilePath("backup_2026.sql").map((v) => v.ruleId)).toContain(
      "FORBIDDEN_DB_DUMP_OR_SQL"
    );
    expect(checkForbiddenFilePath("local.sqlite3").map((v) => v.ruleId)).toContain(
      "FORBIDDEN_DB_DUMP_OR_SQL"
    );
    expect(checkForbiddenFilePath("participants.csv").map((v) => v.ruleId)).toContain(
      "FORBIDDEN_DB_DUMP_OR_SQL"
    );
    expect(
      checkForbiddenFilePath("drizzle/migrations/0000_initial.sql")
    ).toEqual([]);
    expect(checkForbiddenFilePath("drizzle/seed.sql")).toEqual([]);

    expect(checkForbiddenFilePath("certs/server.pem").map((v) => v.ruleId)).toContain(
      "FORBIDDEN_CERT_OR_KEY"
    );
    expect(
      checkForbiddenFilePath("wrangler.local.jsonc").map((v) => v.ruleId)
    ).toContain("FORBIDDEN_PROD_CONFIG");
    expect(checkForbiddenFilePath(".secrets/brevo.txt").map((v) => v.ruleId)).toContain(
      "FORBIDDEN_LOCAL_SECRETS"
    );
  });

  it("detects DB connection strings, provider keys, private keys, and Cloudflare account literals", () => {
    const sample = [
      'const db = "postgres://admin:secret@db.prod.internal:5432/olimpiadas";',
      'const key = "xkeysib-0123456789abcdef0123456789abcdef";',
      'const CLOUDFLARE_ACCOUNT_ID = "0123456789abcdef0123456789abcdef";',
      "-----BEGIN RSA PRIVATE KEY-----",
    ].join("\n");

    const violations = scanFileContent("src/lib/bad.ts", sample);
    const ids = violations.map((v) => v.ruleId);

    expect(ids).toContain("DB_CONNECTION_STRING");
    expect(ids).toContain("PROVIDER_API_KEY");
    expect(ids).toContain("HARDCODED_CLOUDFLARE_CREDENTIAL");
    expect(ids).toContain("PRIVATE_KEY_BLOCK");
  });

  it("detects participant SQL dumps and real consumer emails/phones while ignoring safe placeholders", () => {
    const dumpSql =
      "INSERT INTO users (id, email) VALUES ('u1', 'autor.real@gmail.com');";
    const sqlViolations = scanFileContent("drizzle/seed.sql", dumpSql);
    expect(sqlViolations.map((v) => v.ruleId)).toContain("PARTICIPANT_SQL_DUMP");
    expect(sqlViolations.map((v) => v.ruleId)).toContain(
      "PERSONAL_CONSUMER_EMAIL"
    );

    const piiCode = 'const phone = "+58 414 789 4521";';
    expect(
      scanFileContent("src/app/page.tsx", piiCode).map((v) => v.ruleId)
    ).toContain("PARTICIPANT_PHONE_PII");

    const safeCode = [
      'const email = "superadmin@example.com";',
      'const support = "olimpiadas@sitelocuento.com";',
      'const examplePhone = "+58 412 1234567";',
      'const dialCode = "+591";',
    ].join("\n");
    expect(scanFileContent("src/lib/profile-service.ts", safeCode)).toEqual([]);
  });
});
