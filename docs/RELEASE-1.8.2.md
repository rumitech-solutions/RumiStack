# RumiStack v1.8.2

## Windows startup path fix

- Fixed shared PowerShell root detection. It now walks upward from the active script location until it finds both `package.json` and `server/index.js`, so it resolves the repository root rather than accidentally stopping in `scripts/`.
- The Windows launcher validates that the server entry point exists and invokes Node.js with its absolute path.
- Setup and other PowerShell scripts that use the shared helper also benefit from the corrected root detection.
- Normal startup remains local-only and does not pull, fetch or update Git.

## Verification

The Windows CI job executes a root-detection regression test and validates PowerShell script syntax. The cross-platform CI matrix also runs the Node.js checks and test suite.
