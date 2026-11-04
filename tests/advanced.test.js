import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { startTestServer } from './helpers.js';
import { parseVersion, compareVersions } from '../server/lib/system.js';
import { sanitizeRemote, parsePorcelain } from '../server/lib/git.js';

let s;
before(async () => { s = await startTestServer(); });
after(async () => { await s.close(); });

const device = (tools) => ({ schemaVersion: 1, tools, sources: [], vscodeExtensions: [] });

test('version helpers', () => {
  assert.equal(parseVersion('claude 2.0.31 (Claude Code)'), '2.0.31');
  assert.equal(parseVersion('v22.23.4'), '22.23.4');
  assert.equal(parseVersion('Docker version 27.0.3, build abc'), '27.0.3');
  assert.equal(parseVersion('no digits'), null);
  assert.equal(compareVersions('1.2.3', '1.10.0'), -1);
  assert.equal(compareVersions('2.0', '2.0.0'), 0);
  assert.equal(compareVersions('3.0.1', '3.0.0'), 1);
});

test('git helpers', () => {
  assert.equal(sanitizeRemote('https://user:token@github.com/o/r.git'), 'https://github.com/o/r.git');
  assert.equal(sanitizeRemote('https://github.com/o/r.git'), 'https://github.com/o/r.git');
  assert.deepEqual(parsePorcelain('M config/a.json\n?? config/b.json\n'), [{ status: 'M', file: 'config/a.json' }, { status: '??', file: 'config/b.json' }]);
  // git porcelain lines start with a space for unstaged changes, and run() only trims the whole output once,
  // so every line after the first still has its leading space. All of them must be parsed.
  assert.deepEqual(parsePorcelain(' M config/a.json\n M config/b.json\n?? config/c.json\nA  config/d.json'), [
    { status: 'M', file: 'config/a.json' }, { status: 'M', file: 'config/b.json' }, { status: '??', file: 'config/c.json' }, { status: 'A', file: 'config/d.json' }
  ]);
});

test('versions endpoint returns a plain map of strings or null', async () => {
  const res = await s.get('/api/tools/versions');
  assert.equal(res.status, 200);
  for (const v of Object.values(res.json.versions)) assert.ok(v === null || typeof v === 'string');
});

test('every successful save keeps a backup of the previous file, and backups can be restored', async () => {
  assert.equal((await s.get('/api/backups')).json.backups.length, 0);
  await s.put('/api/profile', device(['git']));            // first write: nothing to back up
  assert.equal((await s.get('/api/backups')).json.backups.length, 0);
  await s.put('/api/profile', device(['git']));            // unchanged: no backup noise
  assert.equal((await s.get('/api/backups')).json.backups.length, 0);
  await s.put('/api/profile', device(['git', 'nodejs']));  // changed: previous version is saved
  const list = (await s.get('/api/backups')).json.backups;
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, 'device');
  assert.match(list[0].file, /^device-\d{8}T\d{9}Z\.json$/);

  const restored = await s.post('/api/backups/restore', { file: list[0].file });
  assert.equal(restored.status, 200);
  assert.deepEqual((await s.get('/api/profile')).json.profile.tools, ['git']);
  assert.equal((await s.get('/api/backups')).json.backups.length, 2, 'restoring backs up the file it replaces');
});

test('backup restore rejects traversal, unknown names and tampered contents', async () => {
  for (const file of ['../config/portable-profile.json', 'device-1.json', '..\\x.json', 'device-20260101T000000000Z.json/../x', '', 42]) {
    assert.equal((await s.post('/api/backups/restore', { file })).status, file === 'device-20260101T000000000Z.json/../x' || file === 42 || file === '' ? 400 : 400, String(file));
  }
  assert.equal((await s.post('/api/backups/restore', { file: 'device-20260101T000000000Z.json' })).status, 404);
  // a backup whose contents no longer validate must not be applied
  const dir = path.join(s.dir, 'backups');
  const bad = 'providers-20260102T000000000Z.json';
  await fs.writeFile(path.join(dir, bad), JSON.stringify({ schemaVersion: 1, profiles: [{ id: 'x', name: 'X', preset: 'custom', baseUrl: 'http://example.com', model: 'm', apiKeyEnv: 'K', protocols: ['openai-chat'] }] }));
  assert.equal((await s.post('/api/backups/restore', { file: bad })).status, 400);
});

test('activity journal records saves', async () => {
  const res = await s.get('/api/activity?limit=50');
  assert.equal(res.status, 200);
  assert.ok(res.json.entries.length >= 2);
  assert.ok(res.json.entries.some((e) => e.action === 'save:device'));
  assert.ok(res.json.entries.every((e) => e.ts && e.action));
  assert.ok(res.json.entries[0].ts >= res.json.entries.at(-1).ts, 'newest first');
});

