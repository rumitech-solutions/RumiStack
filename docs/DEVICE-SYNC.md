# Device sync

The portable profile (`config/portable-profile.json`) lets any Windows laptop converge on the same toolset.

```json
{
  "schemaVersion": 1,
  "tools": ["git", "nodejs", "claude-code", "opencode"],
  "sources": ["superpowers"],
  "vscodeExtensions": ["saoudrizwan.claude-dev"]
}
```

## Workflow

1. In the dashboard open **Device sync**, choose tools, optional source checkouts and VS Code extensions, press **Save profile**.
2. Commit and push `config/` (the dashboard offers the commands).
3. On another laptop: clone the repository to `D:\RumiStack` (or `git pull --ff-only`), then

```powershell
.\scripts\Restore-Profile.ps1 -WhatIf     # preview
.\scripts\Restore-Profile.ps1 -Confirm    # approve each action
.\scripts\Restore-Skills.ps1 -WhatIf
.\scripts\Restore-Skills.ps1 -Confirm
.\scripts\Doctor.ps1
```

The dashboard **Overview** shows the same comparison: what is installed, missing, or needs a manual step.

## What a restore does

- `winget` / `npm` tools: installs only entries with a typed, allow-listed package in `registry/tools.json`; checks the Node.js version required by each npm tool.
- `manual` tools: prints the note and docs link. Nothing is run.
- Source checkouts: shallow clones into `sources\`; existing folders are left alone.
- VS Code extensions: `code --install-extension` for each ID, if `code` is on PATH.
- Installs happen in category order (infrastructure first). After winget installs something, open a **new** PowerShell window so PATH refreshes, then re-run.

## What is never synced

API keys, provider credentials, login sessions, cookies, OAuth tokens, project code and local databases. Re-authenticate every tool on each laptop.

## Import and export

Export downloads the profile as JSON. Import loads a JSON file into the form; it is validated by the server when you save.
