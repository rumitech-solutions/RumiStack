import { h, api, attempt, icon, badge, avatar, modal, pageHeader, loadInto, emptyState, field, copyText, toast } from '../core.js';

const TEMPLATES = [['AGENTS.md', 'AGENTS.md (universal agent instructions)'], ['CLAUDE.md', 'CLAUDE.md (Claude Code)']];

export async function renderProjects(root, { navigate }) {
  const box = h('div', {});
  const [meta, reg] = await Promise.all([api('GET', '/api/meta'), api('GET', '/api/registry/tools')]);
  const windows = meta.platform === 'win32';
  const launchable = reg.tools.filter((t) => t.launchable);

  async function create() {
    const name = h('input', { type: 'text', maxlength: '63', placeholder: 'my-new-app', autocomplete: 'off', spellcheck: 'false' });
    const git = h('input', { type: 'checkbox', checked: true });
    const picks = TEMPLATES.map(([file]) => h('input', { type: 'checkbox', value: file, checked: file === 'AGENTS.md' }));
    const ok = await modal({
      title: 'New project',
      body: [field('Name', name, 'Letters, digits, dot, underscore, hyphen.'),
        h('label', { style: 'display:flex;gap:8px;align-items:center;margin:8px 0' }, git, 'Initialise a Git repository (main branch)'),
        h('strong', {}, 'Add starter files'),
        ...TEMPLATES.map(([, label], i) => h('label', { style: 'display:flex;gap:8px;align-items:center;margin:6px 0' }, picks[i], label))],
      actions: [{ label: 'Cancel', value: false }, { label: 'Create', value: true, kind: 'primary' }]
    });
    if (!ok) return;
    const res = await attempt(() => api('POST', '/api/projects/create', { name: name.value.trim(), git: git.checked, files: picks.filter((p) => p.checked).map((p) => p.value) }), 'Project created');
    if (res) navigate('projects');
  }

  root.append(
    ...pageHeader('Projects', 'Your working projects live in the projects folder of your workspace. Create one with starter instruction files, then open it in VS Code or an assistant.', {
      iconName: 'terminal',
      actions: [h('button', { class: 'btn primary', type: 'button', onclick: create }, icon('plus', 15), 'New project')]
    }),
    windows ? null : h('div', { class: 'notice info', style: 'margin-bottom:14px' }, icon('info', 16), h('span', {}, 'Opening a project in VS Code or an assistant works on Windows. Creating and listing projects works everywhere.')),
    box,
    h('p', { class: 'faint', style: 'margin-top:16px' }, 'Projects stay on this laptop (the folder is git-ignored and not part of your portable profile). Each project can have its own Git remote.')
  );

  await loadInto(box, () => api('GET', '/api/projects'), ({ folder, projects }) => {
    if (projects.length === 0) {
      return h('div', { class: 'panel' }, emptyState('terminal', 'No projects yet', `Projects are folders inside ${folder}.`,
        [h('button', { class: 'btn primary', type: 'button', onclick: create }, icon('plus', 15), 'Create your first project')]));
    }
    return h('div', { class: 'grid' }, projects.map((p) => {
      const picker = h('select', { 'aria-label': `Open ${p.name} with`, style: 'max-width:150px' }, h('option', { value: 'vscode' }, 'VS Code'), launchable.map((t) => h('option', { value: t.id }, t.name)));
      return h('div', { class: 'card' },
        h('div', { class: 'row space' }, h('div', { class: 'row' }, avatar(p.name, p.name), h('strong', { style: 'word-break:break-all' }, p.name)),
          p.git ? badge(p.git.dirty ? `${p.git.branch ?? 'git'} · changes` : (p.git.branch ?? 'git'), p.git.dirty ? 'warn' : 'ok') : badge('no git', '')),
        h('div', { class: 'row', style: 'flex-wrap:wrap' }, TEMPLATES.map(([file]) => p.files[file]
          ? badge(file, 'ok')
          : h('button', { class: 'btn small ghost', type: 'button', title: `Add ${file} from the RumiStack template`, onclick: async () => {
            if (await attempt(() => api('POST', '/api/projects/template', { name: p.name, file }), `${file} added`)) navigate('projects');
          } }, icon('plus', 12), file))),
        h('div', { class: 'row', style: 'flex-wrap:wrap' },
          picker,
          h('button', { class: 'btn small primary', type: 'button', disabled: !windows, onclick: () => attempt(() => api('POST', '/api/projects/open', { name: p.name, with: picker.value }), 'Opening…') }, icon('play', 13), 'Open'),
          h('button', { class: 'btn small', type: 'button', onclick: (e) => copyText(`${folder}\\${p.name}`, e.currentTarget) }, icon('copy', 13), 'Copy path')));
    }));
  });
}
