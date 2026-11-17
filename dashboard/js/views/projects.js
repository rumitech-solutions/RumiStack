import { h, api, attempt, icon, badge, avatar, modal, confirmDialog, pageHeader, loadInto, emptyState, field, copyText, toast } from '../core.js';

const TEMPLATES = [['AGENTS.md', 'AGENTS.md (universal agent instructions)'], ['CLAUDE.md', 'CLAUDE.md (Claude Code)']];

export async function renderProjects(root, { navigate }) {
  const box = h('div', {});
  const hub = h('div', {});
  const [meta, reg] = await Promise.all([api('GET', '/api/meta'), api('GET', '/api/registry/tools')]);
  const windows = meta.platform === 'win32';
  const launchable = reg.tools.filter((t) => t.launchable);
  const repoUrl = h('input', { type: 'url', placeholder: 'https://github.com/owner/repository', autocomplete: 'off', spellcheck: 'false' });
  const destination = h('input', { type: 'text', value: `${meta.root}${windows ? '\\' : '/'}projects`, placeholder: windows ? 'D:\\RumiStack\\projects' : '/home/user/projects' });
  const driveSelect = h('select', { hidden: true, onchange: () => { destination.value = driveSelect.value + 'RumiStack' + (windows ? String.fromCharCode(92) : '/') + 'projects'; } });
  const folderName = h('input', { type: 'text', placeholder: 'Optional folder name (defaults to repository name)' });
  const importBtn = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
    if (!repoUrl.value.trim() || !destination.value.trim()) return toast('Enter a GitHub URL and destination folder.', 'error');
    importBtn.disabled = true; importBtn.textContent = 'Importing…';
    const result = await attempt(() => api('POST', '/api/project-hub/import', { url: repoUrl.value.trim(), destination: destination.value.trim(), name: folderName.value.trim() || undefined }), 'Repository imported. No code was executed.');
    importBtn.disabled = false; importBtn.replaceChildren(icon('download', 15), 'Import repository');
    if (result) { repoUrl.value = ''; folderName.value = ''; refreshHub(); }
  } }, icon('download', 15), 'Import repository');
  const localPath = h('input', { type: 'text', placeholder: windows ? 'D:\\Projects\\my-existing-app' : '/home/user/projects/my-app' });
  const registerBtn = h('button', { class: 'btn', type: 'button', onclick: async () => {
    if (!localPath.value.trim()) return;
    const result = await attempt(() => api('POST', '/api/project-hub/register', { path: localPath.value.trim() }), 'Existing folder registered (not moved).');
    if (result) { localPath.value = ''; refreshHub(); }
  } }, icon('folder-plus', 15), 'Register existing folder');

  async function refreshHub() {
    await loadInto(hub, () => api('GET', '/api/project-hub'), ({ projects, defaultDestination, drives = [] }) => {
      destination.placeholder = defaultDestination;
      if (drives.length) {
        driveSelect.hidden = false;
        driveSelect.replaceChildren(...drives.map((d) => h('option', { value: d }, d.slice(0, 2))));
        const currentDrive = drives.find((d) => destination.value.toLowerCase().startsWith(d.toLowerCase())) ?? drives.find((d) => meta.root.toLowerCase().startsWith(d.toLowerCase()));
        if (currentDrive) driveSelect.value = currentDrive;
      }
      if (!projects.length) return h('div', { class: 'panel' }, emptyState('layers', 'No imported projects yet', 'Import a GitHub repository or register a folder already on your computer.'));
      return h('div', { class: 'grid' }, projects.map((p) => {
        const script = h('select', { 'aria-label': `Start script for ${p.name}`, style: 'max-width:150px' },
          ...(p.scripts ?? []).map((s) => h('option', { value: s, selected: s === p.preferredScript }, s)));
        const openUrl = h('a', { class: 'btn small', target: '_blank', rel: 'noopener noreferrer', hidden: true }, icon('external', 13), 'Open local site');
        async function showLogs() {
          const result = await attempt(() => api('POST', '/api/project-hub/logs', { id: p.id }));
          if (!result) return;
          const match = [...result.lines.matchAll(/https?:\\/\\/(?:localhost|127\\.0\\.0\\.1):\\d+(?:\\/[^\\s]*)?/g)].pop();
          if (match) { openUrl.href = match[0].replace(/[),.;]+$/, ''); openUrl.hidden = false; }
          await modal({ title: `Logs · ${p.name}`, wide: true, body: h('pre', { class: 'code', style: 'white-space:pre-wrap;max-height:60vh;overflow:auto' }, result.lines || 'No log output yet.'), actions: [{ label: 'Close', value: true, kind: 'primary' }] });
        }
        const actions = [];
        if (p.hasPackageJson) actions.push(h('button', { class: 'btn small', type: 'button', onclick: async () => {
          if (!(await confirmDialog({ title: 'Install dependencies?', message: 'This runs the project package manager and may execute dependency lifecycle scripts. Only continue if you trust this repository.', confirmLabel: 'Install' }))) return;
          if (await attempt(() => api('POST', '/api/project-hub/install', { id: p.id }), 'Dependencies installed')) refreshHub();
        } }, icon('download', 13), 'Install dependencies'));
        if (p.scripts?.length) actions.push(h('button', { class: 'btn small primary', type: 'button', disabled: p.running || p.missing, onclick: async () => {
          if (!(await confirmDialog({ title: `Run ${script.value}?`, message: 'This executes the selected script from package.json. Run code only from repositories you trust.', confirmLabel: 'Run project' }))) return;
          if (await attempt(() => api('POST', '/api/project-hub/start', { id: p.id, script: script.value }), 'Start requested. Check logs for the local URL.')) refreshHub();
        } }, icon('play', 13), 'Start'));
        if (p.running) actions.push(h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
          if (await attempt(() => api('POST', '/api/project-hub/stop', { id: p.id }), 'Stop requested')) refreshHub();
        } }, icon('square', 13), 'Stop'));
        actions.push(h('button', { class: 'btn small', type: 'button', onclick: showLogs }, icon('file-text', 13), 'Logs'));
        actions.push(openUrl);
        actions.push(h('button', { class: 'btn small', type: 'button', onclick: (e) => copyText(p.path, e.currentTarget) }, icon('copy', 13), 'Copy path'));
        actions.push(h('button', { class: 'btn small ghost', type: 'button', onclick: async () => {
          if (!(await confirmDialog({ title: 'Remove project from RumiStack?', message: 'Only removes the Project Hub entry. The actual project folder and its files will remain untouched.', confirmLabel: 'Unregister', danger: true }))) return;
          if (await attempt(() => api('POST', '/api/project-hub/unregister', { id: p.id }), 'Project unregistered; files kept.')) refreshHub();
        } }, icon('unlink', 13), 'Unregister'));
        return h('article', { class: 'card' },
          h('div', { class: 'row space' }, h('div', { class: 'row' }, avatar(p.id, p.name), h('div', {}, h('strong', { style: 'word-break:break-all' }, p.name), h('div', { class: 'faint' }, p.framework ?? 'Project'))),
            p.missing ? badge('folder missing', 'warn') : p.running ? badge('running', 'ok') : p.isWeb ? badge('web project', 'info') : badge('imported', '')),
          h('p', { class: 'faint', style: 'font-size:12px;overflow-wrap:anywhere' }, p.path),
          p.source ? h('p', { class: 'faint', style: 'font-size:12px' }, p.source) : h('p', { class: 'faint', style: 'font-size:12px' }, 'Local folder · registered without moving'),
          p.hasPackageJson ? h('div', { class: 'row', style: 'flex-wrap:wrap' }, badge(p.manager), badge(p.scripts?.length ? `${p.scripts.length} scripts` : 'no scripts')) : h('p', { class: 'faint' }, 'No Node.js package.json detected. Stored and organized; no automatic runner available.'),
          p.scripts?.length ? h('div', { class: 'row', style: 'margin:8px 0' }, h('label', { class: 'faint' }, 'Run script'), script) : null,
          h('div', { class: 'row', style: 'flex-wrap:wrap;margin-top:10px' }, actions));
      }));
    });
  }

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
    ...pageHeader('Projects', 'Import repositories to any drive, register existing folders without moving them, and manage web-app dependencies, runtime and logs.', {
      iconName: 'terminal',
      actions: [h('button', { class: 'btn primary', type: 'button', onclick: create }, icon('plus', 15), 'New project')]
    }),
    h('h2', {}, icon('download', 16), 'Import from GitHub'),
    h('div', { class: 'panel' },
      field('GitHub repository URL', repoUrl, 'Public repositories and private repositories available to your Git sign-in. Import only clones files; it does not execute them.'),
      field('Destination drive', driveSelect, 'Select a detected Windows drive, or type any absolute path in the destination field below.'),
      field('Destination folder', destination, 'Choose any folder on the selected drive, for example D:\\RumiStack\\projects or E:\\WebProjects. The repository is placed in a new subfolder.'),
      field('Folder name (optional)', folderName, 'Leave blank to use the repository name.'),
      importBtn),
    h('h2', {}, icon('folder', 16), 'Register an existing project'),
    h('div', { class: 'panel' }, field('Full folder path', localPath, 'Registers the folder in place. RumiStack will not copy, move or modify its source files.'), registerBtn),
    h('h2', {}, icon('layers', 16), 'Imported & managed projects'),
    hub,
    h('h2', {}, icon('terminal', 16), 'Workspace projects'),
    windows ? null : h('div', { class: 'notice info', style: 'margin-bottom:14px' }, icon('info', 16), h('span', {}, 'Opening a project in VS Code or an assistant works on Windows. Creating and listing projects works everywhere.')),
    box,
    h('p', { class: 'faint', style: 'margin-top:16px' }, 'Project Hub metadata is stored locally in state/project-hub.json. Imported folders remain wherever you selected; unregistering never deletes them.')
  );

  await refreshHub();
  await loadInto(box, () => api('GET', '/api/projects'), ({ folder, projects }) => {
    if (projects.length === 0) return h('div', { class: 'panel' }, emptyState('terminal', 'No workspace projects yet', `Projects created here live inside ${folder}.`,
      [h('button', { class: 'btn primary', type: 'button', onclick: create }, icon('plus', 15), 'Create your first project')]));
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
