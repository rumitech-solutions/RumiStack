# 🧰 Maintenance

## ▶️ Start RumiStack on Windows

There is one normal Windows launcher: double-click `Start-RumiStack.bat`.

- Starts the local RumiStack server on `127.0.0.1:47821`.
- Opens the dashboard in your default browser.
- Reuses an existing RumiStack instance on that port instead of starting a duplicate.
- Reports a clear error if another application is using the port.
- Does **not** run Git, pull, update source repositories or change tracked files.

Keep the launcher window open while using RumiStack. Press `Ctrl+C` in that window to stop the server.

## 🔄 Update only when you choose

Starting the dashboard and updating code are separate tasks. To deliberately update RumiStack, open PowerShell in the repository and run:

```powershell
git status --short
git pull --ff-only origin main
npm run check
npm test
```

Do not pull over uncommitted local changes. Review `git status` first and commit or back up your work.

To separately update clean source checkouts as well, run `\\scripts\\Update-Workspace.ps1`. This is an optional maintenance action; the start launcher never calls it.

## 🩺 Routine checks

```powershell
.\\scripts\\Doctor.ps1             # read-only health report
npm run check                       # syntax, JSON, registry, profile and hygiene checks
npm test                            # API, validation and frontend regression tests
npm run verify-registry              # network: confirm registry URLs still resolve
```

## 🗂️ Keeping the registry current

1. Run `npm run verify-registry` and fix any `FAIL` or `MOVED` lines in `registry/tools.json`.
2. When adding a tool: use a typed installer or `manual` with a note; set `"clone": true` only for GitHub HTTPS repos you want on the clone allowlist; prefer official upstream links and check the licence.
3. Update the `updated` date in `registry/tools.json` (and `registry/skills.json` for skills changes).
4. Run `npm run check` and `npm test`.

## 🚦 Before a release

- `npm run check` and `npm test` pass on Windows and Linux (CI runs both).
- On a Windows laptop, run `Restore-Profile.ps1 -WhatIf` and `Restore-Skills.ps1 -WhatIf` and read the output.
- Update `CHANGELOG.md` and `package.json` version.
