# Anchored transcript windows design

## Decision

Add a raw-line anchor to `get_transcript` in a follow-up implementation, with opaque tokens only for continuing from a returned window. A caller starts from the `lineNumber` already returned by grep or indexed search; the server maps that source coordinate to normalized messages while streaming the session.

The existing `{ provider, id, path?, limit? }` request remains unchanged. A future request may instead provide `window`; `limit` and `window` are mutually exclusive.

```json
{
  "provider": "codex",
  "id": "session-id",
  "path": "/absolute/session.jsonl",
  "window": {
    "aroundLine": 4831,
    "before": 25,
    "after": 25,
    "expectedSource": { "mtimeMs": 1788696000000, "sizeBytes": 912340 }
  }
}
```

The response keeps the existing session fields and adds window metadata:

```json
{
  "messages": ["existing normalized message objects"],
  "messageCount": 721,
  "parseErrors": 2,
  "window": {
    "anchor": { "requestedRawLine": 4831, "found": true, "messageIndex": 604 },
    "rawBounds": { "first": 4802, "last": 4866 },
    "messageBounds": { "first": 579, "last": 629 },
    "truncated": { "before": true, "after": true },
    "previous": "opaque-token",
    "next": "opaque-token",
    "source": { "mtimeMs": 1788696000000, "sizeBytes": 912340, "verified": true },
    "totalCountAvailable": true,
    "parseErrorsInBounds": 1
  }
}
```

Continuation requests use `{ provider, id, path?, continuation }`. Tokens bind the direction, exclusive raw boundary, window size, provider/session identity, and source fingerprint. They are opaque and versioned; callers must not construct or inspect them.

## Why raw line is the initial anchor

The adapters map source lines independently, but not one-to-one. The characterization test records the same shape for all current adapters:

| Raw line | Fixture record             | Normalized position | Parse error |
| -------- | -------------------------- | ------------------- | ----------- |
| 1        | envelope/unrecognized      | —                   | no          |
| 2        | invalid JSON               | —                   | yes         |
| 3        | tool-result-only content   | —                   | no          |
| 4        | empty normalized message   | —                   | no          |
| 5        | valid conversational record | 0                   | no          |

Consequently, a normalized index cannot be inferred from a search hit without replaying every prior source record. Raw line is already present on both grep and FTS hits and remains the least surprising join key.

## Alternatives

| Shape | Search-hit ergonomics | Identity and mutation | Pagination | Decision |
| ----- | --------------------- | --------------------- | ---------- | -------- |
| `aroundLine` plus before/after | Direct: pass the hit's existing `lineNumber` | Stable only for one file revision; pair it with a fingerprint | Return opaque previous/next tokens | Recommended |
| Normalized message cursor | Requires an extra raw-to-normalized mapping step for every hit | Position shifts when earlier records normalize differently | Simple integer paging, but exposes adapter internals | Reject |
| Opaque token for the initial anchor | Search must mint and persist/return tokens, coupling search and core | Can bind identity and revision strongly | Strong continuation semantics | Reject for initial lookup; use for continuation only |

An API with separate `before` and `after` counts is clearer than overloading the existing head `limit`. The anchor message is additional, so the maximum returned count is `before + 1 + after` when the anchor maps to a message.

## Mapping and state semantics

- Raw lines are one-based, matching current search results. Normalized message indexes are zero-based and informational.
- Every physical JSONL line advances the raw coordinate. Only a successfully parsed, non-empty normalized message advances the message index.
- Schema-rejected envelopes and deliberately skipped records are not parse errors. Invalid JSON and adapter mapping exceptions are parse errors, matching `readSession` today.
- If the requested raw line is skipped but inside the file, `anchor.found` is false. The response contains up to `before` messages before and `after` messages after the raw coordinate; it never silently chooses a different anchor.
- If the raw line is beyond EOF, `anchor.found` is false, the before side may contain the final messages, the after side is empty, and `next` is null.
- `rawBounds` describe the first and last source lines that produced returned messages, not every scanned line. They are null when no messages are returned.
- `messageBounds` are present only when their indexes were computed during a complete forward scan.
- `truncated.before`/`after` mean more normalized messages exist beyond the returned side. A continuation is non-null exactly when its corresponding truncation flag is true.
- `parseErrors` remains the whole-session count. `parseErrorsInBounds` counts invalid/mapping-failed records from the first through last returned raw bound, inclusive.
- The first implementation performs one complete forward scan, preserving truthful `messageCount`, `parseErrors`, message indexes, and both truncation flags while retaining only the bounded window.

## File mutation

The source identity is `(canonical path, provider, session id, mtimeMs, sizeBytes)`. The server stats the file before and after the scan.

- If `expectedSource` is supplied and differs before reading, fail with a structured `STALE_TRANSCRIPT_SOURCE` tool error and return no messages.
- If size or modification time changes during the scan, fail with `TRANSCRIPT_CHANGED_DURING_READ` and return no partial response.
- Without `expectedSource`, the request is best-effort and the response reports `source.verified: false`; the post-read stability check still applies.
- Continuation tokens always contain a source fingerprint. Any mismatch fails with `STALE_CONTINUATION`; tokens never drift to a nearby line.
- Replacement with identical size and mtime is an acknowledged filesystem limitation. A content hash is rejected for the first version because it adds a second full-file pass or hashing work to the parsing path.

