# Especificación Técnica y Arquitectura — Olimpíadas Literarias

[English](TECHNICAL_SPECIFICATION.md) | **Español**

**Documento complementario:** [`ESPECIFICACION_FUNCIONAL_AGENTE.md`](ESPECIFICACION_FUNCIONAL_AGENTE.md)  
**Organizador:** Club de escritura SiTeLoCuento  
**Producción:** `https://olimpiadas.sitelocuento.com` | **Desarrollo:** `https://dev-olimpiadas.sitelocuento.com`  
**Zona horaria oficial:** `America/Caracas` (UTC-4)

---

## 1. Arquitectura y Stack Tecnológico

Arquitectura **100% Serverless y Edge-Native** desplegada sobre **Cloudflare Developer Platform** con costo operativo **\$0/mes** en capas gratuitas, sin pausas por inactividad fuera de temporada y despliegues automáticos desde GitHub (`dev` y `main`).

| Capa | Tecnología | Rol en la Plataforma |
| :--- | :--- | :--- |
| **Framework Full-Stack** | **Next.js 15 (App Router) + React 19 + TypeScript** (`@opennextjs/cloudflare`) | Interfaz SSR/RSC y rutas API unificadas en un solo repositorio con tipado estricto. |
| **Diseño y Motion** | **Tailwind CSS v4 + Editorial Ámbar SiTeLoCuento + Lucide Icons + GSAP** | Tokens CSS en `tokens.css` / `base.css` / `globals.css` (`#D47E17` / `#B3640C`, `Bricolage Grotesque`, `DM Sans`, `Newsreader` italic) y animaciones GSAP (`SplitText`, `ScrollTrigger`, `ScrollToPlugin`) respetando `prefers-reduced-motion`. |
| **Cómputo Edge** | **Cloudflare Workers** | Ejecución distribuida en el edge con entornos aislados (`olimpiadas-stlc` y `olimpiadas-stlc-dev`). |
| **Base de Datos** | **Cloudflare D1 (SQLite Serverless) + Drizzle ORM** | 22 tablas normalizadas (4 de autenticación + 18 de dominio), migraciones SQL en `drizzle/migrations` y semilla `drizzle/seed.sql`. |
| **Multimedia** | **Cloudflare R2** | Almacenamiento de avatares (`avatars/`) e imágenes de consignas (`prompts/`) sin cargos de egreso. |
| **Autenticación y Sesiones** | **Better Auth + D1 Adapter** (`src/lib/auth.ts`) | Correo/Contraseña (`E01`/`E02`, verificación previa de duplicado, política 3 de 4), Google y Microsoft OAuth (`tenant: "common"`) con precarga de perfil, soporte dinámico `workers.dev`/`localhost`, y tokens rodantes estilo bancario (`15 min` cerrada / `25+5 min` abierta). |
| **Correos Transaccionales** | **Brevo HTTP REST API** (`src/lib/email.ts`) | 26 plantillas editables (`E01`–`E26`) con registro idempotente en `email_dispatch_logs` y modo dry-run. |
| **Automatización (Cron)** | **Cloudflare Cron Triggers** (`src/lib/cron-runner.ts`) | Transiciones de etapa, publicación/cierre de consignas, cálculo de fallas y recordatorios de 1 hora. |
| **Similitud y Diff** | **`diff` (Myers Diff) + Levenshtein** (`src/lib/similarity.ts`) | Control de similitud mínima en Etapa 3 y comparación visual rojo/verde en Etapa 4. |

---

## 2. Controles de Seguridad, RBAC y Sesiones

- **Guardas de Servidor para `SUPERADMIN`:** [`src/lib/admin-session.ts`](../src/lib/admin-session.ts) (`requireSuperadminOrRedirect`) protege mediante `layout.tsx` las rutas `/admin/ediciones`, `/admin/roles`, `/admin/correos` y `/admin/paginas`, complementando las validaciones `403` en cada API y el filtrado del resumen `/admin` por rol (`getVisibleAdminTabs`).
- **Sesiones Rodantes Estilo Bancario:** definidas en [`src/lib/session-timeout.ts`](../src/lib/session-timeout.ts), [`src/app/api/auth/keep-alive/route.ts`](../src/app/api/auth/keep-alive/route.ts) y [`src/components/auth/SessionActivityGuard.tsx`](../src/components/auth/SessionActivityGuard.tsx):
  - Expiración de token en D1 a los **15 minutos** sin latido (pestaña cerrada).
  - Latido automático cada **5 minutos** mientras la pestaña está abierta y dentro de la ventana de actividad.
  - Modal de advertencia a los **25 minutos** de inactividad con cuenta regresiva de **5 minutos** (`Seguir conectado` / `Cerrar sesión`), sincronización entre pestañas vía `localStorage` y cierre automático a los **30 minutos**.
- **Eliminación Segura de Cuenta (`DELETE /api/profile`):** implementada en `deleteUserAccountInDb` ([`src/lib/profile-service.ts`](../src/lib/profile-service.ts)); impide borrar el último `SUPERADMIN`, elimina sesiones/OAuth/verificaciones y anonimiza los datos personales si existen cuentos o auditorías históricas referenciadas.

---

## 3. Esquema de Base de Datos y Algoritmos

El esquema completo de las **22 tablas SQLite/D1**, las fórmulas de votación ponderada del jurado (tramos $K \in \{5, 10, 15, 20\}$), el orden determinista aleatorio por votante, el motor de desempate y el mapa completo de rutas API se detallan en la versión de referencia completa: [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md).
