import { h, api, attempt, avatar, badge, codeBlock, icon, pageHeader, installCommand, updateCommand, toast, emptyState, copyText } from '../core.js';
import { compareVersions } from '../version.js';

export async function renderCatalogue(root, { params }) {
  const [reg, st, src] = await Promise.all([
    api('GET', '/api/registry/tools'),
    api('GET', '/api/tools/status'),
    api('GET', '/api/sources')
  ]);
  const statuses = st.statuses;
  const sources = new Map(src.sources.map((s) => [s.id, s]));
  let versions = {};
  let latest = {};
  let category = '';

  const search = h('input', { type: 'search', placeholder: 'Search tools…', 'aria-label': 'Search tools', value: params?.q ?? '' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Categories' });
  const summary = h('p', { class: 'muted' });
  const list = h('div', { class: 'grid' });
  const checkBtn = h('button', { class: 'btn', type: 'button', onclick: checkUpdates }, icon('refresh', 15), 'Check for updates');

  const installed = reg.tools.filter((t) => statuses[t.id]?.installed).length;
  root.append(
    ...pageHeader('Catalogue', `${reg.tools.length} curated projects in ${reg.categories.length} categories (registry updated ${reg.updated}). RumiStack links to upstream projects; it does not bundle them.`, { iconName: 'grid', actions: [checkBtn] }),
    h('div', { class: 'search-field', style: 'margin-bottom:14px' }, icon('search', 16), search),
    chips, summary, h('div', { style: 'height:14px' }), list
  );

  function drawChips() {
    const all = [{ id: '', name: 'All', n: reg.tools.length }, ...reg.categories.map((c) => ({ ...c, n: reg.tools.filter((t) => t.category === c.id).length }))];
    chips.replaceChildren(...all.map((c) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(category === c.id), onclick: () => { category = c.id; drawChips(); draw(); } }, c.name, h('small', {}, c.n))));
  }

  function draw() {
    const q = search.value.trim().toLowerCase();
    const shown = reg.tools.filter((t) => (!category || t.category === category) && (!q || `${t.name} ${t.description} ${t.id}`.toLowerCase().includes(q)));
    summary.textContent = `${shown.length} shown · ${installed} of ${reg.tools.length} detected on this laptop`;
    list.replaceChildren(...(shown.length ? shown.map(card) : [emptyState('search', 'No tools match', 'Try another word or clear the category filter.')]));
    list.querySelectorAll('.card').forEach((el, i) => el.style.setProperty('--i', String(Math.min(i, 14))));
  }

  function versionLine(tool) {
    const cur = versions[tool.id];
    const lat = latest[tool.id];
    if (!cur && !lat) return null;
    const outdated = cur && lat && compareVersions(cur, lat) < 0;
    return h('div', { class: 'ver' }, cur ? `v${cur}` : '', lat ? [h('span', { class: 'arrow' }, cur ? '→' : 'latest'), `v${lat}`] : null,
      outdated ? badge('update available', 'warn') : cur && lat ? badge('up to date', 'ok') : null);
  }

  function card(tool) {
    const status = statuses[tool.id];
    const cmd = installCommand(tool);
    const upd = updateCommand(tool);
    const source = sources.get(tool.id);
    const cur = versions[tool.id];
    const lat = latest[tool.id];
    const outdated = cur && lat && compareVersions(cur, lat) < 0;
    return h('article', { class: 'card' },
      h('div', { class: 'card-head' }, avatar(tool.id, tool.name),
        h('div', {}, h('h3', {}, tool.name), h('div', { class: 'faint', style: 'font-size:12px' }, tool.category)),
        status.installed === true ? badge('installed', 'ok') : status.installed === false ? badge('not installed') : badge(tool.command ? 'unknown' : 'manual', 'info')),
      h('p', {}, tool.description),
      versionLine(tool),
      tool.install.note ? h('p', { class: 'faint' }, tool.install.note) : null,
      cmd && !status.installed ? codeBlock(cmd, tool.install.type) : null,
      outdated && upd ? codeBlock(upd, 'update') : null,
      h('div', { class: 'row' },
        h('a', { class: 'btn small', href: tool.repo, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 13), 'Repo'),
        h('a', { class: 'btn small ghost', href: tool.docs, target: '_blank', rel: 'noopener noreferrer' }, 'Docs'),
        cmd && status.installed ? h('button', { class: 'btn small ghost', type: 'button', onclick: (e) => copyText(upd ?? cmd, e.currentTarget) }, icon('copy', 13), upd ? 'Update cmd' : 'Copy cmd') : null,
        tool.launchable && status.installed ? h('button', { class: 'btn small primary', type: 'button', onclick: () => attempt(() => api('POST', '/api/launch', { id: tool.id }), `Opened ${tool.name} in projects/`) }, icon('play', 12), 'Launch') : null,
        source && !source.cloned ? h('button', { class: 'btn small', type: 'button', onclick: (e) => cloneIt(tool, e.currentTarget) }, icon('download', 13), 'Clone source') : null,
        source && source.cloned ? h('button', { class: 'btn small', type: 'button', onclick: (e) => updateIt(tool, e.currentTarget) }, icon('refresh', 13), source.dirty ? 'Update (dirty, skips)' : 'Update source') : null));
  }

  async function cloneIt(tool, btn) {
    btn.disabled = true;
    btn.textContent = 'Cloning…';
    const res = await attempt(() => api('POST', '/api/sources/clone', { id: tool.id }), `Cloned ${tool.name} into sources/`);
    if (res) sources.set(tool.id, { id: tool.id, cloned: true, dirty: false });
    draw();
  }

  async function updateIt(tool, btn) {
    btn.disabled = true;
    btn.textContent = 'Updating…';
    const res = await attempt(() => api('POST', '/api/sources/update', { id: tool.id }));
    if (res) toast(res.skipped ?? (res.updated ? `${tool.name} updated` : `${tool.name} is already up to date`), res.skipped ? 'info' : 'ok');
    draw();
  }

  async function checkUpdates() {
    checkBtn.disabled = true;
    checkBtn.replaceChildren(icon('refresh', 15), 'Checking…');
    const res = await attempt(() => api('POST', '/api/tools/latest'));
    checkBtn.disabled = false;
    checkBtn.replaceChildren(icon('refresh', 15), 'Check for updates');
    if (!res) return;
    latest = Object.fromEntries(Object.entries(res.latest).filter(([, v]) => v));
    const outdated = reg.tools.filter((t) => versions[t.id] && latest[t.id] && compareVersions(versions[t.id], latest[t.id]) < 0);
    toast(outdated.length ? `${outdated.length} tool(s) have updates: ${outdated.map((t) => t.name).join(', ')}` : 'All detected npm tools are up to date', outdated.length ? 'info' : 'ok');
    draw();
  }

  search.addEventListener('input', draw);
  drawChips();
  draw();

  // Local version lookup runs `<tool> --version` for installed tools; fill it in after first paint.
  api('GET', '/api/tools/versions').then((res) => {
    versions = Object.fromEntries(Object.entries(res.versions).filter(([, v]) => v));
    draw();
    if (params?.check) checkUpdates();
  }).catch(() => { if (params?.check) checkUpdates(); });
}
