# HANDOFF - Current State

Read `CLAUDE.md` in Claude Code or `AGENTS.md` in Codex first. This file is the current cross-agent state for this project.

Last updated: 2026-10-15

## Current focus

The spec is approved (`docs/specs/2026-10-15-builders-finance-design.md`). The
implementation plan is written: `docs/plans/2026-10-15-builders-finance-v1.md`, 17 tasks
from scaffold to live deploy and launch cleanup. Waiting on Darko to review it and pick
an execution method. No app code yet.

Design flow still to run, in order:

1. Done: storage and stack chosen (sandbox per visitor, Next.js, Vercel, Supabase).
2. Done: approaches compared.
3. Done: present the design in sections (screens, data model, data flow, sample data
   generator, error handling, testing) and get approval after each one.
4. Done: spec written, reviewed and approved by Darko (2026-10-15).
5. Done: implementation plan written. Waiting: Darko reviews it and picks subagent-driven
   or native execution. No app code before the plan is approved.

## Changed recently

- 2026-10-15: Project created from `_template` and registered in `../PROJECTS.md`.
  Local git repo initialized. Scope and decisions recorded in `CLAUDE.md`
  and here. The brainstorming session ran from the workspace root and stopped here
  so work continues from this folder.

## Decisions / facts to preserve

- Separate from `../Business Finance/` (Bold Boost's own books). No shared data.
- Sample data only until a real data source is approved.
- Target customer: any small business owner, no specific industry. "Builders" is only the brand (Darko, 2026-10-15).
- Version 1: demo prototype, one sample business, realistic fake data, no login. Data model scoped per business so it can become multi-business SaaS later (Darko, 2026-10-15).
- Demo is fully editable: add expenses, create invoices, mark invoices paid, plus a reset to the sample data (Darko, 2026-10-15).
- Storage (Darko, 2026-10-15): private sandbox per visitor. Supabase anonymous sign-in,
  each visitor gets a copy of the sample business, RLS per business, Reset regenerates,
  nightly cleanup of old sandboxes. Stack: Next.js on Vercel plus Supabase, TypeScript.
- Built live on the podcast; the public repo is the viewer deliverable. MIT license.
  Remove references to Darko's other projects from repo docs before launch (Darko, 2026-10-15).
- No workspace-wide stack convention exists. Darko's other dashboards
  (Instagram Outreach Automation, Influencers Infra) use Cloudflare Pages and Supabase.

## Open questions / blockers

- **Waiting on Darko:** review of the implementation plan and choice of execution method.

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
- GitHub remote: public repo https://github.com/darkojanevski320-prog/builders-finance
  (created 2026-10-15). This repo commits as `Darko Janevski
  <343090160+darkojanevski320-prog@users.noreply.github.com>` and pushes with the token
  through a repo-local credential helper. Never commit with `darko@boldboost.us`.

## Next actions

- After Darko approves the plan, execute it task by task (Task 1 first: scaffold).
  Docker Desktop must be running from Task 5 on.

## Verification / commands

- None yet.
