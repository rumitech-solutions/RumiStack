// User-controlled project import and local web-app runner.
// Imported repositories are kept at the exact destination selected by the user. No project code
// runs during import; dependency installation and start are separate, explicit actions.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { parseGitHubUrl } from './repos.js';
import { run, findCommand } from './system.js';
import { ValidationError } from './validate.js';

const IS_WINDOWS = process.platform === 'win32';
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const SCRIPT_RE = /^[A-Za-z0-9._:-]{1,64}$/;
const running = new Map();

async function exists(p) { return fs.stat(p).then(() => true, () => false); }

function safeName(value) {
  if (typeof value !== 'string' || !NAME_RE.test(value) || value.endsWith('.') || value === '..') {
    throw new ValidationError('Project folder name must use letters, digits, dot, underscore or hyphen (max 63 characters).');
  }
  return value;
}

function safeDestination(value) {
  if (typeof value !== 'string' || value.length > 500 || !path.isAbsolute(value)) {
    throw new ValidationError('Choose an absolute destination folder, for example D:\\RumiStack\\projects.');
  }
  const dest = path.resolve(value);
  if (dest === path.parse(dest).root) throw new ValidationError('A drive root cannot be used as the project destination. Choose a folder inside the drive.');
  return dest;
}

function projectId(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value)) throw new ValidationError('Invalid project ID.');
  return value;
}

async function readRegistry(stateDir) {
  const file = path.join(stateDir, 'project-hub.json');
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.projects)) throw new Error('invalid registry');
    return data;
  } catch (err) {
    if (err.code !== 'ENOENT') throw new ValidationError('Project registry is invalid. Back up state/project-hub.json before repairing it.', 500);
    return { schemaVersion: 1, projects: [] };
  }
}

async function saveRegistry(stateDir, data) {
  await fs.mkdir(stateDir, { recursive: true });
  const file = path.join(stateDir, 'project-hub.json');
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n', { flag: 'w' });
  await fs.rename(temp, file);
}

