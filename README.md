# RumiStack

**Your entire AI development stack. One portable home.**

RumiStack is a local-first control center for managing AI coding assistants, model/API gateways, skills, agents, MCP servers, testing tools, security utilities and developer infrastructure. GitHub stores the manager, curated registry, safe templates and a portable profile; each Windows laptop runs the tools locally.

RumiStack does **not** merge third-party projects into one application. Each upstream tool keeps its own repository, licence, release cycle and configuration.

## What v0.6.0 includes

v0.6.0 is the first release that ships the complete code (server, dashboard, registry, scripts, tests and docs) behind the features below. See [`CHANGELOG.md`](CHANGELOG.md) for what is verified and what still needs testing on Windows.

- Local-only dashboard for tool discovery, install guidance, health checks and agent launching.
- **Overview** that compares your device profile with what is really installed on this laptop.
- Curated GitHub registry covering 27 projects across 7 categories.
- **Portable Device Sync profile**: choose the tool IDs, optional source checkouts and VS Code extensions you want on each laptop.
- Profile import/export through the dashboard and a tracked `config/portable-profile.json` file.
- **Provider Manager** for secret-free FreeLLMAPI, OmniRoute and custom endpoint profiles.
- Explicit protocol compatibility flags for OpenAI Chat Completions, OpenAI Responses and Anthropic Messages.
- Generated config templates for Claude Code, OpenCode and Codex CLI, with environment-variable references instead of embedded keys.
- **Skills marketplace** with curated official, vendor and community sources, searchable skill IDs, assistant target selection, global/project scope and portable desired-state profile.
- **Agent Manager** with reusable Planner, Code Reviewer, Test Engineer, Security Reviewer and UI/UX Designer profiles; create/edit custom prompts and export reviewable Claude Code, OpenCode, Codex or universal instruction files.
- `Restore-Skills.ps1` with allow-listed source/skill IDs, `-WhatIf` / `-Confirm`, Node.js version checking and project-path protection; plugin installers remain manual.
- Copyable PowerShell model-discovery command that uses the selected provider environment variable without printing or storing its value.
- Strict validation of provider URLs, protocols, model IDs and environment-variable names; remote HTTP endpoints and secret-bearing fields are rejected.
- Windows restore script with `-WhatIf` preview, typed installer allowlists and clear manual-install notices.
- Safe setup, status/doctor, fast-forward-only update and optional GitHub publish scripts.
- **MCP Server Manager** with curated templates for OpenAI Developer Docs, Context7, Playwright MCP and GitHub MCP Server; portable stdio/Streamable HTTP profiles; and per-client configuration previews for Claude Code, OpenCode, Codex CLI and VS Code.
- Example MCP/agent configuration plus reusable `AGENTS.md` / `CLAUDE.md` templates.
- Security boundaries: secrets, sessions, actual projects, downloaded sources, logs and backups remain local-only.

## Recommended Windows layout

Extract or clone RumiStack as `D:\RumiStack`:

```text
D:\RumiStack\
├── dashboard\             # Local web UI
├── server\                 # Local API, Node built-ins only
├── registry\               # Curated tool, provider and skills catalogues (tracked)
├── config\                 # Portable device, provider, skills, agent and MCP profiles (tracked)
├── docs\                   # Architecture, security, sync and operations
├── scripts\                # Windows setup / restore / update / doctor scripts
├── templates\              # Reusable agent instructions
├── sources\                # Optional shallow clones (ignored by Git)
├── projects\               # Your real projects (ignored by this repo)
├── logs\                   # Local-only logs
├── backups\                # Local-only backups
└── state\                  # Local-only runtime state
```

The `.gitignore` intentionally excludes `sources/`, `projects/`, logs, backups, state and machine-specific settings. Do not remove those safeguards casually.

## Quick start (Windows 10/11)

Prerequisites: Git for Windows, Node.js 20+, and GitHub CLI (`gh`) for creating/pushing the private control-plane repository. The portable restore script uses WinGet and/or npm only for tools that have a typed, allow-listed installer in the registry. The optional Vercel Skills CLI used by `Restore-Skills.ps1` requires Node.js 22.20 or later.

1. Clone the repository to `D:\RumiStack`: `git clone https://github.com/rumitech-solutions/RumiStack.git D:\RumiStack`.
2. Ensure Git and Node are available in a new PowerShell window.
3. In PowerShell:

```powershell
Set-Location D:\RumiStack
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\Setup-Workspace.ps1
npm run check
npm test
.\scripts\Start-Workspace.ps1
```

The local dashboard opens at `http://127.0.0.1:47821`. Keep the PowerShell window open; press `Ctrl+C` to stop the server. There is nothing to `npm install`: the server uses Node built-ins only. See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for options and troubleshooting.

`Publish-To-GitHub.ps1` is only for creating a **new** repository elsewhere. It refuses an existing repository or an unexpected remote, so it is not needed for `rumitech-solutions/RumiStack`, which already exists. Use ordinary Git commands there after reviewing the status and diff.

## Provider Manager: connect your assistants

Open Dashboard → Provider manager. Add the FreeLLMAPI or OmniRoute preset, verify the base URL and model ID on your local gateway, select only the protocols your installed release supports, and save. Choose Claude Code, OpenCode or Codex CLI to generate a secret-free config snippet. Merge generated JSON/TOML into existing assistant configuration manually; RumiStack never overwrites those files.

The tracked `config/provider-profiles.json` contains URLs, model IDs and environment-variable names only. The tracked `config/skills-profile.json` and `config/agent-profiles.json` store desired skill selections and prompt profiles without credentials; `config/mcp-servers.json` stores MCP connection metadata without secret values. Keep the actual gateway key in the gateway credential store / a local secret manager. Never paste an API key into RumiStack. See [`docs/PROVIDER-MANAGER.md`](docs/PROVIDER-MANAGER.md) for compatibility notes and [`docs/MCP-MANAGER.md`](docs/MCP-MANAGER.md) for MCP client export formats and security limitations.

