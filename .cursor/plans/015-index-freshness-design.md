# Explicit index freshness design

## Decision

Add an explicit, read-only index status operation before considering any automatic refresh. Status has two modes:

- `cached`: reads persisted build/scope/generation metadata only and never scans transcript roots. It is fast but may report source freshness as `unknown`.
- `scan`: compares the active roots with indexed file metadata under a caller-visible time budget. It reports `current` only after a complete scan; partial or inaccessible scans report `unknown`, never clean.

Do not refresh on startup or before ordinary search. The measured large unchanged incremental-build proxy takes about one second at 2,048 session files, over 100 times the current reopen-and-search cost. Semantic refresh remains a separate explicit build because it can download a model and has a materially different cost/failure domain.

This spike changes no runtime behavior. A follow-up should present the proposed contract for maintainer approval and update the canonical MCP contract only when implementation is authorized.

## Measured evidence

Command: `pnpm bench --samples 3 --output bench-results/freshness-plan-015` on Bun 1.4.0, Windows x64, AMD Ryzen 7 7700X. Each row has one discarded warm-up and three measured rounds. Values are median ± median absolute deviation; p95 is the slowest of the three round averages. Filesystem caches were not flushed.

| Operation | Median ± MAD | p95 | Correctness assertion |
| --------- | ------------: | --: | --------------------- |
| Cached open + FTS query | 7.545 ± 0.180 ms | 8.152 ms | 20 expected hits |
| Existing unchanged scan, 32 × 128-message sessions | 22.358 ± 0.361 ms | 22.719 ms | 0 indexed, 32 skipped |
| Unchanged incremental index, 8 one-message sessions | 5.716 ± 0.166 ms | 7.379 ms | 0 indexed, 8 skipped |
| Unchanged incremental index, 128 one-message sessions | 53.742 ± 1.888 ms | 57.334 ms | 0 indexed, 128 skipped |
| Unchanged incremental index, 2,048 one-message sessions | 837.031 ± 2.750 ms | 839.780 ms | 0 indexed, 2,048 skipped |
| Full index, 32 sessions / 4,096 messages | 257.309 ± 33.836 ms | 307.988 ms | 32 files, 4,096 messages |
| Reindex one appended session | 38.511 ± 1.556 ms | 40.066 ms | 1 file reindexed |
| Semantic build with fake engine, 4,097 messages | 408.191 ± 10.288 ms | 436.550 ms | all rows embedded in bounded batches |

The unchanged measurements exercise the complete current incremental `buildIndex` path: writable database open/bookkeeping plus `listSessions` directory walking, file stats, and adapter head/tail summary reads, but no message reindexing. They are conservative upper-bound proxies for a future read-only scan, not measurements of that unimplemented API. Full and appended builds provide the separate reindex comparison. The fake semantic number excludes model loading, downloads, and real inference, so it proves bounded orchestration but is not a production semantic latency estimate.

Observed unchanged-build proxy cost is roughly proportional to session-file count, not message count. Even if a read-only implementation removes some bookkeeping, the roughly 837 ms large-case result makes mandatory scanning too risky without measuring that implementation directly. It rules out unconditional startup or pre-search checks under a 100 ms interactive budget at this stage.

## Proposed status contract

The future read-only operation should return no canonical roots or transcript paths:

```json
{
  "checkedAt": "2026-09-06T16:20:00.000Z",
  "scope": {
    "id": "opaque-local-scope-id",
    "matchesIndexedScope": true,
    "providerCount": 3
  },
  "scan": {
    "mode": "scan",
    "state": "complete",
    "checkedFiles": 128,
    "durationMs": 55
  },
  "freshness": {
    "state": "stale",
    "changedFiles": 2,
    "deletedFiles": 1
  },
  "fts": {
    "buildState": "idle",
    "generation": 12,
    "lastSuccessfulBuildAt": "2026-09-06T15:00:00.000Z"
  },
  "semantic": {
    "availability": "stale",
    "buildState": "idle",
    "generation": 11,
    "ftsGeneration": 12,
    "lastSuccessfulBuildAt": "2026-09-06T14:00:00.000Z"
  }
}
```

### State vocabulary

`scan.state` is `not-run`, `complete`, `budget-exhausted`, or `unavailable`. `freshness.state` is:

- `uninitialized`: no successful FTS generation exists.
- `current`: a complete active-scope scan matches the committed FTS generation.
- `stale`: a complete scan found added, changed, or deleted files, or the active scope differs.
- `unknown`: no complete scan can establish source freshness.

`fts.buildState` is independently `idle`, `building`, or `failed`; the last failure category may be present while freshness remains `stale` or `unknown`. Readers continue using the last committed generation during a build or after failure.

