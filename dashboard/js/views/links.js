import { h, api, attempt, icon, badge, avatar, modal, confirmDialog, pageHeader, emptyState, field, copyText, toast } from '../core.js';

const slug = (text) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'category';
const newId = () => `l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const hostOf = (url) => { try { return new URL(url).host; } catch { return url; } };

export async function renderLinks(root, { params, navigate }) {
  let data = await api('GET', '/api/links');
  let filter = params?.category ?? '';
  const search = h('input', { type: 'search', placeholder: 'Search saved links…', 'aria-label': 'Search saved links' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Categories' });
  const list = h('div', {});

  async function persist(next, message) {
    const saved = await attempt(() => api('PUT', '/api/links', next), message);
    if (!saved) return false;
    data = saved;
    draw();
    return true;
  }

  // ---- add / edit
  async function editLink(existing) {
    if (data.categories.length === 0) { toast('Create a category first.', 'error'); return manageCategories(); }
    const title = h('input', { type: 'text', value: existing?.title ?? '', maxlength: '100', placeholder: 'e.g. OmniRoute docs' });
    const url = h('input', { type: 'url', value: existing?.url ?? '', maxlength: '500', placeholder: 'https://…' });
    const category = h('select', {}, data.categories.map((c) => h('option', { value: c.id, selected: c.id === (existing?.category ?? (filter || data.categories[0].id)) }, c.name)));
    const note = h('textarea', { rows: '3', maxlength: '300', placeholder: 'Why is it useful? (optional)' }, existing?.note ?? '');
    note.value = existing?.note ?? '';
    const result = await modal({
      title: existing ? 'Edit link' : 'Save a link',
      body: [field('Title', title), field('Address', url), field('Category', category), field('Note', note)],
      actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, kind: 'primary' }]
    });
    if (!result) return;
    const entry = { id: existing?.id ?? newId(), title: title.value, url: url.value, category: category.value, ...(note.value.trim() ? { note: note.value } : {}) };
    const links = existing ? data.links.map((l) => (l.id === existing.id ? entry : l)) : [entry, ...data.links];
    await persist({ ...data, links }, existing ? 'Link updated' : 'Link saved');
  }

  // ---- categories
  async function manageCategories() {
    const rows = data.categories.map((c) => ({ ...c, count: data.links.filter((l) => l.category === c.id).length, removed: false }));
    const box = h('div', {});
    const adder = h('input', { type: 'text', maxlength: '40', placeholder: 'New category name' });
    function drawRows() {
      box.replaceChildren(...rows.filter((r) => !r.removed).map((r) => h('div', { class: 'row', style: 'margin-bottom:8px' },
        h('input', { type: 'text', value: r.name, maxlength: '40', 'aria-label': `Rename ${r.name}`, oninput: (e) => { r.name = e.target.value; } }),
        badge(`${r.count}`, ''),
        h('button', { class: 'btn small danger', type: 'button', disabled: r.count > 0, title: r.count > 0 ? 'Move or delete its links first' : 'Delete category', onclick: () => { r.removed = true; drawRows(); } }, icon('trash', 13)))));
    }
    drawRows();
    const addRow = () => {
      const name = adder.value.trim();
      if (!name) return;
      let id = slug(name); let n = 2;
      while (rows.some((r) => r.id === id)) id = `${slug(name)}-${n++}`;
      rows.push({ id, name, count: 0, removed: false });
      adder.value = '';
      drawRows();
    };
    adder.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addRow(); } });
    const result = await modal({
      title: 'Manage categories',
      body: [box, h('div', { class: 'row', style: 'margin-top:12px' }, adder, h('button', { class: 'btn small', type: 'button', onclick: addRow }, icon('plus', 13), 'Add'))],
      actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, kind: 'primary' }]
    });
    if (!result) return;
    addRow(); // an unsaved name still sitting in the box
    const categories = rows.filter((r) => !r.removed).map((r) => ({ id: r.id, name: r.name }));
    if (filter && !categories.some((c) => c.id === filter)) filter = '';
    await persist({ ...data, categories }, 'Categories saved');
  }

  // ---- drawing
  function draw() {
    const q = search.value.trim().toLowerCase();
    chips.replaceChildren(...[{ id: '', name: 'All', n: data.links.length }, ...data.categories.map((c) => ({ ...c, n: data.links.filter((l) => l.category === c.id).length }))]
      .map((c) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filter === c.id), onclick: () => { filter = c.id; draw(); } }, `${c.name} · ${c.n}`)));

    const catName = new Map(data.categories.map((c) => [c.id, c.name]));
    const shown = data.links.filter((l) => (!filter || l.category === filter)
      && (!q || `${l.title} ${l.url} ${l.note ?? ''} ${catName.get(l.category) ?? ''}`.toLowerCase().includes(q)));

    if (data.links.length === 0) {
      list.replaceChildren(h('div', { class: 'panel' }, emptyState('file', 'No saved links yet', 'Save the tools, docs and sites you want to remember. They sync to your other laptops with the rest of your profile.',
        [h('button', { class: 'btn primary', type: 'button', onclick: () => editLink() }, icon('plus', 15), 'Save your first link')])));
      return;
    }
    if (shown.length === 0) { list.replaceChildren(h('div', { class: 'panel' }, emptyState('search', 'Nothing matches', 'Try another word or category.'))); return; }

    list.replaceChildren(h('div', { class: 'grid' }, shown.map((l, i) => {
      const card = h('div', { class: 'card' },
        h('div', { class: 'row space' }, h('div', { class: 'row' }, avatar(l.id, l.title), h('div', {}, h('strong', { style: 'word-break:break-word' }, l.title), h('div', { class: 'faint' }, hostOf(l.url)))), badge(catName.get(l.category) ?? l.category, 'accent')),
        l.note ? h('p', {}, l.note) : null,
        h('div', { class: 'row', style: 'flex-wrap:wrap' },
          h('a', { class: 'btn small primary', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 13), 'Open'),
          h('button', { class: 'btn small', type: 'button', onclick: (e) => copyText(l.url, e.currentTarget) }, icon('copy', 13), 'Copy'),
          h('button', { class: 'btn small', type: 'button', onclick: () => editLink(l) }, 'Edit'),
          h('button', { class: 'btn small danger', type: 'button', 'aria-label': `Delete ${l.title}`, onclick: async () => {
            if (await confirmDialog({ title: 'Delete this link?', message: `"${l.title}" will be removed from your saved links.`, confirmLabel: 'Delete', danger: true })) {
              await persist({ ...data, links: data.links.filter((x) => x.id !== l.id) }, 'Link deleted');
            }
          } }, icon('trash', 13))));
      card.style.setProperty('--i', String(Math.min(i, 20)));
      return card;
    })));
  }

  search.addEventListener('input', draw);
  root.append(
    ...pageHeader('Saved links', 'Keep the tools, docs and sites you want to remember, grouped by category. Stored in your portable profile (config/saved-links.json) so every laptop has them.', {
      iconName: 'file',
      actions: [h('button', { class: 'btn', type: 'button', onclick: manageCategories }, icon('layers', 15), 'Categories'), h('button', { class: 'btn primary', type: 'button', onclick: () => editLink() }, icon('plus', 15), 'Save a link')]
    }),
    h('div', { class: 'search-field', style: 'margin-bottom:14px' }, icon('search', 16), search),
    chips, h('div', { style: 'height:14px' }), list,
    h('p', { class: 'faint', style: 'margin-top:18px' }, 'Do not save links that contain tokens or keys in the address; such links are rejected. Commit your config from Sync & backups to share the list.')
  );
  draw();
}
