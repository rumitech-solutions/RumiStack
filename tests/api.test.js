import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

let s;
before(async () => { s = await startTestServer(); });
after(async () => { await s.close(); });

const provider = (over = {}) => ({
  id: 'omniroute-local', name: 'OmniRoute (local)', preset: 'omniroute', baseUrl: 'http://127.0.0.1:20128/v1',
  model: 'auto', apiKeyEnv: 'OMNIROUTE_API_KEY', protocols: ['openai-chat'], ...over
});

test('meta and registry', async () => {
  const meta = await s.get('/api/meta');
  assert.equal(meta.status, 200);
  assert.equal(meta.json.name, 'RumiStack');
  const reg = await s.get('/api/registry/tools');
  assert.equal(reg.json.tools.length, 27);
  assert.equal(reg.json.categories.length, 7);
});

test('dashboard is served with a strict CSP; traversal and unknown files are 404', async () => {
  const page = await s.get('/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(page.text, /RumiStack/);
  assert.equal((await s.raw('GET', '/..%2fpackage.json')).status, 404);
  assert.equal((await s.raw('GET', '/js/../../package.json')).status, 404);
  assert.equal((await s.get('/nope.js')).status, 404);
});

test('rejects unexpected Host headers (DNS rebinding)', async () => {
  assert.equal((await s.raw('GET', '/api/meta', { Host: 'evil.example' })).status, 403);
  assert.equal((await s.raw('GET', '/api/meta', { Host: `127.0.0.1:${s.port}` })).status, 200);
});

test('mutating requests reject cross-origin and non-JSON', async () => {
  const body = { schemaVersion: 1, tools: [], sources: [], vscodeExtensions: [] };
  assert.equal((await s.put('/api/profile', body, { Origin: 'http://evil.example' })).status, 403);
  assert.equal((await s.put('/api/profile', body, { Origin: `http://127.0.0.1:${s.port}` })).status, 200);
  assert.equal((await s.put('/api/profile', body, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const text = await s.raw('PUT', '/api/profile', { 'Content-Type': 'text/plain' }, 'x');
  assert.equal(text.status, 415);
  assert.equal((await s.post('/api/launch', { id: 'claude-code' }, { Origin: 'https://evil.example' })).status, 403);
});

test('device profile validation and round trip', async () => {
  const ok = await s.put('/api/profile', { schemaVersion: 1, tools: ['git', 'claude-code'], sources: ['superpowers'], vscodeExtensions: ['saoudrizwan.claude-dev'] });
  assert.equal(ok.status, 200);
  assert.deepEqual((await s.get('/api/profile')).json.profile.tools, ['git', 'claude-code']);
  const bad = [
    { schemaVersion: 1, tools: ['nope'] },
    { schemaVersion: 1, tools: ['git', 'git'] },
    { schemaVersion: 1, sources: ['git'] }, // not on the clone allowlist
    { schemaVersion: 1, vscodeExtensions: ['not valid'] },
    { schemaVersion: 1, extra: true },
    { schemaVersion: 2 }
  ];
  for (const b of bad) assert.equal((await s.put('/api/profile', b)).status, 400, JSON.stringify(b));
  // a failed save must not have changed the stored profile
  assert.deepEqual((await s.get('/api/profile')).json.profile.sources, ['superpowers']);
});

test('overview compares the profile with this machine', async () => {
  const res = await s.get('/api/overview');
  assert.equal(res.status, 200);
  assert.equal(res.json.counts.selected, 2);
  assert.ok(res.json.items.every((i) => ['ok', 'restore', 'manual install', 'check manually'].includes(i.action)));
});

test('provider profiles: valid save, strict rejection paths', async () => {
  const ok = await s.put('/api/providers', { schemaVersion: 1, profiles: [provider()] });
  assert.equal(ok.status, 200);
  const rejects = {
    'secret in env name': provider({ apiKeyEnv: 'sk-abcdefghijklmnopqrstuvwxyz' }),
    'lowercase env name': provider({ apiKeyEnv: 'my_key' }),
    'remote http': provider({ baseUrl: 'http://gateway.example.com/v1' }),
    'url credentials': provider({ baseUrl: 'https://user:pw@gateway.example.com/v1' }),
    'url query': provider({ baseUrl: 'https://gateway.example.com/v1?key=abc' }),
    'bad protocol': provider({ protocols: ['grpc'] }),
    'no protocols': provider({ protocols: [] }),
    'bad model': provider({ model: 'x; y' }),
    'bad preset': provider({ preset: 'other' }),
    'unknown field': provider({ apiKey: 'abc' }),
    'secret in notes': provider({ notes: 'key is sk-abcdefghijklmnopqrstuvwx' })
  };
  for (const [label, p] of Object.entries(rejects)) {
    assert.equal((await s.put('/api/providers', { schemaVersion: 1, profiles: [p] })).status, 400, label);
  }
  assert.equal((await s.put('/api/providers', { schemaVersion: 1, profiles: [provider(), provider()] })).status, 400, 'duplicate ids');
  assert.equal((await s.get('/api/providers')).json.profiles.length, 1);
});

test('provider snippets reference env vars and respect protocol flags', async () => {
  await s.put('/api/providers', { schemaVersion: 1, profiles: [provider({ protocols: ['openai-chat', 'anthropic-messages'] })] });
  const claude = await s.post('/api/providers/snippet', { id: 'omniroute-local', client: 'claude-code' });
  assert.match(claude.json.snippet, /ANTHROPIC_BASE_URL = 'http:\/\/127\.0\.0\.1:20128'/);
  assert.match(claude.json.snippet, /\$env:OMNIROUTE_API_KEY/);

  const oc = await s.post('/api/providers/snippet', { id: 'omniroute-local', client: 'opencode' });
  const cfg = JSON.parse(oc.json.snippet);
  assert.equal(cfg.provider['omniroute-local'].options.apiKey, '{env:OMNIROUTE_API_KEY}');
  assert.equal(cfg.model, 'omniroute-local/auto');

  const codex = await s.post('/api/providers/snippet', { id: 'omniroute-local', client: 'codex' });
  assert.match(codex.json.snippet, /env_key = "OMNIROUTE_API_KEY"/);
  assert.match(codex.json.snippet, /wire_api = "chat"/);

  const disc = await s.post('/api/providers/discovery', { id: 'omniroute-local' });
  assert.match(disc.json.command, /\$env:OMNIROUTE_API_KEY/);

  await s.put('/api/providers', { schemaVersion: 1, profiles: [provider({ protocols: ['openai-responses'] })] });
  assert.equal((await s.post('/api/providers/snippet', { id: 'omniroute-local', client: 'claude-code' })).status, 400);
  assert.equal((await s.post('/api/providers/snippet', { id: 'omniroute-local', client: 'opencode' })).status, 400);
  assert.match((await s.post('/api/providers/snippet', { id: 'omniroute-local', client: 'codex' })).json.snippet, /wire_api = "responses"/);
  assert.equal((await s.post('/api/providers/snippet', { id: 'missing', client: 'codex' })).status, 404);
});

test('skills profile: catalogue-only, no duplicates, no plugin or discovery sources', async () => {
  const sel = (over = {}) => ({ source: 'anthropics-skills', skill: 'frontend-design', assistants: ['claude-code'], scope: 'global', ...over });
  assert.equal((await s.put('/api/skills', { schemaVersion: 1, selections: [sel(), sel({ scope: 'project' })] })).status, 200);
  const rejects = {
    'unknown source': sel({ source: 'evil' }),
    'unknown skill': sel({ skill: 'rm-rf' }),
    'plugin source': sel({ source: 'obra-superpowers', skill: 'brainstorming' }),
    'discovery source': sel({ source: 'skills-sh' }),
    'unsupported assistant': sel({ assistants: ['vim'] }),
    'no assistants': sel({ assistants: [] }),
    'bad scope': sel({ scope: 'machine' })
  };
  for (const [label, p] of Object.entries(rejects)) assert.equal((await s.put('/api/skills', { schemaVersion: 1, selections: [p] })).status, 400, label);
  assert.equal((await s.put('/api/skills', { schemaVersion: 1, selections: [sel(), sel()] })).status, 400, 'duplicate');

  const preview = await s.get('/api/skills/preview');
  assert.equal(preview.json.commands.length, 2);
  assert.match(preview.json.commands[0].command, /^npx --yes skills add anthropics\/skills --skill frontend-design --agent claude-code --global --yes$/);
  assert.equal(preview.json.commands[1].requiresProjectPath, true);
});

test('agent profiles: secrets rejected, exports for every format', async () => {
  const agents = (await s.get('/api/agents')).json;
  assert.equal(agents.profiles.length, 0); // temp config starts empty
  const a = { id: 'planner', name: 'Planner', description: 'Plans work.', prompt: 'Break the goal into small verifiable steps.' };
  assert.equal((await s.put('/api/agents', { schemaVersion: 1, profiles: [a] })).status, 200);
  assert.equal((await s.put('/api/agents', { schemaVersion: 1, profiles: [{ ...a, prompt: 'Use key sk-abcdefghijklmnopqrstuvwx for calls.' }] })).status, 400);
  assert.equal((await s.put('/api/agents', { schemaVersion: 1, profiles: [{ ...a, prompt: 'short' }] })).status, 400);

  const cc = await s.post('/api/agents/export', { id: 'planner', format: 'claude-code' });
  assert.equal(cc.json.filename, '.claude/agents/planner.md');
  assert.match(cc.json.content, /^---\nname: planner\ndescription: "Plans work\."\n---/);
  const oc = await s.post('/api/agents/export', { id: 'planner', format: 'opencode' });
  assert.match(oc.json.content, /mode: subagent/);
  assert.equal((await s.post('/api/agents/export', { id: 'planner', format: 'codex' })).json.filename, 'AGENTS.md');
  assert.match((await s.post('/api/agents/export', { id: 'planner', format: 'universal' })).json.content, /^# Planner/);
  assert.equal((await s.post('/api/agents/export', { id: 'planner', format: 'word' })).status, 400);
});

test('MCP profiles: validation and snippets for every client', async () => {
  const stdio = { id: 'context7', name: 'Context7', transport: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'], envVars: ['CONTEXT7_API_KEY'], clients: ['claude-code', 'opencode', 'codex', 'vscode'] };
  const remote = { id: 'github', name: 'GitHub', transport: 'http', url: 'https://api.githubcopilot.com/mcp/', headerEnv: { Authorization: 'GITHUB_PERSONAL_ACCESS_TOKEN' }, envVars: [], clients: ['claude-code', 'opencode', 'codex', 'vscode'] };
  assert.equal((await s.put('/api/mcp', { schemaVersion: 1, servers: [stdio, remote] })).status, 200);

  const rejects = {
    'command with path': { ...stdio, command: 'C:\\tools\\x.exe' },
    'command with space': { ...stdio, command: 'npx -y' },
    'stdio with url': { ...stdio, url: 'https://example.com' },
    'remote http': { ...remote, url: 'http://example.com/mcp' },
    'http with command': { ...remote, command: 'npx' },
    'secret env name': { ...stdio, envVars: ['sk-abcdefghijklmnopqrstuvwxyz'] },
    'header env secret': { ...remote, headerEnv: { Authorization: 'ghp_' + 'a'.repeat(36) } },
    'bad client': { ...stdio, clients: ['emacs'] },
    'bad transport': { ...stdio, transport: 'sse' }
  };
  for (const [label, p] of Object.entries(rejects)) assert.equal((await s.put('/api/mcp', { schemaVersion: 1, servers: [p] })).status, 400, label);

  const snip = async (id, client) => (await s.post('/api/mcp/snippet', { id, client })).json.snippet;
  assert.match(await snip('context7', 'claude-code'), /^claude mcp add context7 -e "CONTEXT7_API_KEY=\$env:CONTEXT7_API_KEY" -- npx '-y' '@upstash\/context7-mcp'$/);
  assert.match(await snip('github', 'claude-code'), /--transport http github 'https:\/\/api\.githubcopilot\.com\/mcp\/' --header "Authorization: Bearer \$env:GITHUB_PERSONAL_ACCESS_TOKEN"/);
  assert.deepEqual(JSON.parse(await snip('context7', 'opencode')).mcp.context7.command, ['npx', '-y', '@upstash/context7-mcp']);
  assert.equal(JSON.parse(await snip('github', 'opencode')).mcp.github.headers.Authorization, 'Bearer {env:GITHUB_PERSONAL_ACCESS_TOKEN}');
  assert.match(await snip('github', 'codex'), /bearer_token_env_var = "GITHUB_PERSONAL_ACCESS_TOKEN"/);
  assert.match(await snip('context7', 'codex'), /env_vars = \["CONTEXT7_API_KEY"\]/);
  assert.equal(JSON.parse(await snip('context7', 'vscode')).servers.context7.env.CONTEXT7_API_KEY, '${env:CONTEXT7_API_KEY}');
  assert.equal((await s.post('/api/mcp/snippet', { id: 'context7', client: 'emacs' })).status, 400);
});

test('source clone/update are limited to the registry allowlist', async () => {
  for (const id of ['git', 'does-not-exist']) {
    assert.equal((await s.post('/api/sources/clone', { id })).status, 404, id);
    assert.equal((await s.post('/api/sources/update', { id })).status, 404, id);
  }
  assert.equal((await s.post('/api/sources/clone', { id: '../etc' })).status, 400);
  assert.equal((await s.post('/api/sources/update', { id: 'superpowers' })).status, 404); // allowlisted but not cloned
  const list = await s.get('/api/sources');
  assert.ok(list.json.sources.length > 0 && list.json.sources.every((x) => x.cloned === false));
});

test('launch refuses non-launchable tools and arbitrary ids', async () => {
  assert.equal((await s.post('/api/launch', { id: 'git' })).status, 404);
  assert.equal((await s.post('/api/launch', { id: 'cmd /c calc' })).status, 400);
});

test('unknown routes and oversized bodies', async () => {
  assert.equal((await s.get('/api/unknown')).status, 404);
  const big = await s.raw('PUT', '/api/profile', { 'Content-Type': 'application/json' }, JSON.stringify({ x: 'a'.repeat(300 * 1024) }));
  assert.equal(big.status, 413);
});
