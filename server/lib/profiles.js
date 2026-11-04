// Validation + persistence for the five portable profile types.
// Every validator returns a normalised copy and throws ValidationError on anything unexpected.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './store.js';
import {
  ValidationError, assertObject, rejectUnknown, assertSchemaVersion, assertId, assertText, assertEnvName,
  assertModelId, assertArray, assertUnique, assertUrl, scanForSecrets, COMMAND_RE, VSCODE_EXT_RE, HEADER_RE
} from './validate.js';

export const FILES = {
  device: 'portable-profile.json',
  providers: 'provider-profiles.json',
  skills: 'skills-profile.json',
  agents: 'agent-profiles.json',
  mcp: 'mcp-servers.json'
};

const EMPTY = {
  device: { schemaVersion: 1, tools: [], sources: [], vscodeExtensions: [] },
  providers: { schemaVersion: 1, profiles: [] },
  skills: { schemaVersion: 1, selections: [] },
  agents: { schemaVersion: 1, profiles: [] },
  mcp: { schemaVersion: 1, servers: [] }
};

export const PROTOCOL_IDS = ['openai-chat', 'openai-responses', 'anthropic-messages'];
export const PROVIDER_PRESETS = ['freellmapi', 'omniroute', 'custom'];
export const SKILL_SCOPES = ['global', 'project'];

// ---------------------------------------------------------------- device profile

export function validateDevice(input, registry) {
  assertObject(input, 'profile');
  rejectUnknown(input, ['schemaVersion', 'tools', 'sources', 'vscodeExtensions'], 'profile');
  assertSchemaVersion(input, 'profile');
  scanForSecrets(input, 'profile');

  const toolIds = new Map(registry.tools.tools.map((t) => [t.id, t]));
  const tools = assertArray(input.tools ?? [], 'profile.tools', { max: 200 }).map((id) => {
    assertId(id, 'profile.tools[]');
    if (!toolIds.has(id)) throw new ValidationError(`profile.tools contains unknown tool "${id}".`);
    return id;
  });
  assertUnique(tools, 'profile.tools');

  const sources = assertArray(input.sources ?? [], 'profile.sources', { max: 200 }).map((id) => {
    assertId(id, 'profile.sources[]');
    const tool = toolIds.get(id);
    if (!tool) throw new ValidationError(`profile.sources contains unknown tool "${id}".`);
    if (!tool.clone) throw new ValidationError(`"${id}" is not on the source-clone allowlist.`);
    return id;
  });
  assertUnique(sources, 'profile.sources');

  const vscodeExtensions = assertArray(input.vscodeExtensions ?? [], 'profile.vscodeExtensions', { max: 200 }).map((id) => {
    if (typeof id !== 'string' || !VSCODE_EXT_RE.test(id) || id.length > 100) {
      throw new ValidationError(`profile.vscodeExtensions entry "${String(id).slice(0, 40)}" must look like publisher.extension.`);
    }
    return id;
  });
  assertUnique(vscodeExtensions.map((e) => e.toLowerCase()), 'profile.vscodeExtensions');

  return { schemaVersion: 1, tools, sources, vscodeExtensions };
}

// ---------------------------------------------------------------- providers

export function validateProviders(input) {
  assertObject(input, 'providers');
  rejectUnknown(input, ['schemaVersion', 'profiles'], 'providers');
  assertSchemaVersion(input, 'providers');
  const profiles = assertArray(input.profiles ?? [], 'providers.profiles', { max: 30 }).map((p, i) => {
    const where = `providers.profiles[${i}]`;
    assertObject(p, where);
    rejectUnknown(p, ['id', 'name', 'preset', 'baseUrl', 'model', 'apiKeyEnv', 'protocols', 'notes'], where);
    assertId(p.id, `${where}.id`);
    if (!PROVIDER_PRESETS.includes(p.preset)) throw new ValidationError(`${where}.preset must be one of ${PROVIDER_PRESETS.join(', ')}.`);
    const protocols = assertArray(p.protocols, `${where}.protocols`, { max: 3 });
    if (protocols.length === 0) throw new ValidationError(`${where}.protocols must list at least one protocol.`);
    for (const proto of protocols) {
      if (!PROTOCOL_IDS.includes(proto)) throw new ValidationError(`${where}.protocols contains unsupported protocol "${proto}".`);
    }
    assertUnique(protocols, `${where}.protocols`);
    const out = {
      id: p.id,
      name: assertText(p.name, `${where}.name`, { max: 80 }),
      preset: p.preset,
      baseUrl: assertUrl(p.baseUrl, `${where}.baseUrl`).replace(/\/+$/, ''),
      model: assertModelId(p.model, `${where}.model`),
      apiKeyEnv: assertEnvName(p.apiKeyEnv, `${where}.apiKeyEnv`),
      protocols
    };
    const notes = assertText(p.notes, `${where}.notes`, { max: 400, optional: true });
    if (notes) out.notes = notes;
    scanForSecrets(out, where);
    return out;
  });
  assertUnique(profiles.map((p) => p.id), 'providers.profiles ids');
  return { schemaVersion: 1, profiles };
}

