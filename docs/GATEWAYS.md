# ⚡ Model Gateway Setup (FreeLLMAPI & OmniRoute)

RumiStack treats **FreeLLMAPI** and **OmniRoute** as ordinary source repositories and local services. Docker is not required by RumiStack for either workflow.

## 🧭 Understand the pieces

- **AI coding platform:** Claude Code, OpenCode, Codex CLI, Gemini CLI, Aider or Cline — the tool you use to work on code.
- **Model gateway:** FreeLLMAPI or OmniRoute — a local API endpoint that connects an assistant to one or more model providers.
- **Provider profile:** The connection details saved in RumiStack → AI providers.

You can use a coding assistant without a gateway. Add a gateway only when you need one.

## 🚀 Setup flow

1. Open **Tool library → Model gateways & local runtimes**.
2. Find FreeLLMAPI or OmniRoute and choose **Clone repository**. This downloads source code only; it does not execute it.
3. Open the project's **Install guide** / upstream README and follow its current Windows installation instructions. Review scripts and environment examples before running them.
4. Start the service using the upstream documented non-Docker command. Keep its terminal open.
5. Confirm the service is responding at the local endpoint documented by the upstream project.
6. Open **AI providers**, select the matching preset, enter the Base URL and model, save, then choose **Test connection**.
7. Configure your coding assistant to use the gateway using the generated provider snippet or the assistant's own settings.

## 🔐 API keys and local settings

- Store secret values in environment variables on your computer.
- In RumiStack provider profiles, save only the environment-variable name (for example, `FREELLMAPI_API_KEY`), not the secret itself.
- Keep gateway bind addresses on loopback (`127.0.0.1`) unless you deliberately need LAN access and understand the security implications.
- Do not commit upstream `.env` files, local databases, cookies or tokens.

## 🧰 What RumiStack does and does not do

| RumiStack helps with | You still do in the upstream project |
| --- | --- |
| Keep the repository in your source list | Review and follow its installation guide |
| Store the provider Base URL and model | Install the project's own dependencies |
| Generate client configuration snippets | Complete provider sign-in / API-key setup |
| Test a compatible endpoint | Start, stop and update the local service |

RumiStack deliberately does not guess upstream install commands or execute an unreviewed repository's setup scripts.

## 🩺 Troubleshooting

- **Repository clone fails:** check Git is installed and the repository URL is still valid.
- **Service does not start:** use the upstream README and logs from the terminal where you started it.
- **Connection test fails:** check the service is running, the Base URL includes the correct API path (often `/v1`), and the selected environment variable is available to the RumiStack process.
- **Wrong model name:** use a model identifier actually exposed by the gateway.

> 💡 Start with one assistant and one provider. Add more integrations only when a real workflow needs them.
