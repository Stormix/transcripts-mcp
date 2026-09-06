# Contributing

## Development

Requires [Bun](https://bun.sh) >= 1.2, [Node](https://nodejs.org) >= 26.8.1, and [pnpm](https://pnpm.io) 12.

```bash
git clone https://github.com/Stormix/transcripts-mcp.git
cd transcripts-mcp
pnpm install
```

Launch the server from source:

```bash
bun apps/mcp/src/index.ts
```

or:

```bash
pnpm start
```

stdout is JSON-RPC. Logs go to stderr. Point an MCP client at that absolute path (see [README](README.md#from-source)).

## Checks

Run from the repo root before you open a PR:

```bash
pnpm test
pnpm check-types
pnpm lint
pnpm format:check
```

`pnpm lint:fix` and `pnpm format` apply fixes. New features and bug fixes need tests (`*.spec.ts` under `src/tests/`). Changelog-worthy work also needs a changeset (see `.cursor/rules/090-changesets.mdc`).

## Before opening a pull request

Link the issue or discussion your change addresses. For new work or refactors, discuss the approach with the maintainers first.

Review and test your changes before submitting them. If you used AI beyond autocomplete or minor editing, include a short disclosure in the PR description. See the [AI Policy](AI_POLICY.md) for details.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Add a new harness

Adapters convert provider transcripts into the shared message format. Search is handled by the search package.

1. Add one file in `packages/adapters/src/` that calls `defineJsonlAdapter` with `{ id, displayName, root, sessionFiles, sessionIdFromPath, lineSchema, toMessage }`.
2. Add the adapter to `allAdapters` in `packages/adapters/src/index.ts`.
3. Add one anonymized fixture and a `*.spec.ts` under `packages/adapters/src/tests/`.

`apps/mcp` registers `allAdapters`. No other wiring.

### `defineJsonlAdapter`

```ts
export const exampleAdapter = defineJsonlAdapter({
  id: "example",
  displayName: "Example",
  root: () => process.env.EXAMPLE_HOME ?? join(homedir(), ".example"),
  sessionFiles: "projects/*/*.jsonl",
  sessionIdFromPath: (path) => basename(path, ".jsonl"),
  lineSchema: exampleLineSchema,
  toMessage: (line) => ({ role: line.role, text: line.text }),
});
```

Optional: `titleFromLine`, `cwdFromLine`, `timestampFromLine`.

`sessionFiles` is walked by `walkGlob`, which matches per path segment. `*` is allowed. `**` is not. Depth must match the pattern (`projects/*/*.jsonl`, not `projects/**/*.jsonl`).

### Parsing

`lineSchema` is a Zod schema for one JSONL line. Core runs `JSON.parse` then `safeParse`. `toMessage` receives the narrowed type and returns `{ role, text, timestamp?, toolName? }` or `null`.

Unrecognized shapes are skipped. Invalid JSON and throws inside `toMessage` increment `session.parseErrors`.

Use schema-driven parsing. Do not use `unknown` parameters, `typeof` guards, or `Record<string, unknown>` objects.

### Tests

Place an anonymized fixture under `packages/adapters/src/tests/fixtures/<id>/` using the same layout as `sessionFiles`. Specs live next to it as `src/tests/<id>.spec.ts`, named `should [outcome] when [condition]`.

## Performance benchmarks

Run `pnpm bench` for a local report, or compare two installed checkouts:

```bash
pnpm bench --base ../transcripts-mcp --head . --output bench-results
```

The default is one discarded warm-up round and seven measured rounds per revision.
Use `--samples 3` for a shorter check. Both checkouts need their own dependencies
installed from their lockfiles. The driver copies the same harness into temporary
folders in both checkouts, runs them serially in alternating order on the same
machine, and removes those folders afterward. It does not change tracked source.
Bun subprocess startup, corpus generation, vector seeding, and cleanup are outside
the timed operations. Short queries run in batches; each sample is an average per
operation, with three untimed warm-up calls inside each subprocess. Single-shot
mutations and cold initialization are not prewarmed. The full-index case uses a fresh database in every subprocess.

`bench-results/comparison.md` contains medians, median absolute deviations, p95 of
round averages, percentage changes, and runtime/commit identifiers.
`comparison.json` retains every measurement and correctness failure. A timing is
excluded if any sample returned incorrect results. New head-side correctness failures
and all operation errors make the command exit nonzero after writing the report.
An identical assertion failure in every baseline and head round is labeled
"Existing failure on main" and does not block an unrelated PR. Without a baseline,
all correctness failures still fail the command.
Unavailable native engines are reported explicitly; their fallback timings are not
presented as native performance.

Coverage includes a deterministic 32-session, 4,096-message corpus, full indexing,
unchanged indexing, appending one session, native and streaming grep, warm/reopened
FTS queries, filtered/unfiltered vector retrieval over 4,096 384-dimensional vectors,
and rank fusion. The selective vector case deliberately places matching results
behind many nearer nonmatching vectors. Counts and filter correctness are checked
outside the measured intervals. These synthetic workloads do not measure real
provider parsing, model loading, embedding generation, or end-to-end MCP latency.
"Cold" native grep means a fresh finder, not a flushed filesystem cache.

The report flags faster/slower only above 10% and three times the larger median
absolute deviation. This is an informational noise heuristic, not a statistical
significance test or a merge gate for speed. Shared GitHub runners still vary;
rerun borderline results.

### PR reports

The **Benchmarks** workflow compares the PR head against the pinned `main` base SHA
from the PR event. Both revisions use Bun 1.4.0 and run on the same Ubuntu runner.
It saves a job summary and a 14-day JSON artifact, even when correctness checks fail.
The separate **Benchmark comment** workflow updates one bot comment on the PR.
It verifies the current head/base and ignores superseded runs; rerun benchmarks
when `main` changes if a fresh baseline is needed.

PR code runs with read-only permissions and no persisted checkout credentials.
The commenting workflow runs reporting code from the default branch, validates
bounded JSON data, and never executes code from the benchmark artifact. Fork PRs
use the same reporting path, subject to GitHub's workflow-approval settings.
If installation or benchmark execution fails before results are available, the
comment links to the failed run without claiming a speed comparison.

The commenting workflow must first be merged into the default branch before GitHub
will trigger it. Benchmark changes can alter what is measured: review harness diffs
alongside the results; a suite hash in each report identifies the workload version.
