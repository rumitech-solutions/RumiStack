# Project Hub

Project Hub extends Dashboard → Projects. It is intended for day-to-day web development while remaining useful as a library for non-web repositories.

## Import and storage

1. Paste a GitHub HTTPS repository URL.
2. Choose a destination drive and folder. On Windows, the drive selector lists detected drives; the full destination path remains editable. Example: `E:\\WebProjects`.
3. Optionally choose a folder name. The clone is placed in a new child folder.
4. Import only clones repository files. It does not install packages, run setup scripts, start containers or execute project code.

The default destination is `<RumiStack>\\projects`. You can choose another drive or folder for each import. The imported project remains at that path; RumiStack records its location in ignored `state/project-hub.json`.

Use **Register existing project** to add a folder already on disk. This does not copy, move or rewrite its source files. Unregister removes only the Project Hub record; it never deletes the folder.

## Web projects

Project Hub reads `package.json`, lockfiles and common framework dependencies to identify likely web projects and package managers:

- Frameworks: Vite, Next.js, Nuxt, Angular, Vue, React, Svelte and generic Node.js.
- Package managers: npm, pnpm, Yarn and Bun.
- Candidate scripts: dev, start, serve and preview (the UI also lets you select any detected package script).

**Install dependencies** runs the detected package manager's install command in the project folder. Dependency lifecycle scripts may execute, so only do this for repositories you trust.

**Start** runs the selected package.json script. This is an explicit code-execution action and is never performed by import or detection. Logs are written to RumiStack's local `logs/` folder. The Logs view can reveal a localhost URL printed by the development server; use Open local site when one is detected.

**Stop** terminates the tracked process tree (Windows uses taskkill /T /F; POSIX uses the process group). The process registry is in memory, so after restarting RumiStack, a process started before the restart may need to be stopped manually from Task Manager or the operating system.

## Non-web projects and Docker

Non-web repositories can still be imported and organized at the chosen destination. If a Node.js package exposes scripts, Project Hub can run them; otherwise the folder remains registered and available to open in an editor or terminal.

Docker is optional and is not required for importing, organizing or running ordinary Node.js web projects. Existing Docker gateway controls remain separate.

## Safety and limitations

- The dashboard is loopback-only and its mutation APIs retain the existing host/origin protections.
- GitHub imports accept normalized GitHub HTTPS repository URLs only.
- Destination paths must be absolute; drive roots themselves are not accepted.
- Import never executes code. Installing dependencies and starting scripts are separate actions with confirmation prompts.
- The runner exposes package.json script names, not arbitrary shell commands.
- Existing local folders are registered in place. Unregister keeps the files.
- Project paths and process logs are local-only; do not commit `state/` or `logs/`.
- Framework detection is heuristic. Projects with custom runtimes, monorepos or non-Node stacks may need manual setup. Project Hub does not claim universal runtime support.
- Project Hub manages the dev process and logs; it does not yet provide a reverse proxy, HTTPS certificates, automatic port reservation, or persistent process supervision after RumiStack exits.
