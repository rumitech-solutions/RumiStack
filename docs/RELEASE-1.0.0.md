# 🏁 RumiStack v1.0.0 — First stable release

RumiStack 1.0.0 marks the first stable release of the local-first AI developer workspace.

## ✨ What is stable

- **Guided setup:** choose one primary coding assistant and optionally configure a compatible model gateway.
- **Tool library:** discover coding assistants, developer tools, skills and integrations.
- **Project Hub:** import GitHub repositories, register existing folders, install supported Node.js dependencies, and run named project scripts through explicit actions.
- **AI provider profiles:** manage endpoint metadata and environment-variable names without storing API-key values.
- **Portable setup:** maintain profiles, prompts, agents, MCP definitions, favourites and backup bundles.
- **Simple daily launch:** use `Update-and-Start.bat` to safely update, verify and start the dashboard.

## 🛡️ Stability and safety commitments

- Windows 10/11 and Node.js 20+ are the primary supported desktop environment.
- Docker is not required for the standard workflow.
- RumiStack's own dashboard/server require no `npm install`.
- Git updates are fast-forward-only; dirty or divergent workspaces are not reset.
- Imported repositories are not executed automatically. Dependency installation and project scripts remain explicit actions.
- API-key values and account sessions must remain outside portable profiles.
- Unregistering a project removes its RumiStack registry entry, not the project folder.

## 🚀 Upgrade

From an existing clone:

1. Run `git pull origin main` once if the one-click updater is not yet present.
2. Double-click `Update-and-Start.bat`.
3. The launcher checks prerequisites, updates safely, runs integrity checks and automated tests, then opens the local dashboard.

Dashboard: `http://127.0.0.1:47821`

## 🧪 Verification

The release uses the repository CI matrix: Windows and Ubuntu, Node.js 20 and 22. The launcher also runs the local integrity checks and automated tests before starting the app.

## 🔭 What comes next

The 1.x line will focus on reliability, clearer workflows, better project lifecycle management, broader runtime support and quality-of-life improvements — without turning the default experience into a complicated control panel.
