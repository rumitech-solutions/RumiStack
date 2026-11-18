# 🧭 Architecture

RumiStack is a portable developer control plane with two supported operating modes:

- **Windows local:** the dashboard and projects run on the user's Windows laptop.
- **Linux private server:** repositories, projects and runtime state live on a Linux VM; laptops access the dashboard through an SSH local tunnel.

Both modes use the same Node.js application and loopback-only HTTP server. GitHub stores the manager, curated registry, safe templates and deliberately portable configuration. Project working trees remain on the selected machine.

```text
Windows browser ── http://127.0.0.1:47821 ── Windows RumiStack
       │
       └── SSH local port forward (encrypted)
                    │
Laptop browser ── http://127.0.0.1:47821
                    │
             SSH tunnel to Linux VM
                    │
        Linux RumiStack (127.0.0.1:47821)
                    │
        projects/ · sources/ · state/ · logs/
```

## Runtime layers

```
Browser (dashboard/, vanilla JS, no build step)
   │  JSON over loopback, same-origin only
   ▼
server/index.js ── Node built-ins only, no npm dependencies
   ├─ lib/http.js       Host check, origin check, JSON-only writes, 256 KB body cap, CSP headers
   ├─ lib/validate.js   strict validators, secret detection
   ├─ lib/profiles.js   schema + load/save for profile types
   ├─ lib/system.js     platform-aware tools and process operations
   └─ lib/registry.js   read-only catalogues from registry/
```

## Workspace data

| Location | Tracked | Purpose |
| --- | --- | --- |
| `registry/*.json` | yes | Curated tools, provider presets, skill sources, MCP templates |
| `config/*.json` | yes, when deliberately committed | Portable profiles; no credential values |
| `sources/` | no | Imported upstream repositories |
| `projects/` | no | User projects and working copies |
| `logs/`, `backups/`, `state/` | no | Runtime logs, local backups and project registry |

On a Linux VM these folders reside on its persistent disk. VM disk persistence is not a substitute for independent backups.

## Remote access boundary

The app binds to `127.0.0.1` only. Remote browser use is supported through SSH local port forwarding, not a public reverse proxy. Keep TCP 47821 closed in cloud and host firewalls. See [Private Remote Access](REMOTE-ACCESS.md).

RumiStack currently remains a single-user control plane. It does not provide built-in login accounts, role-based access, per-user isolation or public hosting.

## Profile types

- **Device:** tool IDs, source-checkout IDs, VS Code extension IDs.
- **Providers:** base URL, model ID, API-key environment-variable name and protocol flags.
- **Skills:** source ID, skill ID, target assistants and scope.
- **Agents:** role prompts.
- **MCP:** server metadata and environment-variable references.

All profile writes are validated and written atomically.

## Deliberate limits

RumiStack does not merge third-party projects into one application, execute arbitrary commands supplied by the browser, rewrite assistant configuration files, start MCP processes automatically, or store API-key values in portable profiles. Importing a repository does not execute its code; dependency installation and project launch remain explicit actions.

## Extending the catalogue

Add a typed entry to `registry/tools.json`, update its date, then run `npm run check`.
