import { h, api, attempt, icon, badge, modal, confirmDialog, pageHeader, emptyState, field, copyText, toast } from '../core.js';

const slug = (text) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
const newId = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const VAR_RE = /\{\{\s*([A-Za-z0-9_ -]{1,30}?)\s*\}\}/g;
export const variablesOf = (body) => [...new Set([...body.matchAll(VAR_RE)].map((m) => m[1]))];
export const fillVariables = (body, values) => body.replace(VAR_RE, (all, name) => (values[name] !== undefined && values[name] !== '' ? values[name] : all));

export async function renderPrompts(root, { params, navigate }) {
  let data = await api('GET', '/api/prompts');
  let filter = params?.category ?? '';
  const search = h('input', { type: 'search', placeholder: 'Search prompts…', 'aria-label': 'Search prompts', value: params?.q ?? '' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Categories' });
  const list = h('div', {});

  async function persist(next, message) {
    const saved = await attempt(() => api('PUT', '/api/prompts', next), message);
    if (!saved) return false;
    data = saved;
    draw();
    return true;
  }

  async function copyPrompt(p, button) {
    const vars = variablesOf(p.body);
    if (vars.length === 0) return copyText(p.body, button);
    const inputs = vars.map((v) => h('input', { type: 'text', 'aria-label': v, placeholder: v }));
    const ok = await modal({
      title: `Fill in "${p.title}"`,
      body: [h('p', { class: 'muted', style: 'margin-top:0' }, 'Leave a field empty to keep its {{placeholder}} in the copied text.'), ...vars.map((v, i) => field(v, inputs[i]))],
      actions: [{ label: 'Cancel', value: false }, { label: 'Copy', value: true, kind: 'primary' }]
    });
    if (ok) copyText(fillVariables(p.body, Object.fromEntries(vars.map((v, i) => [v, inputs[i].value]))));
  }

  async function edit(existing) {
    if (data.categories.length === 0) { toast('Create a category first.', 'error'); return manageCategories(); }
    const title = h('input', { type: 'text', value: existing?.title ?? '', maxlength: '100', placeholder: 'e.g. Review for bugs' });
    const category = h('select', {}, data.categories.map((c) => h('option', { value: c.id, selected: c.id === (existing?.category ?? (filter || data.categories[0].id)) }, c.name)));
    const body = h('textarea', { rows: '8', maxlength: '4000', placeholder: 'Write the prompt. Use {{name}} for parts you fill in each time.' });
    body.value = existing?.body ?? '';
    const ok = await modal({
      title: existing ? 'Edit prompt' : 'New prompt', wide: true,
      body: [field('Title', title), field('Category', category), field('Prompt', body, 'Never paste keys or passwords here; saves containing them are rejected.')],
      actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, kind: 'primary' }]
    });
    if (!ok) return;
    const entry = { id: existing?.id ?? newId(), title: title.value, category: category.value, body: body.value };
    await persist({ ...data, prompts: existing ? data.prompts.map((p) => (p.id === existing.id ? entry : p)) : [entry, ...data.prompts] }, existing ? 'Prompt updated' : 'Prompt saved');
  }

  async function manageCategories() {
    const rows = data.categories.map((c) => ({ ...c, count: data.prompts.filter((p) => p.category === c.id).length, removed: false }));
    const box = h('div', {});
    const adder = h('input', { type: 'text', maxlength: '40', placeholder: 'New category name' });
    const drawRows = () => box.replaceChildren(...rows.filter((r) => !r.removed).map((r) => h('div', { class: 'row', style: 'margin-bottom:8px' },
      h('input', { type: 'text', value: r.name, maxlength: '40', 'aria-label': `Rename ${r.name}`, oninput: (e) => { r.name = e.target.value; } }), badge(String(r.count), ''),
      h('button', { class: 'btn small danger', type: 'button', disabled: r.count > 0, title: r.count > 0 ? 'Move or delete its prompts first' : 'Delete category', onclick: () => { r.removed = true; drawRows(); } }, icon('trash', 13)))));
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
    const ok = await modal({ title: 'Manage categories', body: [box, h('div', { class: 'row', style: 'margin-top:12px' }, adder, h('button', { class: 'btn small', type: 'button', onclick: addRow }, icon('plus', 13), 'Add'))], actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, kind: 'primary' }] });
    if (!ok) return;
    addRow();
    const categories = rows.filter((r) => !r.removed).map((r) => ({ id: r.id, name: r.name }));
    if (filter && !categories.some((c) => c.id === filter)) filter = '';
    await persist({ ...data, categories }, 'Categories saved');
  }

  function draw() {
    const q = search.value.trim().toLowerCase();
    chips.replaceChildren(...[{ id: '', name: 'All', n: data.prompts.length }, ...data.categories.map((c) => ({ ...c, n: data.prompts.filter((p) => p.category === c.id).length }))]
      .map((c) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filter === c.id), onclick: () => { filter = c.id; draw(); } }, `${c.name} · ${c.n}`)));
    const catName = new Map(data.categories.map((c) => [c.id, c.name]));
    const shown = data.prompts.filter((p) => (!filter || p.category === filter) && (!q || `${p.title} ${p.body}`.toLowerCase().includes(q)));
    if (data.prompts.length === 0) { list.replaceChildren(h('div', { class: 'panel' }, emptyState('file', 'No prompts yet', 'Save the prompts you reuse. Use {{name}} for parts you fill in each time.', [h('button', { class: 'btn primary', type: 'button', onclick: () => edit() }, icon('plus', 15), 'New prompt')]))); return; }
    if (shown.length === 0) { list.replaceChildren(h('div', { class: 'panel' }, emptyState('search', 'Nothing matches', 'Try another word or category.'))); return; }
    list.replaceChildren(h('div', { class: 'grid' }, shown.map((p, i) => {
      const vars = variablesOf(p.body);
      const card = h('div', { class: 'card' },
        h('div', { class: 'row space' }, h('strong', {}, p.title), badge(catName.get(p.category) ?? p.category, 'accent')),
        h('p', { style: 'white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden' }, p.body),
        vars.length ? h('div', { class: 'row', style: 'flex-wrap:wrap' }, vars.map((v) => badge(`{{${v}}}`, ''))) : null,
        h('div', { class: 'row', style: 'flex-wrap:wrap' },
          h('button', { class: 'btn small primary', type: 'button', onclick: (e) => copyPrompt(p, e.currentTarget) }, icon('copy', 13), vars.length ? 'Fill & copy' : 'Copy'),
          h('button', { class: 'btn small', type: 'button', onclick: () => edit(p) }, 'Edit'),
          h('button', { class: 'btn small danger', type: 'button', 'aria-label': `Delete ${p.title}`, onclick: async () => {
            if (await confirmDialog({ title: 'Delete this prompt?', message: `"${p.title}" will be removed.`, confirmLabel: 'Delete', danger: true })) await persist({ ...data, prompts: data.prompts.filter((x) => x.id !== p.id) }, 'Prompt deleted');
          } }, icon('trash', 13))));
      card.style.setProperty('--i', String(Math.min(i, 20)));
      return card;
    })));
  }

  search.addEventListener('input', draw);
  root.append(
    ...pageHeader('Prompt library', 'Reusable prompts for your assistants, grouped by category. Use {{name}} for parts you fill in each time. Stored in your portable profile (config/prompts.json).', {
      iconName: 'sparkles',
      actions: [h('button', { class: 'btn', type: 'button', onclick: manageCategories }, icon('layers', 15), 'Categories'), h('button', { class: 'btn primary', type: 'button', onclick: () => edit() }, icon('plus', 15), 'New prompt')]
    }),
    h('div', { class: 'search-field', style: 'margin-bottom:14px' }, icon('search', 16), search), chips, h('div', { style: 'height:14px' }), list
  );
  draw();
}