export async function detectProject(dir, packageJson) {
  const scripts = packageJson?.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const files = new Set(await fs.readdir(dir));
  let framework = 'Node.js';
  const deps = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  if (deps.next) framework = 'Next.js';
  else if (deps.vite) framework = 'Vite';
  else if (deps.nuxt) framework = 'Nuxt';
  else if (deps['@angular/core']) framework = 'Angular';
  else if (deps.vue) framework = 'Vue';
  else if (deps.react) framework = 'React';
  else if (deps.svelte || deps['@sveltejs/kit']) framework = 'Svelte';
  else if (deps.express || deps.fastify || deps.nestjs) framework = 'Node.js server';
  const manager = String(packageJson?.packageManager ?? '').startsWith('pnpm@') ? 'pnpm' : String(packageJson?.packageManager ?? '').startsWith('yarn@') ? 'yarn' : String(packageJson?.packageManager ?? '').startsWith('bun@') ? 'bun' : files.has('pnpm-lock.yaml') ? 'pnpm' : files.has('yarn.lock') ? 'yarn' : files.has('bun.lockb') || files.has('bun.lock') ? 'bun' : 'npm';
  const preferred = ['dev', 'start', 'serve', 'preview'].find((s) => typeof scripts[s] === 'string' && SCRIPT_RE.test(s)) ?? null;
  const isWeb = Boolean(packageJson && (framework !== 'Node.js' || ['dev', 'serve', 'preview'].some((s) => typeof scripts[s] === 'string') || files.has('index.html') || files.has('next.config.js') || files.has('vite.config.js') || files.has('vite.config.ts')));
  if (packageJson) return { ecosystem: 'node', framework, manager, scripts: Object.keys(scripts).filter((s) => SCRIPT_RE.test(s)).slice(0, 40), preferredScript: preferred, isWeb, hasPackageJson: true };

  const dotnetFiles = [...files].filter((name) => /\.(csproj|sln)$/i.test(name));
  const python = ['pyproject.toml', 'requirements.txt', 'Pipfile', 'poetry.lock', 'uv.lock', 'setup.py', 'setup.cfg'].some((name) => files.has(name));
  if (python) {
    const manager = files.has('uv.lock') ? 'uv' : files.has('poetry.lock') ? 'poetry' : 'pip';
    const setupAction = files.has('requirements.txt') ? 'python-requirements' : files.has('uv.lock') ? 'python-uv' : files.has('poetry.lock') ? 'python-poetry' : null;
    return { ecosystem: 'python', framework: 'Python', manager, scripts: [], preferredScript: null, isWeb: false, hasPackageJson: false, setupAction, projectFiles: [], projectCount: 0 };
  }
  if (dotnetFiles.length) {
    const projectFiles = dotnetFiles.filter((name) => /\.csproj$/i.test(name)).sort();
    return { ecosystem: 'dotnet', framework: '.NET', manager: 'dotnet', scripts: [], preferredScript: null, isWeb: false, hasPackageJson: false, setupAction: projectFiles.length || dotnetFiles.some((name) => /\.sln$/i.test(name)) ? 'dotnet-restore' : null, projectFiles, projectCount: projectFiles.length };
  }
  if (files.has('go.mod')) return { ecosystem: 'go', framework: 'Go', manager: 'go', scripts: [], preferredScript: null, isWeb: false, hasPackageJson: false, setupAction: null };
  if (files.has('Cargo.toml')) return { ecosystem: 'rust', framework: 'Rust', manager: 'cargo', scripts: [], preferredScript: null, isWeb: false, hasPackageJson: false, setupAction: null };
  if (['pom.xml', 'build.gradle', 'build.gradle.kts'].some((name) => files.has(name))) return { ecosystem: 'java', framework: 'Java', manager: 'java', scripts: [], preferredScript: null, isWeb: false, hasPackageJson: false, setupAction: null };
  return { ecosystem: 'unknown', framework: 'Project', manager: null, scripts: [], preferredScript: null, isWeb: false, hasPackageJson: false, setupAction: null };
}
async function inspectProject(entry) {
  const dir = entry.path;
  const folderExists = await fs.stat(dir).then((s) => s.isDirectory(), () => false);
  if (!folderExists) {
    return { ...entry, missing: true, hasPackageJson: false, framework: 'Unavailable', manager: null,
      scripts: [], preferredScript: null, isWeb: false, running: false, pid: null,
      health: { status: 'missing-folder', label: 'Folder not found', issues: ['The project folder was moved, renamed or disconnected.'] },
      runtime: { node: process.version, requiredNode: null, managerAvailable: false }, logFile: entry.logFile ?? null };
  }

  let pkg = null;
  let packageError = null;
  const packageFile = path.join(dir, 'package.json');
  const packageExists = await exists(packageFile);
  if (packageExists) {
    try { pkg = JSON.parse(await fs.readFile(packageFile, 'utf8')); }
    catch { packageError = 'package.json is invalid JSON.'; }
  }
  const detected = await detectProject(dir, pkg);
  const child = running.get(entry.id);
  const active = Boolean(child && child.exitCode === null && !child.killed);
  const managerAvailable = detected.ecosystem === 'node' ? Boolean(await findCommand(detected.manager)) : detected.ecosystem === 'python' ? Boolean(await findCommand('python') || await findCommand('py')) : detected.ecosystem === 'dotnet' ? Boolean(await findCommand('dotnet')) : false;
  const dependenciesInstalled = detected.ecosystem === 'node' ? await exists(path.join(dir, 'node_modules')) : detected.ecosystem === 'python' ? await exists(path.join(dir, '.venv')) : false;
  const lockfiles = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'requirements.txt', 'pyproject.toml', 'uv.lock', 'poetry.lock', 'Pipfile.lock'];
  const presentLockfiles = (await Promise.all(lockfiles.map(async (name) => await exists(path.join(dir, name)) ? name : null))).filter(Boolean);
  const issues = [];
  if (packageError) issues.push(packageError);
  if (detected.ecosystem !== 'unknown' && !managerAvailable) issues.push(detected.ecosystem === 'python' ? 'Python is not installed or not available on PATH.' : detected.ecosystem === 'dotnet' ? '.NET SDK is not installed or not available on PATH.' : `${detected.manager} is not installed or not available on PATH.`);
  if (detected.ecosystem === 'node' && !dependenciesInstalled) issues.push('Dependencies are not installed yet.');
  if (detected.ecosystem === 'node' && !detected.scripts.length) issues.push('No runnable scripts are defined in package.json.');
  if (detected.ecosystem === 'node' && !presentLockfiles.length) issues.push('No package lockfile found; installs may resolve newer dependency versions.');
  if (detected.ecosystem === 'python' && !detected.setupAction) issues.push('Python project detected. No supported lockfile or requirements.txt install workflow was found; review its pyproject.toml and set it up manually.');
  if (detected.ecosystem === 'dotnet' && detected.projectCount > 1) issues.push('Multiple .NET project files found. Choose the intended startup project in your IDE; automatic run is not enabled.');
  if (detected.ecosystem === 'dotnet' && !detected.projectCount) issues.push('Solution detected. Restore is supported; select a project file to run from your IDE.');
  const status = packageError ? 'invalid' : detected.ecosystem === 'unknown' ? 'not-node' : !managerAvailable ? 'missing-runtime' : detected.ecosystem === 'node' && !dependenciesInstalled ? 'needs-install' : detected.setupAction ? 'needs-setup' : detected.ecosystem === 'node' ? 'ready' : 'manual-setup';
  const labels = { invalid: 'Needs attention', 'not-node': 'Manual setup', 'missing-runtime': 'Runtime missing', 'needs-install': 'Setup required', 'needs-setup': 'Setup available', 'manual-setup': 'Manual setup', ready: 'Ready' };
  return { ...entry, ...detected, missing: false, running: active, pid: active ? child.pid : null,
    health: { status, label: labels[status], issues },
    runtime: { node: process.version, requiredNode: pkg?.engines?.node ?? null, managerAvailable, manager: detected.manager },
    dependenciesInstalled, dependencyCount: Object.keys({ ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }).length,
    lockfiles: presentLockfiles, logFile: entry.logFile ?? null };
}

