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
          const match = [...result.lines.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+(?:\/[^\s]*)?/g)].pop();
          if (match) { openUrl.href = match[0].replace(/[),.;]+$/, ''); openUrl.hidden = false; }
          await modal({ title: `Logs · ${p.name}`, wide: true, body: h('pre', { class: 'code', style: 'white-space:pre-wrap;max-height:60vh;overflow:auto' }, result.lines || 'No log output yet.'), actions: [{ label: 'Close', value: true, kind: 'primary' }] });
        }
        const moreActions = [];
        async function showGuidance() {
          const issues = p.health?.issues ?? [];
          await modal({
            title: `Next steps · ${p.name}`,
            body: h('div', {},
              h('p', {}, 'RumiStack has identified this project, but it does not have a safe one-click run workflow yet.'),
              issues.length ? h('ul', { class: 'project-guidance-list' }, issues.map((issue) => h('li', {}, issue))) : h('p', { class: 'muted' }, 'No additional health issues were reported.'),
              h('p', { class: 'muted' }, 'You can open the folder in your editor and follow the project’s own documentation. RumiStack will not guess commands for an unsupported project type.')
            ),
            actions: [{ label: 'Close', value: true, kind: 'primary' }]
          });
        }
        async function guidedSetup() {
          const preview = await attempt(() => api('POST', '/api/project-hub/setup-preview', { id: p.id }));
          if (!preview) return;
          const message = `Working folder: ${preview.cwd}\n\nCommand:\n${preview.command}\n\n${preview.warning}\n\nContinue only if you trust this project and its dependencies.`;
          if (!(await confirmDialog({ title: preview.title, message, confirmLabel: 'Run setup' }))) return;
          if (await attempt(() => api('POST', '/api/project-hub/setup', { id: p.id }), 'Project setup completed')) refreshHub();
        }
        async function installDependencies() {
          const label = p.scripts?.length ? 'Setup & start' : 'Install dependencies';
          if (!(await confirmDialog({ title: 'Set up this project?', message: `RumiStack will run ${p.manager} install in this folder. Package lifecycle scripts may execute. Continue only if you trust this repository.`, confirmLabel: 'Install & prepare' }))) return;
          const installed = await attempt(() => api('POST', '/api/project-hub/install', { id: p.id }), 'Dependencies installed');
          if (installed && p.preferredScript) {
            if (await confirmDialog({ title: 'Start the project now?', message: `Dependencies are ready. Run the ${p.preferredScript} script?`, confirmLabel: 'Start project' })) {
              await attempt(() => api('POST', '/api/project-hub/start', { id: p.id, script: p.preferredScript }), 'Project start requested');
            }
          }
          refreshHub();
        }
        async function reinstallDependencies() {
          if (!(await confirmDialog({ title: 'Reinstall dependencies?', message: 'This runs the project package manager and may execute dependency lifecycle scripts. Only continue if you trust this repository.', confirmLabel: 'Install' }))) return;
          if (await attempt(() => api('POST', '/api/project-hub/install', { id: p.id }), 'Dependencies installed')) refreshHub();
        }
        async function runApp() {
          const preview = await attempt(() => api('POST', '/api/project-hub/run-preview', { id: p.id }));
          if (!preview) return;
          const message = `Working folder: ${preview.cwd}\n\nCommand:\n${preview.command}\n\n${preview.warning}\n\nRun only code from repositories you trust.`;
          if (!(await confirmDialog({ title: preview.title, message, confirmLabel: 'Run project' }))) return;
          if (await attempt(() => api('POST', '/api/project-hub/run', { id: p.id }), 'Project start requested. Check logs for output.')) refreshHub();
        }
        async function startNodeProject() {
          if (!(await confirmDialog({ title: `Run ${script.value}?`, message: 'This executes the selected script from package.json. Run code only from repositories you trust.', confirmLabel: 'Run project' }))) return;
          if (await attempt(() => api('POST', '/api/project-hub/start', { id: p.id, script: script.value }), 'Start requested. Check logs for the local URL.')) refreshHub();
        }
        async function stopProject() {
          if (await attempt(() => api('POST', '/api/project-hub/stop', { id: p.id }), 'Stop requested')) refreshHub();
        }
        async function showLogs() {
          const result = await attempt(() => api('POST', '/api/project-hub/logs', { id: p.id }));
          if (!result) return;
          const match = [...result.lines.matchAll(/https?:\\/\\/(?:localhost|127\\.0\\.0\\.1):\\d+(?:\\/[^\\s]*)?/g)].pop();
          if (match) { openUrl.href = match[0].replace(/[),.;]+$/, ''); openUrl.hidden = false; }
          await modal({ title: `Logs · ${p.name}`, wide: true, body: h('pre', { class: 'code', style: 'white-space:pre-wrap;max-height:60vh;overflow:auto' }, result.lines || 'No log output yet.'), actions: [{ label: 'Close', value: true, kind: 'primary' }] });
        }
        async function unregister() {
          if (!(await confirmDialog({ title: 'Remove project from RumiStack?', message: 'Only removes the Project Hub entry. The actual project folder and its files will remain untouched.', confirmLabel: 'Unregister', danger: true }))) return;
          if (await attempt(() => api('POST', '/api/project-hub/unregister', { id: p.id }), 'Project unregistered; files kept.')) refreshHub();
        }

        moreActions.push(h('button', { class: 'btn small', type: 'button', onclick: showLogs }, icon('file-text', 13), 'Logs'));
        moreActions.push(openUrl);
        if (p.hasPackageJson && p.dependenciesInstalled) moreActions.push(h('button', { class: 'btn small', type: 'button', onclick: reinstallDependencies }, icon('download', 13), 'Reinstall dependencies'));
        if (p.setupAction && ['python', 'dotnet'].includes(p.ecosystem) && p.setupCompleted) moreActions.push(h('button', { class: 'btn small', type: 'button', disabled: !p.runtime?.managerAvailable, onclick: guidedSetup }, icon('refresh', 13), 'Run setup again'));
        moreActions.push(h('button', { class: 'btn small', type: 'button', onclick: (e) => copyText(p.path, e.currentTarget) }, icon('copy', 13), 'Copy path'));
        moreActions.push(h('button', { class: 'btn small danger ghost', type: 'button', disabled: p.running, onclick: unregister }, icon('unlink', 13), 'Unregister'));

        let primaryAction;
        if (p.missing) {
          primaryAction = h('button', { class: 'btn small', type: 'button', disabled: true }, icon('alert-circle', 13), 'Folder missing');
        } else if (p.running) {
          primaryAction = h('button', { class: 'btn small danger', type: 'button', onclick: stopProject }, icon('square', 13), 'Stop app');
        } else if (p.setupAction && ['python', 'dotnet'].includes(p.ecosystem) && !p.setupCompleted) {
          primaryAction = h('button', { class: 'btn small primary', type: 'button', disabled: !p.runtime?.managerAvailable, title: p.runtime?.managerAvailable ? 'Preview the exact command before running setup.' : 'Install the required runtime first, then reopen RumiStack.', onclick: guidedSetup }, icon('wand-sparkles', 13), p.runtime?.managerAvailable ? 'Guided setup' : 'Runtime required');
        } else if (p.hasPackageJson && !p.dependenciesInstalled) {
          primaryAction = h('button', { class: 'btn small primary', type: 'button', disabled: !p.runtime?.managerAvailable, title: p.runtime?.managerAvailable ? 'Install dependencies after reviewing the confirmation.' : 'Install the required package manager first.', onclick: installDependencies }, icon('wand-sparkles', 13), p.runtime?.managerAvailable ? (p.scripts?.length ? 'Setup & start' : 'Install dependencies') : 'Runtime required');
        } else if (['python', 'dotnet'].includes(p.ecosystem) && p.runTarget) {
          primaryAction = h('button', { class: 'btn small primary', type: 'button', onclick: runApp }, icon('play', 13), 'Run app');
        } else if (p.scripts?.length) {
          primaryAction = h('button', { class: 'btn small primary', type: 'button', onclick: startNodeProject }, icon('play', 13), 'Start app');
        } else {
          primaryAction = h('button', { class: 'btn small', type: 'button', onclick: showGuidance }, icon('book-open', 13), 'View guidance');
        }

        return h('article', { class: 'card project-card' },
          h('div', { class: 'row space project-card-heading' },
            h('div', { class: 'row project-card-identity' }, avatar(p.id, p.name), h('div', {}, h('strong', { style: 'word-break:break-all' }, p.name), h('div', { class: 'faint' }, p.framework ?? 'Project'))),
            p.missing ? badge('folder missing', 'warn') : p.running ? badge('running', 'ok') : p.health?.status === 'ready' ? badge('ready', 'ok') : badge(p.health?.label ?? (p.isWeb ? 'web project' : 'imported'), p.health?.status === 'invalid' ? 'bad' : 'info')),
          h('p', { class: 'faint project-path' }, p.path),
          p.source ? h('p', { class: 'faint project-source' }, p.source) : h('p', { class: 'faint project-source' }, 'Local folder · registered in place'),
          p.hasPackageJson ? h('div', { class: 'row project-meta' }, badge(p.manager), badge(p.scripts?.length ? `${p.scripts.length} scripts` : 'no scripts'), badge(`${p.dependencyCount} dependencies`), badge(p.dependenciesInstalled ? 'dependencies installed' : 'dependencies missing', p.dependenciesInstalled ? 'ok' : 'warn')) : h('div', { class: 'row project-meta' }, badge(p.ecosystem === 'unknown' ? 'unclassified project' : p.ecosystem), p.manager ? badge(p.manager) : null, p.projectCount ? badge(`${p.projectCount} .csproj files`) : null, p.setupCompleted ? badge('setup complete', 'ok') : null),
          p.health ? h('div', { class: `notice ${p.health.status === 'ready' ? 'success' : ['not-node', 'manual-setup', 'needs-setup'].includes(p.health.status) ? 'info' : 'warn'} project-health` }, icon(p.health.status === 'ready' ? 'check-circle' : 'alert-circle', 15), h('span', {}, h('strong', {}, p.health.label), p.health.issues?.length ? h('span', { class: 'faint project-health-issues' }, p.health.issues.join(' ')) : null)) : null,
          p.scripts?.length ? h('div', { class: 'project-script-picker' }, h('label', { class: 'faint' }, 'Run script'), script) : null,
          h('div', { class: 'row project-card-actions' }, primaryAction,
            h('details', { class: 'project-more' },
              h('summary', {}, icon('more-horizontal', 14), 'More'),
              h('div', { class: 'project-more-menu' }, moreActions))));

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
    ...pageHeader('Projects', 'Bring a project into one place. Import from GitHub or open a folder already on this laptop. RumiStack checks what each project needs before you run it.', {
      iconName: 'terminal',
      actions: [h('button', { class: 'btn primary', type: 'button', onclick: create }, icon('plus', 15), 'New project')]
    }),
    h('h2', {}, icon('download', 16), 'Start with a GitHub repository'),
    h('div', { class: 'panel' },
      field('GitHub repository URL', repoUrl, 'Paste a repository link. Importing only downloads the files — it does not run the project.'),
      importBtn,
      h('details', { class: 'project-options' },
        h('summary', {}, icon('sliders', 14), 'Advanced import options'),
        field('Destination drive', driveSelect, 'Choose a detected drive, or enter any absolute folder path below.'),
        field('Destination folder', destination, 'The repository is placed in a new subfolder here. Leave the default unless you need another drive or location.'),
        field('Folder name (optional)', folderName, 'Leave blank to use the repository name.'))),
    h('details', { class: 'project-options project-register' },
      h('summary', {}, icon('folder-plus', 14), 'Already have a project on this laptop? Register its folder'),
      h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'This adds the folder to RumiStack without moving, copying or changing its files.'), field('Project folder path', localPath, 'Example: D:\\\\Projects\\\\my-app'), registerBtn)),
    h('h2', {}, icon('layers', 16), 'Your projects'),
    hub,
    h('h2', {}, icon('terminal', 16), 'Projects created inside RumiStack'),
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
