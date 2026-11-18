# RumiStack 1.4.0 — Guided multi-runtime setup

RumiStack 1.4 expands Project Hub beyond Node.js while keeping setup explicit and reviewable.

## Python
- Detects common Python project manifests.
- Supports a guided install preview for `requirements.txt`, `uv.lock` and `poetry.lock`.
- Checks for Python (or the Windows `py` launcher), uv or Poetry before offering the action.
- Projects with only an unsupported `pyproject.toml` remain manual setup.

## .NET
- Detects .NET solution and project files.
- Checks for the .NET SDK.
- Offers a confirmed `dotnet restore` preview for a single project file or solution.
- Running a .NET app is not automated when project selection is ambiguous.

## Safety
- Importing and detecting a project does not execute its code.
- Before setup, RumiStack shows the exact command, working folder and side-effect warning.
- Dependency installation may execute third-party build/install hooks. Run it only for repositories you trust.
- Go, Rust, Java and unsupported Python layouts remain organized but manual for now.

## Update
Run `git pull origin main` in your RumiStack folder, then double-click `Update-and-Start.bat`.
