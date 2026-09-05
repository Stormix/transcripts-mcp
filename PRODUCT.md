# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A developer who already uses Cursor, Claude Code, or Codex. They want the next session to find something from an earlier one. The agent is the tool caller; the human is the one who cares.

Not a team product, not an adapter-authoring product, not a place to store new sessions.

## Product Purpose

transcripts-mcp lets an MCP client list, open, and search session transcripts those tools already write to disk.

Success is: after a one-time config, the current session can find a past session, open it, or search across them. That is searchable transcript text, not the previous session's memory. The other tool still has to read.

## Positioning

The files are already there. This server reads them. It does not create sessions, does not keep chat memory, and is not a cloud product.

A neighboring MCP server could list tools or search the web. It could not truthfully claim to search Cursor, Claude Code, and Codex transcripts already on this machine without doing this job.

## Operating Context

Configured once in the client's MCP file, then used from inside a session:

- Cursor: `~/.cursor/mcp.json`
- Claude Code: `~/.claude.json`
- Codex: `~/.codex/config.toml`

Transcripts live under `~/.cursor`, `~/.claude`, and `~/.codex` (overridable via `CURSOR_HOME`, `CLAUDE_HOME`, `CODEX_HOME`). Ranked search uses an optional index at `~/.transcripts-mcp/index.db` (`TRANSCRIPTS_MCP_INDEX`).

The marketing site is `apps/www`, live at https://transcriptsmcp.dev/. The Cursor plugin is `distribution/plugin`. The published package is `transcripts-mcp` on public npm, so `npx transcripts-mcp` needs no registry flag and no token.

New marketing and UI surfaces are designed in Pencil (`.design/*.pen`) via the Pencil MCP, then implemented in `apps/www`.

## Capabilities and Constraints

Six tools: `list_providers`, `list_sessions`, `get_transcript`, `grep_transcripts`, `search_transcripts`, `build_index`.

Three search paths: grep on the raw files (no index), ranked full-text after `build_index`, semantic/hybrid after `build_index` with semantic on.

Confirmed facts future work must not contradict:

- Providers today are Cursor, Claude Code, and Codex.
- Grep works immediately; ranked search needs an index.
- The recommended install is `npx transcripts-mcp` (or `bunx --bun transcripts-mcp`). From-source launch is `bun apps/mcp/src/index.ts`, for contributors.
- Semantic/hybrid search only works when the server runs under Bun; the npx platform binary cannot embed `sqlite-vec` or the ONNX engine.
- MIT licensed.

Undecided: other harnesses, public npm, pricing, hosted anything.

## Brand Commitments

- Name: `transcripts-mcp`
- License: MIT
- Voice: dry and concrete. Name the action. Do not sell Bun, SQLite, or "no network". Do not use ALL-CAPS section labels or privacy theater as headlines.
- Hero line in use: "Search your Cursor, Claude Code, and Codex sessions." The earlier "Every session is still on disk." was rejected for describing the file system instead of the user's job.
- Logo: `apps/www/public/favicon.svg` and `.design/exports/transcripts-mcp-icon.svg`

## Evidence on Hand

- README "What you can ask" examples (not testimonials)
- Marketing site copy in `apps/www/src/lib/site.ts` and section components
- Hero session preview in `apps/www/src/components/session-preview.tsx` is a constructed demo, not a captured session
- Design source: `.design/landing.pen`

Do not invent customers, quotes, usage numbers, benchmarks, or press.

## Product Principles

1. Search files that already exist. Do not invent a store or a memory.
2. The human is the user; the agent is the caller.
3. Copy names the action, not the runtime.
4. One command in three clients. Grep first; index when ranking matters.
