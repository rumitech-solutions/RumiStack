import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { startTestServer } from './helpers.js';
import { PROJECT_NAME_RE } from '../server/lib/projects.js';

const posix = process.platform !== 'win32';

test('keys: reports only names and set/not-set, never values', async () => {
  const t = await startTestServer();
  const secret = 'sk-test-VALUE-that-must-never-appear-1234567890';
  process.env.RUMISTACK_TEST_KEY_A = secret;
  delete process.env.RUMISTACK_TEST_KEY_B;
  try {
    await t.put('/api/providers', { schemaVersion: 1, profiles: [
      { id: 'a', name: 'Gateway A', preset: 'custom', baseUrl: 'https://example.com/v1', model: 'm', apiKeyEnv: 'RUMISTACK_TEST_KEY_A', protocols: ['openai-chat'] },
      { id: 'b', name: 'Gateway B', preset: 'custom', baseUrl: 'https://example.org/v1', model: 'm', apiKeyEnv: 'RUMISTACK_TEST_KEY_B', protocols: ['openai-chat'] }
    ] });
    const res = await t.get('/api/keys');
    assert.equal(res.status, 200);
    const byName = Object.fromEntries(res.json.keys.map((k) => [k.name, k]));
    assert.equal(byName.RUMISTACK_TEST_KEY_A.set, true);
    assert.equal(byName.RUMISTACK_TEST_KEY_B.set, false);
    assert.deepEqual(byName.RUMISTACK_TEST_KEY_A.usedBy, [{ kind: 'provider', label: 'Gateway A' }]);
    assert.equal(res.json.missing, 1);
    assert.ok(!res.text.includes(secret) && !res.text.includes('1234567890'), 'the value is never returned');
  } finally {
    delete process.env.RUMISTACK_TEST_KEY_A;
    await t.close();
  }
});

test('projects: create from templates, list, add template, validation, traversal', async () => {
  const t = await startTestServer();
  try {
    assert.deepEqual((await t.get('/api/projects')).json.projects, []);
    for (const bad of ['', '..', '.', '../x', 'a/b', 'a\\b', '.hidden', 'x'.repeat(64), 'bad name', 'C:\\x', 'trail.', null, 5]) {
      assert.equal((await t.post('/api/projects/create', { name: bad })).status, 400, JSON.stringify(bad));
    }
    assert.ok(PROJECT_NAME_RE.test('my-app_2.0'));

    const made = await t.post('/api/projects/create', { name: 'my-app', git: true, files: ['AGENTS.md'] });
    assert.equal(made.status, 200, made.text);
    assert.deepEqual(made.json, { name: 'my-app', path: 'projects/my-app', files: ['AGENTS.md'], git: true });
    assert.match(await fs.readFile(path.join(t.dir, 'projects/my-app/AGENTS.md'), 'utf8'), /\S/);
    assert.ok((await fs.stat(path.join(t.dir, 'projects/my-app/.git'))).isDirectory());
    assert.equal((await t.post('/api/projects/create', { name: 'my-app' })).status, 409);
    assert.equal((await t.post('/api/projects/create', { name: 'x', files: ['../../etc/passwd'] })).status, 400);
    assert.equal((await t.post('/api/projects/create', { name: 'x', extra: 1 })).status, 400);
    await assert.rejects(fs.stat(path.join(t.dir, 'projects/x')), 'a rejected request creates nothing');

    const list = (await t.get('/api/projects')).json.projects;
    assert.equal(list.length, 1);
    assert.equal(list[0].files['AGENTS.md'], true);
    assert.equal(list[0].files['CLAUDE.md'], false);
    assert.equal(list[0].git.dirty, true); // the new AGENTS.md is untracked

    // add the other template; an existing file is never overwritten
    assert.equal((await t.post('/api/projects/template', { name: 'my-app', file: 'CLAUDE.md' })).json.created, true);
    await fs.writeFile(path.join(t.dir, 'projects/my-app/AGENTS.md'), 'mine');
    assert.equal((await t.post('/api/projects/template', { name: 'my-app', file: 'AGENTS.md' })).json.created, false);
    assert.equal(await fs.readFile(path.join(t.dir, 'projects/my-app/AGENTS.md'), 'utf8'), 'mine');
    assert.equal((await t.post('/api/projects/template', { name: 'missing', file: 'AGENTS.md' })).status, 404);
    assert.equal((await t.post('/api/projects/template', { name: 'my-app', file: 'package.json' })).status, 400);

    const open = await t.post('/api/projects/open', { name: 'my-app', with: 'vscode' });
    assert.equal(open.status, posix ? 501 : open.status);
    assert.equal((await t.post('/api/projects/open', { name: '../x', with: 'vscode' })).status, 400);
    assert.ok((await t.get('/api/activity')).json.entries.some((e) => e.action === 'project:create'));
  } finally { await t.close(); }
});

test('prompts: library validation and persistence', async () => {
  const t = await startTestServer();
  try {
    const good = { schemaVersion: 1, categories: [{ id: 'coding', name: 'Coding' }], prompts: [{ id: 'p1', title: 'Explain', category: 'coding', body: 'Explain {{file}} please.' }] };
    assert.equal((await t.put('/api/prompts', good)).status, 200);
    assert.equal((await t.get('/api/prompts')).json.prompts[0].body, 'Explain {{file}} please.');
    const bad = (p) => t.put('/api/prompts', { ...good, prompts: [{ ...good.prompts[0], ...p }] });
    assert.equal((await bad({ category: 'nope' })).status, 400);
    assert.equal((await bad({ body: '' })).status, 400);
    assert.equal((await bad({ body: 'x'.repeat(4001) })).status, 400);
    assert.equal((await bad({ extra: 1 })).status, 400);
    assert.equal((await bad({ body: 'use key sk-abcdefghijklmnopqrstuvwxyz123456 here' })).status, 400); // secrets are not stored
    assert.equal((await t.get('/api/prompts')).json.prompts.length, 1);
  } finally { await t.close(); }
});
