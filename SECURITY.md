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
