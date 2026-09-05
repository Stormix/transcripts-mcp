---
name: transcript-search
description: Search local Cursor, Claude Code, and Codex session transcripts. Use when looking up past agent sessions, choosing grep vs ranked search, building the search index, dumping a session by id, or scoping by cwd and provider.
---

# Transcript search

Query sessions already on disk. Nothing is uploaded. Six tools, three intended search tiers.

## Tools

| Tool                 | Role                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `list_providers`     | Which harnesses are on this machine, with availability and a capped session file count           |
| `list_sessions`      | Session summaries, newest first. Filter by provider, cwd, since, until. Does not return messages |
| `get_transcript`     | Normalized messages for one session                                                              |
| `grep_transcripts`   | Immediate scan of raw JSONL. No index                                                            |
| `search_transcripts` | Ranked search over the FTS5 index                                                                |
| `build_index`        | Build or refresh that index                                                                      |

Provider ids: `cursor`, `claude-code`, `codex`.

## Grep vs search

Use `grep_transcripts` when you need a hit now and have no index, or when you want a literal, regex, or fuzzy scan of raw JSONL.

- `query` (required)
- `mode`: `plain` \| `regex` \| `fuzzy` (default `fuzzy`)
- `provider?`, `limit?` (1–200, default 50)

Grep does not take `cwd`. Scope it with `provider`, then open the matching session.

Intended grep engine is `@ff-labs/fff-bun` (fuzzy / plain / regex). If the native binary is unavailable, the server falls back to a streaming scan. Do not assume the native engine is present in every install.

Use `search_transcripts` when you want BM25-ranked results over normalized message text, or filters grep does not have (`cwd`, `role`, `since`, `until`).

- Requires `build_index` first
- `mode`: `fts` (default) or `hybrid`
- `hybrid` requires a later `build_index` with `semantic: true`

## Index

`search_transcripts` reads the local FTS5 index (`~/.transcripts-mcp/index.db`, overridable via `TRANSCRIPTS_MCP_INDEX`).

1. Call `build_index` before the first FTS search. Incremental is the default; `full: true` rebuilds from scratch.
2. Call `build_index` again with `semantic: true` before `mode: "hybrid"`. First semantic build downloads ~23 MB ONNX (`all-MiniLM-L6-v2`).

The server works without the semantic tier. Hybrid is optional. Do not assume embeddings are available until a semantic build succeeds; they are not guaranteed in every published binary.

## Session id to transcript

Hits from `grep_transcripts` and `search_transcripts` include `provider`, `sessionId`, and `path`. `list_sessions` returns the same `id`, `provider`, and `path`.

Call `get_transcript` with:

- `provider` (required)
- `id` (the session id)
- `path?` (pass it when you have it)
- `limit?` (1–1000, default 200)

`list_sessions` returns summaries only. Dump the session with `get_transcript`.

## Scope

- Call `list_providers` first when you do not know what is installed.
- Pass `provider` on `list_sessions`, `grep_transcripts`, and `search_transcripts` to stay on one harness (`cursor`, `claude-code`, or `codex`).
- Pass `cwd` on `list_sessions` and `search_transcripts` to stay in the current project. Grep has no cwd filter — open the matching session instead.

## Search tiers

1. **grep** — `grep_transcripts`. No index. Native fuzzy/plain/regex when available; otherwise a streaming scan.
2. **FTS5** — `search_transcripts` with `mode: "fts"`. Requires `build_index`.
3. **semantic** (optional) — `build_index` with `semantic: true`, then `search_transcripts` with `mode: "hybrid"` (BM25 + vectors, reciprocal rank fusion).

The published platform binary has native fff grep and FTS5. Semantic/hybrid needs the Bun in-process path (`bunx --bun` or `bun apps/mcp/src/index.ts`). If native fff fails to load, grep falls back to a streaming scan.
