# Security Policy

## Supported Versions

Security fixes are applied to the active development (`dev`) and production (`main`) branches.

| Branch | Supported |
| --- | --- |
| `main` | Yes |
| `dev` | Yes |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, use **GitHub Private Vulnerability Reporting** (under the repository's **Security → Advisories → Report a vulnerability** tab) or contact the maintainers privately with:

1. A clear description of the vulnerability and potential impact.
2. Steps to reproduce or a minimal proof of concept.
3. Affected file paths, endpoints, or configuration.

We aim to acknowledge reports within 72 hours and coordinate a fix before public disclosure.

## Security Design Notes

- **Session Signing (`BETTER_AUTH_SECRET`):** Production and staging deployments fail closed if `BETTER_AUTH_SECRET` is missing.
- **Cron Endpoint Protection (`CRON_SECRET`):** `/api/cron/run` requires a dedicated `CRON_SECRET` verified with constant-time SHA-256 comparison (`src/lib/security.ts`).
- **Editorial HTML & Headers:** Public editorial pages (`site_pages`) and live previews are sanitized (`sanitizeHtml`), and `next.config.ts` enforces CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy`.
- **Registration Email Check (`/api/auth/check-email`):** This endpoint provides immediate duplicate-email feedback during sign-up. Deployments exposed to public traffic should enable Cloudflare Rate Limiting or Cloudflare Turnstile on `/api/auth/*` to mitigate automated email enumeration.

## Automated Pre-commit Hooks & CI Security Gates

- **Local Pre-commit (`.pre-commit-config.yaml`):** Uses [pre-commit](https://pre-commit.com/) with `gitleaks protect --staged`, `detect-private-key`, `check-added-large-files`, `scripts/security-precommit-guard.mjs --staged` (blocks `.env*`, unauthorized `.sql`/`.db`/`.dump`/`.bak`/`.csv`, certs/keys, DB connection strings, provider keys, and participant PII), and ESLint on staged TypeScript files.
- **CI Security Gates (`.github/workflows/security.yml`):** Runs on every push and pull request to `dev` and `main`:
  1. **Gitleaks Full Git History Scan** (`fetch-depth: 0`, `--log-opts="--all"`) to catch any secret ever committed in history.
  2. **Repository Security & PII Policy Guard** (`npm run security:check`) across all tracked files.
  3. **Production Dependency Audit** (`npm audit --omit=dev --audit-level=high`).
- **Incident Response:** If a real credential is ever committed to Git history, **revoke and rotate it immediately** — deleting the file in a later commit does not remove it from Git history.
