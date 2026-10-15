# Codex entry point

Read [CLAUDE.md](CLAUDE.md), the canonical project instructions, then `HANDOFF.md`.
Load only task-relevant references and memory. Current user decisions take precedence.
Use available Codex tools for Claude-specific names; do not assume shared authentication.
Respect the global skill configuration. Historical references do not reactivate paused skills.
Keep this adapter short; shared project facts belong in the canonical file.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
