## [1.8.0] - 2026-11-18

### 🎯 Clear project actions
- Reworked Project Hub cards around one health-aware primary action: guided setup, dependency setup, run app, stop app or setup guidance.
- Moved logs, local URL, reinstall, copy path and unregister into a compact More menu.
- Kept project health, runtime status and script selection visible without flooding every card with buttons.
- Added local setup-completion tracking for guided Python and .NET setup so the next recommended action changes to Run app.
- Added regression coverage for setup completion and the streamlined Project Hub experience.
- Existing install/run confirmation prompts and non-destructive unregister behavior remain in place.

## [1.7.0] - 2026-11-18

### ✨ Simpler Project Hub
- Put the common GitHub import path first and kept the repository URL as the only required visible field.
- Moved destination drive, destination folder and custom folder name into collapsed Advanced import options.
- Moved existing-folder registration into a separate collapsed section with a clear explanation that files are not moved or changed.
- Clarified the difference between imported projects and projects created inside RumiStack.
- Added responsive, accessible disclosure styling for optional project settings.

## [1.6.0] - 2026-11-18

### ☁️ Private cloud foundations
- Added a Linux server launcher with Node.js 20+ checks and local workspace folder initialization.
- Documented a private Linux VM deployment with repositories and project files stored on persistent server disk.
- Added SSH local port-forwarding instructions for browser access from Windows, macOS and Linux laptops.
- Preserved loopback-only binding and explicitly documented that port 47821 must never be opened publicly.
- Clarified the current boundary: private single-user remote access, not public or multi-user hosting.
- Windows setup and the existing Update-and-Start workflow remain supported.

## [1.5.0] - 2026-11-18
### ▶️ Guided Python and .NET launch
- Python projects with exactly one recognized root entrypoint (main.py, app.py, run.py or manage.py) can be launched after an exact command preview and confirmation.
- Python launch prefers the project-local .venv interpreter when present, then checks the system Python/Windows py launcher.
- .NET projects with exactly one .csproj can be launched using a confirmed `dotnet run --project ... --no-launch-profile` action.
- Multiple or ambiguous entrypoints/projects are not guessed; they remain manual.
- Both runtimes use the existing Project Hub process tracking, logs and Stop action.
- Added regression tests for safe target detection and ambiguous Python entrypoints.

## [1.4.0] - 2026-11-18

### 🧭 Guided multi-runtime project setup
- Added actionable Python project detection for requirements.txt, uv.lock and poetry.lock projects, with runtime availability checks and explicit command previews before dependency installation.
- Added .NET SDK detection and guided `dotnet restore` for a single .csproj or a solution file.
- The dashboard shows the project ecosystem, supported setup state and exact command/working folder before asking for confirmation.
- Unsupported Python manifests, multi-project .NET run selection, Go, Rust and Java remain clearly marked for manual setup; no guessed commands or automatic project execution.
- Import and detection remain read-only. Dependency operations run only after an explicit user confirmation and may execute package build/install hooks.
- Added regression tests for Python and .NET recognition and supported setup boundaries.

# Changelog

## [1.3.0] - 2026-11-18

### 🧩 Multi-runtime project recognition
- Project Hub now recognises Python, .NET, Go, Rust and Java projects from common manifest files.
- Non-Node projects receive an explicit detected-runtime status and safe manual-setup guidance instead of a generic unknown-project label.
- Automatic dependency installation and project launching remain limited to the supported Node.js workflow; no runtime commands are guessed or executed.
- Added coverage for all five non-Node manifest families.


## [1.2.0] - 2026-11-18

### 🧭 Smarter first-run setup
- Setup Wizard now prioritizes an already-installed coding assistant when no assistant has previously been selected.
- The wizard explains why an assistant was preselected and keeps installation and configuration changes behind explicit user actions.
- Existing FreeLLMAPI and OmniRoute provider profiles are identified in gateway choices so users can review and reuse their saved connection settings.
- No API-key values, sessions or local service files are read or modified by this detection.


## [1.1.0] - 2026-11-18

### 🧠 Project intelligence & guided launch
- Project Hub now reports framework, Node runtime, required Node version, package manager availability, dependency count, lockfiles and actionable project health.
- Moved or disconnected project folders are identified without breaking the entire Project Hub list.
- Added an explicit Setup & start workflow: install dependencies, then optionally launch the detected default script after a separate confirmation.
- Existing import safety remains unchanged: project code is never executed during import or detection.


## [1.0.0] - 2026-11-18

### 🏁 First stable release
- Declared the core RumiStack experience stable: guided setup, local-first profiles, tool discovery, provider configuration, Project Hub and portable backups.
- Kept the everyday workflow focused: one-click update-and-start, one primary coding assistant, then import or open a project.
- Strengthened the one-click launcher: it now runs both workspace integrity checks and the automated test suite before starting the dashboard.
- Preserved safe defaults: no Docker requirement, no automatic execution of imported repositories, no API-key values in portable profiles, and no destructive Git updates.
- Confirmed the v0.17.0 baseline CI passed on Windows and Ubuntu with Node.js 20 and 22; v1.0.0 changes receive the same CI matrix.


## [0.17.0] - 2026-11-18

### ✨ Simpler Home experience
- Reduced Home to three everyday actions: Projects, Setup assistant and Tool library.
- Moved detailed health checks and laptop/profile comparison into one collapsed Advanced section.
- Kept recent activity visible and retained all advanced functionality and routes.
- Updated the product version and quickstart guidance.


## [0.16.1] - 2026-11-18

