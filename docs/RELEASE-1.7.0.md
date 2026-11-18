# RumiStack v1.7.0

## User experience

- The Projects screen now presents GitHub import as the primary path.
- Advanced destination settings are collapsed by default, while still allowing a custom drive, folder and import name.
- Registering an existing folder is available in a separate expandable section.
- Copy and safety explanations use simpler language.
- Existing project import, detection, setup, launch, logs and unregister behavior is preserved.

## Safety

- Import still clones files only; it does not execute repository code.
- Registering a folder does not move, copy or modify its files.
- Dependency installation and project execution still require explicit confirmation.
- Advanced options remain available; no capability was removed.

## Upgrade

Run `Update-and-Start.bat` on Windows, or pull the `main` branch and restart RumiStack on Linux.
