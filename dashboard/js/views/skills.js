import { h, api, attempt, badge, checkboxes, readChecked, pageHeader, codeBlock, notes, toast } from '../core.js';

export async function renderSkills(root) {
  const data = await api('GET', '/api/skills');
  let selections = data.selections;

  const search = h('input', { type: 'search', placeholder: 'Search skills…', 'aria-label': 'Search skills' });
  const assistantBox = checkboxes(data.assistants, ['claude-code'], 'assistants');
  const scope = h('select', { 'aria-label': 'Scope' }, h('option', { value: 'global' }, 'Global (all projects)'), h('option', { value: 'project' }, 'Project (needs -ProjectPath)'));
  const catalogue = h('div', {});
  const chosenBox = h('div', {});
  const previewBox = h('div', {});

  const key = (s) => `${s.source}/${s.skill}/${s.scope}`;

  function drawCatalogue() {
    const q = search.value.trim().toLowerCase();
    catalogue.replaceChildren(...data.sources.map((src) => {
      const skills = src.skills.filter((k) => !q || `${k.id} ${k.description} ${src.name}`.toLowerCase().includes(q));
      if (q && skills.length === 0) return null;
      return h('div', { class: 'panel' },
        h('div', { class: 'row space' }, h('h2', { style: 'margin:0' }, src.name), h('div', { class: 'row' }, badge(src.tier, src.tier === 'official' ? 'ok' : src.installable ? '' : 'warn'), h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, 'Source'))),
        src.note ? h('p', { class: 'muted' }, src.note) : null,
        skills.length === 0 ? h('p', { class: 'muted' }, 'No listed skills.') : h('table', {}, h('tbody', {}, skills.map((k) => h('tr', {},
          h('td', {}, h('code', {}, k.id)), h('td', { class: 'muted' }, k.description),
          h('td', {}, src.installable ? h('button', { class: 'btn small', type: 'button', onclick: () => add(src.id, k.id) }, 'Add') : badge('manual')))))));
    }));
  }

  function add(source, skill) {
    const targets = readChecked(assistantBox, 'assistants');
    if (targets.length === 0) { toast('Select at least one assistant first.', 'error'); return; }
    const sel = { source, skill, assistants: targets, scope: scope.value };
    if (selections.some((s) => key(s) === key(sel))) { toast('Already selected for that scope.', 'error'); return; }
    selections = [...selections, sel];
    drawChosen();
  }

  function drawChosen() {
    chosenBox.replaceChildren(selections.length === 0
      ? h('div', { class: 'empty' }, 'Nothing selected yet.')
      : h('table', {}, h('thead', {}, h('tr', {}, ['Skill', 'Source', 'Assistants', 'Scope', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, selections.map((s) => h('tr', {}, h('td', {}, h('code', {}, s.skill)), h('td', { class: 'muted' }, s.source),
          h('td', {}, s.assistants.join(', ')), h('td', {}, badge(s.scope)),
          h('td', {}, h('button', { class: 'btn small danger', type: 'button', onclick: () => { selections = selections.filter((x) => key(x) !== key(s)); drawChosen(); } }, 'Remove')))))));
  }

  async function save() {
    const res = await attempt(() => api('PUT', '/api/skills', { schemaVersion: 1, selections }), 'Skills profile saved to config/skills-profile.json');
    if (res) { selections = res.selections; drawChosen(); }
  }

  async function preview() {
    const res = await attempt(() => api('GET', '/api/skills/preview'));
    if (!res) return;
    previewBox.replaceChildren(h('h2', {}, 'Restore preview (saved profile)'),
      res.commands.length ? codeBlock(res.commands.map((c) => (c.requiresProjectPath ? `# project scope: run from your project folder\n${c.command}` : c.command)).join('\n')) : h('div', { class: 'empty' }, 'Save a selection first.'),
      ...notes(res.notes));
  }

  root.append(
    ...pageHeader('Skills marketplace', 'Curated skill sources. Choose assistants and scope, save the desired state, and restore it on any laptop with Restore-Skills.ps1.'),
    h('div', { class: 'notice' }, 'Skills are instructions and sometimes scripts that your assistant will follow. Read the source, licence and any hooks before installing. Plugin-style and discovery-only sources are shown for reference but are never installed by RumiStack. The profile does not yet pin exact upstream versions.'),
    h('div', { class: 'panel' }, h('div', { class: 'form-grid' },
      h('div', { class: 'field' }, h('label', {}, 'Install for'), assistantBox),
      h('div', { class: 'field' }, h('label', {}, 'Scope'), scope),
      h('div', { class: 'field' }, h('label', {}, 'Filter'), search))),
    catalogue,
    h('h2', {}, 'Selected skills'), chosenBox,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save skills profile'), h('button', { class: 'btn', type: 'button', onclick: preview }, 'Preview restore commands')),
    previewBox
  );
  search.addEventListener('input', drawCatalogue);
  drawCatalogue();
  drawChosen();
}
