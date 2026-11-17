# Changelog

## 0.14.1 — Premium dashboard refresh

- Added a dedicated premium visual layer with refined spacing, richer glass surfaces, subtle accent lighting, elevated cards, improved typography and more deliberate interaction states.
- Refined desktop navigation and top bar; mobile navigation now scrolls horizontally instead of wrapping into a crowded multi-row menu.
- Improved responsive page headers, form controls, empty states, notifications and modal surfaces.
- Kept the existing dark/light/auto themes, accent colours, density preferences, CSP approach and zero-build dashboard architecture.
- This is a visual-only enhancement: no project folders, credentials, settings, or existing FreeLLMAPI installation are changed.

## 0.14.0 — Project Hub and web project runner

- Added a Project Hub inside Projects: import GitHub repositories directly into a user-selected folder on any available Windows drive, or register an existing local folder without copying or moving it.
- Detect common Node.js web stacks and package managers (Vite, Next.js, Nuxt, Angular, Vue, React, Svelte; npm, pnpm, Yarn and Bun) from project metadata without running project code.
- Added explicit dependency-install and package-script Start/Stop actions, per-project logs, local URL discovery from logs, and safe unregister that always keeps project files.
- Project Hub registry and runtime logs stay in ignored local state/ and logs/; imported project files stay in the exact destination selected by the user. Docker remains optional.
- Security: importing only clones files; package installation and project scripts require separate confirmation. Only package.json script names are accepted; arbitrary shell commands are not exposed.
- Added tests for framework detection, package-manager selection, local folder registration, and non-destructive unregister.
- Verification note: the GitHub connector can commit source changes but does not provide a Windows runtime. Run `npm run check` and `npm test` on the target Windows machine before relying on process launch/stop behaviour.

## 0.13.0 — Favourites and Test all

- **Favourites**: star up to 12 tools in the Catalogue; they appear as a quick-launch row on Overview (Launch for installed assistants, otherwise a shortcut to the catalogue entry). Stored as `favorites` in the portable device profile, so they sync with everything else; applying a kit or saving the Device sync form keeps them.
- **Test all** in Provider manager: checks every saved provider profile (a few at a time) and shows reachable/failed, latency and the reason in one table. Keys are read from the server environment exactly as in the single test and are never returned (a test asserts this).
- Verification: 48 tests pass; exercised in headless Chromium (starring, Overview row, Test all against an unreachable gateway, no console errors).
