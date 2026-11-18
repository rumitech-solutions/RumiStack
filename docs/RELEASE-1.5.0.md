# RumiStack 1.5.0 — Guided Python and .NET launch

Project Hub can now launch selected Python and .NET projects after an explicit review.

## Python
Recognized root entrypoints: `main.py`, `app.py`, `run.py`, `manage.py`.
Exactly one recognized entrypoint is required. When available, the project's `.venv` interpreter is preferred; otherwise RumiStack checks for `python` or the Windows `py` launcher.

## .NET
A project with exactly one `.csproj` can be launched with `dotnet run --project <file> --no-launch-profile`. Multiple project files remain manual to avoid choosing the wrong startup target.

## Safety
The dashboard displays the exact command and working directory before asking for confirmation. Launching runs project-owned code. Only run repositories you trust. Existing Project Hub logs and Stop controls are reused.

## Scope
This release does not expose remote project ports, provide multi-user cloud hosting, or automate Go, Rust and Java workflows. Those require separate runtime, networking and security work.

## Update
Run `git pull origin main` in your RumiStack folder, then double-click `Update-and-Start.bat`.