// ---------------------------------------------------------------- skills

export function validateSkills(input, registry) {
  assertObject(input, 'skills');
  rejectUnknown(input, ['schemaVersion', 'selections'], 'skills');
  assertSchemaVersion(input, 'skills');
  const sources = new Map(registry.skills.sources.map((s) => [s.id, s]));
  const assistants = new Set(registry.skills.assistants.map((a) => a.id));

  const selections = assertArray(input.selections ?? [], 'skills.selections', { max: 300 }).map((s, i) => {
    const where = `skills.selections[${i}]`;
    assertObject(s, where);
    rejectUnknown(s, ['source', 'skill', 'assistants', 'scope'], where);
    assertId(s.source, `${where}.source`);
    const source = sources.get(s.source);
    if (!source) throw new ValidationError(`${where}.source "${s.source}" is not in the skills catalogue.`);
    if (!source.installable) {
      throw new ValidationError(`${where}.source "${s.source}" is ${source.tier === 'discovery' ? 'discovery-only' : 'a manual plugin'} and cannot be installed by RumiStack.`);
    }
    assertId(s.skill, `${where}.skill`);
    if (!source.skills.some((k) => k.id === s.skill)) throw new ValidationError(`${where}.skill "${s.skill}" is not listed for source "${s.source}".`);
    const targets = assertArray(s.assistants, `${where}.assistants`, { max: 10 });
    if (targets.length === 0) throw new ValidationError(`${where}.assistants must name at least one assistant.`);
    for (const a of targets) {
      if (!assistants.has(a)) throw new ValidationError(`${where}.assistants contains unsupported assistant "${a}".`);
    }
    assertUnique(targets, `${where}.assistants`);
    if (!SKILL_SCOPES.includes(s.scope)) throw new ValidationError(`${where}.scope must be "global" or "project".`);
    return { source: s.source, skill: s.skill, assistants: targets, scope: s.scope };
  });
  assertUnique(selections.map((s) => `${s.source}/${s.skill}/${s.scope}`), 'skills.selections');
  return { schemaVersion: 1, selections };
}

// ---------------------------------------------------------------- agents

export function validateAgents(input) {
  assertObject(input, 'agents');
  rejectUnknown(input, ['schemaVersion', 'profiles'], 'agents');
  assertSchemaVersion(input, 'agents');
  const profiles = assertArray(input.profiles ?? [], 'agents.profiles', { max: 50 }).map((p, i) => {
    const where = `agents.profiles[${i}]`;
    assertObject(p, where);
    rejectUnknown(p, ['id', 'name', 'description', 'prompt'], where);
    assertId(p.id, `${where}.id`);
    const out = {
      id: p.id,
      name: assertText(p.name, `${where}.name`, { max: 80 }),
      description: assertText(p.description, `${where}.description`, { max: 300 }),
      prompt: assertText(p.prompt, `${where}.prompt`, { min: 10, max: 8000 })
    };
    scanForSecrets(out, where);
    return out;
  });
  assertUnique(profiles.map((p) => p.id), 'agents.profiles ids');
  return { schemaVersion: 1, profiles };
}

// ---------------------------------------------------------------- MCP

export function validateMcp(input) {
  assertObject(input, 'mcp');
  rejectUnknown(input, ['schemaVersion', 'servers'], 'mcp');
  assertSchemaVersion(input, 'mcp');
  const servers = assertArray(input.servers ?? [], 'mcp.servers', { max: 50 }).map((s, i) => {
    const where = `mcp.servers[${i}]`;
    assertObject(s, where);
    rejectUnknown(s, ['id', 'name', 'transport', 'command', 'args', 'url', 'envVars', 'headerEnv', 'clients'], where);
    assertId(s.id, `${where}.id`);
    if (s.transport !== 'stdio' && s.transport !== 'http') throw new ValidationError(`${where}.transport must be "stdio" or "http".`);
    const clients = assertArray(s.clients ?? [], `${where}.clients`, { max: 4 });
    for (const c of clients) {
      if (!['claude-code', 'opencode', 'codex', 'vscode'].includes(c)) throw new ValidationError(`${where}.clients contains unsupported client "${c}".`);
    }
    assertUnique(clients, `${where}.clients`);
    const envVars = assertArray(s.envVars ?? [], `${where}.envVars`, { max: 20 }).map((n) => assertEnvName(n, `${where}.envVars[]`));
    assertUnique(envVars, `${where}.envVars`);

    const out = { id: s.id, name: assertText(s.name, `${where}.name`, { max: 80 }), transport: s.transport, clients, envVars };
    if (s.transport === 'stdio') {
      if (s.url !== undefined || (s.headerEnv && Object.keys(s.headerEnv).length)) {
        throw new ValidationError(`${where}: stdio servers cannot have a url or headerEnv.`);
      }
      if (typeof s.command !== 'string' || !COMMAND_RE.test(s.command)) {
        throw new ValidationError(`${where}.command must be a bare executable name such as npx or uvx (no paths or spaces).`);
      }
      out.command = s.command;
      out.args = assertArray(s.args ?? [], `${where}.args`, { max: 30 }).map((a, j) => {
        if (typeof a !== 'string' || a.length > 200) throw new ValidationError(`${where}.args[${j}] must be a string of at most 200 characters.`);
        // eslint-disable-next-line no-control-regex
        if (/[\u0000-\u001f]/.test(a)) throw new ValidationError(`${where}.args[${j}] contains control characters.`);
        return a;
      });
      out.headerEnv = {};
    } else {
      if (s.command !== undefined || (s.args && s.args.length)) throw new ValidationError(`${where}: http servers cannot have a command or args.`);
      out.url = assertUrl(s.url, `${where}.url`);
      assertObject(s.headerEnv ?? {}, `${where}.headerEnv`);
      out.headerEnv = {};
      for (const [header, env] of Object.entries(s.headerEnv ?? {})) {
        if (!HEADER_RE.test(header)) throw new ValidationError(`${where}.headerEnv has an invalid header name "${header}".`);
        out.headerEnv[header] = assertEnvName(env, `${where}.headerEnv.${header}`);
      }
      out.args = [];
    }
    scanForSecrets(out, where);
    return out;
  });
  assertUnique(servers.map((s) => s.id), 'mcp.servers ids');
  return { schemaVersion: 1, servers };
}

