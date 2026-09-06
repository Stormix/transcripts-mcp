---
"@transcripts-mcp/search": patch
"@transcripts-mcp/mcp": patch
---

Speed up index rebuilds and file updates by deleting messages through rowid bounds instead of scanning the transcript corpus for every file. Existing indexes require one explicit rebuild to upgrade to schema 5.

Report MCP build progress, stop indexing and embedding at cancellation checkpoints, and preserve safe SQLite error codes without exposing transcript text or database paths.