export async function listHubProjects(root, stateDir) {
  const registry = await readRegistry(stateDir);
  const drives = [];
  if (IS_WINDOWS) {
    for (let code = 65; code <= 90; code++) {
      const drive = String.fromCharCode(code) + ':' + String.fromCharCode(92);
      if (await fs.stat(drive).then((s) => s.isDirectory(), () => false)) drives.push(drive);
    }
  }
  return { projects: await Promise.all(registry.projects.map(inspectProject)), defaultDestination: path.join(root, 'projects'), drives };
}

export async function importHubRepo(root, stateDir, input) {
  const parsed = parseGitHubUrl(input.url);
  const destination = safeDestination(input.destination);
  const name = safeName(input.name || parsed.repo.replace(/[^A-Za-z0-9._-]/g, '-'));
  const dir = path.resolve(destination, name);
  if (path.dirname(dir) !== destination) throw new ValidationError('Project destination is invalid.');
  if (await exists(dir)) throw new ValidationError(`The destination already exists: ${dir}. Nothing was changed.`, 409);
  const registry = await readRegistry(stateDir);
  if (registry.projects.some((p) => p.path.toLowerCase() === dir.toLowerCase())) throw new ValidationError('This project is already registered.', 409);
  await fs.mkdir(destination, { recursive: true });
  const cloned = await run('git', ['clone', '--depth', '1', '--no-recurse-submodules', '--', parsed.url, dir], { timeout: 15 * 60_000 });
  if (!cloned.ok) {
    await fs.rm(dir, { recursive: true, force: true });
    throw new ValidationError(`Git clone failed: ${cloned.stderr.split('\n').filter(Boolean).pop() || 'unknown error'}`, 502);
  }
  const entry = { id: `${randomUUID().replace(/-/g, '').slice(0, 12)}-${parsed.id.slice(0, 48)}`.toLowerCase(), name, path: dir, source: parsed.url, importedAt: new Date().toISOString() };
  registry.projects.push(entry);
  await saveRegistry(stateDir, registry);
  return inspectProject(entry);
}

export async function registerHubProject(stateDir, input) {
  const dir = path.resolve(String(input.path ?? ''));
  if (!path.isAbsolute(String(input.path ?? '')) || !(await fs.stat(dir).then((s) => s.isDirectory(), () => false))) {
    throw new ValidationError('Select an existing project folder using its full path.');
  }
  const registry = await readRegistry(stateDir);
  if (registry.projects.some((p) => p.path.toLowerCase() === dir.toLowerCase())) throw new ValidationError('This folder is already registered.', 409);
  const name = path.basename(dir);
  const entry = { id: `${randomUUID().replace(/-/g, '').slice(0, 12)}-local-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32)}`, name, path: dir, source: null, importedAt: new Date().toISOString() };
  registry.projects.push(entry);
  await saveRegistry(stateDir, registry);
  return inspectProject(entry);
}

