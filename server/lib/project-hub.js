// User-controlled project import and local web-app runner.
// Imported repositories are kept at the exact destination selected by the user. No project code
// runs during import; dependency installation and start are separate, explicit actions.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseGitHubUrl } from './repos.js';
import { run, findCommand } from './system.js';
import { ValidationError } from './validate.js';

const IS_WINDOWS = process.platform === 'win32';
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const SCRIPT_RE = /^[A-Za-z0-9:_-]{1,64}$/;
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

export function detectProject(dir, packageJson) {
  const scripts = packageJson?.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const files = new Set();
  return fs.readdir(dir).then((names) => {
    for (const name of names) files.add(name);
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
    return { framework, manager, scripts: Object.keys(scripts).filter((s) => SCRIPT_RE.test(s)).slice(0, 40), preferredScript: preferred, isWeb, hasPackageJson: Boolean(packageJson) };
  });
}

async function inspectProject(entry) {
  const dir = entry.path;
  let pkg = null;
  try { pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8')); } catch { /* non-Node project */ }
  const detected = await detectProject(dir, pkg);
  const child = running.get(entry.id);
  const active = Boolean(child && child.exitCode === null && !child.killed);
  return { ...entry, ...detected, running: active, pid: active ? child.pid : null, logFile: entry.logFile ?? null };
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
  const entry = { id: `${Date.now().toString(36)}-${parsed.id.slice(0, 48)}`.toLowerCase(), name, path: dir, source: parsed.url, importedAt: new Date().toISOString() };
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
  const entry = { id: `${Date.now().toString(36)}-local-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32)}`, name, path: dir, source: null, importedAt: new Date().toISOString() };
  registry.projects.push(entry);
  await saveRegistry(stateDir, registry);
  return inspectProject(entry);
}

export async function unregisterHubProject(stateDir, id) {\n  const registry = await readRegistry(stateDir);\n  const entry = registry.projects.find((p) => p.id === projectId(id));\n  if (!entry) throw new ValidationError('Project not found in the Project Hub.', 404);\n  if (running.has(entry.id)) throw new ValidationError('Stop the project before removing it from the list.', 409);\n  registry.projects = registry.projects.filter((p) => p.id !== entry.id);\n  await saveRegistry(stateDir, registry);\n  return { id: entry.id, folderKept: entry.path };\n}\n\nasync function findProject(stateDir, id) {
  const registry = await readRegistry(stateDir);
  const entry = registry.projects.find((p) => p.id === projectId(id));
  if (!entry) throw new ValidationError('Project not found in the Project Hub.', 404);
  return { registry, entry };
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
  const logDir = path.resolve(stateDir, '..', 'logs');
  await fs.mkdir(logDir, { recursive: true });
  const logFile = path.join(logDir, `project-${entry.id.replace(/[^a-z0-9-]/g, '-')}.log`);
  const fd = await fs.open(logFile, 'w');
  const current = await readRegistry(stateDir);
  const saved = current.projects.find((p) => p.id === entry.id);
  if (saved) { saved.logFile = logFile; await saveRegistry(stateDir, current); }
  const manager = detected.manager;
  const command = manager === 'pnpm' ? 'pnpm' : manager === 'yarn' ? 'yarn' : manager === 'bun' ? 'bun' : 'npm';
  if (!(await findCommand(command))) throw new ValidationError(`${command} was not found on PATH. Install it before starting this project.`, 409);
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
