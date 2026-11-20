# Olimpíadas Literarias de SiTeLoCuento

Plataforma web oficial del concurso anual de cuentos cortos **Olimpíadas Literarias de SiTeLoCuento**, organizado por el club de escritura **SiTeLoCuento**.

- **Producción (`main`):** `https://olimpiadas.sitelocuento.com`
- **Desarrollo / Pruebas (`dev`):** `https://dev-olimpiadas.sitelocuento.com`
- **Zona horaria oficial del sistema:** `America/Caracas` (UTC-4)

---

## Estructura del Proyecto

```text
├── docs/                                      # Documentación funcional y técnica
│   ├── FUNCTIONAL_SPECIFICATION_AGENT.md      # Especificación funcional exhaustiva (Inglés)
│   ├── TECHNICAL_SPECIFICATION.md             # Arquitectura, esquema BD D1 y algoritmos
│   └── GUIA_FUNCIONAL_ORGANIZADORES.md        # Guía en lenguaje natural para organizadores
├── src/                                       # Código fuente de la aplicación
│   ├── app/                                   # Rutas, páginas y endpoints (Next.js App Router)
│   ├── components/                            # Componentes visuales e interactivos
│   ├── db/                                    # Esquema Drizzle ORM y migraciones (Cloudflare D1)
│   └── lib/                                   # Autenticación, correos, similitud de textos y cron
├── public/                                    # Archivos estáticos públicos
├── wrangler.jsonc                             # Configuración de Cloudflare Workers, bindings D1/R2 y Cron
├── drizzle.config.ts                          # Configuración de Drizzle Kit (SQLite / Cloudflare D1)
├── open-next.config.ts                        # Configuración del adaptador @opennextjs/cloudflare
├── .secrets/                                  # Archivos auxiliares de credenciales locales (Ignorado en Git)
├── .env                                       # Variables de entorno locales (Ignorado en Git)
├── .env.example                               # Plantilla de variables de entorno
└── AGENTS.md                                  # Instrucciones para agentes de IA
```

---

## Stack Tecnológico

- **Framework Full-Stack:** Next.js (App Router) + TypeScript + Tailwind CSS v4
- **Sistema de Diseño Visual:** Hallmark (`Riso` — `Cabinet Grotesk 800` + `Literata`, tokens en `src/app/tokens.css` y `src/app/base.css`)
- **Infraestructura y Hosting:** Cloudflare Workers / Pages (`@opennextjs/cloudflare`)
- **Base de Datos:** Cloudflare D1 (SQLite Serverless) + Drizzle ORM
  - Producción: `olimpiadas-db-prod` (`62d0469d-8c03-42a9-ac45-98b320f85b02`)
  - Desarrollo: `olimpiadas-db-dev` (`b03d7071-ddc3-4111-96e1-12c18da7245a`)
- **Almacenamiento Multimedia:** Cloudflare R2 (`WEUR`)
  - Producción: `olimpiadas-media-prod`
  - Desarrollo: `olimpiadas-media-dev`
- **Autenticación:** Better Auth (Correo/Contraseña + Google OAuth + Microsoft OAuth)
- **Correos Transaccionales:** Brevo API (`olimpiadas@sitelocuento.com`)
- **Tareas Programadas:** Cloudflare Cron Triggers (`*/5 * * * *`)

---

## Comandos de Desarrollo, Verificación y Calidad

```bash
npm run dev              # Inicia el servidor local de desarrollo (Next.js App Router)
npm run build            # Compila la aplicación Next.js para producción
npm run cf:build         # Empaqueta la aplicación para Cloudflare Workers (@opennextjs/cloudflare)
npm run db:generate      # Genera migraciones SQL desde el esquema Drizzle (drizzle/migrations)
npm run db:migrate:local # Aplica migraciones SQL pendientes en la base D1 local (.wrangler)
npm run db:migrate:dev   # Aplica migraciones SQL pendientes en olimpiadas-db-dev (Cloudflare D1)
npm run db:seed:local    # Ejecuta la semilla inicial (plantillas E01-E26 y páginas) en D1 local
npm run db:seed:dev      # Ejecuta la semilla inicial en olimpiadas-db-dev (Cloudflare D1)
npm run db:studio        # Abre el visor visual de tablas Drizzle Studio
npm test                 # Ejecuta la suite de tests unitarios (Vitest)
npm run lint             # Verifica reglas de estilo y análisis estático (ESLint)
npm run typecheck        # Verifica tipos estrictos de TypeScript
```

---

## Documentación

1. **[Guía Funcional para Organizadores](docs/GUIA_FUNCIONAL_ORGANIZADORES.md):** Explicación completa de todas las etapas, roles y reglas del concurso en lenguaje no técnico.
2. **[Especificación Funcional para Desarrollo](docs/FUNCTIONAL_SPECIFICATION_AGENT.md):** Reglas de negocio detalladas, estados, validaciones y catálogo de correos automáticos (`E01`–`E26`).
3. **[Especificación Técnica y Arquitectura](docs/TECHNICAL_SPECIFICATION.md):** Esquema SQL de las 17 tablas, algoritmos de similitud y desempate, motor de Cron y hoja de ruta en 6 fases.
