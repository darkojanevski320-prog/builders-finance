# Builders Finance

A finance app for small businesses. An owner sees money coming in and going out,
which invoices are due or overdue, and the overall financial health of the business
on one dashboard with filters and date ranges. Status: design phase, no app code yet.

## Start here

Read `HANDOFF.md` for current work. Load only the references needed for the task.
This is the canonical project guide; `AGENTS.md` is a short Codex adapter.

## Project requirements

- Product scope (from Darko, 2026-10-15):
  - Income and outbound expenses analysis.
  - Invoices that are due, and their status.
  - Overall financial situation, with filters, date ranges and a finance dashboard.
- Target customer: any small business owner, no specific industry. "Builders" is the brand only.
- Version 1 is a demo prototype: one sample business, fake data, no login. Scope every
  record to a business so multi-business SaaS needs no rewrite.
- The demo is editable: add expenses, create invoices, mark paid, reset to sample data.
- This is a product for other businesses. It is separate from `../Business Finance/`
  (Bold Boost LLC's own ledger) and `../Digital Corner Bookkeeping/` (the Dutch BV).
  Do not read or copy their real financial data into this project.
- Built live on Darko's podcast (from Darko, 2026-10-15). The public GitHub repo is the
  deliverable for viewers: anyone must be able to clone it and run or deploy their own
  copy on their own Vercel and Supabase. Keep setup documented and reproducible, and
  never show tokens or secrets on screen or in the repo.
- Use only generated sample data until a real data source is approved.
- No feature in this app moves money.
- Design before code: the approved spec lives in `docs/specs/`, the plan in `docs/plans/`.

## Working commands and sources

Run `npm run db:start` and `npm run env:local` once per session for local work.

| Command | Purpose |
|---|---|
| `npm run dev` | App on http://localhost:3000 |
| `npm test` | Unit tests |
| `npm run test:db` | pgTAP database tests (local Supabase) |
| `npm run test:e2e` | Playwright tests (local Supabase) |
| `npm run lint && npm run typecheck` | Static checks |

| Task | Read or use |
|---|---|
| Current work | `HANDOFF.md` |
| Product design | `docs/specs/2026-10-15-builders-finance-design.md` (approved) |
| Implementation plan | `docs/plans/2026-10-15-builders-finance-v1.md` (approved, executing) |

## Continuity

- Current work and blockers belong in `HANDOFF.md`; update them rather than append a full session log.
- Completed sessions belong in dated history files; durable lessons belong in project references.
- Use existing folders. Create a new knowledge/history subfolder only when content needs it.
- Reference shared conventions where applicable; do not copy them into this file.
- Keep this map short, generally about 50 lines. Move detailed operations into task references.
