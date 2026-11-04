// Everything that touches the local machine. Only fixed, allow-listed operations live here:
// no arbitrary commands, no arbitrary URLs. Child processes are started without a shell.

import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { COMMAND_RE, ValidationError } from './validate.js';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Runs a fixed executable with fixed arguments (never a shell string from the browser).
 * `shell` is only used on Windows for npm/CLI shims (.cmd files cannot be spawned directly); callers
 * pass names that were already matched against strict patterns, so no metacharacters can reach it.
 */
export function run(file, args, { cwd, timeout = 30_000, shell = false } = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { cwd, timeout, shell, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error?.code ?? 0, stdout: String(stdout).trim(), stderr: String(stderr).trim() });
    });
  });
}

// ---------------------------------------------------------------- versions

const SEMVER_RE = /\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?/;

export function parseVersion(text) {
  const m = SEMVER_RE.exec(String(text ?? ''));
  return m ? m[0] : null;
}

/** Numeric dotted comparison; pre-release suffixes are ignored. Returns -1, 0 or 1. */
export function compareVersions(a, b) {
  const nums = (v) => String(v).split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0);
  const x = nums(a);
  const y = nums(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Installed versions via `<command> --version` for tools that are on PATH. Local only, no network. */
export async function installedVersions(tools, statuses) {
  const entries = await Promise.all(tools.filter((t) => t.command && statuses[t.id]?.installed).map(async (tool) => {
    const res = await run(tool.command, ['--version'], { timeout: 8_000, shell: IS_WINDOWS });
    return [tool.id, parseVersion(res.stdout || res.stderr)];
  }));
  return Object.fromEntries(entries);
}

/** Latest published versions for npm-installed tools via `npm view`. Needs network; explicit user action only. */
export async function latestNpmVersions(tools) {
  const npmTools = tools.filter((t) => t.install.type === 'npm');
  const out = {};
  const queue = [...npmTools];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const tool = queue.shift();
      if (!/^(@[a-z0-9][a-z0-9-._~]*\/)?[a-z0-9][a-z0-9-._~]*$/.test(tool.install.package)) continue;
      const res = await run('npm', ['view', tool.install.package, 'version'], { timeout: 25_000, shell: IS_WINDOWS });
      out[tool.id] = res.ok ? parseVersion(res.stdout) : null;
    }
  }));
  return out;
}

export async function findCommand(command) {
  if (!command) return null;
  if (!COMMAND_RE.test(command)) throw new ValidationError('Invalid command name.');
  const res = await run(IS_WINDOWS ? 'where.exe' : 'which', [command], { timeout: 5_000 });
  if (!res.ok || !res.stdout) return null;
  return res.stdout.split(/\r?\n/)[0];
}

/** { toolId: { installed: true|false|null, path } } — null means "not detectable on PATH". */
export async function toolStatuses(tools) {
  const entries = await Promise.all(tools.map(async (tool) => {
    if (!tool.command) return [tool.id, { installed: null, path: null }];
    const found = await findCommand(tool.command);
    return [tool.id, { installed: Boolean(found), path: found }];
  }));
  return Object.fromEntries(entries);
}

export function buildOverview(profile, registry, statuses) {
  const byId = new Map(registry.tools.tools.map((t) => [t.id, t]));
  const items = profile.tools.map((id) => {
    const tool = byId.get(id);
    const st = statuses[id] ?? { installed: null };
    return {
      id, name: tool.name, category: tool.category, installType: tool.install.type,
      installed: st.installed, path: st.path ?? null,
      action: st.installed === true ? 'ok' : st.installed === null ? 'check manually' : tool.install.type === 'manual' ? 'manual install' : 'restore'
    };
  });
  return {
    items,
    counts: {
      selected: items.length,
      installed: items.filter((i) => i.installed === true).length,
      missing: items.filter((i) => i.installed === false).length,
      undetectable: items.filter((i) => i.installed === null).length
    }
  };
}

// ---------------------------------------------------------------- source checkouts

function cloneable(registry, id) {
  const tool = registry.tools.tools.find((t) => t.id === id);
  if (!tool || !tool.clone) throw new ValidationError(`"${id}" is not on the source-clone allowlist.`, 404);
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(tool.repo)) throw new ValidationError(`Registry URL for "${id}" is not an allowed GitHub HTTPS URL.`, 500);
  return tool;
}

