// Working projects live in projects/<name>. Names are restricted to a safe pattern and everything is resolved
// inside projects/, so nothing from the browser can address another path.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { run, findCommand } from './system.js';
import { ValidationError } from './validate.js';

export const PROJECT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
export const TEMPLATE_FILES = ['AGENTS.md', 'CLAUDE.md'];
const IS_WINDOWS = process.platform === 'win32';

function projectDir(root, name) {
  if (typeof name !== 'string' || !PROJECT_NAME_RE.test(name) || name.endsWith('.') || /^\.+$/.test(name)) {
    throw new ValidationError('A project name may use letters, digits, dot, underscore and hyphen (max 63 characters, starting with a letter or digit).');
  }
  const base = path.join(root, 'projects');
  const dir = path.resolve(base, name);
  if (path.dirname(dir) !== path.resolve(base)) throw new ValidationError('Invalid project name.');
  return dir;
}

async function exists(file) { return fs.stat(file).then(() => true, () => false); }

export async function listProjects(root) {
  const base = path.join(root, 'projects');
  const entries = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
  const dirs = entries.filter((e) => e.isDirectory() && PROJECT_NAME_RE.test(e.name));
  const projects = await Promise.all(dirs.map(async (e) => {
    const dir = path.join(base, e.name);
    const isRepo = await exists(path.join(dir, '.git'));
    const out = { name: e.name, path: `projects/${e.name}`, git: null, files: {} };
    for (const f of TEMPLATE_FILES) out.files[f] = await exists(path.join(dir, f));
    if (isRepo) {
      const [branch, status] = await Promise.all([run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir }), run('git', ['status', '--porcelain'], { cwd: dir })]);
      out.git = { branch: branch.ok ? branch.stdout : null, dirty: status.stdout.length > 0 };
    }
    return out;
  }));
  return { folder: base, projects: projects.sort((a, b) => a.name.localeCompare(b.name)) };
}

async function copyTemplate(templatesDir, dir, file) {
  if (!TEMPLATE_FILES.includes(file)) throw new ValidationError('Unknown template.');
  const target = path.join(dir, file);
  if (await exists(target)) return false; // never overwrite
  await fs.copyFile(path.join(templatesDir, file), target);
  return true;
}

export async function createProject(root, templatesDir, { name, git = false, files = [] }) {
  const dir = projectDir(root, name);
  if (await exists(dir)) throw new ValidationError(`projects/${name} already exists.`, 409);
  if (!Array.isArray(files) || files.some((f) => !TEMPLATE_FILES.includes(f))) throw new ValidationError('Unknown template file requested.');
  await fs.mkdir(dir, { recursive: true });
  const created = [];
  for (const f of files) if (await copyTemplate(templatesDir, dir, f)) created.push(f);
  let gitInit = false;
  if (git === true) {
    const res = await run('git', ['init', '-b', 'main'], { cwd: dir });
    gitInit = res.ok;
    if (!res.ok) throw new ValidationError(`Project created, but git init failed: ${res.stderr.split('\n').pop()}`, 502);
  }
  return { name, path: `projects/${name}`, files: created, git: gitInit };
}

export async function addTemplate(root, templatesDir, { name, file }) {
  const dir = projectDir(root, name);
  if (!(await exists(dir))) throw new ValidationError(`projects/${name} does not exist.`, 404);
  const created = await copyTemplate(templatesDir, dir, file);
  return { name, file, created };
}

/** Opens a project in VS Code or an assistant's terminal. Windows only, like the assistant launcher. */
export async function openProject(root, registry, { name, with: target }) {
  const dir = projectDir(root, name);
  if (!(await exists(dir))) throw new ValidationError(`projects/${name} does not exist.`, 404);
  if (!IS_WINDOWS) throw new ValidationError('Opening projects is implemented for Windows only.', 501);
  let command; let title;
  if (target === 'vscode') {
    if (!(await findCommand('code'))) throw new ValidationError('The "code" command was not found on PATH. Install VS Code and enable its command-line launcher.', 409);
    command = ['/c', 'code', '.']; title = 'VS Code';
  } else {
    const tool = registry.tools.tools.find((t) => t.id === target && t.launchable);
    if (!tool) throw new ValidationError(`"${String(target).slice(0, 40)}" cannot be launched from the dashboard.`, 404);
    if (!(await findCommand(tool.command))) throw new ValidationError(`${tool.name} was not found on PATH. Install it first.`, 409);
    command = ['/k', tool.command]; title = tool.name;
  }
  const child = spawn('cmd.exe', ['/c', 'start', `RumiStack - ${title}`, '/D', dir, 'cmd.exe', ...command], { detached: true, stdio: 'ignore', windowsHide: command[0] === '/c' });
  child.unref();
  return { name, with: target };
}
