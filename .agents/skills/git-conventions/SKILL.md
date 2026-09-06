---
name: git-conventions
description: Git Conventions: Guidelines for commit messages, branch naming, and version control practices
---

# Git Commit and Version Control Conventions

## Commit Message Format

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. This format enables automatic changelog generation, version bumping, and better collaboration.

### Structure

```text
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Type

The type must be one of the following:

- `feat` - A new feature for the user
- `fix` - A bug fix
- `docs` - Documentation only changes
- `style` - Changes that don't affect the meaning of code (white-space, formatting, etc.)
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `perf` - Code change that improves performance
- `test` - Adding missing tests or correcting existing tests
- `build` - Changes that affect the build system or external dependencies
- `ci` - Changes to CI configuration files and scripts
- `chore` - Other changes that don't modify src or test files
- `revert` - Reverts a previous commit

### Scope

Infer scope from staged file paths. Use the workspace **directory name**, not the npm package name (`packages/cli` is `cli`, not `transcripts-mcp`). Scope is optional; omit it or use `repo` for repo-wide work. Multiple scopes are allowed when each is a valid workspace or meta scope (`feat(mcp,search):`).

**Apps:**

- `mcp` - stdio MCP server
- `www` - Marketing site

**Packages:**

- `core` - Types, adapter contract, jsonl reader
- `adapters` - Cursor, Claude Code, and Codex adapters
- `search` - Grep, FTS5, semantic search
- `cli` - Published CLI package

**Tools:**

- `oxlint-plugins` - Custom oxlint rules
- `typescript-config` - Shared TypeScript config

**Distribution:**

- `plugin` - Cursor plugin manifest and skill

**Other:**

- `deps` - Dependency updates
- `repo` - Repository-wide changes
- `release` - Release-related changes

### Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No period (.) at the end
- Keep it under 72 characters

### Body (Optional)

The body should include the motivation for the change and contrast this with previous behavior.

- Use the imperative, present tense
- Wrap at 72 characters
- Separate from subject with a blank line

### Footer (Optional)

The footer should contain information about Breaking Changes and reference issues that this commit closes.

**Breaking Changes** should start with `BREAKING CHANGE:` followed by a description.

**Closes** references should be on a separate line and use the format: `Closes #123, #456`

## Examples

### Feature Addition

```text
feat(search): add hybrid fusion ranking

Blend FTS5 and semantic hits so keyword and meaning both
influence the result order.

Closes #142
```

### Bug Fix

```text
fix(mcp): restore session id on grep hits

Resolve the session id from the adapter path so grep results
can open the matching transcript.
```

### Breaking Change

```text
feat(adapters)!: drop deprecated parse helpers

BREAKING CHANGE: Adapter parse helpers were removed. New harness
adapters must use defineJsonlAdapter.
```

### Dependency Update

```text
chore(deps): update zod to v4.4.3
```

### Documentation

```text
docs(repo): add installation instructions for Linux
```

### Repo-wide or no scope

```text
ci: run commitlint on pull request commits
```

### Multiple scopes

```text
refactor(mcp,search): extract fusion ranking
```

### Simple Fix

```text
fix(www): correct button alignment on mobile
```

## Branch Naming Conventions

### Branch Format

```text
<type>/<ticket-or-description>
```

### Types

- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical fixes that need immediate deployment
- `refactor/` - Code refactoring
- `chore/` - Maintenance tasks
- `docs/` - Documentation updates

### Branch Naming Rules

- Use kebab-case for descriptions
- Include ticket/issue numbers when applicable
- Keep names descriptive but concise
- Use lowercase letters

### Branch Examples

```bash
# With ticket number
feature/KR-123-add-mod-collections
bugfix/KR-456-fix-download-crash
hotfix/KR-789-security-patch

# Without ticket number
feature/dark-mode-toggle
bugfix/pagination-edge-case
refactor/extract-validation-logic
chore/update-dependencies
docs/add-api-examples
```

## Gathering Git Context

Run this single command to gather all necessary information:

```bash
echo "=== BRANCH ===" && git rev-parse --abbrev-ref HEAD && echo "=== STAGED FILES ===" && git diff --staged --stat && echo "=== STAGED CHANGES ===" && git diff --staged
```

This provides:

- Current branch name
- Staged files summary → determine scope (which workspace/package)
- Actual changes → determine commit type and write description

### Changesets Integration

This project uses changesets for version management. See [090-changesets.mdc](mdc:.cursor/rules/090-changesets.mdc) for details on when and how to create changesets alongside commits.

### Current branch (agents)

When running `/commit` or creating commits for the user, use the **checked-out
branch** as-is. Do not create, switch to, or require a feature branch only
because the current branch is `main` or `master`, unless the user explicitly
asks for a different branch.

## References

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Project Changeset Guidelines](mdc:.cursor/rules/090-changesets.mdc)
