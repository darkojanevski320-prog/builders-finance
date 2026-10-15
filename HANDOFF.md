# HANDOFF - Current State

Read `CLAUDE.md` in Claude Code or `AGENTS.md` in Codex first. This file is the current cross-agent state for this project.

Last updated: 2026-10-15

## Current focus

Product design for the Builders Finance app, in the brainstorming phase. No spec,
plan or code yet. Four scoping decisions are made (below). One question is waiting
on Darko: where demo edits are stored, which also sets the stack.

Design flow still to run, in order:

1. Darko answers the storage and stack question.
2. Propose 2 to 3 approaches with trade-offs and a recommendation.
3. Present the design in sections (screens, data model, data flow, sample data
   generator, error handling, testing) and get approval after each one.
4. Write the spec to `docs/specs/2026-10-DD-builders-finance-design.md`, self-review it,
   commit it, and have Darko review it.
5. Write the implementation plan in `docs/plans/`. No app code before the plan is approved.

## Changed recently

- 2026-10-15: Project created from `_template` and registered in `../PROJECTS.md`.
  Local git repo initialized (no remote). Scope and decisions recorded in `CLAUDE.md`
  and here. The brainstorming session ran from the workspace root and stopped here
  so work continues from this folder.

## Decisions / facts to preserve

- Separate from `../Business Finance/` (Bold Boost's own books). No shared data.
- Sample data only until a real data source is approved.
- Target customer: any small business owner, no specific industry. "Builders" is only the brand (Darko, 2026-10-15).
- Version 1: demo prototype, one sample business, realistic fake data, no login. Data model scoped per business so it can become multi-business SaaS later (Darko, 2026-10-15).
- Demo is fully editable: add expenses, create invoices, mark invoices paid, plus a reset to the sample data (Darko, 2026-10-15).
- No workspace-wide stack convention exists. Darko's other dashboards
  (Instagram Outreach Automation, Influencers Infra) use Cloudflare Pages and Supabase.

## Open questions / blockers

- **Waiting on Darko: where do demo edits live?** Options presented 2026-10-15:
  - **Each visitor's browser (recommended):** static Vite + React + TypeScript app on
    Cloudflare Pages. A seeded generator creates 12 to 18 months of income, expenses
    and invoices; edits persist in the visitor's browser storage; Reset regenerates.
    Visitors never see each other's changes; no server or database to run. All data
    access goes through one repository interface so a Supabase repository can replace
    it for the SaaS version without touching the dashboard.
  - **Shared Supabase database:** Next.js plus Supabase from day one. Closer to final
    SaaS, but every visitor edits the same business, so it needs a scheduled reset and
    a hosted database for a no-login demo.
- Hosting accounts (2026-10-15): Darko created new accounts only for this project and
  chose Vercel plus Supabase, which points to the shared Supabase option above. Confirm
  this in the design step.
  - GitHub: `darkojanevski320-prog` (id 343090160). Not `boldboost` or `aifactory-ad`,
    which are also signed in to `gh` on this Mac.
  - Vercel: `darkojanevski320-prog`.
  - Supabase: org `Builders` (`dvzixbhxklrpogrjchry`), project `Builders` already exists
    in `eu-west-1`.
  - Tokens live in `.env.accounts.local` (gitignored, mode 600) as `GH_TOKEN`,
    `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`. Load them per command
    (`set -a; source .env.accounts.local; set +a`) so the old global logins stay untouched.
    Never print or commit them.
- GitHub remote: not created. Ask Darko before running `gh repo create`.

## Next actions

- Get Darko's answer to the storage question, then continue the design flow above.

## Verification / commands

- None yet.
