// Ctrl/Cmd+K command palette: jump to a view, find a tool, run a quick action.

import { h, icon, api } from './core.js';

let toolsCache = null;

function score(query, text) {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  const at = t.indexOf(q);
  if (at >= 0) return 100 - at; // substring hit, earlier is better
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 10 : 0; // loose subsequence match
}

export async function openPalette({ views, navigate, actions }) {
  if (document.querySelector('dialog.palette')) return;
  if (!toolsCache) {
    try { toolsCache = (await api('GET', '/api/registry/tools')).tools; } catch { toolsCache = []; }
  }

  let saved = { categories: [], links: [] };
  try { saved = await api('GET', '/api/links'); } catch { /* the palette still works without saved links */ }
  let repos = { repos: [] };
  try { repos = await api('GET', '/api/repos'); } catch { /* optional */ }
  const categoryName = new Map(saved.categories.map((c) => [c.id, c.name]));

  const items = [
    ...views.map((v) => ({ group: 'Go to', label: v.label, hint: '', icon: v.icon, keywords: v.id, run: () => navigate(v.id) })),
    ...toolsCache.map((t) => ({ group: 'Tools', label: t.name, hint: t.category, icon: 'box', keywords: `${t.id} ${t.description}`, run: () => navigate('catalogue', { q: t.name }) })),
    ...saved.links.map((l) => ({ group: 'Saved links', label: l.title, hint: categoryName.get(l.category) ?? '', icon: 'external', keywords: `${l.url} ${l.note ?? ''}`, run: () => window.open(l.url, '_blank', 'noopener,noreferrer') })),
    ...repos.repos.map((r) => ({ group: 'Repositories', label: r.url.replace('https://github.com/', ''), hint: r.cloned ? 'cloned' : 'not cloned', icon: 'layers', keywords: r.id, run: () => navigate('repos') })),
    ...actions.map((a) => ({ group: 'Actions', ...a }))
  ];

  const input = h('input', { type: 'text', placeholder: 'Search views, tools, saved links and actions…', 'aria-label': 'Command palette', autocomplete: 'off', spellcheck: 'false' });
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  const dialog = h('dialog', { class: 'palette', 'aria-label': 'Command palette' },
    h('div', { class: 'pal-input' }, icon('search', 18), input, h('kbd', {}, 'Esc')),
    list,
    h('div', { class: 'pal-foot' }, h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), 'navigate'), h('span', {}, h('kbd', {}, 'Enter'), 'open'), h('span', {}, h('kbd', {}, 'Esc'), 'close')));

  let shown = [];
  let active = 0;

  function close() { dialog.close(); dialog.remove(); }
  function run(item) { close(); item.run(); }

  function draw() {
    const q = input.value.trim();
    shown = items.map((it) => ({ it, s: score(q, `${it.label} ${it.keywords ?? ''}`) })).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s).slice(0, q ? 30 : 40).map((x) => x.it);
    active = Math.min(active, Math.max(shown.length - 1, 0));
    list.replaceChildren();
    if (shown.length === 0) {
      list.append(h('div', { class: 'pal-group' }, 'No matches'));
      return;
    }
    let group = null;
    shown.forEach((it, i) => {
      if (it.group !== group) { group = it.group; list.append(h('div', { class: 'pal-group' }, group)); }
      const row = h('button', { class: 'pal-item', type: 'button', role: 'option', 'aria-selected': String(i === active), onclick: () => run(it), onmousemove: () => { if (active !== i) { active = i; paint(); } } },
        h('span', { class: 'pal-ico' }, icon(it.icon ?? 'zap', 16)), h('span', {}, it.label), it.hint ? h('small', {}, it.hint) : null);
      row.dataset.index = String(i);
      list.append(row);
    });
  }

  function paint() {
    for (const row of list.querySelectorAll('.pal-item')) {
      const on = Number(row.dataset.index) === active;
      row.setAttribute('aria-selected', String(on));
      if (on) row.scrollIntoView({ block: 'nearest' });
    }
  }

  input.addEventListener('input', () => { active = 0; draw(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); run(shown[active]); }
  });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  document.body.append(dialog);
  draw();
  dialog.showModal();
  input.focus();
}