export async function sourceStatus(root, registry) {
  const list = registry.tools.tools.filter((t) => t.clone);
  return Promise.all(list.map(async (tool) => {
    const dir = path.join(root, 'sources', tool.id);
    const exists = await fs.stat(path.join(dir, '.git')).then(() => true, () => false);
    if (!exists) return { id: tool.id, name: tool.name, repo: tool.repo, cloned: false };
    const [status, branch] = await Promise.all([
      run('git', ['status', '--porcelain'], { cwd: dir }),
      run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir })
    ]);
    return { id: tool.id, name: tool.name, repo: tool.repo, cloned: true, dirty: status.stdout.length > 0, branch: branch.stdout || null };
  }));
}

export async function cloneSource(root, registry, id) {
  const tool = cloneable(registry, id);
  const dest = path.join(root, 'sources', tool.id);
  const exists = await fs.stat(dest).then(() => true, () => false);
  if (exists) throw new ValidationError(`sources/${tool.id} already exists. Use update instead.`, 409);
  await fs.mkdir(path.join(root, 'sources'), { recursive: true });
  const res = await run('git', ['clone', '--depth', '1', tool.repo, dest], { timeout: 10 * 60_000 });
  if (!res.ok) throw new ValidationError(`git clone failed: ${res.stderr.split('\n').pop() || 'unknown error'}`, 502);
  return { id: tool.id, path: `sources/${tool.id}` };
}

export async function updateSource(root, registry, id) {
  const tool = cloneable(registry, id);
  const dir = path.join(root, 'sources', tool.id);
  const exists = await fs.stat(path.join(dir, '.git')).then(() => true, () => false);
  if (!exists) throw new ValidationError(`sources/${tool.id} has not been cloned yet.`, 404);
  const status = await run('git', ['status', '--porcelain'], { cwd: dir });
  if (status.stdout.length > 0) return { id: tool.id, updated: false, skipped: 'Working tree has local changes; left untouched.' };
  const res = await run('git', ['pull', '--ff-only'], { cwd: dir, timeout: 5 * 60_000 });
  if (!res.ok) throw new ValidationError(`git pull --ff-only failed: ${res.stderr.split('\n').pop() || 'unknown error'}`, 502);
  return { id: tool.id, updated: !/Already up to date/i.test(res.stdout), output: res.stdout.split('\n').pop() };
}

// ---------------------------------------------------------------- launching assistants

export async function launchAssistant(root, registry, id) {
  const tool = registry.tools.tools.find((t) => t.id === id && t.launchable);
  if (!tool) throw new ValidationError(`"${id}" cannot be launched from the dashboard.`, 404);
  if (!IS_WINDOWS) throw new ValidationError('Launching a terminal is implemented for Windows only.', 501);
  const found = await findCommand(tool.command);
  if (!found) throw new ValidationError(`${tool.name} was not found on PATH. Install it first.`, 409);
  const cwd = path.join(root, 'projects');
  await fs.mkdir(cwd, { recursive: true });
  const child = spawn('cmd.exe', ['/c', 'start', `RumiStack - ${tool.name}`, '/D', cwd, 'cmd.exe', '/k', tool.command], {
    detached: true, stdio: 'ignore', windowsHide: false
  });
  child.unref();
  return { id: tool.id, cwd: 'projects' };
}

// ---------------------------------------------------------------- skills restore preview

export function skillsPreview(selections, registry) {
  const sources = new Map(registry.skills.sources.map((s) => [s.id, s]));
  const commands = selections.map((sel) => {
    const src = sources.get(sel.source);
    const args = ['npx --yes skills add', src.repo, '--skill', sel.skill, ...sel.assistants.flatMap((a) => ['--agent', a])];
    if (sel.scope === 'global') args.push('--global');
    args.push('--yes');
    return {
      source: sel.source, skill: sel.skill, scope: sel.scope,
      requiresProjectPath: sel.scope === 'project',
      command: args.join(' ')
    };
  });
  return {
    commands,
    notes: [
      'Preview only. Restore-Skills.ps1 runs these with -WhatIf / -Confirm and requires Node.js 22.20+.',
      'Project-scoped skills need -ProjectPath pointing at the real project; the command runs from that folder.',
      'Inspect each upstream skill (scripts, hooks, permissions, licence) before confirming.'
    ]
  };
}