`semantic.availability` is `disabled`, `current`, `stale`, or `incomplete`, while `semantic.buildState` is independently `idle`, `building`, or `failed`. Semantic availability is `current` only when its complete generation equals the committed FTS generation. A newer FTS generation immediately makes the prior semantic generation stale; hybrid search must follow Plan 004's complete-only behavior and fall back rather than mix generations.

`current` is valid only in the response that performed a complete scan. Persisted cached status returns `unknown` for source freshness even if the last scan was clean, because files may have changed since then. Persisted build failure and generation facts remain authoritative.

The opaque scope id should be derived with a database-local random key over sorted provider/canonical-root identities. This permits equality checks without disclosing root paths or enabling portable hashes of likely usernames/directories. Provider count is safe aggregate metadata; per-provider roots and file names stay internal.

## State transitions

| Event | Freshness transition | Build/semantic transition | Required observation |
| ----- | -------------- | ------------------- | -------------------- |
| First status, no index | `uninitialized` | FTS `idle`; semantic `disabled/idle` | cached and scan agree; scan may report discovered file count only |
| Successful first FTS build | any → `current` for build snapshot | FTS `building` → `idle`; semantic becomes `stale` or stays `disabled` | generation increments once after atomic commit |
| Complete unchanged scan | `unknown` → `current` | build states unchanged | 0 changed/deleted; active scope matches |
| File appended/changed | `current/unknown` → `stale` after scan | build states unchanged | changed count is nonzero; no write occurs |
| File deleted | `current/unknown` → `stale` after scan | build states unchanged | deleted count is nonzero |
| Active root switch | any → `stale` after scan | semantic availability → `stale` | opaque scope mismatch; old-root results remain excluded per Plan 005 |
| Root cannot be scanned | any → `unknown` | build states unchanged | scan state `unavailable`; never claim current |
| FTS build fails/interrupted | stays `stale/unknown` | FTS `building` → `failed`; semantic unchanged against last commit | partial generation is rolled back and not searchable |
| FTS retry succeeds | → `current` for build snapshot | FTS `failed` → `idle`; semantic availability → `stale` unless rebuilt | lease clears; generation increments once |
| Semantic build fails/interrupted | unchanged | semantic `building` → `failed`; availability is `incomplete/stale` | no partial semantic generation becomes available |
| Semantic retry succeeds | unchanged | semantic build → `idle`, availability → `current` | completeness marker and matching FTS generation commit together |

After any time passes or a new process begins without a scan, source freshness is conservatively `unknown`; the committed generation and previous failure remain observable.

## Policy comparison

| Policy | Latency | Correctness/trust | Complexity | Cross-platform behavior | Failure UX | Decision |
| ------ | ------- | ----------------- | ---------- | ----------------------- | ---------- | -------- |
| Explicit cached/scan status only | Cached near current DB-open cost; unchanged-build proxy is 6–837 ms | Never silently labels an unchecked index current; caller chooses scan/build | Small; reuses incremental metadata | Existing walk/stat path on all supported platforms | Explicit unknown/stale/busy states | Recommend first |
| Startup FTS refresh | Adds 22 ms for current fixture and ~837 ms at 2,048 files before reindex | Fresh after successful startup, but delays availability and can fail server launch | Medium | Sensitive to filesystem and antivirus startup variance | Poor: startup blocked or search begins ambiguously | Reject |
| Time-budgeted/debounced check before search | Budget bounds typical delay but a partial scan cannot prove freshness | Can label results unknown; cannot promise fresh results without completing/building | Medium-high concurrency/state machine | Timer and filesystem variance; repeated clients duplicate work | Search latency becomes workload-dependent | Defer behind explicit opt-in |
| Filesystem watcher | Fast steady-state dirty signal after initial baseline | Missed/overflow events still require rescans; watcher is not proof of cleanliness | High; lifecycle, overflow, root churn | Platform-specific semantics and limits | Background failures are hard to surface over stdio | Reject |

The smallest useful policy is explicit status. It fixes observability without adding hidden latency or work. A later, separately approved request option such as `freshness: "require-current"` may combine scan and FTS refresh, but it must be opt-in, bounded, and return `INDEX_REFRESH_REQUIRED`/`INDEX_REFRESH_BUDGET_EXCEEDED` instead of silently searching stale data. Semantic work must never be triggered by ordinary FTS search or status.

## Concurrency and idempotency

Persist `build_state`, committed FTS generation, semantic generation/completeness, last successful timestamps, and an expiring writer lease in SQLite metadata. Use `busy_timeout` plus bounded retry; do not wait indefinitely.

### Search while a build runs

