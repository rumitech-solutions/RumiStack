import { h, api, attempt, field, pageHeader, codeBlock, notes, toast } from '../core.js';

export async function renderAgents(root) {
  const data = await api('GET', '/api/agents');
  let profiles = data.profiles;
  let editing = null;

  const idIn = h('input', { type: 'text', placeholder: 'release-manager' });
  const nameIn = h('input', { type: 'text', placeholder: 'Release Manager' });
  const descIn = h('input', { type: 'text', placeholder: 'One sentence: when should this agent be used?' });
  const promptIn = h('textarea', { rows: 9, placeholder: 'Write the instructions this agent should follow…' });
  const format = h('select', { 'aria-label': 'Export format' }, data.formats.map((f) => h('option', { value: f.id }, f.name)));
  const listBox = h('div', {});
  const outBox = h('div', {});

  function load(p) {
    editing = p.id;
    idIn.value = p.id; nameIn.value = p.name; descIn.value = p.description; promptIn.value = p.prompt;
    outBox.replaceChildren();
    drawList();
  }

  function clear() {
    editing = null;
    for (const i of [idIn, nameIn, descIn, promptIn]) i.value = '';
    outBox.replaceChildren();
    drawList();
  }

  async function persist(next, message) {
    const res = await attempt(() => api('PUT', '/api/agents', { schemaVersion: 1, profiles: next }), message);
    if (res) { profiles = res.profiles; drawList(); return true; }
    return false;
  }

  async function save() {
    const p = { id: idIn.value.trim(), name: nameIn.value.trim(), description: descIn.value.trim(), prompt: promptIn.value.trim() };
    if (!editing && profiles.some((x) => x.id === p.id)) { toast(`An agent with id "${p.id}" already exists. Select it to edit.`, 'error'); return; }
    const others = profiles.filter((x) => x.id !== (editing ?? p.id));
    if (await persist([...others, p], 'Agent profile saved')) editing = p.id;
  }

  async function exportIt() {
    if (!editing) { toast('Save and select an agent first.', 'error'); return; }
    const res = await attempt(() => api('POST', '/api/agents/export', { id: editing, format: format.value }));
    if (res) outBox.replaceChildren(h('h2', {}, 'Export'), h('p', { class: 'muted' }, `Suggested path: ${res.filename}`), codeBlock(res.content, 'markdown'), ...notes(res.notes));
  }

  function drawList() {
    listBox.replaceChildren(...profiles.map((p) => h('div', { class: 'list-item', 'aria-selected': String(p.id === editing), onclick: () => load(p) },
      h('div', {}, h('strong', {}, p.name), h('div', { class: 'muted' }, p.description)),
      h('button', { class: 'btn small danger', type: 'button', onclick: async (e) => { e.stopPropagation(); if (await persist(profiles.filter((x) => x.id !== p.id), 'Agent removed') && editing === p.id) clear(); } }, 'Delete'))));
    if (profiles.length === 0) listBox.replaceChildren(h('div', { class: 'empty' }, 'No agents yet.'));
  }

  root.append(
    ...pageHeader('Agent manager', 'Reusable role prompts, stored once and exported to each assistant\'s format. Profiles hold prompts only: no credentials and no enforceable permissions.', { iconName: 'bot' }),
    h('div', { class: 'split' },
      h('div', {}, h('h2', { style: 'margin-top:0' }, 'Profiles'), listBox, h('button', { class: 'btn', type: 'button', onclick: clear }, 'New agent')),
      h('div', {},
        h('div', { class: 'panel' },
          h('div', { class: 'form-grid' }, field('ID', idIn, 'Lowercase letters, digits, hyphens.'), field('Name', nameIn)),
          field('Description', descIn), field('Prompt', promptIn),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save agent'), format, h('button', { class: 'btn', type: 'button', onclick: exportIt }, 'Export'))),
        outBox)));
  drawList();
}