Search results should gain the same source fingerprint in the follow-up feature so callers can request verified anchors. Adding only `aroundLine` first is compatible but cannot prove that a saved hit still points at the same revision.

## Machine-testable acceptance criteria

| State | Required assertion |
| ----- | ------------------ |
| Anchor is a valid message | `found=true`; anchor occurs once at offset `beforeReturned`; count is at most `before + 1 + after` |
| Anchor is a skipped/envelope/empty record | `found=false`; no neighboring message is relabeled as the anchor |
| Anchor is invalid JSON | `found=false`; whole-session and in-bounds parse-error counts include it when bounds enclose it |
| Anchor is line 1 | no negative coordinates; `previous=null`; `truncated.before=false` |
| Anchor is after EOF | `found=false`; after side empty; `next=null` |
| Fewer neighbors than requested | returned messages preserve source order; corresponding truncation is false |
| More neighbors than requested | retained messages never exceed the requested bound; continuation and truncation are present |
| Expected fingerprint is stale | `STALE_TRANSCRIPT_SOURCE`; no session payload |
| File changes during scan | `TRANSCRIPT_CHANGED_DURING_READ`; no partial payload |
| Continuation source changed | `STALE_CONTINUATION`; no fallback to line number |
| Existing request without `window` | byte-for-byte equivalent fields and head-limit behavior to the current API |
| `limit` and `window` together | input validation error before file access |

## Follow-on implementation shape

- `packages/core/src/types.ts`: add window request/result and source-fingerprint types without changing the existing request defaults.
- `packages/core/src/adapter.ts`: add a bounded ring-buffer/read-ahead seam that tracks raw lines, normalized indexes, parse errors, and file identity in one scan.
- `packages/core/src/tests/adapter.spec.ts`: cover bounds, skipped anchors, errors, retention, EOF, and mutation races with the generic adapter.
- `packages/adapters/src/tests/raw-line-mapping.spec.ts`: retain the cross-adapter characterization fixtures added by this spike.
- `packages/search/src/types.ts`, grep normalization, and FTS row mapping: attach source fingerprint fields to hits.
- `apps/mcp/src/tools/get-transcript.ts`: validate the mutually exclusive request shapes and encode/decode continuation tokens.
- `apps/mcp/src/tests/server.spec.ts`: verify backward compatibility, errors, response metadata, and token rejection.
- `packages/contracts/src/index.ts`, README, website, and distributed skill: advertise the feature only after runtime support lands.

## Test matrix

Run each mapping case for Cursor, Claude Code, and Codex. Run window-algorithm cases once against the generic adapter plus MCP integration cases through `get_transcript`.

| Dimension | Cases |
| --------- | ----- |
| Source records | envelope, invalid JSON, tool-result-only, empty message, valid message, adapter mapping exception |
| Anchor | first line, valid middle message, each skipped record kind, final line, after EOF |
| Counts | zero before, zero after, both zero, exact available neighbors, over-request, configured maximum |
| Mutation | stale before read, append during read, truncate during read, stable unverified request |
| Continuation | previous, next, first/last page, tampered token, wrong provider/session, stale fingerprint |
| Compatibility | omitted window, explicit legacy limit, default legacy limit, limit/window conflict |

## Compatibility and migration

This is additive. Existing clients continue to receive the current session response when they omit `window` and `continuation`. New metadata is present only for windowed reads. Search fingerprint fields are additive. No persisted index migration is required if FTS resolves the current file fingerprint when returning hits; persisting a fingerprint is optional and should be justified separately.

## Performance budget

- One sequential file read and one stat before/after; no second parsing or hashing pass.
- Retained messages are `O(before + after)` and must never exceed the public maximum of 1,000 total returned messages.
- Temporary retained text should remain below the existing bounded response size plus the ring buffer; characterization tests should expose a retention observer as Plan 006 does.
- The initial implementation preserves the existing full-scan cost required for truthful total counts. A benchmark fixture of at least 64 MiB should show no more than 20% overhead versus current `readSession` on the same machine.
- If a future early-stop mode is desired, it must set `totalCountAvailable=false`, omit total-only fields, and define an explicit work budget rather than presenting partial totals as complete.

## Open maintainer questions

1. Should unverified `aroundLine` requests be allowed, or should search fingerprints be required from the first release?
2. Should a skipped anchor return surrounding messages as designed, or fail with a dedicated `ANCHOR_NOT_A_MESSAGE` error?
3. Is mtime plus size sufficient for local transcripts, or is a rolling content identity worth its added I/O?
4. Should continuation tokens be process-local signed values or portable versioned base64url payloads? Either way, malformed or tampered tokens must fail closed.

This spike does not add the public inputs, response fields, or documentation claims described above.
