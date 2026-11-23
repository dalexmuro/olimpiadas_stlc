# Agent Instructions — Olimpíadas Literarias de SiTeLoCuento

When interacting with Cloudflare, use the `cf` CLI unless the project has a Wrangler configuration file.

## Project Documentation Reference
- Functional Specification (Agent Reference): `docs/FUNCTIONAL_SPECIFICATION_AGENT.md` (EN) / `docs/ESPECIFICACION_FUNCIONAL_AGENTE.md` (ES)
- Technical Specification & Architecture: `docs/TECHNICAL_SPECIFICATION.md` (EN) / `docs/ESPECIFICACION_TECNICA.md` (ES)
- Functional Guide for Organizers: `docs/ORGANIZER_FUNCTIONAL_GUIDE.md` (EN) / `docs/GUIA_FUNCIONAL_ORGANIZADORES.md` (ES)
- Deployment Guide: `docs/DEPLOYMENT_GUIDE.md` (EN) / `docs/GUIA_DESPLIEGUE.md` (ES)

## Visual Design System (Editorial Ámbar SiTeLoCuento)
- All web pages and UI components must follow the single-accent **Ámbar SiTeLoCuento (`#D47E17` / `#B3640C`)** editorial design system defined in `src/app/tokens.css`, `src/app/base.css`, and `src/app/globals.css`, aligned with `PRODUCT.md`.
- Visual guidelines must never contradict `docs/FUNCTIONAL_SPECIFICATION_AGENT.md`, `docs/TECHNICAL_SPECIFICATION.md`, or `PRODUCT.md`.
- Every color and font must reference `:root` / `@theme` tokens (`bg-paper`, `bg-paper-2`, `bg-surface`, `bg-accent-soft`, `text-ink`, `text-muted`, `border-rule`, `bg-accent`, `font-display` = `Bricolage Grotesque`, `font-body` = `DM Sans`, `font-serif` = `Newsreader` italic). Never introduce literal colors, purple-to-blue gradients, card-in-card nesting, tracked uppercase eyebrows, decorative middle dots, or arrows glued to link text.

## Mandatory Implementation Workflow (Step-by-Step Rules)
1. **One Step at a Time:** Proceed in well-scoped, verifiable increments aligned with the project specifications.
2. **No Agent Git Commits:** Never run `git commit` or `git push`. All commits are performed exclusively by the user (1 commit per step).
3. **Mandatory Post-Step Verification Checklist (Before Ending Any Step):**
   - Write, run, and document **unit tests** for the implemented step (`npm test`).
   - Run the **linter** (`npm run lint`) and **typecheck** (`npm run typecheck`) across all created/modified code.
   - Fix any test, type, or linter error until 100% clean.
   - Update project documentation (`README.md` / `README.es.md` / `docs/`) when behavior or architecture changes.
   - Propose a clear **commit message** to the user and **wait for explicit user confirmation** that the commit has been made before starting the next step.
