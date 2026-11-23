# Guía de Despliegue y Secretos — Olimpíadas Literarias

[English](DEPLOYMENT_GUIDE.md) | **Español**

Esta guía documenta la configuración de secretos en GitHub Actions, secretos de ejecución en Cloudflare Workers, migraciones en D1 y configuración DNS para los entornos aislados **`dev`** (`dev-olimpiadas.sitelocuento.com`) y **`prod`** (`olimpiadas.sitelocuento.com`).

---

## 1. Secretos en GitHub Actions

En el repositorio de GitHub, ir a **Settings → Secrets and variables → Actions → New repository secret** y configurar:

| Nombre | Descripción |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Token de API de Cloudflare con permisos de **Workers Scripts (Edit)**, **D1 (Edit)** y **R2 Storage (Edit)** |
| `CLOUDFLARE_ACCOUNT_ID` | Identificador de cuenta de Cloudflare (*Account ID*) |

---

## 2. Variables y Secretos en Cloudflare Workers (`prod` y `dev`)

Las variables no sensibles (`APP_ENV`, `BETTER_AUTH_URL`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`) están definidas en [`wrangler.jsonc`](../wrangler.jsonc).

Los secretos cifrados se sincronizan desde el archivo local `.env` (excluido de Git) mediante el script incluido:

```bash
# Validar sin enviar cambios
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
| `SUPERADMIN_INITIAL_EMAIL` | Obligatorio | Obligatorio |

---

## 3. Migración y Semilla Inicial en D1 (`prod` y `dev`)

Antes del primer despliegue en producción (`main`), aplicar la migración del esquema y la semilla inicial (plantillas `E01`–`E26` + páginas públicas):

```bash
# Producción
npx wrangler d1 migrations apply olimpiadas-db-prod --remote
npx wrangler d1 execute olimpiadas-db-prod --remote --file=./drizzle/seed.sql

# Desarrollo
npx wrangler d1 migrations apply olimpiadas-db-dev --env dev --remote
npx wrangler d1 execute olimpiadas-db-dev --env dev --remote --file=./drizzle/seed.sql
```

---

## 4. DNS de Dominios Personalizados y URIs de Callback OAuth

1. **Dominios en Cloudflare:** En **Workers & Pages → Settings → Domains & Routes**, vincular los subdominios de producción y desarrollo a `olimpiadas-stlc` y `olimpiadas-stlc-dev`.
2. **Registros DNS:** Crear los registros `CNAME` (`olimpiadas` y `dev-olimpiadas`) apuntando a los hostnames objetivo de Cloudflare Workers.
3. **URIs de redirección autorizados en Google Cloud Console y Microsoft Entra ID:**
   - **Google OAuth (Producción):** `https://olimpiadas.sitelocuento.com/api/auth/callback/google`
   - **Google OAuth (Desarrollo):** `https://dev-olimpiadas.sitelocuento.com/api/auth/callback/google` (y el dominio temporal `*.workers.dev` si se prueba antes del DNS)
   - **Microsoft OAuth (Producción):** `https://olimpiadas.sitelocuento.com/api/auth/callback/microsoft`
   - **Microsoft OAuth (Desarrollo):** `https://dev-olimpiadas.sitelocuento.com/api/auth/callback/microsoft`