export async function unregisterHubProject(stateDir, id) {
  const registry = await readRegistry(stateDir);
  const entry = registry.projects.find((p) => p.id === projectId(id));
  if (!entry) throw new ValidationError('Project not found in the Project Hub.', 404);
  if (running.has(entry.id)) throw new ValidationError('Stop the project before removing it from the list.', 409);
  registry.projects = registry.projects.filter((p) => p.id !== entry.id);
  await saveRegistry(stateDir, registry);
  return { id: entry.id, folderKept: entry.path };
}

async function findProject(stateDir, id) {
  const registry = await readRegistry(stateDir);
  const entry = registry.projects.find((p) => p.id === projectId(id));
  if (!entry) throw new ValidationError('Project not found in the Project Hub.', 404);
  return { registry, entry };
}

export async function projectSetupPreview(stateDir, id) {
  const { entry } = await findProject(stateDir, id);
  const detected = await detectProject(entry.path, null);
  if (detected.ecosystem === 'python') {
    if (detected.setupAction === 'python-requirements') {
      const command = await findCommand('python') ? 'python' : await findCommand('py') ? 'py' : null;
      if (!command) throw new ValidationError('Python was not found on PATH. Install Python 3 and reopen RumiStack.', 409);
      const args = command === 'py' ? ['-3', '-m', 'pip', 'install', '-r', 'requirements.txt'] : ['-m', 'pip', 'install', '-r', 'requirements.txt'];
      return { id, ecosystem: 'python', title: 'Install Python requirements', command: [command, ...args].join(' '), args, executable: command, cwd: entry.path, warning: 'This may download packages and execute package build/install hooks. A virtual environment is recommended; this workflow does not create one automatically.' };
    }
    if (detected.setupAction === 'python-uv' || detected.setupAction === 'python-poetry') {
      const command = detected.setupAction === 'python-uv' ? 'uv' : 'poetry';
      if (!(await findCommand(command))) throw new ValidationError(`${command} was not found on PATH. Install it using its official instructions first.`, 409);
      const args = detected.setupAction === 'python-uv' ? ['sync'] : ['install'];
      return { id, ecosystem: 'python', title: `Install with ${command}`, command: [command, ...args].join(' '), args, executable: command, cwd: entry.path, warning: 'This may download packages and execute package build/install hooks.' };
    }
  }
  if (detected.ecosystem === 'dotnet') {
    if (!(await findCommand('dotnet'))) throw new ValidationError('.NET SDK was not found on PATH. Install the SDK and reopen RumiStack.', 409);
    const target = detected.projectFiles.length === 1 ? detected.projectFiles[0] : [...(await fs.readdir(entry.path)).filter((name) => /\.sln$/i.test(name)).sort()][0];
    if (!target) throw new ValidationError('No .sln or .csproj file was found for restore.', 409);
    const args = ['restore', target];
    return { id, ecosystem: 'dotnet', title: 'Restore .NET dependencies', command: ['dotnet', ...args].join(' '), args, executable: 'dotnet', cwd: entry.path, warning: 'This downloads NuGet dependencies. No project code is launched.' };
  }
  throw new ValidationError('No guided setup workflow is available for this project yet.', 409);
}

export async function runProjectSetup(stateDir, id) {
  const preview = await projectSetupPreview(stateDir, id);
  const result = await run(preview.executable, preview.args, { cwd: preview.cwd, timeout: 20 * 60_000, shell: IS_WINDOWS });
  if (!result.ok) throw new ValidationError(`${preview.title} failed: ${result.stderr.split('\\n').filter(Boolean).pop() || 'see command output'}`, 502);
  return { id, title: preview.title, command: preview.command, output: result.stdout.slice(-4000), completed: true };
}

