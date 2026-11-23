/**
 * Core Security & PII Guard Rules for Olimpíadas Literarias
 * Used by `scripts/security-precommit-guard.mjs` (pre-commit staged & CI full-repo)
 * and unit-tested in `src/lib/__tests__/security-guard.test.ts`.
 */

const ALLOWLISTED_SQL_PATHS = [
  /^drizzle\/migrations\/[^/]+\.sql$/i,
  /^drizzle\/seed\.sql$/i,
];

const ALLOWLISTED_ENV_PATHS = [/^\.env\.example$/i];

const FORBIDDEN_PATH_RULES = [
  {
    id: "FORBIDDEN_ENV_FILE",
    description: "Environment file with potential runtime secrets (.env*)",
    test: (p) =>
      /(^|\/)\.env(\..+)?$/i.test(p) &&
      !ALLOWLISTED_ENV_PATHS.some((rx) => rx.test(p)),
  },
  {
    id: "FORBIDDEN_LOCAL_SECRETS",
    description: "Local secrets, Wrangler dev vars, or private notes",
    test: (p) =>
      /(^|\/)(\.dev\.vars|\.secrets\/|notas\/|registros_brevo\.yml$|client_secret_.*\.json$)/i.test(
        p
      ),
  },
  {
    id: "FORBIDDEN_DB_DUMP_OR_SQL",
    description:
      "Unauthorized SQL, database file, dump, backup, or data export",
    test: (p) =>
      /\.(sql|dump|bak|backup|sqlite|sqlite3|db|rdb|csv|tsv)$/i.test(p) &&
      !ALLOWLISTED_SQL_PATHS.some((rx) => rx.test(p)),
  },
  {
    id: "FORBIDDEN_CERT_OR_KEY",
    description: "Private key or certificate file",
    test: (p) => /\.(pem|key|p12|pfx|jks|crt|cer|der)$/i.test(p),
  },
  {
    id: "FORBIDDEN_PROD_CONFIG",
    description: "Private production or local server override configuration",
    test: (p) =>
      /(^|\/)(wrangler\.local\.[^/]+|[^/]+\.prod\.env|[^/]+\.production\.[^/]+)$/i.test(
        p
      ),
  },
];

const CONTENT_SKIP_PATHS = [
  /^package-lock\.json$/i,
  /^\.gitleaks\.toml$/i,
  /^scripts\/security-guard-core\.mjs$/i,
  /^src\/lib\/__tests__\/security-guard\.test\.ts$/i,
];

const TEST_FIXTURE_PATHS = [/^src\/.*\/__tests__\//i, /\.test\.(ts|tsx|js|mjs)$/i];

const CONTENT_RULES = [
  {
    id: "DB_CONNECTION_STRING",
    description: "Database or cache connection string with URI scheme",
    regex:
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|libsql|mssql):\/\/[^\s"'`<>]+/i,
  },
  {
    id: "PRIVATE_KEY_BLOCK",
    description: "Embedded PEM private key block",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    id: "PROVIDER_API_KEY",
    description: "Known cloud/email/OAuth/AI provider credential pattern",
    regex:
      /\b(?:xkeysib-[a-f0-9]{16,}|GOCSPX-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|ghp_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,}|AKIA[0-9A-Z]{16}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,})\b/,
    skipInTests: true,
  },
  {
    id: "HARDCODED_CLOUDFLARE_CREDENTIAL",
    description: "Hardcoded Cloudflare API token or Account ID literal",
    regex:
      /\bCLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)\s*[:=]\s*["'][0-9a-fA-F_-]{32,}["']/,
  },
  {
    id: "PARTICIPANT_SQL_DUMP",
    description:
      "SQL INSERT targeting sensitive participant/auth tables (users, accounts, sessions, enrollments, stories, votes)",
    regex:
      /\bINSERT\s+(?:OR\s+(?:IGNORE|REPLACE)\s+)?INTO\s+["'`]?(?:users|accounts|sessions|verifications|enrollments|stories|story_votes|jury_votes|audit_logs)["'`]?\b/i,
    skipInTests: true,
  },
  {
    id: "PERSONAL_CONSUMER_EMAIL",
    description:
      "Potential real personal email address (consumer domain) in tracked source",
    regex:
      /\b[A-Za-z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo|icloud|protonmail|live)\.[A-Za-z]{2,}\b/i,
  },
  {
    id: "PARTICIPANT_PHONE_PII",
    description:
      "Potential real international phone number (E.164 format outside allowlisted examples)",
    regex: /\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/,
    skipInTests: true,
    isAllowedMatch: (matchText) => {
      const digits = matchText.replace(/\D/g, "");
      if (digits.length < 9) return true;
      // Known synthetic placeholder examples in UI/docs/validators
      if (
        /(1234567|87654321|000000|111111|55501|999999)/.test(digits) ||
        matchText.includes("58 412 1234567")
      ) {
        return true;
      }
      return false;
    },
  },
];

/**
 * Normalizes repository-relative paths to POSIX forward slashes.
 */
export function normalizeRepoPath(rawPath) {
  return String(rawPath ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

/**
 * Checks whether a staged or tracked file path violates forbidden-file policies.
 */
export function checkForbiddenFilePath(rawPath) {
  const filePath = normalizeRepoPath(rawPath);
  const violations = [];

  for (const rule of FORBIDDEN_PATH_RULES) {
    if (rule.test(filePath)) {
      violations.push({
        ruleId: rule.id,
        filePath,
        line: 0,
        description: rule.description,
      });
    }
  }

  return violations;
}

/**
 * Scans text content of a staged or tracked file for credentials, DB dumps, and PII.
 * Never returns matched secret values in violation objects.
 */
export function scanFileContent(rawPath, content) {
  const filePath = normalizeRepoPath(rawPath);
  if (CONTENT_SKIP_PATHS.some((rx) => rx.test(filePath))) {
    return [];
  }

  const isTestFile = TEST_FIXTURE_PATHS.some((rx) => rx.test(filePath));
  const lines = String(content ?? "").split(/\r?\n/);
  const violations = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const lineText = lines[idx];
    if (!lineText) continue;

    for (const rule of CONTENT_RULES) {
      if (rule.skipInTests && isTestFile) continue;
      const match = rule.regex.exec(lineText);
      if (!match) continue;

      if (rule.isAllowedMatch && rule.isAllowedMatch(match[0], lineText)) {
        continue;
      }

      violations.push({
        ruleId: rule.id,
        filePath,
        line: idx + 1,
        description: rule.description,
      });
    }
  }

  return violations;
}