```text
client A: acquire writer lease → BEGIN FTS generation 13
client B: open read snapshot → search committed generation 12
client B: response labels generation=12, freshness.state=unknown, fts.buildState=building
client A: replace changed rows → update metadata → COMMIT generation 13 → release lease
next search: reads generation 13
```

The FTS refresh is one atomic transaction. Readers never observe a half-updated corpus. If a single transaction proves operationally unacceptable, stop for a maintainer decision rather than exposing partial generations.

### Simultaneous builders and multiple MCP clients

```text
client A: atomically acquire lease(database id, owner nonce, expiry)
client B: lease acquisition fails → bounded retry → INDEX_BUSY with retryAfterMs
client A retry with same idempotency key: observe committed result or resume no work
```

The build request accepts an optional client-supplied idempotency key. Before work begins, the server stores the key with a canonical request fingerprint covering `full`, `semantic`, and the opaque active-scope identity. Completed keys map to that fingerprint and committed generation, so a client can safely retry after losing the first response. Reusing a key with different options or scope fails with `IDEMPOTENCY_KEY_REUSED`; it never returns an unrelated generation as success. Keys are scoped to the local database and validated as bounded opaque strings. A lease owner heartbeat may extend only its own unexpired nonce. Expired leases are recoverable after SQLite confirms no writer transaction remains.

### Interrupted or failed builds

- Process death rolls back the open FTS transaction. On next open, an expired `building` lease becomes `failed/interrupted`; generation remains unchanged.
- Validation, parse, or write failure rolls back all FTS corpus and file-metadata changes, records a sanitized failure category in a new short transaction, and releases the lease.
- Semantic rows are written for a proposed semantic generation and become visible only when the completeness marker and matching FTS generation commit. Failure deletes or ignores the proposed generation.
- Shutdown stops accepting new builds, allows a short grace period, then closes the database; SQLite rollback and lease expiry cover forced termination.

## Machine-checkable acceptance criteria

1. Cached status performs no root walk/stat/read and never reports source `current`.
2. A complete unchanged scan reports `current`, zero dirty/deleted files, the committed generation, and no writes to corpus tables.
3. A budget-exhausted or inaccessible scan reports `unknown` and never returns partial counts as complete.
4. Added, changed, deleted, or active-scope-switched fixtures report `stale` deterministically.
5. Status output contains no canonical root, transcript path, username, or unhashed path material.
6. Search during an FTS build returns either the entire prior generation or the entire new generation, never a mixture.
7. Two simultaneous builders produce one owner and one bounded `INDEX_BUSY` response; retrying a completed client idempotency key with the same request fingerprint returns its generation without rebuilding, while changed options or scope fail with `IDEMPOTENCY_KEY_REUSED`.
8. An interrupted FTS build leaves corpus rows, file metadata, and committed generation exactly unchanged.
9. A new FTS generation makes the previous semantic generation unavailable to hybrid search until a complete matching semantic build commits.
10. Ordinary search, startup, cached status, and scan status never download a model or compute embeddings.
11. Existing `build_index` and `search_transcripts` behavior remains unchanged until a separately approved implementation ships.

## Follow-on implementation plan

- `packages/search/src/types.ts`: define closed status/state/scan result types and operation identifiers.
- `packages/search/src/fts.ts`: separate read-only metadata comparison from mutation; add generation-bound atomic FTS builds, lease handling, and cached status reads.
- `packages/search/src/semantic.ts`: bind completeness to an FTS generation and stage semantic generations safely.
- `packages/search/src/tests/fts.spec.ts` plus a dedicated harness: cover every transition, root privacy, interruption, concurrent processes, busy timeout, and idempotent retry.
- `packages/search/src/tests/semantic-lifecycle.*`: assert that FTS generation changes invalidate semantic availability and failed retries preserve the prior committed state.
- `packages/search/src/bench/*`: retain the scale metrics added by this spike and add status-specific timing once the read-only API exists.
- `apps/mcp/src/tools/`: add the approved status surface and structured busy/stale errors; do not overload search defaults implicitly.
- `packages/contracts/src/index.ts`, README, website, and distributed skill: update only after the runtime contract is approved and implemented.

## Maintainer STOP decisions

1. Approve whether status is a new MCP tool or an explicit read-only mode on `build_index`; do not choose during implementation by accident.
2. Approve the default scan time budget and whether callers may request a higher bound.
3. Confirm that a single atomic FTS refresh transaction is acceptable for the largest supported local corpus.
4. Choose the bounded SQLite busy timeout/retry UX for competing local clients.
5. Decide whether an opt-in `require-current` search policy is desired after status usage is observed.
6. Do not add a watcher, daemon, dependency, automatic startup refresh, search-triggered refresh, or semantic download without separate approval.
