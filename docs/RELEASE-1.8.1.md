# RumiStack v1.8.1

## Windows startup

- There is now one normal Windows launcher: `Start-RumiStack.bat`.
- It runs `scripts/Start-Workspace.ps1`, starts the local server and opens the dashboard in the default browser.
- It does not call Git and does not pull, update, merge or modify tracked files.
- If RumiStack is already running on the selected port, the launcher opens that instance rather than starting a duplicate.
- If another application owns the port, the launcher reports a clear port-conflict message.
- Removed `Update-and-Start.bat`, `scripts/Update-and-Start.ps1` and the duplicate legacy `start.cmd`.

## Updates are deliberate

Use Git commands or the optional `scripts/Update-Workspace.ps1` maintenance script only when you deliberately decide to update. Startup and updates are separate operations.

## Verification

The CI workflow checks the start-only launcher contract, PowerShell syntax, project tests and cross-platform Node.js compatibility.
