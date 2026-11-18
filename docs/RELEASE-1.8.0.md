# RumiStack v1.8.0

## User experience

- Project cards now show one main action based on project state: Guided setup, Setup & start, Install dependencies, Run app, Start app, Stop app or View guidance.
- Logs, detected local URL, dependency reinstall, Copy path and Unregister are grouped in the per-project More menu.
- Runtime health, framework, dependency state and project script selection remain visible.
- When a guided Python or .NET setup succeeds, RumiStack records the completion timestamp in its local Project Hub registry. The next recommended action can then become Run app.
- Existing projects without a safe guided workflow receive explanatory setup guidance rather than a guessed command.

## Safety

- Project imports remain download-only.
- Dependency installation and project execution still require explicit confirmation.
- Exact Python and .NET command previews and trust warnings remain.
- Unregister removes only the Project Hub registry entry; project files are kept.
- Setup completion metadata is stored in local RumiStack state, not in the imported project folder.

## Upgrade

Run `Update-and-Start.bat` on Windows, or pull the `main` branch and restart RumiStack on Linux.
