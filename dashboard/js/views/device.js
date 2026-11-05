import { h, api, attempt, field, pageHeader, readChecked, toast, copyText, icon, badge, confirmDialog } from '../core.js';

export async function renderDevice(root, { navigate }) {
  const [reg, prof, kitData, mcpData] = await Promise.all([
    api('GET', '/api/registry/tools'), api('GET', '/api/profile'), api('GET', '/api/kits'), api('GET', '/api/mcp')
  ]);
  let profile = prof.profile;
  const toolName = new Map(reg.tools.map((t) => [t.id, t.name]));
  const mcpHave = new Set(mcpData.servers.map((s) => s.id));
  const mcpName = new Map(mcpData.templates.map((t) => [t.id, t.name]));

  // ---------------------------------------------------------------- starter kits
  function missingFor(kit) {
    const have = new Set(profile.tools);
    const haveSrc = new Set(profile.sources);
    const haveExt = new Set(profile.vscodeExtensions.map((e) => e.toLowerCase()));
    return {
      tools: kit.tools.filter((t) => !have.has(t)),
      sources: kit.sources.filter((t) => !haveSrc.has(t)),
      extensions: kit.vscodeExtensions.filter((e) => !haveExt.has(e.toLowerCase())),
      mcp: kit.mcp.filter((m) => !mcpHave.has(m))
    };
  }

  async function applyKit(kit, missing) {
    const lines = [
      ...missing.tools.map((id) => `Tool: ${toolName.get(id) ?? id}`),
      ...missing.sources.map((id) => `Source checkout: ${toolName.get(id) ?? id}`),
      ...missing.extensions.map((e) => `VS Code extension: ${e}`),
      ...missing.mcp.map((id) => `MCP profile: ${mcpName.get(id) ?? id}`)
    ];
    const ok = await confirmDialog({
      title: `Apply "${kit.name}"?`,
      message: 'This adds the items below to your saved profiles. Nothing is removed, and nothing is installed until you run a restore.',
      confirmLabel: 'Apply kit',
      details: h('ul', { class: 'plain' }, lines.map((l) => h('li', {}, icon('plus', 13), l)))
    });
    if (!ok) return;
    const res = await attempt(() => api('POST', '/api/kits/apply', { id: kit.id }), `Applied ${kit.name}`);
    if (res) navigate('device');
  }

  const kitGrid = h('div', { class: 'grid' }, kitData.kits.map((kit) => {
    const m = missingFor(kit);
    const total = m.tools.length + m.sources.length + m.extensions.length + m.mcp.length;
    return h('article', { class: 'card kit' },
      h('div', { class: 'card-head' }, h('span', { class: 'kit-icon' }, icon(kit.icon ?? 'layers', 20)), h('div', {}, h('h3', {}, kit.name)),
        total === 0 ? badge('applied', 'ok') : null),
      h('p', {}, kit.description),
      h('div', { class: 'chips' },
        m.tools.length ? badge(`+${m.tools.length} tools`, 'accent') : null, m.sources.length ? badge(`+${m.sources.length} sources`, 'accent') : null,
        m.mcp.length ? badge(`+${m.mcp.length} MCP`, 'accent') : null, m.extensions.length ? badge(`+${m.extensions.length} extensions`, 'accent') : null,
        total === 0 ? h('span', { class: 'faint' }, 'Everything in this kit is already in your profile.') : null),
      h('div', { class: 'row' }, h('button', { class: 'btn small primary', type: 'button', disabled: total === 0, onclick: () => applyKit(kit, m) }, icon('plus', 13), 'Apply kit')));
  }));

  // ---------------------------------------------------------------- manual selection
  const toolBox = h('div', {});
  const sourceBox = h('div', { class: 'checks' });
  const extBox = h('textarea', { rows: 4, 'aria-label': 'VS Code extension IDs', placeholder: 'saoudrizwan.claude-dev\nms-python.python' });
  const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  const count = h('span', {});

  function paint() {
    const chosen = new Set(profile.tools);
    toolBox.replaceChildren(...reg.categories.map((cat) => h('div', { style: 'margin-bottom:16px' },
      h('label', {}, cat.name),
      h('div', { class: 'checks' }, reg.tools.filter((t) => t.category === cat.id).map((t) =>
        h('label', {}, h('input', { type: 'checkbox', name: 'tools', value: t.id, checked: chosen.has(t.id) }), h('span', {}, t.name),
          t.install.type === 'manual' ? h('span', { class: 'badge' }, 'manual') : null))))));
    const srcChosen = new Set(profile.sources);
    sourceBox.replaceChildren(...reg.tools.filter((t) => t.clone).map((t) =>
      h('label', {}, h('input', { type: 'checkbox', name: 'sources', value: t.id, checked: srcChosen.has(t.id) }), h('span', {}, t.name))));
    extBox.value = profile.vscodeExtensions.join('\n');
    updateCount();
  }

  function updateCount() { count.textContent = `${readChecked(toolBox, 'tools').length} tools selected`; }
  toolBox.addEventListener('change', updateCount);

  function collect() {
    return {
      schemaVersion: 1,
      tools: readChecked(toolBox, 'tools'),
      sources: readChecked(sourceBox, 'sources'),
      vscodeExtensions: extBox.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
      favorites: profile.favorites ?? []
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
      profile = { schemaVersion: 1, tools: parsed.tools ?? [], sources: parsed.sources ?? [], vscodeExtensions: parsed.vscodeExtensions ?? [], favorites: parsed.favorites ?? profile.favorites ?? [] };
      paint();
      toast('Imported into the form. Review it, then press Save profile (the server validates it).', 'info');
    } catch {
      toast('That file is not valid JSON.', 'error');
    }
    importInput.value = '';
  });

  root.append(
    ...pageHeader('Device sync', 'Pick what every laptop should have. The profile holds only tool IDs, source checkouts and VS Code extension IDs. No keys, sessions or project code.', { iconName: 'laptop' }),
    h('h2', { style: 'margin-top:0' }, icon('layers', 16), 'Starter kits'),
    h('p', { class: 'muted', style: 'margin:-4px 0 12px' }, 'One-click bundles that merge into your profiles. Applying a kit saves immediately and keeps a backup of what it replaced.'),
    kitGrid,
    h('h2', {}, icon('grid', 16), 'Choose tools yourself', h('span', { class: 'badge accent' }, count)),
    h('div', { class: 'panel' }, toolBox),
    h('div', { class: 'panel' }, h('h2', {}, 'Optional source checkouts'),
      h('p', { class: 'muted' }, 'Shallow clones into the git-ignored sources/ folder, from a fixed allowlist.'), sourceBox),
    h('div', { class: 'panel' }, field('VS Code extensions', extBox, 'One publisher.extension ID per line.')),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', type: 'button', onclick: save }, icon('save', 15), 'Save profile'),
      h('a', { class: 'btn', href: '/api/profile/export', download: 'portable-profile.json' }, icon('download', 15), 'Export'),
      h('button', { class: 'btn', type: 'button', onclick: () => importInput.click() }, icon('upload', 15), 'Import…'),
      importInput),
    h('h2', {}, icon('git', 16), 'Move to another laptop'),
    h('ol', { class: 'muted' },
      h('li', {}, 'Save the profile, then use Sync & backups to commit and push config/.'),
      h('li', {}, 'On the new laptop clone the repository to D:\\RumiStack (or pull from the Sync page).'),
      h('li', {}, 'Run .\\scripts\\Restore-Profile.ps1 -WhatIf, review, then -Confirm.')),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', type: 'button', onclick: () => navigate('sync') }, icon('git', 13), 'Open Sync & backups'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: (e) => copyText('git add config/\ngit commit -m "Update RumiStack profiles"\ngit push', e.currentTarget) }, icon('copy', 13), 'Copy git commands'))
  );
  paint();
}