## MCP Server Manager

Open Dashboard → **MCP servers**. Add a curated template or define a local stdio / remote Streamable HTTP server, choose target clients, and save the profile. Select a server and generate a snippet for Claude Code, OpenCode, Codex CLI or VS Code. Review and merge the single server entry manually; RumiStack never rewrites a client config, launches an MCP process, installs a package, performs OAuth or claims a server is connected. For a remote server, use HTTPS (HTTP is allowed only for loopback development). For authentication, define a local environment variable and save only its name in the profile. See [`docs/MCP-MANAGER.md`](docs/MCP-MANAGER.md) for transport and client-specific notes.

## Device sync: move to another laptop

1. Open RumiStack → **Device sync**. Select the tools, optional source checkouts and VS Code extensions you want on your devices, then choose **Save profile**.
2. Commit and push the portable profile from your current laptop:

```powershell
git add config/portable-profile.json config/provider-profiles.json config/skills-profile.json config/agent-profiles.json config/mcp-servers.json
git commit -m "Update RumiStack device, provider, skills, agent and MCP profiles"
git push
```

3. On a new laptop, clone the private RumiStack repository (or `git pull --ff-only` if it is already present), then preview and restore:

```powershell
Set-Location D:\RumiStack
.\scripts\Restore-Profile.ps1 -WhatIf
.\scripts\Restore-Profile.ps1 -Confirm
.\scripts\Restore-Skills.ps1 -WhatIf
.\scripts\Restore-Skills.ps1 -Confirm
.\scripts\Doctor.ps1
```

`-WhatIf` previews allow-listed tool installs, source/extension actions and selected skill installs without applying them. Review each preview, then use `-Confirm` to approve each action. Project-scoped skills require `-ProjectPath` pointing to the actual target project. After pulling `config/mcp-servers.json` to a new laptop, open MCP Servers, regenerate snippets for the installed assistant clients and merge them manually; verify each connection in the client. MCP definitions do not copy OAuth sessions or token values. The skills profile records source/skill selection but does not yet pin exact upstream content versions. Some products (including FreeLLMAPI and Codex CLI) are intentionally listed as manual setup items rather than running remote installer scripts automatically.

The device profile stores only tool IDs, selected cloneable source IDs and VS Code extension IDs. The skills profile stores selected source/skill IDs, target assistants and scope; project-scoped skills require an explicit `-ProjectPath`. Agent profiles store reusable prompts, not credentials or enforceable permissions. The provider profile stores connection metadata and environment-variable names only. The MCP profile stores local command names/arguments or remote HTTPS URLs and environment-variable names, never credential values. They never store API keys, provider credentials, login sessions, cookies, project code or local databases. Re-authenticate and re-enter credentials on each laptop.

## Dashboard capabilities

- Search and filter the repository catalogue.
- Open upstream repositories and documentation.
- Copy install/setup commands.
- Clone selected, size-reviewed reference repositories into the ignored `sources/` folder from a fixed registry allowlist.
- Check common CLI tools on `PATH` and launch Claude Code, OpenCode, Codex or Gemini CLI in `projects/` when installed.
- Run health checks and update clean repositories using fast-forward-only Git pulls; dirty repositories are skipped.
- Edit, validate, import and export the portable device profile.
- Manage local model gateway profiles and generate client configuration for Claude Code, OpenCode and Codex CLI.
- Search curated skills, select compatible assistants, save portable skill profiles and preview restore commands.
- Create portable agent role profiles and export them to supported assistant-specific formats without overwriting existing files.
- Manage MCP definitions, keep environment-variable names (not secrets), and generate reviewable target-client snippets without executing server commands or rewriting client configuration.

The dashboard binds to `127.0.0.1` only. It does not accept arbitrary shell commands or arbitrary Git URLs from the browser, does not enable CORS, and validates the origin for mutating requests.

## Important: open source is not the same as free inference

Open-source agents and routers do not make paid model APIs free. Every upstream provider has its own authentication, quota, acceptable-use policy and pricing. Free-tier offers change frequently and may be rate-limited, unavailable or unsuitable for production. RumiStack does not promise unlimited free models or tokens.

## Safe installation philosophy

RumiStack does not silently install every item in the catalogue. The restore script only executes typed `winget` or `npm` package specifications included in the trusted local registry; the script requests confirmation before each install/clone step. Tools whose package install scripts need additional human review remain manual. Manual products are reported with their official documentation/release link. Review upstream licences, package scripts, permissions and quotas before use.

## Validation

```powershell
npm run check
npm test
```

GitHub Actions runs the same checks on Windows and Linux (Node 20 and 22) for pushes and pull requests. The PowerShell scripts could not be executed in the Linux development environment, so run each with `-WhatIf` on your Windows machine before treating them as verified. The registry URLs are curated by hand: run `npm run verify-registry` to re-check them from a networked machine.

## Useful scripts

```powershell
.\scripts\Setup-Workspace.ps1
.\scripts\Doctor.ps1
.\scripts\Restore-Profile.ps1 -WhatIf
.\scripts\Restore-Profile.ps1 -Confirm
.\scripts\Restore-Skills.ps1 -WhatIf
.\scripts\Restore-Skills.ps1 -Confirm
.\scripts\Update-Workspace.ps1
.\scripts\Clone-Sources.ps1 -Ids superpowers,playwright-mcp
.\scripts\Start-Workspace.ps1
```

See `docs/` for architecture, security, provider profiles, device sync, installation and maintenance details.