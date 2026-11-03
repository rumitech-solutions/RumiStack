# Changelog

## 0.6.0 — First complete code release

The repository previously contained documentation only. This release adds the implementation behind everything the 0.2.0–0.5.0 notes describe, plus a few additions.

- Added the local server (`server/`, Node built-ins only, loopback only) with Host, origin and content-type checks, a 256 KB body cap and a strict Content-Security-Policy.
- Added the dashboard (`dashboard/`, no build step): Overview, Catalogue, Device sync, Provider manager, Skills marketplace, Agent manager and MCP servers.
- Added the curated registry (`registry/`): 27 projects in 7 categories, provider presets, skill sources and MCP templates.
- Added the five portable profiles under `config/` with strict validation, secret detection and atomic saves.
- Added Windows scripts: `Setup-Workspace`, `Start-Workspace`, `Restore-Profile`, `Restore-Skills`, `Doctor`, `Update-Workspace`, `Clone-Sources`, `Publish-To-GitHub`.
- Added `docs/`, `templates/AGENTS.md`, `templates/CLAUDE.md` and GitHub Actions CI on Windows and Linux (Node 20 and 22).
- New: **Overview** compares your device profile with what is actually installed on this laptop.
- New: `npm run verify-registry` re-checks every registry URL from a networked machine.
- New: MCP and provider presets for Windows-specific notes (`cmd /c npx`) and per-protocol generation errors.
- Removed a duplicated 0.5.0 entry from this file.

### Verification

- `npm run check` — passed in the development container.
- `npm test` — 20 tests passed (validation, API, security rejections, snippets), including a real HTTP server on an ephemeral loopback port.
- Dashboard — all seven views loaded and a provider save/snippet/secret-rejection flow was exercised in headless Chromium with no CSP violations; mobile width (390 px) showed no horizontal overflow.
- Windows PowerShell scripts — **not executed** (the development container has no PowerShell). Run each with `-WhatIf` on a Windows laptop first.
- Registry URLs — written from upstream knowledge and not network-verified in the container. Run `npm run verify-registry`. In particular confirm the OmniRoute and FreeLLMAPI repositories, which have several forks.
- Third-party config field names (Codex CLI, OpenCode, VS Code MCP) follow upstream docs at the time of writing and may differ in your installed release.

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
