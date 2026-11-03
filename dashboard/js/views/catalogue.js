import { h, api, attempt, badge, codeBlock, pageHeader, installCommand, toast } from '../core.js';

export async function renderCatalogue(root) {
  const [reg, st, src] = await Promise.all([
    api('GET', '/api/registry/tools'),
    api('GET', '/api/tools/status'),
    api('GET', '/api/sources')
  ]);
  const statuses = st.statuses;
  const sources = new Map(src.sources.map((s) => [s.id, s]));

  const search = h('input', { type: 'search', placeholder: 'Search tools…', 'aria-label': 'Search tools' });
  const category = h('select', { 'aria-label': 'Category' },
    h('option', { value: '' }, 'All categories'),
    reg.categories.map((c) => h('option', { value: c.id }, c.name)));
  const list = h('div', { class: 'grid' });

  root.append(
    ...pageHeader('Catalogue', `${reg.tools.length} curated projects in ${reg.categories.length} categories (registry updated ${reg.updated}). RumiStack links to upstream projects; it does not bundle them.`),
    h('div', { class: 'row', style: 'margin-bottom:14px' }, h('div', { style: 'flex:2;min-width:200px' }, search), h('div', { style: 'flex:1;min-width:180px' }, category)),
    list
  );

  function draw() {
    const q = search.value.trim().toLowerCase();
    const cat = category.value;
    const shown = reg.tools.filter((t) => (!cat || t.category === cat) && (!q || `${t.name} ${t.description} ${t.id}`.toLowerCase().includes(q)));
    list.replaceChildren(...(shown.length ? shown.map(card) : [h('div', { class: 'empty' }, 'No tools match.')]));
  }

  function card(tool) {
    const status = statuses[tool.id];
    const cmd = installCommand(tool);
    const source = sources.get(tool.id);
    return h('div', { class: 'card' },
      h('h3', {}, tool.name,
        status.installed === true ? badge('installed', 'ok') : status.installed === false ? badge('not installed') : badge(tool.command ? 'unknown' : 'manual')),
      h('p', {}, tool.description),
      h('div', { class: 'row' }, badge(tool.category), badge(tool.install.type)),
      tool.install.note ? h('p', {}, tool.install.note) : null,
      cmd ? codeBlock(cmd) : null,
      h('div', { class: 'row' },
        h('a', { class: 'btn small', href: tool.repo, target: '_blank', rel: 'noopener noreferrer' }, 'Repository'),
        h('a', { class: 'btn small', href: tool.docs, target: '_blank', rel: 'noopener noreferrer' }, 'Docs'),
        tool.launchable && status.installed ? h('button', { class: 'btn small primary', type: 'button', onclick: () => attempt(() => api('POST', '/api/launch', { id: tool.id }), `Opened ${tool.name} in projects/`) }, 'Launch') : null,
        source && !source.cloned ? h('button', { class: 'btn small', type: 'button', onclick: (e) => cloneIt(tool, e.target) }, 'Clone source') : null,
        source && source.cloned ? h('button', { class: 'btn small', type: 'button', onclick: (e) => updateIt(tool, e.target) }, source.dirty ? 'Update (dirty, will skip)' : 'Update source') : null));
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
    if (res) {
      toast(res.skipped ?? (res.updated ? `${tool.name} updated` : `${tool.name} is already up to date`), res.skipped ? 'info' : 'ok');
    }
    draw();
  }

  search.addEventListener('input', draw);
  category.addEventListener('change', draw);
  draw();
}
