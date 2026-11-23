# Contributing to Olimpíadas Literarias

Thank you for your interest in contributing to **Olimpíadas Literarias**!

## Local Development Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/dalexmuro/olimpiadas_stlc.git
   cd olimpiadas_stlc
   npm install --legacy-peer-deps
   ```
2. Copy `.env.example` to `.env` and fill in your local development values (never commit `.env`).
3. Apply local Cloudflare D1 migrations and seed data:
   ```bash
   npm run db:migrate:local
   npm run db:seed:local
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Branching & Pull Requests

- Target `dev` for new features and fixes (`main` is reserved for production releases).
- Keep PRs focused, well-scoped, and accompanied by unit tests.
- Follow the **Editorial Ámbar SiTeLoCuento** visual design tokens defined in `src/app/tokens.css`, `src/app/base.css`, and `src/app/globals.css`.

## Verification Checklist (Required Before Opening a PR)

All checks below run automatically in GitHub Actions (`.github/workflows/ci.yml`) and must pass with zero errors:

```bash
npm run typecheck
npm run lint
npm test
```

## Documentation

When changing architecture, database schema, or user-facing workflows, please update the corresponding English and Spanish documentation in `docs/` (`README.md` / `README.es.md`).
