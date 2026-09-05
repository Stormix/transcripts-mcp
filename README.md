# transcripts-mcp

Local stdio MCP server that queries Cursor, Claude Code, and Codex session transcripts already on disk.

## Requirements

- [Bun](https://bun.sh) >= 1.2
- [pnpm](https://pnpm.io)

## Install

```bash
pnpm install
```

## Launch

```bash
bun apps/mcp/src/index.ts
```

or:

```bash
pnpm --filter @transcripts-mcp/mcp start
```

stdout is the JSON-RPC channel. Logs go to stderr.

## Cursor `mcp.json`

```json
{
  "mcpServers": {
    "transcripts": {
      "command": "bun",
      "args": ["/path/to/transcripts-mcp/apps/mcp/src/index.ts"]
    }
  }
}
```

Use an absolute path to `apps/mcp/src/index.ts`. Windows paths work (`V:/dev/transcripts-mcp/apps/mcp/src/index.ts` or `V:\\dev\\...`).

## Environment

| Variable                | Default                       |
| ----------------------- | ----------------------------- |
| `CURSOR_HOME`           | `~/.cursor`                   |
| `CLAUDE_HOME`           | `~/.claude`                   |
| `CODEX_HOME`            | `~/.codex`                    |
| `TRANSCRIPTS_MCP_INDEX` | `~/.transcripts-mcp/index.db` |

## Tools

| Tool                 | Inputs                                                                                                                              | What it does                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `list_providers`     | (none)                                                                                                                              | Harnesses on this machine, with availability and a capped session file count                      |
| `list_sessions`      | `provider?`, `cwd?`, `since?`, `until?`, `limit?` (1–200, default 50)                                                               | Session summaries, newest first. `since` / `until` are ISO-8601. Does not return full transcripts |
| `get_transcript`     | `provider`, `id`, `path?`, `limit?` (1–1000, default 200)                                                                           | Normalized messages for one session                                                               |
| `grep_transcripts`   | `query`, `mode?` (`plain` \| `regex` \| `fuzzy`, default `fuzzy`), `provider?`, `limit?` (1–200, default 50)                        | Fuzzy / plain / regex over raw JSONL, then adapter-normalized. No index required                  |
| `search_transcripts` | `query`, `mode?` (`fts` \| `hybrid`, default `fts`), `provider?`, `role?`, `cwd?`, `since?`, `until?`, `limit?` (1–100, default 20) | BM25-ranked search over the FTS5 index. `hybrid` after a semantic build                           |
| `build_index`        | `full?`, `semantic?`                                                                                                                | Build or refresh the FTS5 index. `full: true` rebuilds from scratch. `semantic: true` also embeds |

Provider ids: `cursor`, `claude-code`, `codex`.

## Search tiers

1. **grep** (`grep_transcripts`) — `@ff-labs/fff-bun` fuzzy / plain / regex. No index. Falls back to a streaming scan if the native binary fails to load.
2. **FTS5** (`search_transcripts`, `mode: "fts"`) — `bun:sqlite` + `bm25()` over normalized message text. Requires `build_index`.
3. **semantic** (optional) — `build_index` with `semantic: true` downloads ~23 MB ONNX (`all-MiniLM-L6-v2`) on first run. Then `search_transcripts` accepts `mode: "hybrid"` (BM25 + vectors, reciprocal rank fusion). The server works without this tier.

## Safety

Read-only on transcripts. The only write is the search index at `~/.transcripts-mcp/index.db` (or `TRANSCRIPTS_MCP_INDEX`).

## Workspace

- `apps/mcp` — stdio server, tool registration, adapter wiring
- `packages/core` — types, adapter contract, jsonl reader, registry
- `packages/adapters` — Cursor, Claude Code, Codex
- `packages/search` — grep (fff), FTS5, optional semantic search

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a harness.

> **AI-Assisted Contributions:** We welcome AI-assisted contributions! Please review our [AI Policy](./AI_POLICY.md) for guidelines on disclosure and quality expectations.

## License

MIT
