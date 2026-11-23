# Agent Instructions — Olimpíadas Literarias de SiTeLoCuento

When interacting with Cloudflare, use the `cf` CLI unless the project has a Wrangler configuration file.

## Project Documentation Reference
- Functional Specification (Agent Reference): `docs/FUNCTIONAL_SPECIFICATION_AGENT.md`
- Technical Specification & Architecture: `docs/TECHNICAL_SPECIFICATION.md`
- Functional Guide for Organizers (Spanish): `docs/GUIA_FUNCIONAL_ORGANIZADORES.md`

## Visual Design System (Taller Abierto — Verde Bosque)
- All web pages and UI components must follow the **Taller Abierto** single-accent **Verde Bosque (`#16795C`)** design system defined in `src/app/tokens.css`, `src/app/base.css`, and `src/app/globals.css`, aligned with `PRODUCT.md`.
- Visual guidelines must never contradict `docs/FUNCTIONAL_SPECIFICATION_AGENT.md`, `docs/TECHNICAL_SPECIFICATION.md`, or `PRODUCT.md`.
- Every color and font must reference `:root` / `@theme` tokens (`bg-paper`, `bg-paper-2`, `bg-accent-soft`, `text-ink`, `text-muted`, `border-rule`, `bg-accent`, `font-display` = `Bricolage Grotesque`, `font-body` = `DM Sans`). Never introduce literal colors, purple-to-blue gradients, card-in-card nesting, tracked uppercase eyebrows, decorative middle dots, or arrows glued to link text.

## Mandatory Implementation Workflow (Step-by-Step Rules)
1. **One Step at a Time:** Implementation must proceed strictly step-by-step according to `notas/IMPLEMENTATION_TRACKER.md`.
2. **No Agent Git Commits:** Never run `git commit` or `git push`. All commits are performed exclusively by the user (1 commit per step).
3. **Mandatory Post-Step Verification Checklist (Before Ending Any Step):**
   - Write, run, and document **unit tests** for the implemented step.
   - Run the **linter** across all created/modified code.
   - Fix any test, type, or linter error until 100% clean.
   - Update project documentation (`README.md` / `docs/`).
   - Update `notas/IMPLEMENTATION_TRACKER.md` and add a **Verification Gate** entry for the step.
   - Propose a clear **commit message** to the user and **wait for explicit user confirmation** that the commit has been made before starting the next step.
