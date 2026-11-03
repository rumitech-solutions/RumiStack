# Provider Manager

A provider profile describes one model gateway you run or use. It never contains a key.

```json
{
  "id": "omniroute-local",
  "name": "OmniRoute (local)",
  "preset": "omniroute",
  "baseUrl": "http://127.0.0.1:20128/v1",
  "model": "auto",
  "apiKeyEnv": "OMNIROUTE_API_KEY",
  "protocols": ["openai-chat"]
}
```

## Presets

FreeLLMAPI, OmniRoute and a custom OpenAI-compatible endpoint. Preset ports and model names are **starting points**: confirm them in your gateway's own dashboard or README before saving.

## Protocol flags

Tick only what your gateway really serves. Generation is refused when a client needs a protocol you have not flagged.

| Protocol | Needed by |
| --- | --- |
| OpenAI Chat Completions | OpenCode, Codex CLI (`wire_api = "chat"`) |
| OpenAI Responses | Codex CLI (`wire_api = "responses"`) |
| Anthropic Messages | Claude Code |

## Generated configuration

- **Claude Code** (PowerShell): sets `ANTHROPIC_BASE_URL` (trailing `/v1` removed because the client appends it), `ANTHROPIC_AUTH_TOKEN` from your variable, and `ANTHROPIC_MODEL`.
- **OpenCode** (`opencode.json`): an `@ai-sdk/openai-compatible` provider with `apiKey` set to `{env:NAME}`.
- **Codex CLI** (`config.toml`): a `[model_providers.<id>]` table with `env_key`.

Merge snippets by hand into existing configuration. RumiStack never overwrites assistant files.

## Model discovery

The dashboard can print a PowerShell command that calls `<baseUrl>/models` using `$env:NAME` for the bearer token. The dashboard does not run it, so the key never passes through RumiStack.

## Free inference caveat

Open-source routers do not make paid APIs free. Each upstream provider sets its own authentication, quota, acceptable-use policy and price, and free tiers change often.
