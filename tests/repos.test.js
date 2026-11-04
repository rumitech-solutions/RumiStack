import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { startTestServer } from './helpers.js';
import { parseGitHubUrl } from '../server/lib/repos.js';

test('parseGitHubUrl accepts plain GitHub repo links and rejects everything else', () => {
  assert.deepEqual(parseGitHubUrl('https://github.com/Owner/My_Repo.git/'), { id: 'owner-my-repo', url: 'https://github.com/Owner/My_Repo', owner: 'Owner', repo: 'My_Repo' });
  assert.equal(parseGitHubUrl('  https://github.com/a/b  ').id, 'a-b');
  for (const bad of [
    'http://github.com/a/b', 'https://gitlab.com/a/b', 'https://github.com/a', 'https://github.com/a/b/tree/main',
    'https://user:pw@github.com/a/b', 'https://github.com/a/b?x=1', 'https://github.com/a/b#frag', 'git@github.com:a/b.git',
    'https://github.com/a/..', 'https://github.com/a/.hidden', 'file:///etc', '-oProxyCommand=x', '', 42, null,
    'https://github.com.evil.com/a/b', 'https://github.com/a/b c'
  ]) assert.throws(() => parseGitHubUrl(bad), /link|Use a|not allowed|required/i, String(bad));
});

test('repos API: add (clone), list, update, remove, validation and CSRF', async () => {
  // A local repository stands in for GitHub through git's url rewriting, so no network is needed.
  const upstream = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-upstream-'));
  const git = (...args) => execFileSync('git', args, { cwd: upstream, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  await fs.writeFile(path.join(upstream, 'README.md'), 'hello\n');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'init');

  const saved = { c: process.env.GIT_CONFIG_COUNT, k: process.env.GIT_CONFIG_KEY_0, v: process.env.GIT_CONFIG_VALUE_0 };
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = `url.${upstream}.insteadOf`;
  process.env.GIT_CONFIG_VALUE_0 = 'https://github.com/demo/project';
  const t = await startTestServer();
  try {
    assert.deepEqual((await t.get('/api/repos')).json.repos, []);
    assert.equal((await t.post('/api/repos/add', { url: 'https://example.com/a/b' })).status, 400);
    assert.equal((await t.post('/api/repos/add', {})).status, 400);
    assert.equal((await t.call('POST', '/api/repos/add', 'url=x', { 'Content-Type': 'text/plain' })).status, 415);

    const add = await t.post('/api/repos/add', { url: 'https://github.com/demo/project.git' });
    assert.equal(add.status, 200, add.text);
    assert.deepEqual(add.json, { id: 'demo-project', path: 'sources/demo-project' });
    assert.equal(await fs.readFile(path.join(t.dir, 'sources/demo-project/README.md'), 'utf8'), 'hello\n');

    const list = (await t.get('/api/repos')).json;
    assert.equal(list.folder, path.join(t.dir, 'sources'));
    assert.deepEqual(list.repos.map((r) => [r.id, r.url, r.cloned, r.dirty]), [['demo-project', 'https://github.com/demo/project', true, false]]);
    const profile = JSON.parse(await fs.readFile(path.join(t.dir, 'config/repos.json'), 'utf8'));
    assert.deepEqual(profile, { schemaVersion: 1, repos: [{ id: 'demo-project', url: 'https://github.com/demo/project' }] });

    assert.equal((await t.post('/api/repos/add', { url: 'https://github.com/demo/project' })).status, 409); // duplicate

    // upstream moves on; update fast-forwards
    await fs.writeFile(path.join(upstream, 'two.txt'), '2\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'two');
    const upd = await t.post('/api/repos/update', { id: 'demo-project' });
    assert.equal(upd.json.updated, true);
    assert.equal(await fs.readFile(path.join(t.dir, 'sources/demo-project/two.txt'), 'utf8'), '2\n');

    // local edits are never overwritten
    await fs.writeFile(path.join(t.dir, 'sources/demo-project/README.md'), 'mine\n');
    assert.match((await t.post('/api/repos/update', { id: 'demo-project' })).json.skipped, /local changes/);

    // a folder missing on another laptop can be cloned from the list
    await fs.rm(path.join(t.dir, 'sources/demo-project'), { recursive: true, force: true });
    assert.equal((await t.get('/api/repos')).json.repos[0].cloned, false);
    assert.equal((await t.post('/api/repos/clone', { id: 'demo-project' })).status, 200);
    assert.equal((await t.post('/api/repos/clone', { id: 'demo-project' })).status, 409);
    assert.equal((await t.post('/api/repos/clone', { id: 'unknown' })).status, 404);

    // a failing clone adds nothing to the list and leaves no folder
    const fail = await t.post('/api/repos/add', { url: 'https://github.com/demo/does-not-exist' });
    assert.ok(fail.status >= 400);
    assert.equal((await t.get('/api/repos')).json.repos.length, 1);
    await assert.rejects(fs.stat(path.join(t.dir, 'sources/demo-does-not-exist')));

    // removal only edits the list
    const rm = await t.post('/api/repos/remove', { id: 'demo-project' });
    assert.equal(rm.json.folderKept, 'sources/demo-project');
    assert.deepEqual((await t.get('/api/repos')).json.repos, []);
    assert.ok((await fs.stat(path.join(t.dir, 'sources/demo-project/.git'))).isDirectory());
    assert.ok((await t.get('/api/backups')).json.backups.some((b) => b.kind === 'repos'));
  } finally {
    for (const [k, v] of [['GIT_CONFIG_COUNT', saved.c], ['GIT_CONFIG_KEY_0', saved.k], ['GIT_CONFIG_VALUE_0', saved.v]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await t.close();
    await fs.rm(upstream, { recursive: true, force: true });
  }
});

test('repos profile rejects tampered entries', async () => {
  const t = await startTestServer();
  try {
    const { validateRepos } = await import('../server/lib/profiles.js');
    assert.throws(() => validateRepos({ schemaVersion: 1, repos: [{ id: 'x', url: 'https://github.com/a/b' }] }), /must be "a-b"/);
    assert.throws(() => validateRepos({ schemaVersion: 1, repos: [{ id: 'a-b', url: 'https://github.com/a/b', extra: 1 }] }), /unknown field/);
    assert.throws(() => validateRepos({ schemaVersion: 1, repos: [{ id: 'a-b', url: 'https://token@github.com/a/b' }] }));
    assert.deepEqual(validateRepos({ schemaVersion: 1, repos: [] }).repos, []);
  } finally { await t.close(); }
});