test('starter kits merge, never remove, and are idempotent', async () => {
  await s.put('/api/profile', device(['vscode']));
  const first = await s.post('/api/kits/apply', { id: 'web-dev' });
  assert.equal(first.status, 200);
  assert.ok(first.json.added.tools.includes('claude-code'));
  assert.ok(!first.json.added.tools.includes('vscode'), 'already present items are not re-added');
  assert.deepEqual(first.json.added.mcp.sort(), ['context7', 'github', 'playwright']);

  const profile = (await s.get('/api/profile')).json.profile;
  assert.ok(profile.tools.includes('vscode') && profile.tools.includes('playwright'));
  const mcp = (await s.get('/api/mcp')).json;
  assert.equal(mcp.servers.length, 3);
  assert.ok(mcp.servers.every((x) => x.clients.length === 4));
  assert.match((await s.post('/api/mcp/snippet', { id: 'github', client: 'vscode' })).json.snippet, /\$\{env:GITHUB_PERSONAL_ACCESS_TOKEN\}/);

  const second = await s.post('/api/kits/apply', { id: 'web-dev' });
  assert.deepEqual(second.json.added, { tools: [], sources: [], vscodeExtensions: [], mcp: [] });
  assert.equal((await s.post('/api/kits/apply', { id: 'nope' })).status, 404);
  const kits = await s.get('/api/kits');
  assert.ok(kits.json.kits.length >= 4);
  const gateway = await s.post('/api/kits/apply', { id: 'free-gateway' });
  assert.deepEqual(gateway.json.added.sources.sort(), ['freellmapi', 'omniroute']);
});

test('doctor returns scored checks', async () => {
  const res = await s.get('/api/doctor');
  assert.equal(res.status, 200);
  assert.ok(res.json.score >= 0 && res.json.score <= 100);
  const node = res.json.checks.find((c) => c.id === 'node');
  assert.equal(node.status, 'ok');
  assert.ok(res.json.checks.every((c) => ['ok', 'warn', 'fail', 'info'].includes(c.status)));
  assert.ok(res.json.checks.some((c) => c.id === 'profile-device'));
});

// ---------------------------------------------------------------- provider connection test

function startGateway(key) {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization });
    const json = (code, obj, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...extra }); res.end(JSON.stringify(obj)); };
    if (req.url === '/v1/models') {
      if (req.headers.authorization !== `Bearer ${key}`) return json(401, { error: 'bad key' });
      return json(200, { data: [{ id: 'auto' }, { id: 'gpt-x' }] });
    }
    if (req.url === '/r/models') return json(302, {}, { Location: 'http://evil.example/steal' });
    if (req.url === '/odd/models') return json(200, { surprise: true });
    return json(404, { error: 'nope' });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, seen })));
}

test('provider test: success, wrong/missing key, redirect, 404, odd body, refused; never leaks the key', async () => {
  const KEY = 'rs-test-key-value-1234567890';
  process.env.RS_TEST_GATEWAY_KEY = KEY;
  delete process.env.RS_TEST_UNSET_KEY;
  const gw = await startGateway(KEY);
  const { port } = gw;
  const closed = await new Promise((resolve) => { const t = http.createServer().listen(0, '127.0.0.1', () => { const p = t.address().port; t.close(() => resolve(p)); }); });
  const p = (id, base, env = 'RS_TEST_GATEWAY_KEY', model = 'auto') => ({ id, name: id, preset: 'custom', baseUrl: base, model, apiKeyEnv: env, protocols: ['openai-chat'] });
  try {
    await s.put('/api/providers', { schemaVersion: 1, profiles: [
      p('good', `http://127.0.0.1:${port}/v1`),
      p('unlisted', `http://127.0.0.1:${port}/v1`, 'RS_TEST_GATEWAY_KEY', 'not-a-listed-model'),
      p('nokey', `http://127.0.0.1:${port}/v1`, 'RS_TEST_UNSET_KEY'),
      p('redirect', `http://127.0.0.1:${port}/r`),
      p('missing', `http://127.0.0.1:${port}/zzz`),
      p('odd', `http://127.0.0.1:${port}/odd`),
      p('down', `http://127.0.0.1:${closed}/v1`)
    ] });
    const t = async (id) => (await s.post('/api/providers/test', { id })).json;

    const good = await t('good');
    assert.equal(good.ok, true);
    assert.equal(good.keySet, true);
    assert.equal(good.modelCount, 2);
    assert.equal(good.modelListed, true);
    assert.deepEqual(good.models, ['auto', 'gpt-x']);

    const unlisted = await t('unlisted');
    assert.equal(unlisted.ok, true);
    assert.equal(unlisted.modelListed, false);

    const nokey = await t('nokey');
    assert.equal(nokey.ok, false);
    assert.equal(nokey.status, 401);
    assert.equal(nokey.keySet, false);
    assert.match(nokey.message, /RS_TEST_UNSET_KEY is not set/);

    const redirect = await t('redirect');
    assert.equal(redirect.ok, false);
    assert.equal(redirect.status, 302);
    assert.match(redirect.message, /does not follow redirects/);
    assert.ok(!gw.seen.some((r) => r.url.includes('steal')), 'redirect target was never requested');

    assert.equal((await t('missing')).status, 404);
    assert.match((await t('odd')).message, /not with a model list/);
    const down = await t('down');
    assert.equal(down.ok, false);
    assert.match(down.message, /Connection refused/);

    // the key must never appear in any response body or in the activity journal
    const everything = JSON.stringify([good, unlisted, nokey, redirect]) + JSON.stringify((await s.get('/api/activity')).json);
    assert.ok(!everything.includes(KEY));
    assert.equal((await s.post('/api/providers/test', { id: 'ghost' })).status, 404);
  } finally {
    gw.server.close();
    delete process.env.RS_TEST_GATEWAY_KEY;
  }
});

