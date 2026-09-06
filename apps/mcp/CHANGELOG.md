# @transcripts-mcp/mcp

## 0.1.0

### Minor Changes

- 88dad9b: Add a stdio MCP server with tools to list, read, and search transcripts and build the search index.

### Patch Changes

- 336d696: Return `INDEX_REBUILD_REQUIRED` when the local index needs an upgrade, with instructions to rebuild it.
- 1150f88: Limit fallback grep scans and messages returned by `get_transcript`. Report scan-limit errors and the full message count when a response is truncated.
- e2de125: Apply the same date filters to keyword and semantic search.
- b68011e: Speed up index rebuilds and file updates. Add build progress notifications and cancellation support. Include SQLite error codes without exposing transcript text or database paths. Run `build_index` with `full: true` once to upgrade existing indexes to schema 5.

### Dependencies

- `@transcripts-mcp/search@0.1.0`
- `@transcripts-mcp/core@0.1.0`
- `@transcripts-mcp/adapters@0.1.0`
- `@transcripts-mcp/contracts@0.0.1`
