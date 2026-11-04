// Docker support for self-hosted gateways. RumiStack never writes its own compose files: it runs the
// upstream project's docker-compose.yml from sources/<id>, with fixed arguments only. The registry entry
// (tools.json -> "docker") is the allowlist; nothing from the browser reaches a command line except a tool id.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { run } from './system.js';
import { ValidationError } from './validate.js';

const MAX_LOG = 64 * 1024;
const COMPOSE_TIMEOUT = 20 * 60_000; // first run may build an image from source

function lastLine(text) {
  return String(text).split('\n').filter(Boolean).pop() ?? 'unknown error';
}

export function gatewayEntries(registry) {
  return registry.tools.tools.filter((t) => t.docker);
}

function gateway(registry, id) {
  const tool = gatewayEntries(registry).find((t) => t.id === id);
  if (!tool) throw new ValidationError(`"${id}" has no Docker support in the registry.`, 404);
  return tool;
}

function composeArgs(tool, ...rest) {
  return ['compose', ...(tool.docker.profile ? ['--profile', tool.docker.profile] : []), ...rest];
}

export async function dockerAvailability() {
  const cli = await run('docker', ['--version'], { timeout: 10_000 });
  if (!cli.ok) return { cli: false, compose: false, daemon: false };
  const [compose, daemon] = await Promise.all([
    run('docker', ['compose', 'version', '--short'], { timeout: 10_000 }),
    run('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 15_000 })
  ]);
  return { cli: true, compose: compose.ok, daemon: daemon.ok, composeVersion: compose.ok ? compose.stdout : null, engineVersion: daemon.ok ? daemon.stdout : null };
}

/** `docker compose ps --format json` prints either one JSON array or one object per line, depending on version. */
export function parsePs(text) {
  const raw = String(text).trim();
  if (!raw) return [];
  let items;
  try {
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    items = raw.split('\n').map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  }
  return items.map((c) => ({ service: String(c.Service ?? c.Name ?? ''), state: String(c.State ?? ''), health: String(c.Health ?? '') }));
}

/** True when the .env asks Docker to publish on a non-loopback interface. Only the named key is read. */
export function bindsOutsideLoopback(envText, keys) {
  for (const key of keys ?? []) {
    const m = new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'#\\s]*)`, 'm').exec(envText);
    if (m && m[1] && !['127.0.0.1', 'localhost', '::1'].includes(m[1])) return true;
  }
  return false;
}

async function dirs(root, tool) {
  const dir = path.join(root, 'sources', tool.id);
  const cloned = await fs.stat(path.join(dir, '.git')).then(() => true, () => false);
  const compose = cloned && await fs.stat(path.join(dir, tool.docker.compose)).then(() => true, () => false);
  const envText = cloned ? await fs.readFile(path.join(dir, tool.docker.env), 'utf8').catch(() => null) : null;
  return { dir, cloned, compose, envText };
}

export async function gatewayStatus(root, registry, availability) {
  const docker = availability ?? await dockerAvailability();
  const gateways = await Promise.all(gatewayEntries(registry).map(async (tool) => {
    const { dir, cloned, compose, envText } = await dirs(root, tool);
    const out = {
      id: tool.id, name: tool.name, description: tool.description, url: tool.docker.url, note: tool.docker.note ?? null,
      cloned, composeFile: compose, envReady: envText !== null,
      exposed: envText ? bindsOutsideLoopback(envText, tool.docker.bindKeys) : false,
      containers: []
    };
    if (compose && docker.daemon && docker.compose) {
      const ps = await run('docker', composeArgs(tool, 'ps', '--all', '--format', 'json'), { cwd: dir, timeout: 30_000 });
      if (ps.ok) out.containers = parsePs(ps.stdout);
    }
    out.running = out.containers.some((c) => c.state === 'running');
    return out;
  }));
  return { docker, gateways };
}

async function ready(root, registry, id, { needEnv }) {
  const tool = gateway(registry, id);
  const { dir, cloned, compose, envText } = await dirs(root, tool);
  if (!cloned) throw new ValidationError(`Clone ${tool.name} first (Catalogue → Clone source).`, 409);
  if (!compose) throw new ValidationError(`${tool.docker.compose} was not found in sources/${tool.id}. The upstream layout may have changed.`, 409);
  if (needEnv && envText === null) throw new ValidationError(`Prepare ${tool.name} first so ${tool.docker.env} exists.`, 409);
  const docker = await dockerAvailability();
  if (!docker.cli || !docker.compose) throw new ValidationError('Docker with the compose plugin was not found. Install Docker Desktop.', 409);
  if (!docker.daemon) throw new ValidationError('The Docker engine is not running. Start Docker Desktop and try again.', 409);
  return { tool, dir };
}

/** Creates .env from the upstream example (never overwrites) and fills any listed secret keys with random values. */
export async function prepareGateway(root, registry, id) {
  const tool = gateway(registry, id);
  const { dir, cloned, envText } = await dirs(root, tool);
  if (!cloned) throw new ValidationError(`Clone ${tool.name} first (Catalogue → Clone source).`, 409);
  if (envText !== null) return { id, created: false, generated: [] };
  const example = await fs.readFile(path.join(dir, tool.docker.envExample), 'utf8').catch(() => null);
  if (example === null) throw new ValidationError(`${tool.docker.envExample} was not found in sources/${tool.id}.`, 409);

  let text = example;
  const generated = [];
  for (const key of tool.docker.generate ?? []) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) {
      text = text.replace(re, () => `${key}=${crypto.randomBytes(32).toString('hex')}`);
      generated.push(key);
    }
  }
  const file = path.join(dir, tool.docker.env);
  await fs.writeFile(file, text, { mode: 0o600, flag: 'wx' });
  return { id, created: true, generated };
}

export async function gatewayUp(root, registry, id) {
  const { tool, dir } = await ready(root, registry, id, { needEnv: true });
  const res = await run('docker', composeArgs(tool, 'up', '-d'), { cwd: dir, timeout: COMPOSE_TIMEOUT });
  if (!res.ok) throw new ValidationError(`docker compose up failed: ${lastLine(res.stderr || res.stdout)}`, 502);
  return { id, started: true };
}

/** Stops and removes containers. Volumes are never removed, so gateway data survives. */
export async function gatewayDown(root, registry, id) {
  const { tool, dir } = await ready(root, registry, id, { needEnv: false });
  const res = await run('docker', composeArgs(tool, 'down'), { cwd: dir, timeout: 5 * 60_000 });
  if (!res.ok) throw new ValidationError(`docker compose down failed: ${lastLine(res.stderr || res.stdout)}`, 502);
  return { id, stopped: true };
}

export async function gatewayLogs(root, registry, id) {
  const { tool, dir } = await ready(root, registry, id, { needEnv: false });
  const res = await run('docker', composeArgs(tool, 'logs', '--no-color', '--tail', '150'), { cwd: dir, timeout: 30_000 });
  let logs = [res.stdout, res.stderr].filter(Boolean).join('\n');
  const truncated = logs.length > MAX_LOG;
  if (truncated) logs = logs.slice(-MAX_LOG);
  return { id, logs, truncated };
}

