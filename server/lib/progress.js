// Core onboarding checklist. Optional integrations never block a usable workspace.

const ASSISTANTS = new Set(['claude-code', 'deepseek-harness', 'opencode', 'codex-cli', 'gemini-cli', 'aider', 'cline']);

export async function setupProgress({ store, gitState }) {
  const [device, providers] = await Promise.all([store.load('device'), store.load('providers')]);
  const selectedAssistant = device.tools.find((id) => ASSISTANTS.has(id));
  const steps = [
    {
      id: 'assistant',
      title: 'Choose your coding platform',
      detail: 'Select Claude Code, OpenCode, Codex or another assistant. This is the only required setup step.',
      done: Boolean(selectedAssistant),
      required: true,
      view: 'setup',
      cta: 'Start setup'
    },
    {
      id: 'gateway',
      title: 'Connect a model gateway',
      detail: 'Optional: configure FreeLLMAPI, OmniRoute or another compatible endpoint when you need it.',
      done: providers.profiles.length > 0,
      required: false,
      view: 'setup',
      cta: 'Configure provider'
    },
    {
      id: 'sync',
      title: 'Back up your setup',
      detail: 'Optional: connect Git sync to move your portable configuration between laptops.',
      done: Boolean(gitState.repo && gitState.remote && gitState.configChanges.length === 0 && gitState.lastCommit),
      required: false,
      view: 'sync',
      cta: 'Set up backup'
    }
  ];
  const required = steps.filter((s) => s.required);
  return { steps, done: required.filter((s) => s.done).length, total: required.length };
}
