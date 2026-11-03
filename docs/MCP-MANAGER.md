# MCP Server Manager

Portable MCP definitions with per-client config previews.

**Saving a profile is not installation, connection or a health check.** RumiStack does not launch MCP processes, run package installs, perform OAuth or edit any client configuration.

## Profile shape

```json
{ "id": "context7", "name": "Context7", "transport": "stdio",
  "command": "npx", "args": ["-y", "@upstash/context7-mcp"],
  "envVars": ["CONTEXT7_API_KEY"], "clients": ["claude-code", "codex"] }
```

```json
{ "id": "github", "name": "GitHub MCP Server", "transport": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headerEnv": { "Authorization": "GITHUB_PERSONAL_ACCESS_TOKEN" },
  "envVars": [], "clients": ["claude-code", "vscode"] }
```

Rules: `stdio` needs a bare executable name (no path, no spaces) and may not have a URL; `http` needs an HTTPS URL (HTTP only for loopback) and may not have a command. Credentials are environment-variable names only, either in `envVars` or mapped to a header in `headerEnv`.

## Templates

OpenAI Developer Docs, Context7, Playwright MCP and the GitHub MCP Server.

## Client previews

| Client | Output |
| --- | --- |
| Claude Code | a `claude mcp add ...` PowerShell command that expands `$env:NAME` at run time |
| OpenCode | an `mcp` entry for `opencode.json` using `{env:NAME}` |
| Codex CLI | a `[mcp_servers.<id>]` table for `config.toml` (`env_vars`, `bearer_token_env_var`) |
| VS Code | a `servers` entry for `.vscode/mcp.json` using `${env:NAME}` |

Field names for Codex CLI and VS Code follow upstream documentation at the time of writing; check your installed release.

## Windows notes

Some clients cannot spawn `npx` directly on native Windows. If a server fails to start, wrap it as `cmd /c npx ...`. After pulling `config/mcp-servers.json` onto a new laptop, regenerate snippets, merge them by hand and verify each connection inside the client. OAuth sessions and token values are never copied between laptops.
