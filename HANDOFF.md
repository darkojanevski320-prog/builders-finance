# HANDOFF - Current State

Read `CLAUDE.md` in Claude Code or `AGENTS.md` in Codex first. This file is the current cross-agent state for this project.

Last updated: 2026-10-15

## Current focus

Version 1 is live at https://builders-finance.vercel.app and the public repo is ready for
viewers. Every push to `main` runs the full test suite, applies database migrations to the
live Supabase project, deploys to Vercel, and runs a smoke test.

## Changed recently

- 2026-10-15: Designed, planned, and built version 1 in one session. Details in
  `docs/history/2026-10-15-design-and-build.md`.

## Decisions / facts to preserve

- Sample data only until a real data source is approved. No feature moves money.
- Target customer: any small business owner, no specific industry. "Builders" is only the brand (Darko, 2026-10-15).
- Version 1: no-login demo, one sample business per visitor, data model scoped per business so it can
  become multi-business SaaS later (Darko, 2026-10-15).
- Storage: private sandbox per visitor through Supabase anonymous sign-in, RLS per business, Reset
  regenerates, nightly `pg_cron` cleanup after 7 days (Darko, 2026-10-15).
- Built live on the podcast; the public repo is the viewer deliverable. MIT license (Darko, 2026-10-15).
- Accounts used only for this project:
  - GitHub `darkojanevski320-prog`, repo https://github.com/darkojanevski320-prog/builders-finance.
    Commits use `Darko Janevski <343090160+darkojanevski320-prog@users.noreply.github.com>`; pushes use
    the token through a repo-local credential helper. Other GitHub accounts may be signed in to gh on the
    maintainer's Mac; always load the token file.
  - Vercel project `builders-finance` (team `builders-5acf`), production domain `builders-finance.vercel.app`.
  - Supabase org `Builders`, project ref `vfiegeptxcplngqslmwb` in `eu-west-1`.
- Tokens live in `.env.accounts.local` (gitignored, mode 600) as `GH_TOKEN`, `VERCEL_TOKEN`,
  `SUPABASE_ACCESS_TOKEN`. Load them per command (`set -a; source .env.accounts.local; set +a`). Never
  print or commit them. GitHub Actions has its own copies as repo secrets.
- `.env.production.local` (gitignored) holds the live Supabase URL and publishable key; `.env.local`
  points at local Supabase for development.

## Open questions / blockers

- None.

## Next actions

- Small fixes the final review deferred (none block the demo):
  - Client names that differ only in inner spacing create a second client.
  - After the 1-hour token lifetime, an expired visitor sees plain `/welcome` without the expired notice.
  - An invoice above $1B saves but cannot be marked paid; add a total limit to the invoice schema.
  - A custom date range has no maximum span; cap it (for example 10 years).
  - `fetchAll` assumes Supabase `max_rows` is at least 1000.
  - CI hardening: add a `permissions` block, pin actions by SHA, pass `PRODUCTION_URL` through `env`.
  - `app/welcome/actions.ts` calls Supabase directly instead of through `lib/data`.
- Possible features: real accounts (email sign-in replacing anonymous), more than one member per
  business, PDF invoices, dark mode.

## Verification / commands

- Local: `npm run db:start`, `npm run env:local`, then `npm run dev`.
- Tests: `npm test`, `npm run test:db`, `npm run test:e2e`, `npm run lint && npm run typecheck`.
- Live: `npm run smoke -- https://builders-finance.vercel.app`.
