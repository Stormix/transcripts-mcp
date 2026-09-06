# @transcripts-mcp/core

## 0.1.0

### Minor Changes

- 88dad9b: Add transcript types, JSONL streaming helpers, `defineJsonlAdapter`, and the adapter registry.

### Patch Changes

- 0b85282: Restrict native grep to each adapter's declared session files.
- 62f2eca: Read session working directories and timestamps when transcripts start with metadata rather than a message.
- d2c49b0: Fix session summaries, titles, and working-directory filters. Rebuild the search index after upgrading.
- 41215ae: Reject transcript paths outside the adapter's allowed session files.
- 62f2eca: Keep searching for grep results when matching lines cannot be parsed as messages.
- f78ec4b: Restrict indexed search results to available providers and their current transcript folders.
- 1150f88: Limit the messages retained while reading a transcript, while still counting every message.
- ba652a0: Convert grep byte offsets to line numbers without repeatedly reading the start of the file.
