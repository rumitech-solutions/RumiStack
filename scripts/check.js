// `npm run check`: syntax, JSON, registry integrity, profile validation and repo-hygiene checks.
// Zero dependencies. Exits non-zero on the first category of failure it finds.

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadRegistry } from '../server/lib/registry.js';
import { createProfileStore, validateMcp, FILES } from '../server/lib/profiles.js';
import { scanForSecrets } from '../server/lib/validate.js';

const problems = [];
const fail = (msg) => problems.push(msg);

async function walk(dir, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'sources', 'projects', 'state', 'logs', 'backups'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = await walk(REPO_ROOT);
const rel = (f) => path.relative(REPO_ROOT, f).split(path.sep).join('/');

// 1. JavaScript syntax
for (const f of files.filter((f) => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    fail(`Syntax error in ${rel(f)}:\n${String(err.stderr).trim()}`);
  }
}

// 2. JSON validity
for (const f of files.filter((f) => f.endsWith('.json'))) {
  try {
    JSON.parse(await fs.readFile(f, 'utf8'));
  } catch (err) {
    fail(`Invalid JSON in ${rel(f)}: ${err.message}`);
  }
}

const registry = await loadRegistry();
const { tools, skills, mcp, providers } = registry;

// 3. Tool registry integrity
const NPM_RE = /^(@[a-z0-9][a-z0-9-._~]*\/)?[a-z0-9][a-z0-9-._~]*$/;
const WINGET_RE = /^[A-Za-z0-9][A-Za-z0-9.-]{2,100}$/;
const catIds = new Set(tools.categories.map((c) => c.id));
const seen = new Set();
for (const t of tools.tools) {
  const at = `registry/tools.json:${t.id}`;
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(t.id)) fail(`${at}: invalid id`);
  if (seen.has(t.id)) fail(`${at}: duplicate id`);
  seen.add(t.id);
  if (!catIds.has(t.category)) fail(`${at}: unknown category "${t.category}"`);
  for (const k of ['name', 'description', 'repo', 'docs']) if (!t[k]) fail(`${at}: missing ${k}`);
  for (const k of ['repo', 'docs']) if (t[k] && !t[k].startsWith('https://')) fail(`${at}: ${k} must be https`);
  if (!['npm', 'winget', 'manual'].includes(t.install?.type)) fail(`${at}: install.type must be npm, winget or manual`);
  if (t.install?.type === 'npm' && !NPM_RE.test(t.install.package ?? '')) fail(`${at}: invalid npm package name`);
  if (t.install?.type === 'winget' && !WINGET_RE.test(t.install.package ?? '')) fail(`${at}: invalid winget id`);
  if (t.install?.type === 'manual' && !t.install.note) fail(`${at}: manual installs need a note`);
  if (t.clone && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(t.repo)) fail(`${at}: clone allowlist requires a github.com HTTPS repo URL`);
  if (t.command !== null && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(t.command ?? '')) fail(`${at}: invalid command`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(tools.updated)) fail('registry/tools.json: "updated" must be YYYY-MM-DD');

// 4. Skills + MCP + provider catalogues
const assistantIds = new Set(skills.assistants.map((a) => a.id));
for (const s of skills.sources) {
  if (s.installable && !/^[\w.-]+\/[\w.-]+$/.test(s.repo ?? '')) fail(`registry/skills.json:${s.id}: installable sources need an owner/repo`);
  if (!['official', 'vendor', 'community', 'discovery'].includes(s.tier)) fail(`registry/skills.json:${s.id}: unknown tier`);
  if (s.tier === 'discovery' && s.installable) fail(`registry/skills.json:${s.id}: discovery sources cannot be installable`);
}
if (assistantIds.size === 0) fail('registry/skills.json: no assistants');
try {
  validateMcp({
    schemaVersion: 1,
    servers: mcp.templates.map(({ description, docs, ...server }) => ({ clients: ['claude-code'], ...server }))
  });
} catch (err) {
  fail(`registry/mcp.json templates: ${err.message}`);
}
if (providers.protocols.length !== 3) fail('registry/providers.json: expected 3 protocols');

// 5. Tracked config profiles validate and contain no secrets
const store = createProfileStore(path.join(REPO_ROOT, 'config'), registry);
for (const kind of Object.keys(FILES)) {
  try {
    const profile = await store.load(kind);
    scanForSecrets(profile, `config/${FILES[kind]}`);
  } catch (err) {
    fail(`config/${FILES[kind]}: ${err.message}`);
  }
}

// 6. Repo hygiene
const gitignore = await fs.readFile(path.join(REPO_ROOT, '.gitignore'), 'utf8').catch(() => '');
for (const entry of ['sources/', 'projects/', 'logs/', 'backups/', 'state/', '.env']) {
  if (!gitignore.split(/\r?\n/).includes(entry)) fail(`.gitignore must keep the "${entry}" safeguard`);
}
// tests/ deliberately contains fake credentials to prove they are rejected, so it is exempt.
for (const f of files.filter((f) => /\.(md|json|ps1|js|html|css|yml)$/.test(f) && !rel(f).startsWith('tests/'))) {
  const text = await fs.readFile(f, 'utf8');
  try {
    scanForSecrets(text.split(/\r?\n/), rel(f));
  } catch (err) {
    fail(err.message);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) found:\n`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log(`RumiStack check passed: ${files.filter((f) => f.endsWith('.js')).length} scripts, ${tools.tools.length} tools in ${tools.categories.length} categories, ${Object.keys(FILES).length} profiles.`);
