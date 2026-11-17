import { h, api, attempt, icon, badge, pageHeader, copyText, toast, field } from '../core.js';

const DEFAULTS = {
  freellmapi: { id: 'freellmapi-local', name: 'FreeLLMAPI (local)', baseUrl: 'http://127.0.0.1:3001/v1', model: 'auto', apiKeyEnv: 'FREELLMAPI_API_KEY', protocols: ['openai-chat'] },
  omniroute: { id: 'omniroute-local', name: 'OmniRoute (local)', baseUrl: 'http://127.0.0.1:20128/v1', model: 'auto', apiKeyEnv: 'OMNIROUTE_API_KEY', protocols: ['openai-chat'] }
};

const ASSISTANT_IDS = ['claude-code', 'deepseek-harness', 'opencode', 'codex-cli', 'gemini-cli', 'aider', 'cline'];

export async function renderSetup(root, { navigate }) {
  const [registry, status, profileData, providerData] = await Promise.all([
    api('GET', '/api/registry/tools'),
    api('GET', '/api/tools/status'),
    api('GET', '/api/profile'),
    api('GET', '/api/providers')
  ]);
  const tools = new Map(registry.tools.map((t) => [t.id, t]));
  const assistants = ASSISTANT_IDS.map((id) => tools.get(id)).filter(Boolean);
  let selectedAssistant = assistants.find((t) => profileData.profile.tools.includes(t.id))?.id ?? 'claude-code';
  let selectedGateway = '';
  let step = 1;
  const stepDots = h('div', { class: 'wizard-steps' });
  const progress = h('div', { class: 'wizard-progress' });
  const content = h('div', { class: 'panel wizard-panel' });
  const footer = h('div', { class: 'row space wizard-footer' });
  const gatewayUrl = h('input', { type: 'url', value: '', placeholder: 'http://127.0.0.1:3001/v1' });
  const gatewayModel = h('input', { type: 'text', value: 'auto', placeholder: 'auto' });
  const gatewayEnv = h('input', { type: 'text', value: '', placeholder: 'FREELLMAPI_API_KEY' });
  const gatewayFields = h('div', { class: 'form-grid' },
    field('Local API base URL', gatewayUrl, 'Use the URL shown by the running gateway.'),
    field('Default model', gatewayModel, 'Use a model ID actually exposed by your gateway.'),
    field('API key environment variable', gatewayEnv, 'Name only — never paste the secret value here.'));
  const titles = ['Choose your coding platform', 'Connect a model gateway (optional)', 'Review your setup'];

  function paintSteps() {
    stepDots.replaceChildren(...titles.map((label, i) => h('div', { class: `wizard-step${step === i + 1 ? ' active' : ''}${step > i + 1 ? ' done' : ''}` },
      h('span', {}, step > i + 1 ? '✓' : String(i + 1)), h('small', {}, label))));
    progress.replaceChildren(h('i', { style: `width:${Math.round(step / 3 * 100)}%` }));
  }

  function gatewayPreset() {
    if (!selectedGateway) return null;
    return providerData.presets.find((p) => p.id === selectedGateway) ?? DEFAULTS[selectedGateway];
  }

  function paintGatewayFields() {
    const preset = gatewayPreset();
    if (!preset) { gatewayUrl.value = ''; gatewayModel.value = 'auto'; gatewayEnv.value = ''; return; }
    const saved = providerData.profiles.find((p) => p.id === DEFAULTS[selectedGateway].id);
    gatewayUrl.value = saved?.baseUrl ?? preset.baseUrl;
    gatewayModel.value = saved?.model ?? preset.model;
    gatewayEnv.value = saved?.apiKeyEnv ?? preset.apiKeyEnv;
  }

  function renderStep() {
    paintSteps();
    if (step === 1) {
      content.replaceChildren(
        h('div', { class: 'wizard-intro' }, h('span', { class: 'eyebrow' }, 'STEP 01 · REQUIRED'),
          h('h2', {}, 'Pick your main coding assistant'),
          h('p', {}, 'Choose one platform to start. You can install more later — RumiStack does not lock you into a single assistant.')),
        h('div', { class: 'assistant-choices' }, assistants.map((tool) => {
          const installed = status.statuses[tool.id]?.installed === true;
          const selected = selectedAssistant === tool.id;
          return h('button', { class: `assistant-choice${selected ? ' selected' : ''}`, type: 'button', 'aria-pressed': String(selected), onclick: () => { selectedAssistant = tool.id; renderStep(); } },
            h('div', { class: 'assistant-choice-top' }, h('strong', {}, tool.name), badge(installed ? 'Detected' : tool.install.type === 'manual' ? 'Manual setup' : 'Install needed', installed ? 'ok' : 'info')),
            h('p', {}, tool.description),
            h('span', { class: 'choice-check' }, selected ? icon('check-circle', 18) : icon('circle', 18)));
        })),
        h('div', { class: 'notice info' }, icon('shield-check', 16), h('span', {}, 'Install commands are shown for review and copied to your clipboard. RumiStack will not silently run installers or sign in to services.'))
      );
      footer.replaceChildren(
        h('span', { class: 'muted' }, 'You can change this later in Tool library.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { step = 2; renderStep(); } }, 'Continue', icon('arrow-right', 15))
      );
    } else if (step === 2) {
      content.replaceChildren(
        h('div', { class: 'wizard-intro' }, h('span', { class: 'eyebrow' }, 'STEP 02 · OPTIONAL'),
          h('h2', {}, 'Do you want a model gateway?'),
          h('p', {}, 'A gateway is useful when you want to route an assistant to FreeLLMAPI, OmniRoute or another compatible local endpoint. You can skip this completely and use your assistant’s normal sign-in.')),
        h('div', { class: 'gateway-choices' },
          h('button', { class: `gateway-choice${selectedGateway === '' ? ' selected' : ''}`, type: 'button', onclick: () => { selectedGateway = ''; paintGatewayFields(); renderStep(); } },
            h('strong', {}, 'No gateway for now'), h('p', {}, 'Simplest setup — use your assistant’s built-in account or provider.')),
          ...['freellmapi', 'omniroute'].map((id) => {
            const tool = tools.get(id);
            return h('button', { class: `gateway-choice${selectedGateway === id ? ' selected' : ''}`, type: 'button', onclick: () => { selectedGateway = id; paintGatewayFields(); renderStep(); } },
              h('strong', {}, tool?.name ?? id), h('p', {}, tool?.description ?? 'Local model gateway.'));
          })),
        selectedGateway ? h('div', { class: 'gateway-config' },
          h('h3', {}, 'Connection defaults'),
          gatewayFields,
          h('p', { class: 'faint' }, 'These values are editable defaults. Confirm the actual port, model and authentication settings in the gateway before testing.')) : null,
        h('div', { class: 'notice info' }, icon('info', 16), h('span', {}, 'Docker is not required. Selecting a gateway does not install or start it. You will explicitly import/register and start the project from Projects.'))
      );
      footer.replaceChildren(
        h('button', { class: 'btn', type: 'button', onclick: () => { step = 1; renderStep(); } }, icon('arrow-left', 15), 'Back'),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { selectedGateway = ''; step = 3; renderStep(); } }, 'Skip gateway'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { step = 3; renderStep(); } }, 'Continue', icon('arrow-right', 15)))
      );
    } else {
      const assistant = tools.get(selectedAssistant);
      const gateway = selectedGateway ? tools.get(selectedGateway) : null;
      const existingProvider = selectedGateway ? providerData.profiles.find((p) => p.id === DEFAULTS[selectedGateway].id) : null;
      const installCmd = assistant?.id === 'deepseek-harness' ? 'npx @deepseek-ai/dsh web' : assistant?.install.type === 'npm' ? `npm install -g ${assistant.install.package}`
        : assistant?.install.type === 'winget' ? `winget install --id ${assistant.install.package} --exact` : null;
      const alreadyInstalled = status.statuses[selectedAssistant]?.installed === true;
      content.replaceChildren(
        h('div', { class: 'wizard-intro' }, h('span', { class: 'eyebrow' }, 'STEP 03 · REVIEW'),
          h('h2', {}, 'Your developer setup is ready to save'),
          h('p', {}, 'Review the choices below. Saving updates your RumiStack profile; it does not execute any external code.')),
        h('div', { class: 'review-list' },
          h('div', { class: 'review-item' }, icon('terminal', 19), h('div', {}, h('strong', {}, assistant.name), h('p', {}, alreadyInstalled ? 'Already detected on this laptop.' : 'Selected as your primary coding platform.'))),
          gateway ? h('div', { class: 'review-item' }, icon('server', 19), h('div', {}, h('strong', {}, gateway.name), h('p', {}, existingProvider ? 'An existing provider profile will be updated.' : 'A local provider profile will be created.'))) :
            h('div', { class: 'review-item' }, icon('check-circle', 19), h('div', {}, h('strong', {}, 'No gateway selected'), h('p', {}, 'You can use your assistant’s built-in sign-in.')))),
        installCmd && !alreadyInstalled ? h('div', { class: 'install-command' }, h('div', {}, h('strong', {}, assistant.id === 'deepseek-harness' ? 'Launch command' : 'Install command'), h('p', { class: 'muted' }, 'Review and run this in PowerShell when you are ready.')),
          h('pre', {}, installCmd), h('button', { class: 'btn small', type: 'button', onclick: (e) => copyText(installCmd, e.currentTarget) }, icon('copy', 14), 'Copy command')) :
          !alreadyInstalled ? h('div', { class: 'notice info' }, icon('book-open', 16), h('span', {}, 'This assistant uses a manual installation path. Open its official guide from the Tool library.')) : null,
        h('div', { class: 'notice info' }, icon('lock', 16), h('span', {}, 'API keys and account passwords are never requested or saved by this wizard.'))
      );
      footer.replaceChildren(
        h('button', { class: 'btn', type: 'button', onclick: () => { step = 2; renderStep(); } }, icon('arrow-left', 15), 'Back'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => navigate('catalogue', { q: assistant.name }) }, 'Open install guide'),
          h('button', { class: 'btn primary', type: 'button', onclick: saveSetup }, icon('check', 15), 'Save my setup'))
      );
    }
  }

  async function saveSetup() {
    const btn = footer.querySelector('.btn.primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    const selectedTools = [...new Set([...profileData.profile.tools, selectedAssistant, ...(selectedGateway ? [selectedGateway] : [])])];
    const selectedSources = profileData.profile.sources;
    const saved = await attempt(() => api('PUT', '/api/profile', {
      schemaVersion: 1, tools: selectedTools, sources: selectedSources,
      vscodeExtensions: profileData.profile.vscodeExtensions, favorites: profileData.profile.favorites
    }), 'Your RumiStack setup profile has been saved.');
    if (!saved) { if (btn) { btn.disabled = false; btn.textContent = 'Save my setup'; } return; }
    if (selectedGateway) {
      const preset = gatewayPreset();
      const existing = providerData.profiles.find((p) => p.id === DEFAULTS[selectedGateway].id);
      const next = {
        id: DEFAULTS[selectedGateway].id, name: existing?.name ?? `${gateway.name} (local)`, preset: selectedGateway,
        baseUrl: gatewayUrl.value.trim() || preset.baseUrl,
        model: gatewayModel.value.trim() || preset.model,
        apiKeyEnv: gatewayEnv.value.trim() || preset.apiKeyEnv,
        protocols: existing?.protocols ?? preset.protocols,
        ...(existing?.notes ? { notes: existing.notes } : {})
      };
      const others = providerData.profiles.filter((p) => p.id !== next.id);
      const result = await attempt(() => api('PUT', '/api/providers', { schemaVersion: 1, profiles: [...others, next] }), 'Local provider profile saved.');
      if (!result) { if (btn) { btn.disabled = false; btn.textContent = 'Save my setup'; } return; }
      toast('Next: import or register the gateway in Projects, then install and start it using its upstream guide.', 'info');
      navigate('projects');
      return;
    }
    navigate('overview');
  }

  root.append(
    ...pageHeader('Setup wizard', 'A guided path to your first working AI coding environment. Only the essentials are required.', { iconName: 'sparkles' }),
    h('section', { class: 'hero wizard-hero' },
      h('div', {}, h('span', { class: 'eyebrow' }, 'RUMISTACK QUICKSTART'),
        h('h2', {}, 'Build your workspace, one clear step at a time.'),
        h('p', {}, 'Choose your coding platform first. Connect a gateway only if you need one. Add skills, agents and MCP whenever you are ready.')),
      badge('3 simple steps', 'accent')),
    stepDots, progress, content, footer
  );
  renderStep();
}
