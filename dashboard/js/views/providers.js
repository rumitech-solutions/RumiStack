import { h, api, attempt, field, checkboxes, readChecked, pageHeader, codeBlock, notes, badge, toast, icon, fill, modal } from '../core.js';

export async function renderProviders(root) {
  const data = await api('GET', '/api/providers');
  let profiles = data.profiles;
  let editing = null; // id of the profile loaded in the form, or null for a new one
  const outputBox = h('div', {});

  const preset = h('select', {}, h('option', { value: '' }, 'Start from a preset…'), data.presets.map((p) => h('option', { value: p.id }, p.name)));
  const idIn = h('input', { type: 'text', placeholder: 'omniroute-local' });
  const nameIn = h('input', { type: 'text', placeholder: 'OmniRoute (local)' });
  const urlIn = h('input', { type: 'text', placeholder: 'http://127.0.0.1:20128/v1' });
  const modelIn = h('input', { type: 'text', placeholder: 'auto' });
  const envIn = h('input', { type: 'text', placeholder: 'OMNIROUTE_API_KEY' });
  const notesIn = h('input', { type: 'text', placeholder: 'Optional note' });
  const hint = h('div', { class: 'notice info', hidden: true });
  const presetKind = { value: 'custom' };
  let protoBox = checkboxes(data.protocols, ['openai-chat'], 'protocols');
  const protoHolder = h('div', {}, protoBox);
  const listBox = h('div', {});

  preset.addEventListener('change', () => {
    const p = data.presets.find((x) => x.id === preset.value);
    if (!p) return;
    presetKind.value = p.id;
    idIn.value = p.id === 'custom' ? '' : `${p.id}-local`;
    nameIn.value = p.name;
    urlIn.value = p.baseUrl;
    modelIn.value = p.model;
    envIn.value = p.apiKeyEnv;
    protoBox = checkboxes(data.protocols, p.protocols, 'protocols');
    protoHolder.replaceChildren(protoBox);
    hint.textContent = p.hint;
    hint.hidden = false;
    editing = null;
  });

  function load(p) {
    editing = p.id;
    presetKind.value = p.preset;
    preset.value = '';
    idIn.value = p.id; nameIn.value = p.name; urlIn.value = p.baseUrl; modelIn.value = p.model; envIn.value = p.apiKeyEnv; notesIn.value = p.notes ?? '';
    protoBox = checkboxes(data.protocols, p.protocols, 'protocols');
    protoHolder.replaceChildren(protoBox);
    hint.hidden = true;
    outputBox.replaceChildren();
  }

  function formProfile() {
    const p = {
      id: idIn.value.trim(), name: nameIn.value.trim(), preset: presetKind.value,
      baseUrl: urlIn.value.trim(), model: modelIn.value.trim(), apiKeyEnv: envIn.value.trim(),
      protocols: readChecked(protoBox, 'protocols')
    };
    if (notesIn.value.trim()) p.notes = notesIn.value.trim();
    return p;
  }

  async function persist(next, message) {
    const res = await attempt(() => api('PUT', '/api/providers', { schemaVersion: 1, profiles: next }), message);
    if (res) { profiles = res.profiles; drawList(); return true; }
    return false;
  }

  async function save() {
    const p = formProfile();
    const others = profiles.filter((x) => x.id !== (editing ?? p.id));
    if (!editing && profiles.some((x) => x.id === p.id)) { toast(`A profile with id "${p.id}" already exists. Select it to edit.`, 'error'); return; }
    if (await persist([...others, p], 'Provider profile saved')) editing = p.id;
  }

  function drawList() {
    listBox.replaceChildren(...(profiles.length === 0
      ? [h('div', { class: 'empty' }, 'No provider profiles yet. Pick a preset below.')]
      : profiles.map((p) => h('div', { class: 'list-item', 'aria-selected': String(p.id === editing), onclick: () => { load(p); drawList(); } },
        h('div', {}, h('strong', {}, p.name), h('div', { class: 'muted' }, `${p.baseUrl} · ${p.model}`)),
        h('div', { class: 'row' }, p.protocols.map((x) => badge(x)),
          h('button', { class: 'btn small danger', type: 'button', onclick: async (e) => { e.stopPropagation(); if (await persist(profiles.filter((x) => x.id !== p.id), 'Profile removed') && editing === p.id) editing = null; } }, 'Delete'))))));
  }

  async function snippet(client) {
    if (!editing) { toast('Save the profile first, then select it.', 'error'); return; }
    const res = await attempt(() => api('POST', '/api/providers/snippet', { id: editing, client }));
    if (res) fill(outputBox, h('h2', {}, `Config for ${client}`), res.filename ? h('p', { class: 'muted' }, `Target file: ${res.filename}`) : null, codeBlock(res.snippet, res.language), ...notes(res.notes));
  }

  async function discovery() {
    if (!editing) { toast('Save the profile first, then select it.', 'error'); return; }
    const res = await attempt(() => api('POST', '/api/providers/discovery', { id: editing }));
    if (res) outputBox.replaceChildren(h('h2', {}, 'Model discovery'), codeBlock(res.command, 'powershell'), ...notes(res.notes));
  }

  async function testConnection(btn) {
    if (!editing) { toast('Save the profile first, then select it.', 'error'); return; }
    btn.disabled = true;
    outputBox.replaceChildren(h('div', { class: 'skeleton-group' }, h('div', { class: 'skeleton', style: 'width:60%' }), h('div', { class: 'skeleton', style: 'width:40%' })));
    const res = await attempt(() => api('POST', '/api/providers/test', { id: editing }));
    btn.disabled = false;
    if (!res) { outputBox.replaceChildren(); return; }
    fill(outputBox,
      h('h2', {}, icon('zap', 16), 'Connection test'),
      h('div', { class: 'panel' },
        h('div', { class: 'row' }, badge(res.ok ? 'connected' : 'failed', res.ok ? 'ok' : 'bad'),
          res.status ? badge(`HTTP ${res.status}`) : null, res.latencyMs !== null ? badge(`${res.latencyMs} ms`) : null,
          badge(res.keySet ? 'key found in environment' : 'no key in environment', res.keySet ? 'ok' : 'warn')),
        h('p', { style: 'margin:12px 0 0' }, res.message),
        res.models.length ? h('div', { style: 'margin-top:12px' }, h('label', {}, `Models (${res.modelCount})`), h('div', { class: 'chips' }, res.models.map((m) => badge(m, m === modelIn.value.trim() ? 'accent' : '')))) : null),
      h('p', { class: 'faint' }, 'The key is read from this server\'s environment, sent only to this profile\'s URL, and never stored or shown. Redirects are not followed.'));
  }

  root.append(
    ...pageHeader('Provider manager', 'Gateway profiles hold URLs, model IDs and the NAME of the environment variable that carries your key. Never the key itself.', {
      iconName: 'server',
      actions: [h('button', { class: 'btn', type: 'button', onclick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        const res = await attempt(() => api('POST', '/api/providers/test-all'));
        btn.disabled = false;
        if (!res) return;
        if (res.results.length === 0) { toast('Save at least one provider profile first.', 'info'); return; }
        await modal({
          title: 'Test all providers', wide: true,
          body: h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, res.results.map((r) => h('tr', {},
            h('td', {}, h('strong', {}, r.name)), h('td', {}, r.ok ? badge('reachable', 'ok') : badge('failed', 'warn')),
            h('td', {}, r.latencyMs != null ? `${r.latencyMs} ms` : '—'),
            h('td', { class: 'muted' }, r.ok ? `${r.modelCount ?? 0} model(s)` : r.message)))))),
          actions: [{ label: 'Close', value: true, kind: 'primary' }]
        });
      } }, icon('zap', 15), 'Test all')]
    }),
    h('div', { class: 'notice' }, 'Open-source routers are not free inference: every upstream provider has its own quota, terms and pricing, and free tiers change often.'),
    h('h2', {}, 'Saved profiles'), listBox,
    h('div', { class: 'panel' },
      field('Preset', preset), hint,
      h('div', { class: 'form-grid' },
        field('Profile ID', idIn, 'Lowercase letters, digits, hyphens.'), field('Display name', nameIn),
        field('Base URL', urlIn, 'HTTPS for remote hosts; HTTP only for localhost. No credentials or query string.'),
        field('Model ID', modelIn), field('API key environment variable', envIn, 'e.g. OMNIROUTE_API_KEY. Set the value in your own shell or secret manager.'),
        field('Notes', notesIn)),
      field('Protocols your gateway really supports', protoHolder),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save profile'),
        h('button', { class: 'btn', type: 'button', onclick: () => { editing = null; preset.value = ''; for (const i of [idIn, nameIn, urlIn, modelIn, envIn, notesIn]) i.value = ''; hint.hidden = true; drawList(); } }, 'New'))),
    h('h2', {}, 'Generate assistant config'),
    h('p', { class: 'muted' }, 'Select a saved profile above, then choose a target. Snippets are for review and manual merge; RumiStack never overwrites assistant config.'),
    h('div', { class: 'row' }, data.clients.map((c) => h('button', { class: 'btn', type: 'button', onclick: () => snippet(c.id) }, c.name)),
      h('button', { class: 'btn', type: 'button', onclick: discovery }, 'Model discovery command'),
      h('button', { class: 'btn primary', type: 'button', onclick: (e) => testConnection(e.currentTarget) }, icon('zap', 15), 'Test connection')),
    outputBox
  );
  drawList();
}
