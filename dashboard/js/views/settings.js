import { h, api, attempt, icon, badge, confirmDialog, modal, pageHeader, loadInto, toast } from '../core.js';
import { ACCENTS, THEMES, getPref, setPref, getTheme, setTheme } from '../prefs.js';

export const SHORTCUTS = [
  ['Ctrl K  or  /', 'Open the command palette'],
  ['g then o', 'Overview'], ['g then c', 'Catalogue'], ['g then d', 'Device sync'], ['g then r', 'Repositories'],
  ['g then l', 'Saved links'], ['g then s', 'Sync & backups'], ['g then w', 'Gateways (Docker)'], ['g then p', 'Provider manager'],
  ['g then k', 'Skills marketplace'], ['g then a', 'Agent manager'], ['g then m', 'MCP servers'], ['g then h', 'Activity'],
  ['t', 'Cycle theme (auto / light / dark)'], ['?', 'Show these shortcuts'], ['Esc', 'Close a dialog']
];

export function shortcutList() {
  return h('div', { class: 'keys' }, SHORTCUTS.flatMap(([keys, label]) => [
    h('div', {}, keys.split(/\s+/).map((k) => (['then', 'or'].includes(k) ? ` ${k} ` : h('kbd', {}, k)))), h('span', {}, label)]));
}

export function showShortcuts() {
  return modal({ title: 'Keyboard shortcuts', body: shortcutList(), actions: [{ label: 'Close', value: true, kind: 'primary' }] });
}

function segmented(label, name, options, onChange) {
  const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  const draw = () => wrap.replaceChildren(...options.map(([value, text]) => h('button', { type: 'button', 'aria-pressed': String(getPref(name) === value), onclick: () => { setPref(name, value); draw(); onChange?.(); } }, text)));
  draw();
  return wrap;
}

export async function renderSettings(root, { navigate }) {
  const swatches = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Accent colour' });
  const drawSwatches = () => swatches.replaceChildren(...ACCENTS.map((a) => h('button', { class: 'swatch', type: 'button', 'data-accent': a.id, title: a.name, 'aria-label': a.name, 'aria-pressed': String(getPref('accent') === a.id), onclick: () => { setPref('accent', a.id); drawSwatches(); } })));
  drawSwatches();

  const themeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' });
  const drawTheme = () => themeSeg.replaceChildren(...THEMES.map((t) => h('button', { type: 'button', 'aria-pressed': String(getTheme() === t), onclick: () => setTheme(t) }, t[0].toUpperCase() + t.slice(1))));
  drawTheme();
  document.addEventListener('rumistack-theme', drawTheme);
  const about = h('div', {});
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });

  async function importFile() {
    const picked = file.files?.[0];
    file.value = '';
    if (!picked) return;
    if (picked.size > 250 * 1024) { toast('That file is too large for a RumiStack bundle (limit 250 KB).', 'error'); return; }
    let bundle;
    try { bundle = JSON.parse(await picked.text()); } catch { toast('That file is not valid JSON.', 'error'); return; }
    const preview = await attempt(() => api('POST', '/api/bundle/import', { bundle, dryRun: true }));
    if (!preview) return;
    const changed = preview.profiles.filter((p) => p.changed);
    if (changed.length === 0) { toast('Nothing to import: your profiles already match this bundle.', 'info'); return; }
    const ok = await confirmDialog({
      title: 'Import this bundle?',
      message: `Replaces ${changed.length} profile(s). The current version of each is backed up first, so you can restore it from Sync & backups.`,
      details: h('div', { class: 'row', style: 'flex-wrap:wrap' }, preview.profiles.map((p) => badge(`${p.kind}: ${p.changed ? 'will change' : 'same'}`, p.changed ? 'warn' : 'ok'))),
      confirmLabel: 'Import'
    });
    if (ok && await attempt(() => api('POST', '/api/bundle/import', { bundle, dryRun: false }), 'Bundle imported')) navigate('settings');
  }
  file.addEventListener('change', importFile);

  root.append(
    ...pageHeader('Settings', 'Appearance is saved in this browser only. Bundles move your portable profiles between laptops without Git.', { iconName: 'sparkles' }),
    h('h2', {}, icon('sun', 16), 'Appearance'),
    h('div', { class: 'panel' },
      h('div', { class: 'setting-row' }, h('div', {}, h('strong', {}, 'Accent colour'), h('small', {}, 'Applies to buttons, highlights and the health ring.')), swatches),
      h('div', { class: 'setting-row' }, h('div', {}, h('strong', {}, 'Theme'), h('small', {}, 'Follow the system, or force light or dark.')), themeSeg),
      h('div', { class: 'setting-row' }, h('div', {}, h('strong', {}, 'Density'), h('small', {}, 'Compact fits more on screen.')), segmented('Density', 'density', [['comfortable', 'Comfortable'], ['compact', 'Compact']])),
      h('div', { class: 'setting-row' }, h('div', {}, h('strong', {}, 'Motion'), h('small', {}, 'Reduce animations if they bother you.')), segmented('Motion', 'motion', [['full', 'Full'], ['reduced', 'Reduced']]))),

    h('h2', {}, icon('download', 16), 'Move to another laptop'),
    h('div', { class: 'panel' },
      h('p', { class: 'muted', style: 'margin-top:0' }, 'A bundle is one JSON file with all seven portable profiles (tools, repos, links, providers, skills, agents, MCP). It contains no keys or sessions. Importing validates everything first and backs up what it replaces.'),
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        h('a', { class: 'btn primary', href: '/api/bundle/export', download: 'rumistack-bundle.json' }, icon('download', 15), 'Export bundle'),
        h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, icon('upload', 15), 'Import bundle…'), file)),

    h('h2', {}, icon('command', 16), 'Keyboard shortcuts'),
    h('div', { class: 'panel' }, shortcutList()),

    h('h2', {}, icon('info', 16), 'About this workspace'),
    h('div', { class: 'panel' }, about)
  );

  await loadInto(about, () => api('GET', '/api/meta'), (m) => h('dl', { class: 'kv' },
    h('dt', {}, 'RumiStack'), h('dd', {}, `v${m.version}`), h('dt', {}, 'Workspace'), h('dd', {}, m.root), h('dt', {}, 'Config'), h('dd', {}, m.configDir),
    h('dt', {}, 'Server'), h('dd', {}, `127.0.0.1:${m.port} · Node ${m.node} · ${m.platform}`), h('dt', {}, 'Registry updated'), h('dd', {}, m.registryUpdated)));
}
