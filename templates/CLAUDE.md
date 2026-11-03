# CLAUDE.md

Project memory for Claude Code. Copy to the project root and fill in the placeholders.

## Project

- Purpose: <one sentence>
- Stack: <languages, frameworks>
- Run: `<command>` · Test: `<command>` · Lint/check: `<command>`

## Conventions

- <naming, formatting, folder layout>
- Prefer small, reviewable changes. Match the surrounding style.

## Rules

- Read before you edit. Run the checks above before saying a task is finished, and report failures honestly.
- Never put secrets in code, config or logs. Use environment-variable names only.
- Do not install packages or run remote scripts without telling the user what and why.
- Do not modify files outside this project.

## Shared agent roles

Reusable roles (Planner, Code Reviewer, Test Engineer, Security Reviewer, UI/UX Designer) live in RumiStack's Agent Manager and can be exported to `.claude/agents/`.