### 🚀 One-click Windows launcher
- Rebuilt `Update-and-Start.bat` as a smart updater that fetches the official `main` branch, refuses dirty or divergent checkouts, fast-forwards safely, runs workspace validation and starts the dashboard.
- Detects an already-running RumiStack instance and opens it instead of attempting a duplicate server.
- Removed the unnecessary `npm install` step; RumiStack uses Node.js built-ins for its own dashboard and server.
- Added `scripts/Update-and-Start.ps1` for the update, safety and launch workflow.


## [0.16.0] - 2026-11-18

### 🧭 Guided setup experience
- Added a three-step Setup Wizard: choose one primary coding assistant, optionally select FreeLLMAPI or OmniRoute, then review and save.
- Detects installed assistants and shows a copyable install command or official manual-install route, including DeepSeek Harness.
- Saves the selected assistant into the portable device profile and can create/update a local gateway provider profile.
- Keeps gateway setup optional; no Docker, automatic package execution, service startup or credential collection.
- Added a first-run quickstart guide and a clearer home checklist that distinguishes required setup from optional upgrades.

### ✨ Workspace polish
- Added a dedicated Setup Wizard entry and command-palette action.
- Navigation now groups secondary capabilities into one collapsible More & advanced section and opens only the active section.
- Added responsive premium styling for wizard steps, assistant choices, gateway selection and review panels.
- Added tests for required-vs-optional onboarding progress.

### 🛡️ Safety
- Gateway configuration stores only Base URL, model ID and environment-variable name; secret values remain outside RumiStack.
- Existing profiles are preserved and selected tools are merged rather than replacing the user's profile.
- Gateway repositories remain separate Project Hub imports; saving a provider profile does not clone, install or start gateway code.

## [0.15.0] - 2026-11-18

### ✨ User-friendly workspace
- Added an in-dashboard Guides & help area with step-by-step workflows for coding assistants, model gateways, skills, MCP, repositories and device sync.
- Simplified navigation into Workspace, AI setup, Manage and System groups.
- Renamed Catalogue to Tool library and clarified AI coding platforms vs model gateways and add-ons.
- Added category deep links so guides can open the relevant filtered tool list.

### ⚡ Docker-free model gateway workflow
- FreeLLMAPI and OmniRoute remain in the tool library and repository clone list.
- Removed Docker-specific gateway controls, API routes, registry configuration and test suite.
- Replaced Docker gateway instructions with direct upstream installation and AI provider configuration guidance.
- Removed Docker Desktop from the curated required-tools catalogue. Docker is not required for the standard RumiStack workflow.

### 🛡️ Safety & clarity
- Repository cloning remains download-only; it does not run setup scripts.
- Gateway installation and service startup remain explicit user actions using upstream documentation.
- Existing local service folders and user data are not migrated or deleted by this release.

# 📝 Changelog

## 0.14.2 — ✨ Signature UI & documentation refresh

- Refined the premium dashboard with more intentional spacing, deeper glass surfaces, emerald/gold-inspired signature accents, clearer navigation hierarchy and elevated content cards.
- Improved mobile navigation, responsive page headers, buttons, forms, empty states, dialogs and notification surfaces.
- Preserved theme and accent preferences, reduced-motion support, local-first behavior and the zero-build frontend.
- Rebuilt the root README as an emoji-led product showcase with feature areas, setup instructions, architecture overview, privacy notes and documentation links.
- Added a dedicated documentation hub and refreshed guide headings with consistent emoji-led navigation.
- No project files, credentials, local profiles or existing FreeLLMAPI installation are changed by this release.

## 0.14.1 — Premium dashboard refresh

- Added a dedicated premium visual layer with refined spacing, richer glass surfaces, subtle accent lighting, elevated cards, improved typography and more deliberate interaction states.
- Refined desktop navigation and top bar; mobile navigation now scrolls horizontally instead of wrapping into a crowded multi-row menu.
- Improved responsive page headers, form controls, empty states, notifications and modal surfaces.
- Kept the existing dark/light/auto themes, accent colours, density preferences, CSP approach and zero-build dashboard architecture.
- This is a visual-only enhancement: no project folders, credentials, settings, or existing FreeLLMAPI installation are changed.

## 0.14.0 — 📁 Project Hub and web project runner

- Added a Project Hub inside Projects: import GitHub repositories directly into a user-selected folder on any available Windows drive, or register an existing local folder without copying or moving it.
- Detect common Node.js web stacks and package managers (Vite, Next.js, Nuxt, Angular, Vue, React, Svelte; npm, pnpm, Yarn and Bun) from project metadata without running project code.
- Added explicit dependency-install and package-script Start/Stop actions, per-project logs, local URL discovery from logs, and safe unregister that always keeps project files.
- Project Hub registry and runtime logs stay in ignored local state/ and logs/; imported project files stay in the exact destination selected by the user. Docker remains optional.
- Security: importing only clones files; package installation and project scripts require separate confirmation. Only package.json script names are accepted; arbitrary shell commands are not exposed.
- Added tests for framework detection, package-manager selection, local folder registration, and non-destructive unregister.
- Verification note: the GitHub connector can commit source changes but does not provide a Windows runtime. Run `npm run check` and `npm test` on the target Windows machine before relying on process launch/stop behaviour.

## 0.13.0 — ⭐ Favourites and Test all

- **Favourites**: star up to 12 tools in the Catalogue; they appear as a quick-launch row on Overview (Launch for installed assistants, otherwise a shortcut to the catalogue entry). Stored as `favorites` in the portable device profile, so they sync with everything else; applying a kit or saving the Device sync form keeps them.
- **Test all** in Provider manager: checks every saved provider profile (a few at a time) and shows reachable/failed, latency and the reason in one table. Keys are read from the server environment exactly as in the single test and are never returned (a test asserts this).
- Verification: 48 tests pass; exercised in headless Chromium (starring, Overview row, Test all against an unreachable gateway, no console errors).
