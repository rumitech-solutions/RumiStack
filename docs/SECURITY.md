# 🛡️ Security model

RumiStack is a **single-user, local developer tool**. Do not expose its HTTP server directly to a network. Private remote use is supported only through the documented SSH local port-forwarding workflow. To report a vulnerability see the repository-level [SECURITY.md](../SECURITY.md).

## 🔒 Network boundaries

- The server binds to `127.0.0.1` only. There is no setting to change this.
- The `Host` header must be a loopback name with the server's port (defence against DNS rebinding).
- Mutating requests must be `application/json`. Requests carrying a foreign `Origin` or a `Sec-Fetch-Site` other than `same-origin`/`none` are rejected. CORS is never enabled.
- The dashboard uses a restrictive Content Security Policy, `X-Frame-Options: DENY` and `no-store` caching. UI text is inserted as text nodes, not interpreted as HTML.
- Request bodies are capped at 256 KB.
- For remote use, keep TCP 47821 closed in cloud/host firewalls and connect through SSH local port forwarding. SSH access is the boundary for the current private single-user mode; there are no built-in user accounts or per-user isolation.

## ⚙️ What RumiStack can execute

RumiStack exposes fixed, validated operations rather than a general-purpose terminal. The supported operations include:

| Operation | Limits and safeguards |
| --- | --- |
| Tool detection and launch | Tool IDs and executable names come from the curated registry. Only entries explicitly marked launchable can be opened. |
| Source and repository management | Git operations use fixed argument lists. Repository imports accept validated GitHub HTTPS URLs; clone downloads files only and does not execute them. Updates use fast-forward-only behavior and skip dirty source checkouts. |
| Profile Git sync | Fixed status/diff/fetch/pull/add/commit/push operations; only the portable `config/` directory is committed. No force push, reset or rebase is exposed. |
| Provider connectivity | Performs a model-list request to a validated provider URL. A referenced key is read from the server process environment and sent only to that URL; redirects are not followed. |
| Project creation | Creates a named folder under the RumiStack projects directory, initializes Git when requested and copies approved starter templates without overwriting existing files. |
| Node.js dependency installation | Runs the detected package manager in the registered project folder after explicit user confirmation. Installation can execute third-party lifecycle scripts. |
| Node.js project launch | Runs a script name selected from that project's `package.json`. The script name must pass a strict allowlist; running it executes project-owned code. |
| Python/.NET guided setup and launch | Shows the working folder, exact supported command and warning before confirmation. Python launch requires one recognized root entrypoint; .NET launch requires exactly one `.csproj`. Ambiguous targets are not guessed. |
| Process stop and logs | Stops a process tracked by Project Hub and reads its local log file. The process registry is in memory, so processes may outlive a RumiStack restart. |

On Windows, some package-manager operations use the platform shell to support command shims such as `.cmd` files. The command executable and arguments are selected by RumiStack; project script names are validated. There is no API that accepts an arbitrary command line from the browser.

## 🔐 Secrets and profiles

Profiles store environment-variable **names**, not secret values. Profile saves are scanned for common credential shapes (provider keys, GitHub/Slack tokens, AWS/Google keys, bearer tokens, private-key blocks and obvious key/value assignments) and rejected on a match. This is a safety net, not a guarantee: keep real keys in your gateway's credential store or a secret manager.

Provider connection tests are the place where a referenced secret is used. The key is read from the server process environment and sent as a bearer token only to the profile's validated URL. Redirects are not followed, and the key is never returned to the browser or written to the activity log.

Local backups, project registry data and activity logs can still contain sensitive operational information. Keep `state/`, `logs/` and `backups/` private and git-ignored. Copy backups to a separate trusted location and test restoration before relying on them.

Provider URLs must be HTTPS, except for loopback endpoints. They may not contain credentials, query strings or fragments.

## 📦 Supply chain

- Review upstream installers and repositories before executing them.
- Skills and community integrations may contain scripts, hooks or permissions that change over time; inspect their source and licence.
- Registry URLs are curated by hand. Run `npm run verify-registry` periodically to catch moved or deleted repositories.
- Keep Node.js, Git, runtimes and third-party coding tools updated through their official channels.

## ⚠️ Known limitations

- RumiStack is not a multi-user service and has no built-in authentication, role-based access or project isolation.
- Imported code is not sandboxed. Dependency installation and project launch execute third-party code with the permissions of the RumiStack user.
- The app does not provide persistent process supervision for Project Hub processes after RumiStack exits.
- PowerShell scripts and third-party provider connectivity still need validation on the actual Windows device.
