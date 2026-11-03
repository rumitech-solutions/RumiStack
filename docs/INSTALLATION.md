# Installation (Windows 10/11)

## Prerequisites

- **Git for Windows**: `winget install --id Git.Git --exact`
- **Node.js 20+** (22.20+ if you will use `Restore-Skills.ps1`): `winget install --id OpenJS.NodeJS.LTS --exact`
- Optional: **GitHub CLI** (`winget install --id GitHub.cli --exact`) for `Publish-To-GitHub.ps1`; Docker Desktop for self-hosted gateways.

Open a new PowerShell window after installing so PATH is refreshed.

## Get RumiStack

```powershell
git clone https://github.com/rumitech-solutions/RumiStack.git D:\RumiStack
Set-Location D:\RumiStack
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\Setup-Workspace.ps1
npm run check
npm test
.\scripts\Start-Workspace.ps1
```

The dashboard opens at `http://127.0.0.1:47821`. Keep the window open; press `Ctrl+C` to stop. Use `-Port 48000` to change the port, or `-NoBrowser` to skip opening the browser.

There is nothing to `npm install`: the server uses Node built-ins only.

## Without PowerShell scripts

```bash
node server/index.js          # starts the dashboard
RUMISTACK_PORT=48000 node server/index.js
```

## Troubleshooting

- **Port in use**: another RumiStack is running, or pick another port.
- **Scripts blocked**: run `Set-ExecutionPolicy -Scope Process Bypass -Force` in that window.
- **A tool shows "missing" right after install**: open a new PowerShell window so PATH updates.
- **Doctor**: `.\scripts\Doctor.ps1` prints a read-only health report.
