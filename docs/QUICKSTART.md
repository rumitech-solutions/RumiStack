# 🧭 RumiStack — First-run Quickstart

Get from a fresh install to a usable AI coding environment without configuring every feature.

## 1. Start RumiStack

From PowerShell:

```powershell
cd D:\RumiStack
npm start
```

Open the local dashboard URL printed in the terminal.

## 2. Choose one coding platform

1. Open **Setup wizard**.
2. Pick one primary assistant: Claude Code, OpenCode, Codex CLI, Gemini CLI, Aider or Cline.
3. Review the install command or official install guide.
4. Run the command yourself in PowerShell, complete the assistant's sign-in, and return to RumiStack.
5. Save your setup profile.

You can add other assistants later. You do not need to install every tool in the library.

## 3. Decide whether you need a model gateway

This step is optional. Skip it if you use your assistant's normal account/provider.

If you choose FreeLLMAPI or OmniRoute:

1. Select the gateway in the wizard and confirm the default Base URL, model and environment-variable name.
2. Save the provider profile.
3. Open **Projects → Import GitHub repository**, or register an existing local folder.
4. Review the upstream Windows instructions. Use Project Hub Install/Start only when the detected runtime is supported.
5. Confirm the service's actual port and model, then test the connection in **AI providers**.

Docker is not required for RumiStack's normal workflow. RumiStack does not store API-key values; set them in your own environment.

## 4. Start building

- **Projects:** import or register the app you want to work on.
- **Repositories:** keep source projects you want to inspect or reuse.
- **Tool library:** discover additional coding platforms and utilities.
- **Guides & help:** learn optional skills, agents, MCP and device sync.

## 5. Add advanced capabilities only when useful

| Feature | Add it when |
| --- | --- |
| Model gateway | You want a compatible local/API endpoint shared across assistants |
| Skills | You want reusable workflows such as review, testing or frontend design |
| Agents | You need reusable role-specific instructions |
| MCP | Your assistant needs external tools or context |
| Backup & sync | You want to carry your portable configuration between laptops |
| API keys | You need to check which expected environment variables are set |

## 🔐 Safety defaults

- Repository import/clone downloads source; it does not run it.
- Dependency installation and project startup are separate explicit actions.
- Review upstream scripts before executing them.
- Keep API-key values and account sessions outside portable profiles.
- Registering an existing project folder does not move or overwrite it.

**Recommended principle:** one coding assistant first, one project next, integrations only when a real task needs them.
