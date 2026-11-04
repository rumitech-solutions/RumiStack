# Security model

RumiStack is a **single-user, local developer tool**. Do not expose it to a network. To report a vulnerability see the repository-level [`SECURITY.md`](../SECURITY.md).

## Boundaries

- The server binds to `127.0.0.1` only. There is no setting to change this.
- The `Host` header must be a loopback name with the server's port (defence against DNS rebinding).
- Mutating requests must be `application/json`. Requests carrying a foreign `Origin` or a `Sec-Fetch-Site` other than `same-origin`/`none` are rejected. CORS is never enabled.
- The dashboard is served with `Content-Security-Policy: default-src 'self'` (no inline script or style), `X-Frame-Options: DENY` and `no-store` caching. The UI inserts text with `textContent`, never HTML.
- Request bodies are capped at 256 KB.

## What can run

Only fixed operations in `server/lib/system.js`:

| Operation | Limit |
| --- | --- |
| PATH detection | `where.exe` / `which` with a command name taken from the registry and matched against `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` |
| Source clone | `git clone --depth 1` of a registry entry flagged `clone`, GitHub HTTPS URLs only, into `sources/<id>` |
| Repository clone | `git clone --depth 1 --no-recurse-submodules -- <url>` for a link you paste. The URL must match `https://github.com/<owner>/<repo>` exactly and the folder name is derived from it, so no path or option can come from the browser. Cloned code is never executed |
| Source update | `git pull --ff-only`; skipped if the working tree is dirty |
| Version check | `<command> --version` for registry commands, and `npm view <package> version` for registry npm packages |
| Git sync | Fixed arguments only: `status`, `diff`, `fetch`, `pull --ff-only`, `add -- config`, `commit -- config`, `push`. Never force, rebase or reset. Only `config/` is ever committed; commit messages are single-line and secret-scanned |
| Provider test | One `GET <profile URL>/models` request (see below) |
| Gateway containers | `docker compose [--profile <registry profile>] up -d \| down \| ps \| logs` in `sources/<id>`, only for registry entries with a `docker` block. Never `-v`, never the `cli` profile, never auto-update profiles. See [`GATEWAYS.md`](GATEWAYS.md) |
| Project actions | `git init -b main` inside `projects/<name>`; copying `templates/AGENTS.md` / `CLAUDE.md` without overwriting; opening VS Code or an assistant in that folder (Windows). Names must match a strict pattern and are resolved inside `projects/` |
| Key check | Reads `process.env[NAME]` for names from your profiles and returns only set / not set |
| Launch assistant | A registry entry flagged `launchable`, found on PATH, opened in `projects/`. Windows only |

Child processes are started without a shell. There is no endpoint that accepts a command line or a path from the browser. The only free-text input that reaches Git is a GitHub repository link, validated as described above.

## Secrets

Profiles store environment-variable **names**. Every save is scanned for credential shapes (OpenAI-style keys, GitHub and Slack tokens, AWS and Google keys, bearer tokens, private-key blocks, `key = value` assignments) and rejected on a match. This is a safety net, not a guarantee: keep real keys in your gateway's credential store or a secret manager.

**Provider connection test.** The only place a secret value is used. The key is read from the server's own environment variable named in the profile and sent as a bearer token **only** to that profile's validated URL. Redirects are not followed (`redirect: 'manual'`), so the key cannot be forwarded elsewhere. The key is never returned to the browser or written to the activity log or backups.

**Backups and activity.** `backups/` holds the previous version of each profile (last 20 per kind); restore re-validates the file and only accepts names matching a fixed pattern. `logs/activity.jsonl` records what changed, never request bodies. Both are git-ignored.

Provider URLs must be HTTPS, except loopback. They may not contain credentials, query strings or fragments.

## Supply chain

- Installers are typed (`winget` or `npm`) with strict name patterns, and the restore scripts ask for confirmation per action.
- Plugin-style and discovery-only skill sources are never installed automatically.
- The skills profile does not yet pin upstream versions. Review a skill's scripts, hooks, permissions and licence before installing.
- Registry URLs are curated by hand. Run `npm run verify-registry` periodically to catch moved or deleted repositories.

## Known limitations

- PowerShell scripts have not been executed in the Linux development container; run them with `-WhatIf` on the target laptop first.
- Snippet formats for third-party tools (field names such as `env_vars`, `wire_api`) follow upstream documentation at the time of writing and can change between releases.
