# Architecture

RumiStack is a small local control plane. GitHub stores the manager, the curated registry, safe templates and a portable profile. Each Windows laptop runs the real tools locally.

```text
Browser (dashboard/, vanilla JS, no build step)
   │  JSON over http://127.0.0.1:47821, same-origin only
   ▼
server/index.js ── Node built-ins only, no npm dependencies
   ├─ lib/http.js       Host check, origin check, JSON-only writes, 256 KB body cap, CSP headers
   ├─ lib/validate.js   strict validators, secret detection
   ├─ lib/profiles.js   schema + load/save for the seven profile types
   ├─ lib/snippets.js   config previews (Claude Code, OpenCode, Codex CLI, VS Code), agent exports
   ├─ lib/system.js     the only code that touches the machine: PATH checks, source clone/update, launch
   └─ lib/registry.js   read-only catalogues from registry/
```

## Data

| Location | Tracked | Purpose |
| --- | --- | --- |
| `registry/*.json` | yes | Curated tools, provider presets, skill sources, MCP templates. Read-only at runtime. |
| `config/*.json` | yes | Your portable profiles: device, providers, skills, agents, MCP. No secrets. |
| `sources/` | no | Optional shallow clones of upstream repos. |
| `projects/` | no | Your real projects; assistants launched from the dashboard start here. |
| `logs/`, `backups/`, `state/` | no | Local-only runtime data. |

All profile writes are validated first and written atomically (temporary file, then rename), so a rejected save never changes the stored file.

## Profile types

- **Device** (`portable-profile.json`): tool IDs, optional source-checkout IDs, VS Code extension IDs.
- **Providers** (`provider-profiles.json`): base URL, model ID, API-key environment-variable *name*, protocol flags.
- **Skills** (`skills-profile.json`): source ID, skill ID, target assistants, scope (global or project).
- **Agents** (`agent-profiles.json`): role prompts only.
- **MCP** (`mcp-servers.json`): stdio command/args or remote URL, environment-variable names, header-to-variable mappings.

## What RumiStack deliberately does not do

It never merges third-party projects into one application, never executes arbitrary commands or URLs from the browser, never rewrites assistant configuration files, never starts MCP processes, and never stores or transmits credentials.

## Extending the catalogue

Add an entry to `registry/tools.json` with a typed installer (`winget`, `npm` or `manual`). Set `"clone": true` only for GitHub HTTPS repositories you want on the clone allowlist. Update the `updated` date, then run `npm run check`.
