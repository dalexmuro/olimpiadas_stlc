# Deployment & Secrets Guide — Olimpíadas Literarias

**English** | [Español](GUIA_DESPLIEGUE.md)

This guide documents GitHub Actions secrets, Cloudflare Workers runtime secrets, D1 migrations, and DNS configuration for both isolated environments: **`dev`** (`dev-olimpiadas.sitelocuento.com`) and **`prod`** (`olimpiadas.sitelocuento.com`).

---

## 1. GitHub Actions Secrets

In your GitHub repository, navigate to **Settings → Secrets and variables → Actions → New repository secret** and configure:

| Secret Name | Description |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with **Workers Scripts (Edit)**, **D1 (Edit)**, and **R2 Storage (Edit)** permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |

---

## 2. Cloudflare Workers Runtime Variables & Secrets (`prod` and `dev`)

Non-sensitive runtime variables (`APP_ENV`, `BETTER_AUTH_URL`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`) are defined in [`wrangler.jsonc`](../wrangler.jsonc).

Encrypted runtime secrets are synced from your local `.env` file (excluded from Git) using the provided helper script:

```bash
# Dry-run validation (no changes pushed)
node scripts/sync-cloudflare-secrets.mjs dev --dry-run
node scripts/sync-cloudflare-secrets.mjs prod --dry-run

# Push encrypted secrets to Cloudflare Workers
npm run cf:secrets:dev
npm run cf:secrets:prod
```

| Secret | `dev` (`olimpiadas-stlc-dev`) | `prod` (`olimpiadas-stlc`) |
| :--- | :---: | :---: |
| `BETTER_AUTH_SECRET` | Required | Required |
| `BREVO_API_KEY` | Required | Required |
| `GOOGLE_CLIENT_ID` | Required | Required |
| `GOOGLE_CLIENT_SECRET` | Required | Required |
| `MICROSOFT_CLIENT_ID` | Optional | Required |
| `MICROSOFT_CLIENT_SECRET` | Optional | Required |
| `SUPERADMIN_INITIAL_EMAIL` | Required | Required |

---

## 3. Initial D1 Migration & Seed (Production & Dev)

Before the first production launch on `main`, apply the schema migration and initial seed (`E01`–`E26` email templates + static public pages):

```bash
# Production
npx wrangler d1 migrations apply olimpiadas-db-prod --remote
npx wrangler d1 execute olimpiadas-db-prod --remote --file=./drizzle/seed.sql

# Development
npx wrangler d1 migrations apply olimpiadas-db-dev --env dev --remote
npx wrangler d1 execute olimpiadas-db-dev --env dev --remote --file=./drizzle/seed.sql
```

---

## 4. Custom Domain DNS & OAuth Callback URIs

1. **Cloudflare Custom Domains:** Under **Workers & Pages → Settings → Domains & Routes**, attach your production and staging subdomains to `olimpiadas-stlc` and `olimpiadas-stlc-dev`.
2. **DNS Records:** Configure `CNAME` records pointing your subdomains (`olimpiadas` and `dev-olimpiadas`) to the target Cloudflare Workers routes.
3. **OAuth Authorized Redirect URIs (Google Cloud Console & Microsoft Entra ID):**
   - **Google OAuth (Prod):** `https://olimpiadas.sitelocuento.com/api/auth/callback/google`
   - **Google OAuth (Dev):** `https://dev-olimpiadas.sitelocuento.com/api/auth/callback/google` (plus your `*.workers.dev` preview URL during staging)
   - **Microsoft OAuth (Prod):** `https://olimpiadas.sitelocuento.com/api/auth/callback/microsoft`
   - **Microsoft OAuth (Dev):** `https://dev-olimpiadas.sitelocuento.com/api/auth/callback/microsoft`