export async function installHubDependencies(stateDir, id) {
  const { entry } = await findProject(stateDir, id);
  const pkg = JSON.parse(await fs.readFile(path.join(entry.path, 'package.json'), 'utf8').catch(() => 'null'));
  if (!pkg || typeof pkg !== 'object') throw new ValidationError('This project has no valid package.json. Automatic dependency installation is available for Node.js projects only.', 409);
  const detected = await detectProject(entry.path, pkg);
  const command = detected.manager === 'pnpm' ? 'pnpm' : detected.manager === 'yarn' ? 'yarn' : detected.manager === 'bun' ? 'bun' : 'npm';
  const args = command === 'npm' ? ['install'] : ['install'];
  const result = await run(command, args, { cwd: entry.path, timeout: 20 * 60_000, shell: IS_WINDOWS });
  if (!result.ok) throw new ValidationError(`${command} install failed: ${result.stderr.split('\n').filter(Boolean).pop() || 'see terminal output'}`, 502);
  return { id, manager: command, output: result.stdout.slice(-4000) };
}

export async function startHubProject(stateDir, id, requestedScript) {
  const { entry } = await findProject(stateDir, id);
  const pkg = JSON.parse(await fs.readFile(path.join(entry.path, 'package.json'), 'utf8').catch(() => 'null'));
  if (!pkg || typeof pkg !== 'object' || !pkg.scripts || typeof pkg.scripts !== 'object') throw new ValidationError('This project has no runnable package.json scripts.', 409);
  const detected = await detectProject(entry.path, pkg);
  const script = requestedScript || detected.preferredScript;
  if (!script || !SCRIPT_RE.test(script) || typeof pkg.scripts[script] !== 'string') throw new ValidationError('Choose a valid script from this project package.json.');
  if (!(await exists(path.join(entry.path, 'node_modules')))) throw new ValidationError('Dependencies are not installed yet. Run Install dependencies first.', 409);
  const existing = running.get(entry.id);
  if (existing && existing.exitCode === null && !existing.killed) throw new ValidationError('This project is already running.', 409);
  const manager = detected.manager;
  const command = manager === 'pnpm' ? 'pnpm' : manager === 'yarn' ? 'yarn' : manager === 'bun' ? 'bun' : 'npm';
  if (!(await findCommand(command))) throw new ValidationError(`${command} was not found on PATH. Install it before starting this project.`, 409);
  const logDir = path.resolve(stateDir, '..', 'logs');
  await fs.mkdir(logDir, { recursive: true });
  const logFile = path.join(logDir, `project-${entry.id.replace(/[^a-z0-9-]/g, '-')}.log`);
  const fd = await fs.open(logFile, 'w');
  const current = await readRegistry(stateDir);
  const saved = current.projects.find((p) => p.id === entry.id);
  if (saved) { saved.logFile = logFile; await saveRegistry(stateDir, current); }
  // Running a package script executes project-owned code. This endpoint is only called by the
  // explicit Start button; import and detection never execute package scripts.
  const child = spawn(command, ['run', script], {
    cwd: entry.path, shell: IS_WINDOWS, detached: !IS_WINDOWS, stdio: ['ignore', fd.fd, fd.fd], windowsHide: true,
    env: { ...process.env, BROWSER: 'none', HOST: '127.0.0.1' }
  });
  running.set(entry.id, child);
  child.on('error', () => { running.delete(entry.id); fd.close().catch(() => {}); });
  child.on('exit', () => { running.delete(entry.id); fd.close().catch(() => {}); });
  return { id, script, pid: child.pid, logFile, message: 'Start requested. Check project logs for the local URL and startup errors.' };
}

export async function stopHubProject(stateDir, id) {
  const { entry } = await findProject(stateDir, id);
  const child = running.get(entry.id);
  if (!child || child.exitCode !== null || child.killed) return { id, stopped: false, message: 'No running process is tracked for this project.' };
  if (IS_WINDOWS) {
    const result = await run('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { timeout: 15_000 });
    if (!result.ok) throw new ValidationError(`Could not stop project process: ${result.stderr}`, 502);
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (err) { if (err.code !== 'ESRCH') throw err; }
  }
  running.delete(entry.id);
  return { id, stopped: true };
}

export async function hubProjectLogs(stateDir, id) {
  const { entry } = await findProject(stateDir, id);
  if (!entry.logFile) return { id, lines: '' };
  const file = path.resolve(entry.logFile);
  const data = await fs.readFile(file, 'utf8').catch(() => '');
  return { id, lines: data.slice(-16_000) };
}