// ---------------------------------------------------------------- persistence

export const BACKUP_RE = /^(device|providers|skills|agents|mcp)-\d{8}T\d{9}Z\.json$/;
const BACKUPS_KEPT_PER_KIND = 20;

/**
 * @param {string} configDir
 * @param {object} registry
 * @param {{backupsDir?: string}} [options] When set, the previous file is copied there before every change.
 */
export function createProfileStore(configDir, registry, { backupsDir } = {}) {
  const validators = {
    device: (v) => validateDevice(v, registry),
    providers: validateProviders,
    skills: (v) => validateSkills(v, registry),
    agents: validateAgents,
    mcp: validateMcp
  };

  async function load(kind) {
    const raw = await readJson(path.join(configDir, FILES[kind]), EMPTY[kind]);
    return validators[kind](raw);
  }

  async function backupCurrent(kind, next) {
    if (!backupsDir) return null;
    let current;
    try {
      current = await fs.readFile(path.join(configDir, FILES[kind]), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
    if (current === JSON.stringify(next, null, 2) + '\n') return null; // unchanged: no backup noise
    await fs.mkdir(backupsDir, { recursive: true });
    for (let attempt = 0; attempt < 5; attempt++) {
      const name = `${kind}-${new Date().toISOString().replace(/[-:.]/g, '')}.json`;
      try {
        await fs.writeFile(path.join(backupsDir, name), current, { encoding: 'utf8', flag: 'wx' });
        await prune(kind);
        return name;
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        await new Promise((r) => setTimeout(r, 3));
      }
    }
    return null;
  }

  async function prune(kind) {
    const names = (await fs.readdir(backupsDir)).filter((n) => n.startsWith(`${kind}-`) && BACKUP_RE.test(n)).sort();
    for (const old of names.slice(0, Math.max(0, names.length - BACKUPS_KEPT_PER_KIND))) await fs.rm(path.join(backupsDir, old), { force: true });
  }

  async function save(kind, input) {
    const clean = validators[kind](input);
    await backupCurrent(kind, clean);
    await writeJsonAtomic(path.join(configDir, FILES[kind]), clean);
    return clean;
  }

  async function listBackups() {
    if (!backupsDir) return [];
    let names;
    try {
      names = await fs.readdir(backupsDir);
    } catch {
      return [];
    }
    const out = [];
    for (const file of names.filter((n) => BACKUP_RE.test(n)).sort().reverse()) {
      const stat = await fs.stat(path.join(backupsDir, file));
      const m = /^([a-z]+)-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z\.json$/.exec(file);
      out.push({ file, kind: m[1], createdAt: `${m[2]}-${m[3]}-${m[4]}T${m[5]}:${m[6]}:${m[7]}.${m[8]}Z`, size: stat.size });
    }
    return out;
  }

  async function restoreBackup(file) {
    if (typeof file !== 'string' || !BACKUP_RE.test(file)) throw new ValidationError('Invalid backup file name.');
    const kind = file.slice(0, file.indexOf('-'));
    let text;
    try {
      text = await fs.readFile(path.join(backupsDir, file), 'utf8');
    } catch {
      throw new ValidationError('Backup not found.', 404);
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ValidationError('Backup is not valid JSON.', 422);
    }
    // Re-validated like any other save, and the file being replaced is itself backed up first.
    return { kind, profile: await save(kind, parsed) };
  }

  return { load, save, validate: (kind, v) => validators[kind](v), listBackups, restoreBackup };
}
