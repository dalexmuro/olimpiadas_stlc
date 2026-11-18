# Agent Instructions — Olimpíadas Literarias de SiTeLoCuento

When interacting with Cloudflare, use the `cf` CLI unless the project has a Wrangler configuration file.

## Project Documentation Reference
- Functional Specification (Agent Reference): `docs/FUNCTIONAL_SPECIFICATION_AGENT.md`
- Technical Specification & Architecture: `docs/TECHNICAL_SPECIFICATION.md`
- Functional Guide for Organizers (Spanish): `docs/GUIA_FUNCIONAL_ORGANIZADORES.md`

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
