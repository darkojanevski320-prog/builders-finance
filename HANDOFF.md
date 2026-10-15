# HANDOFF - Current State

Read `CLAUDE.md` in Claude Code or `AGENTS.md` in Codex first. This file is the current cross-agent state for this project.

Last updated: 2026-10-15

## Current focus

Product design for the Builders Finance app. The project folder exists; no spec,
plan or code yet. Design follows the brainstorming flow: questions, approaches,
sectioned design, written spec in `docs/specs/`, then an implementation plan.

## Changed recently

- 2026-10-15: Project created from `_template`. Scope recorded in `CLAUDE.md`.

## Decisions / facts to preserve

- Separate from `../Business Finance/` (Bold Boost's own books). No shared data.
- Sample data only until a real data source is approved.
- Target customer: any small business owner, no specific industry. "Builders" is only the brand (Darko, 2026-10-15).
- Version 1: demo prototype, one sample business, realistic fake data, no login. Data model scoped per business so it can become multi-business SaaS later (Darko, 2026-10-15).
- Demo is fully editable: add expenses, create invoices, mark invoices paid, plus a reset to the sample data (Darko, 2026-10-15).

## Open questions / blockers

- Where edits are stored for a no-login demo (per visitor or shared).
- Tech stack and hosting.

## Next actions

- Answer the open questions, then approve a design and write the spec.

## Verification / commands

- None yet.
