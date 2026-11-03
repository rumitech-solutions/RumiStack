# Changelog

## 0.5.0 — MCP Server Manager

- Added a curated MCP catalogue for OpenAI Developer Docs, Context7, Playwright MCP and GitHub MCP Server.
- Added portable MCP profile validation and local persistence for stdio and Streamable HTTP definitions.
- Added target selection and config previews for Claude Code, OpenCode, Codex CLI and VS Code.
- Added secret rejection and environment-variable-name-only credential references.
- Added cross-origin write tests and explicit documentation that profile save is not installation, connection or health verification.
- MCP processes are not launched, package installs are not run, OAuth is not managed and assistant config files are never overwritten.

### Verification

- `npm run check` — passed in the development container.
- `npm test` — passed in the development container, including MCP profile validation, persistence and cross-origin rejection.
- Windows PowerShell and live MCP client connectivity — not tested in this Linux container.


## 0.4.0 — Skills & Agent Manager

- Added a searchable curated skills marketplace with official, vendor, community and discovery-only sources.
- Added a portable skills desired-state profile with validated source IDs, skill IDs, assistant targets, global/project scope and duplicate prevention.
- Added safe Vercel Skills CLI command generation and a PowerShell restore script with allowlisted catalogue lookups, `-WhatIf`, `-Confirm` and explicit project-path protection.
- Kept plugin installations manual and discovery-only indexes non-installable; RumiStack does not execute arbitrary skill repositories from the dashboard.
- Added five starter agent roles plus custom profile create/edit/delete, secret-pattern checks, and portable JSON export.
- Added reviewable universal Markdown, Claude Code subagent, OpenCode subagent and Codex `AGENTS.md` instruction exports.
- Added responsive Skills Marketplace and Agent Manager screens, filtering, selected-profile management and safer profile-save behavior.
- Expanded smoke tests for unknown skills, duplicate selections, unsupported assistants, plugin scope, credential rejection, agent profiles, and cross-origin mutation rejection.

### Verification

- `npm run check` — passed in the development container.
- `npm test` — passed in the development container, including API validation and save/restore round trips.
- Windows PowerShell restore — not executed in this Linux container; run `Restore-Skills.ps1 -WhatIf` on the Windows laptop before using `-Confirm`.
- Upstream skill installations — not run automatically; inspect source, licence, hooks, scripts and permissions before installation.

## 0.3.0 — Provider & Assistant Config Manager

- Added FreeLLMAPI, OmniRoute and custom OpenAI-compatible provider presets.
- Added validated, credential-free provider profiles in `config/provider-profiles.json`.
- Added explicit OpenAI Chat Completions, OpenAI Responses and Anthropic Messages protocol capabilities.
- Added Claude Code PowerShell, OpenCode JSON and Codex CLI TOML snippet generation.
- Added strict provider URL validation: HTTPS for remote endpoints, HTTP only for loopback; rejects URL credentials, query strings and fragments.
- Rejects unknown profile fields, actual API key values, malformed environment-variable names, unsupported protocols and invalid model IDs.
- Added provider-profile API endpoints and smoke tests for validation, save and security rejection paths.
- Added a copyable PowerShell `/models` discovery command that references the local environment variable without embedding its value.
- Documented upstream compatibility sources and credential boundaries.

### Verification

- `npm run check` — passed in the development container.
- `npm test` — passed in the development container.
- Browser / Windows PowerShell integration — not run in this Linux build container.
- Live provider API connectivity — not tested; this release does not send credentials or make provider requests.

## 0.2.0 — Portable Device Sync

- Renamed the product and project package to RumiStack.
- Added a Device Sync dashboard view for selecting managed tools, optional reference source checkouts and VS Code extension IDs.
- Added strict local profile API validation, atomic profile saving, JSON import and export.
- Added `Restore-Profile.ps1` with `-WhatIf` preview, per-action confirmation, allow-listed package metadata, Node-version checks, optional source clones and VS Code extension restoration.
- Kept tools whose install scripts require extra review as manual steps.
- Documented the profile schema, migration workflow, security exclusions and GitHub publishing steps.
- Updated the publisher to support a GitHub user or organization as the repository owner, while checking the authenticated account and requiring explicit confirmation.
- Expanded smoke tests for invalid IDs, secrets, duplicate values and invalid source selections.

### Verification

- `npm run check` — passed in the development container.
- `npm test` — passed in the development container.
- Windows PowerShell scripts — not executed in this Linux container; verify them on the target Windows laptop before relying on a full restore.
- GitHub publishing — not performed; the `rumitech-solutions/RumiStack` repository was not found in the connected GitHub account.


## 0.5.0 — MCP Server Manager

- Added a curated MCP catalogue for OpenAI Developer Docs, Context7, Playwright MCP and GitHub MCP Server.
- Added portable MCP profile validation and local persistence for stdio and Streamable HTTP definitions.
- Added target selection and config previews for Claude Code, OpenCode, Codex CLI and VS Code.
- Added secret rejection and environment-variable-name-only credential references.
- Added cross-origin write tests and explicit documentation that profile save is not installation, connection or health verification.
- MCP processes are not launched, package installs are not run, OAuth is not managed and assistant config files are never overwritten.