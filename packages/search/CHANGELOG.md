# @transcripts-mcp/search

## 0.1.0

### Minor Changes

- 88dad9b: Add grep, FTS5, optional semantic search, and combined keyword and semantic ranking.

### Patch Changes

- 33fcf56: Reduce CPU and memory use for filtered vector searches without changing result rankings.
- c92a265: Return semantic matches when closer vectors are excluded by filters.
- 0b85282: Restrict native grep to each adapter's declared session files.
- c92a265: Preserve a file's indexed messages and embeddings if reindexing fails.
- b3daf72: Batch semantic indexing to reduce memory use and database writes.
- d2c49b0: Fix session summaries, titles, and working-directory filters. Rebuild the search index after upgrading.
- 336d696: Return `INDEX_REBUILD_REQUIRED` when the local index needs an upgrade, with instructions to rebuild it.
- 62f2eca: Restore semantic search when reopening an existing index.
- a70e5fd: Mark semantic search as ready only after all current messages have embeddings.
- 62f2eca: Keep searching for grep results when matching lines cannot be parsed as messages.
- f78ec4b: Restrict indexed search results to available providers and their current transcript folders.
- 1150f88: Limit fallback grep scans and return errors when a scan exceeds those limits.
- e2de125: Apply the same date filters to keyword and semantic search.
- b68011e: Speed up index rebuilds and file updates. Let callers track progress and cancel indexing or embedding. Run `build_index` with `full: true` once to upgrade existing indexes to schema 5.
- ba652a0: Convert grep byte offsets to line numbers without repeatedly reading the start of the file.
- c92a265: Fix native grep when providers store transcripts in different folders.

### Dependencies

- `@transcripts-mcp/core@0.1.0`
- `@transcripts-mcp/contracts@0.0.1`
