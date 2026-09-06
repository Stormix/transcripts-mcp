# transcripts-mcp

Search your Cursor, Claude Code, and Codex conversations from any MCP client.

The server reads session transcripts already on your machine. Browse recent sessions, retrieve a conversation, or search across tools with fuzzy, full-text, and optional semantic search.

## Setup

Requires Node.js 24 or later. Add this configuration to your MCP client:

```json
{
  "mcpServers": {
    "transcripts": {
      "command": "npx",
      "args": ["-y", "transcripts-mcp"]
    }
  }
}
```

The npm launcher uses a platform binary with grep and full-text search. If the binary is unavailable, it looks for Bun on `PATH`.

For semantic search, use `bunx --bun transcripts-mcp` as the launch command. The first semantic index build downloads a model; embeddings are computed locally.

If `search_transcripts` reports `INDEX_REBUILD_REQUIRED` after a server upgrade, run `build_index` with `full: true`. This replaces only the local search cache, not source transcripts. Rebuild with `semantic: true` to recreate embeddings. Give concurrently running incompatible server versions separate `TRANSCRIPTS_MCP_INDEX` paths.

The server does not modify transcripts. Search results are returned to your MCP client, which handles them according to its own settings.

See the [README](https://github.com/Stormix/transcripts-mcp#readme) for client-specific setup, tool reference, and configuration. Development instructions are in [CONTRIBUTING.md](https://github.com/Stormix/transcripts-mcp/blob/main/CONTRIBUTING.md).

## License

[MIT](https://github.com/Stormix/transcripts-mcp/blob/main/LICENSE)
