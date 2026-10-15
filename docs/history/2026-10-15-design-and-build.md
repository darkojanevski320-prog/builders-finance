# 2026-10-15: Design and version 1 build

Built live on the podcast in one session with Claude Code.

## Design flow

1. Scope set: income and expense analysis, invoice status, overall financial health, filters, date ranges.
2. Target customer: any small business owner. Version 1 is a no-login demo with one sample business.
3. Storage compared (per-visitor sandbox, shared business, browser storage). Chosen: a private sandbox per
   visitor through Supabase anonymous sign-in.
4. Seven design sections approved one at a time: architecture, screens, data model, data flow, sample data,
   error handling, testing.
5. Spec written and approved: `docs/specs/2026-10-15-builders-finance-design.md`.
6. Implementation plan written and approved: `docs/plans/2026-10-15-builders-finance-v1.md` (17 tasks).
   Executed natively in one session.

## Build result

- Live demo: https://builders-finance.vercel.app
- Tests: 166 unit tests (Vitest), 61 database tests (pgTAP), 6 browser tests (Playwright), production smoke test.
- CI on GitHub Actions runs all tests, applies migrations to the live Supabase project, deploys to Vercel,
  and runs the smoke test on every push to `main`.

## Decisions made during the build

- Next.js 16.4 scaffold differences: Tailwind runs through `@tailwindcss/turbopack` (no PostCSS file); the
  scaffold's Cache Components and partial prefetching are turned off because every route reads the session;
  the error boundary prop is `retry`; `typecheck` runs `next typegen` first.
- Sample data payroll is sized from generated income so the margin lands between 15% and 25% for any date.
- Forms validate in the browser with the same Zod schemas the server uses.
- The Vercel project framework had to be set to Next.js through the API; `vercel project add` leaves it empty.
- `supabase db push` works with the access token alone (CLI login role); no database password is stored.
