# Maintenance

## Routine

```powershell
.\scripts\Update-Workspace.ps1   # fast-forward-only pull of RumiStack and clean sources\ checkouts
.\scripts\Doctor.ps1             # read-only health report
npm run check                    # syntax, JSON, registry, profile and hygiene checks
npm test                         # API, validation and snippet tests
npm run verify-registry          # network: confirm every registry URL still resolves
```

Updates never merge, rebase or discard. A repository with local changes is skipped and reported.

## Keeping the registry current

1. Run `npm run verify-registry` and fix any `FAIL` or `MOVED` lines in `registry/tools.json`.
2. When adding a tool: typed installer or `manual` with a note; `"clone": true` only for GitHub HTTPS repos you want on the clone allowlist; prefer official upstream links; check the licence.
3. Update the `updated` date in `registry/tools.json` (and `registry/skills.json` for skills changes).
4. Run `npm run check` and `npm test`.

## Before a release

- `npm run check` and `npm test` pass on Windows and Linux (CI runs both).
- On a Windows laptop, run `Restore-Profile.ps1 -WhatIf` and `Restore-Skills.ps1 -WhatIf` and read the output.
- Update `CHANGELOG.md` and `package.json` version.
