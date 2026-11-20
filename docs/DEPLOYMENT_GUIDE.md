# Guía de Despliegue y Secretos — Olimpíadas Literarias de SiTeLoCuento

Esta guía documenta la configuración de secretos en GitHub Actions y Cloudflare Workers para los entornos **`dev`** (`dev-olimpiadas.sitelocuento.com`) y **`prod`** (`olimpiadas.sitelocuento.com`).

---

## 1. Secretos en GitHub Actions

En el repositorio `dalexmuro/olimpiadas_stlc`, ir a **Settings → Secrets and variables → Actions → New repository secret** y agregar:

| Nombre | Valor |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Token de API de Cloudflare con permisos de **Workers Scripts (Edit)**, **D1 (Edit)** y **R2 Storage (Edit)** |
| `CLOUDFLARE_ACCOUNT_ID` | `72a8537e848ff38b562b789901671eec` |

---

## 2. Variables y Secretos en Cloudflare Workers (`prod` y `dev`)

Las variables no sensibles (`APP_ENV`, `BETTER_AUTH_URL`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`) ya están definidas en [`wrangler.jsonc`](../wrangler.jsonc).

Los secretos cifrados se sincronizan desde tu archivo local `.env` (ignorado en Git) usando:

```bash
# Validar sin subir nada
node scripts/sync-cloudflare-secrets.mjs dev --dry-run
node scripts/sync-cloudflare-secrets.mjs prod --dry-run

# Subir secretos cifrados a Cloudflare Workers
npm run cf:secrets:dev
npm run cf:secrets:prod
```

| Secreto | `dev` (`olimpiadas-stlc-dev`) | `prod` (`olimpiadas-stlc`) |
| :--- | :---: | :---: |
| `BETTER_AUTH_SECRET` | Obligatorio | Obligatorio |
| `BREVO_API_KEY` | Obligatorio | Obligatorio |
| `GOOGLE_CLIENT_ID` | Obligatorio | Obligatorio |
| `GOOGLE_CLIENT_SECRET` | Obligatorio | Obligatorio |
| `MICROSOFT_CLIENT_ID` | Opcional | Obligatorio |
| `MICROSOFT_CLIENT_SECRET` | Opcional | Obligatorio |
| `SUPERADMIN_INITIAL_EMAIL` | Obligatorio (`dalexmuro@gmail.com`) | Obligatorio (`dalexmuro@gmail.com`) |

---

## 3. Migración y Semilla Inicial en Producción (`olimpiadas-db-prod`)

La base `olimpiadas-db-dev` ya tiene aplicada la migración inicial y la semilla (`E01`–`E26` + páginas estáticas). Al preparar el primer despliegue en `main`:

```bash
npx wrangler d1 migrations apply olimpiadas-db-prod --remote
npx wrangler d1 execute olimpiadas-db-prod --remote --file=./drizzle/seed.sql
```
