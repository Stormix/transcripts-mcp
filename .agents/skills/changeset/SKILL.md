---
name: changeset
description: Generate a changeset file describing the current PR's changes. Use when asked to "create a changeset", "add a changeset", "/changeset", or after implementing a feature/fix that needs a changelog entry. Produces a randomly named `.changeset/*.md` file with affected packages, bump type, and an 80-character-max user-facing summary.
disable-model-invocation: true
---

# Create a Changeset

Generate a properly formatted changeset file in `.changeset/` describing the work on the current branch / PR. Follow the project's changeset conventions in `.cursor/rules/090-changesets.mdc`.

## Instructions

### 1. Gather Context

Determine what changed on the current branch versus the default branch:

```bash
echo "=== BRANCH ===" && git rev-parse --abbrev-ref HEAD && echo "=== CHANGED FILES ===" && git diff --name-only origin/main...HEAD && echo "=== DIFF SUMMARY ===" && git diff --stat origin/main...HEAD
```

If `origin/main` is not available, fall back to staged + unstaged changes (`git status` and `git diff`).

### 2. Decide If A Changeset Is Needed

Create one for: new features, bug fixes, breaking changes, performance improvements, security fixes.

Skip for: refactors with no user impact, formatting, docs-only, tests-only, internal tooling, dev dependency bumps.

If a changeset is not needed, tell the user and stop.

### 3. Determine Affected Packages

Map changed file paths to package names from `package.json` files. Common mappings:

| Path                   | Package name                |
| ---------------------- | --------------------------- |
| `packages/core/**`     | `@transcripts-mcp/core`     |
| `packages/adapters/**` | `@transcripts-mcp/adapters` |
| `packages/search/**`   | `@transcripts-mcp/search`   |
| `apps/mcp/**`          | `@transcripts-mcp/mcp`      |
| `packages/<name>/**`   | `@transcripts-mcp/<name>`   |

Only include packages directly modified. Do not include transitive dependents.

### 4. Determine Bump Type

| Type    | When                                                      |
| ------- | --------------------------------------------------------- |
| `patch` | Bug fixes, small internal-facing changes with user impact |
| `minor` | New features, backwards-compatible additions              |
| `major` | Breaking changes that require user action                 |

### 5. Generate Filename

Pick a random kebab-case filename matching the existing convention `adjective-noun-verb.md` (three short words, lowercase, hyphen-separated).

Examples already in `.changeset/`: `swift-foxes-leap.md`, `gentle-cats-gather.md`, `brave-otters-fall.md`.

Verify the filename does not already exist in `.changeset/` before writing. If it collides, pick another.

### 6. Write the Changeset

Write to `.changeset/<random-name>.md` using this exact format:

```markdown
---
"@transcripts-mcp/<package>": <patch|minor|major>
---

<Summary, max 80 characters, starts with a verb, user-facing>
```

For multiple affected packages, list each on its own line in the frontmatter.

**Summary rules:**

- Hard limit: 80 characters
- Start with an imperative verb (`Add`, `Fix`, `Improve`, `Remove`, `Update`)
- Describe _what_ changed from the user's perspective, not _how_
- No trailing period required
- No emojis, no markdown formatting in the summary line

**Good summaries:**

```text
Add dark mode toggle to settings page
Fix crash when processing large files
Improve queue processing performance by 50%
```

**Bad summaries:**

```text
Updated code
Fixed bug
Refactored component
chore: refactor download logic to use streams (over 80 chars and not user-facing)
```

### 7. Confirm

Print the path to the created file and its contents. Do not stage or commit it unless asked — it will be committed alongside the user's code changes.

## Example Output

```text
Created .changeset/brave-foxes-hunt.md:

---
"@transcripts-mcp/search": patch
---

Fix incorrect job retry logic in queue processor
```

## Example Usage

**User:** "/changeset", "create a changeset", or "add a changeset for this PR"

**Response:**

1. Run the git command to gather changed files
2. Decide if a changeset is warranted; stop if not
3. Map paths to packages and pick a bump type
4. Generate a unique random filename
5. Write the file with frontmatter and an 80-char-max summary
6. Print the resulting path and contents
