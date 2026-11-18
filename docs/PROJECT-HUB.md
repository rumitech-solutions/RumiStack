# 📁 Project Hub

Project Hub is the central place to bring repositories and existing folders together, inspect project health, prepare dependencies and run supported apps.

## 📥 Import a repository

1. Open **Projects** and paste a GitHub HTTPS repository URL.
2. Choose **Import repository**. Importing downloads the repository into RumiStack's default projects folder.
3. To choose another drive or destination, expand **Advanced import options** before importing. The optional folder name defaults to the repository name.
4. The imported project appears under **Your projects**.

Import is download-only. It does not install dependencies, run setup scripts or execute project code.

The default destination is `<RumiStack>/projects`. On Windows, the advanced options include detected drives and an editable absolute destination path. Drive roots themselves are not accepted.

## 📂 Register a folder already on your laptop

Expand **Already have a project on this laptop? Register its folder**, enter its full path and confirm registration. The existing folder stays where it is; RumiStack does not copy, move or rewrite its source files.

To remove a project from the list, use **More → Unregister**. This removes only the Project Hub record and keeps the actual files.

## 🧠 Project health and supported workflows

Project Hub inspects project manifests without running project code. The project card shows its detected framework/ecosystem, runtime and package-manager availability, dependency state and relevant warnings. Framework detection is heuristic, so review the result rather than treating it as a guarantee.

| Project type | What RumiStack can guide |
| --- | --- |
| Node.js | Detect npm, pnpm, Yarn or Bun; install dependencies after confirmation; run a selected `package.json` script after a separate confirmation |
| Python | For supported `requirements.txt`, `uv.lock` or `poetry.lock` projects, preview and confirm the setup command; a single recognized root entrypoint (`main.py`, `app.py`, `run.py` or `manage.py`) can be launched after a separate command preview |
| .NET | Preview and confirm dependency restore; a project with exactly one `.csproj` can be launched after a separate command preview |
| Go, Rust and Java | Detect common project manifests and provide manual-setup guidance; commands are not guessed or run automatically |

### Main project action

Each card presents one primary action based on the project's current state:

- **Guided setup** for supported Python/.NET setup that has not yet completed.
- **Setup & start** or **Install dependencies** for Node.js projects that need dependencies.
- **Run app** for a supported Python or .NET app after setup.
- **Start app** for a Node.js project with installed dependencies and scripts.
- **Stop app** while a tracked app is running.
- **View guidance** when no supported automatic workflow is available.

When a guided Python/.NET setup succeeds, the completion timestamp is saved in RumiStack's local Project Hub registry. It is not written into the imported project.

Use the script selector to choose a detected Node.js script. RumiStack never accepts an arbitrary command-line string as a project script.

### More menu

Less-frequent actions are grouped under **More**:

- **Logs** opens the project's recent output. If a localhost URL is detected, **Open local site** becomes available.
- **Reinstall dependencies** repeats the detected Node.js package-manager install.
- **Run setup again** repeats a supported guided Python/.NET setup.
- **Copy path** copies the project's full folder path.
- **Unregister** removes the list entry but keeps the folder.

## ▶️ Execution and process behavior

Dependency installation may download third-party packages and execute their lifecycle/build scripts. Starting a project runs code owned by that repository. Only continue with projects and dependencies you trust.

Before guided Python/.NET setup or launch, RumiStack shows the working directory, exact command and a warning. Review these details before confirming.

Logs are stored under RumiStack's local `logs/` folder. Project process tracking is in memory; after RumiStack exits or restarts, a previously launched process may need to be stopped manually from Task Manager or the operating system.

## 🛡️ Safety and limitations

- The dashboard binds to loopback only; do not expose port `47821` publicly.
- GitHub imports accept validated GitHub HTTPS repository URLs.
- Destination paths must be absolute; drive roots are not valid destinations.
- Import and project inspection do not execute repository code.
- Dependency installation and project launch are separate, explicit actions.
- Package scripts are selected by name from the project's `package.json`; arbitrary shell command text is not accepted.
- Existing local folders are registered in place; unregister never deletes project files.
- Project paths, process logs and the Project Hub registry are local data. Do not commit `state/` or `logs/`.
- Custom runtimes, monorepos, multi-project .NET solutions and projects without a recognized entrypoint may need manual setup.
- Project Hub does not provide a reverse proxy, HTTPS certificates, automatic port reservation or persistent process supervision after RumiStack exits.
