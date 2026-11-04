# Changelog

## 0.12.0 — Keys, Projects, Prompt library

- **Keys**: lists every API-key environment variable referenced by your provider and MCP profiles and whether it is set on this laptop, with a copyable PowerShell command for each missing one. Only names and set/not-set are reported; values and lengths never leave the server process (a test asserts this). The doctor gets a matching informational check.
- **Projects**: create a project folder under `projects/` with optional `git init -b main` and starter `AGENTS.md` / `CLAUDE.md` from the templates (existing files are never overwritten); add a missing template later; open a project in VS Code or a launchable assistant (Windows only). Names are restricted to a safe pattern and resolved inside `projects/`.
- **Prompt library**: reusable prompts by category with `{{variable}}` placeholders; *Fill & copy* asks for each value and copies the finished text. New portable profile `config/prompts.json` (now eight profiles, included in bundles). Five starter prompts. Secrets in prompt text are rejected.
- Shortcuts `g j` (Projects), `g i` (Prompt library), `g y` (Keys); the palette finds prompts.
- Verification: 46 tests pass; all three views exercised in headless Chromium (create project, fill-and-copy to the clipboard, shortcuts, no console errors, no overflow at 390 px). **Not verified**: *Open in VS Code / assistant* (needs Windows) and the Windows scripts.

## 0.11.0 — Premium and advanced

- **Settings** view: five accent colours (violet, ocean, emerald, rose, amber) that work in dark and light, theme, comfortable/compact density and reduced motion. Saved in this browser only and applied before first paint (no flash).
- **Getting started** checklist on Overview (tools, repository, link, gateway, provider, Git sync), derived from what already exists; it disappears when everything is done.
- **Keyboard shortcuts**: `g` then a letter jumps to a view (`g l` Saved links, `g r` Repositories, ...), `t` cycles theme, `?` lists them all. The `Ctrl K` palette also searches your repositories and has new actions.
- **Bundle export/import**: one JSON file with all seven portable profiles for moving laptops without Git. Import validates every profile first (a single bad profile rejects the whole bundle), shows what would change, and backs up what it replaces.
- **Install as an app**: web manifest and icons so Chrome/Edge can install the dashboard as a standalone window (Install app in the address bar menu).
- Verification: 43 tests pass (bundle round trip and rejection, progress, PWA assets). Exercised in headless Chromium: shortcuts, accent/density persistence across reload, light + emerald theme, no console errors, no overflow at 390 px. **Not verified**: the install-as-app prompt itself (needs real Chrome/Edge) and the Windows scripts.

## 0.10.1

- Saved links now appear in the `Ctrl K` palette under "Saved links" and open in a new tab. Verified in headless Chromium.

## 0.10.0 — Saved links

- New **Saved links** view: keep the tools, docs and sites you want to remember, grouped into categories you create (four starters: AI tools, Free APIs, Docs & learning, Skills & agents). Search, filter by category, open, copy, edit and delete. Stored in the new portable profile `config/saved-links.json`, so every laptop gets the same list after a pull.
- Validation: only `http(s)` addresses (no `javascript:`/`file:`), no embedded user name or password, secret scan on every save, links must belong to an existing category, categories with links cannot be deleted from the UI.
- Verification: 40 tests pass; the view was exercised in headless Chromium (add, reject a `javascript:` link, add a category, filter, no horizontal overflow).

## 0.9.1 — Workspace folders create themselves

- The server now creates `config/`, `sources/`, `projects/`, `backups/`, `logs/` and `state/` on start, so `start.cmd` or `node server/index.js` works on a fresh clone without running `Setup-Workspace.ps1`. Existing folders are never touched.
- The Repositories page shows the workspace structure and what each folder is for (`GET /api/workspace`).
- Verification: 39 tests pass; started from an empty folder in the container and all six folders appeared. The Windows scripts were not run.

## 0.9.0 — Your own repositories and one-click start

- New **Repositories** view: paste any `https://github.com/owner/repository` link; RumiStack clones it into `sources/<owner>-<repo>` and records it in a new portable profile, `config/repos.json`. On another laptop, pull the config and press *Clone missing*. Update is fast-forward only and skips checkouts with local changes. Remove only edits the list; the folder is kept.
- Only plain GitHub HTTPS links are accepted (no other hosts, SSH, credentials, query strings or extra paths). A failed clone adds nothing and leaves no folder. Cloned code is never executed by RumiStack.
- New `start.cmd`: double-click to start the dashboard (runs `scripts\Start-Workspace.ps1` with execution policy bypassed for that process only).
- Verification: 38 tests pass (including a clone/update/remove flow through git URL rewriting, and URL attack strings); the view was exercised in headless Chromium. `start.cmd` and the PowerShell scripts were **not** run (no Windows here).

## 0.8.0 — Docker gateways

- New **Gateways (Docker)** view: prepare `.env`, start, stop and read logs for FreeLLMAPI and OmniRoute using their own upstream compose files (see `docs/GATEWAYS.md`).
- Safety: fixed `docker compose` arguments, no volume removal, no `cli` or auto-update profiles, warning when `.env` publishes beyond `127.0.0.1`, generated secrets never returned or logged. `npm run check` now validates `docker` registry blocks.
- Doctor reports Docker engine / Compose availability.
- Verification: 35 tests pass, including a full lifecycle against a fake `docker` executable; the new view was exercised in headless Chromium without console errors.
- **Not verified**: a real Docker engine and the real upstream images. Upstream compose layouts were read on 2026-11-04 and may change.

## 0.7.0 — Premium dashboard and sync

- Redesigned the dashboard ("Aurora"): dark, light and auto themes, command palette (`Ctrl K`), health ring, toasts, skeleton loading, staggered entrances, inline SVG icons, responsive layout. Still no build step and still CSP-clean (no inline script or style attributes).
- New **Starter kits** (Web developer, Free-tier gateway, Agent workstation, Security & quality). Kits only merge into your profiles and back up what they replace.
- New **Sync & backups** view: Git status, fetch, fast-forward pull, config diff, and commit/push of `config/` only; one-click restore of any of the last 20 backups per profile.
- New **Activity** journal (`logs/activity.jsonl`) and an **Overview health score** from a new doctor engine (`/api/doctor`).
- New **Test connection** on providers: reads the key from the server environment and calls `GET /models` on the profile URL only, without following redirects.
- New update checks: installed versions (`--version`) compared with the latest npm release.
- Stricter profile saves: backups on every change, unknown-field rejection retained.
- Fixed: Git status lost all but the first changed file; gateway test reported unrecognised responses as connected; mobile horizontal overflow on Overview.

### Verification

- `npm run check` and `npm test` (31 tests, including a real Git repository sync flow and a stub gateway) pass in the development container.
- Dashboard exercised in headless Chromium: all nine views, command palette, kit apply, diff view, provider test, theme persistence, no console or CSP errors, no horizontal overflow at 390 px. Dark, light and mobile screenshots were reviewed.
- **Not verified**: PowerShell scripts (no PowerShell in the container), registry URLs (run `npm run verify-registry`), and third-party config field names. Run scripts with `-WhatIf` first.

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
