# AGENTS.md

Reusable instructions for AI coding agents working in this repository. Copy to the project root and edit.

## Working agreement

- Read the relevant code and docs before changing anything. State assumptions that you cannot verify.
- Make the smallest change that solves the task. Do not refactor unrelated code.
- Run the project's checks and tests before declaring work done, and report the real result, including failures.
- Never weaken, skip or delete a test to make it pass. Explain the failure instead.

## Security and secrets

- Never print, log, commit or ask for API keys, tokens, passwords or private keys.
- Refer to credentials by environment-variable name only (for example `MY_API_KEY`).
- Do not run commands that download and execute remote scripts without showing them to the user first.
- Do not touch files outside this project folder.

## Git

- Work on a branch. Keep commits small with clear messages.
- Never force-push, rewrite published history or change remotes without explicit approval.

## When unsure

Ask one specific question rather than guessing, and say what you already checked.
