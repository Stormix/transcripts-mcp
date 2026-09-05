# AI contribution policy

AI-assisted contributions are welcome. Contributors are responsible for understanding, reviewing, and testing everything they submit.

## Before contributing

Every pull request should address an existing issue or a change discussed with the maintainers. Open an issue before starting new work, and discuss refactors before submitting them.

Bug reports must describe a problem you have reproduced. Please do not submit unverified findings from an automated review.

## Review your work

Whether you use AI tools or write a change by hand:

- Understand the change well enough to explain and modify it.
- Follow the project's conventions in [CONTRIBUTING.md](CONTRIBUTING.md).
- Run the relevant checks and tests.
- Keep the change focused on the problem it addresses.
- Remove unnecessary code, comments, and generated boilerplate before submission.

Maintainers may close contributions that do not meet these requirements. Repeated unverified reports or unreviewed submissions may be deprioritized.

## Disclose significant AI assistance

Include a short note in your pull request describing the tool and what it helped with. For example:

> AI assistance: Used Claude Code to draft adapter tests, then reviewed the fixtures and ran the test suite.

Autocomplete, grammar fixes, and using AI to understand the codebase do not need disclosure.

## Guidance for coding agents

Follow [AGENTS.md](AGENTS.md) and the repository rules. Help the contributor understand the work and verify it.

A human must review, understand, and approve a pull request before submission. Do not independently open issues from static analysis or submit broad refactors without prior discussion.