// ---------------------------------------------------------------- git sync against real repositories

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.com' } }).trim();
}

test('git sync: status, diff, commit only config/, push, fetch, fast-forward pull', async () => {
  const env = { GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.com' };
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env); // the server's git child processes inherit this
  const g = await startTestServer();
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-remote-'));
  const other = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-other-'));
  try {
    assert.equal((await g.get('/api/git/status')).json.repo, false, 'a plain folder is not a repo');

    git(remote, 'init', '--bare', '-b', 'main');
    git(g.dir, 'init', '-b', 'main');
    git(g.dir, 'remote', 'add', 'origin', remote);
    await fs.writeFile(path.join(g.dir, 'README.md'), '# test\n');
    await g.put('/api/profile', device(['git']));
    git(g.dir, 'add', 'README.md', 'config');
    git(g.dir, 'commit', '-m', 'initial');
    git(g.dir, 'push', '-u', 'origin', 'main');

    let st = (await g.get('/api/git/status')).json;
    assert.equal(st.repo, true);
    assert.equal(st.branch, 'main');
    assert.equal(st.upstream, 'origin/main');
    assert.equal(st.ahead, 0);
    assert.equal(st.behind, 0);
    assert.equal(st.configChanges.length, 0);
    assert.equal(st.lastCommit.subject, 'initial');

    // change config AND an unrelated file; only config may be committed
    await g.put('/api/profile', device(['git', 'nodejs']));
    await fs.writeFile(path.join(g.dir, 'README.md'), '# changed\n');
    st = (await g.get('/api/git/status')).json;
    assert.deepEqual(st.configChanges.map((c) => c.file), ['config/portable-profile.json']);
    assert.ok(st.otherChanges >= 1);
    const diff = (await g.get('/api/git/diff')).json;
    assert.match(diff.diff, /\+\s+"nodejs"/);
    assert.ok(!diff.diff.includes('README'));

    assert.equal((await g.post('/api/git/commit', { message: 'x'.repeat(101) })).status, 400);
    assert.equal((await g.post('/api/git/commit', { message: 'two\nlines' })).status, 400);
    assert.equal((await g.post('/api/git/commit', { message: 'key sk-abcdefghijklmnopqrstuvwx' })).status, 400);
    assert.equal((await g.post('/api/git/commit', { message: 'ok', push: 'yes' })).status, 400);

    const done = await g.post('/api/git/commit', { message: 'Update device profile', push: true });
    assert.equal(done.status, 200);
    assert.deepEqual(done.json.committed, ['config/portable-profile.json']);
    assert.equal(done.json.pushed, true);
    assert.equal(git(g.dir, 'status', '--porcelain', '--', 'README.md'), 'M README.md', 'unrelated change was left uncommitted');
    assert.equal(git(remote, 'log', '-1', '--format=%s', 'main'), 'Update device profile');
    assert.equal((await g.post('/api/git/commit', { message: 'again' })).status, 409, 'nothing left to commit');

    // another laptop pushes; we fetch, see "behind", then fast-forward
    git(other, 'clone', remote, 'repo');
    const clone = path.join(other, 'repo');
    await fs.writeFile(path.join(clone, 'NOTES.md'), 'from laptop 2\n');
    git(clone, 'add', 'NOTES.md');
    git(clone, 'commit', '-m', 'laptop 2 change');
    git(clone, 'push');

    assert.equal((await g.post('/api/git/fetch')).status, 200);
    st = (await g.get('/api/git/status')).json;
    assert.equal(st.behind, 1);
    const pull = await g.post('/api/git/pull');
    assert.equal(pull.status, 200);
    assert.equal(pull.json.upToDate, false);
    assert.equal((await g.get('/api/git/status')).json.behind, 0);
    assert.equal((await g.post('/api/git/pull')).json.upToDate, true);

    const names = (await g.get('/api/activity')).json.entries.map((e) => e.action);
    for (const a of ['git:commit', 'git:fetch', 'git:pull']) assert.ok(names.includes(a), a);
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await g.close();
    await fs.rm(remote, { recursive: true, force: true });
    await fs.rm(other, { recursive: true, force: true });
  }
});

test('git routes are protected like every other mutation', async () => {
  assert.equal((await s.post('/api/git/pull', {}, { Origin: 'http://evil.example' })).status, 403);
  assert.equal((await s.post('/api/git/commit', { message: 'x' }, { Origin: 'http://evil.example' })).status, 403);
  assert.equal((await s.post('/api/providers/test', { id: 'good' }, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await s.post('/api/backups/restore', { file: 'device-20260101T000000000Z.json' }, { Origin: 'http://evil.example' })).status, 403);
});
