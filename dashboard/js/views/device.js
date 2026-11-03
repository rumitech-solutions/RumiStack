import { h, api, attempt, field, pageHeader, readChecked, toast, copyText } from '../core.js';

export async function renderDevice(root) {
  const [reg, prof] = await Promise.all([api('GET', '/api/registry/tools'), api('GET', '/api/profile')]);
  let profile = prof.profile;

  const toolBox = h('div', {});
  const sourceBox = h('div', { class: 'checks' });
  const extBox = h('textarea', { rows: 5, 'aria-label': 'VS Code extension IDs', placeholder: 'saoudrizwan.claude-dev\nms-python.python' });
  const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });

  function paint() {
    const chosen = new Set(profile.tools);
    toolBox.replaceChildren(...reg.categories.map((cat) => h('div', { style: 'margin-bottom:14px' },
      h('label', {}, cat.name),
      h('div', { class: 'checks' }, reg.tools.filter((t) => t.category === cat.id).map((t) =>
        h('label', {}, h('input', { type: 'checkbox', name: 'tools', value: t.id, checked: chosen.has(t.id) }), t.name,
          t.install.type === 'manual' ? h('span', { class: 'badge' }, 'manual') : null))))));
    const srcChosen = new Set(profile.sources);
    sourceBox.replaceChildren(...reg.tools.filter((t) => t.clone).map((t) =>
      h('label', {}, h('input', { type: 'checkbox', name: 'sources', value: t.id, checked: srcChosen.has(t.id) }), t.name)));
    extBox.value = profile.vscodeExtensions.join('\n');
  }

  function collect() {
    return {
      schemaVersion: 1,
      tools: readChecked(toolBox, 'tools'),
      sources: readChecked(sourceBox, 'sources'),
      vscodeExtensions: extBox.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    };
  }

  async function save() {
    const res = await attempt(() => api('PUT', '/api/profile', collect()), 'Profile saved to config/portable-profile.json');
    if (res) { profile = res.profile; paint(); }
  }

  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      profile = { schemaVersion: 1, tools: parsed.tools ?? [], sources: parsed.sources ?? [], vscodeExtensions: parsed.vscodeExtensions ?? [] };
      paint();
      toast('Imported into the form. Review it, then press Save profile (the server validates it).', 'info');
    } catch {
      toast('That file is not valid JSON.', 'error');
    }
    importInput.value = '';
  });

  root.append(
    ...pageHeader('Device sync', 'Pick what every laptop should have. The profile holds only tool IDs, source checkouts and VS Code extension IDs. No keys, sessions or project code.'),
    h('div', { class: 'panel' }, h('h2', { style: 'margin-top:0' }, 'Tools'), toolBox),
    h('div', { class: 'panel' }, h('h2', { style: 'margin-top:0' }, 'Optional source checkouts'),
      h('p', { class: 'muted' }, 'Shallow clones into the git-ignored sources/ folder, from a fixed allowlist.'), sourceBox),
    h('div', { class: 'panel' }, field('VS Code extensions', extBox, 'One publisher.extension ID per line.')),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save profile'),
      h('a', { class: 'btn', href: '/api/profile/export', download: 'portable-profile.json' }, 'Export'),
      h('button', { class: 'btn', type: 'button', onclick: () => importInput.click() }, 'Import…'),
      importInput),
    h('h2', {}, 'Move to another laptop'),
    h('ol', { class: 'muted' },
      h('li', {}, 'Save the profile, then commit and push config/ from this laptop.'),
      h('li', {}, 'On the new laptop clone the repository to D:\\RumiStack (or git pull --ff-only).'),
      h('li', {}, 'Run .\\scripts\\Restore-Profile.ps1 -WhatIf, review, then -Confirm.')),
    h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onclick: () => copyText('git add config/\ngit commit -m "Update RumiStack profiles"\ngit push') }, 'Copy git commands'))
  );
  paint();
}
