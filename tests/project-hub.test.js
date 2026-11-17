import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { detectProject, registerHubProject, listHubProjects, unregisterHubProject, startHubProject } from '../server/lib/project-hub.js';

test('detects common frontend frameworks and package managers without executing scripts', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-detect-'));
  try {
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({
      packageManager: 'pnpm@9.0.0',
      dependencies: { vite: '^6.0.0', react: '^19.0.0' },
      scripts: { dev: 'vite --host', build: 'vite build' }
    }));
    await fs.writeFile(path.join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
    const result = await detectProject(dir, JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8')));
    assert.equal(result.framework, 'Vite');
    assert.equal(result.manager, 'pnpm');
    assert.equal(result.isWeb, true);
    assert.equal(result.preferredScript, 'dev');
    assert.deepEqual(result.scripts, ['dev', 'build']);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('registers existing folders without moving them and unregisters without deleting files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-hub-'));
  const state = path.join(root, 'state');
  const project = path.join(root, 'already-here');
  try {
    await fs.mkdir(project);
    await fs.writeFile(path.join(project, 'README.md'), 'keep me');
    const entry = await registerHubProject(state, { path: project });
    assert.equal(entry.path, project);
    const listed = await listHubProjects(root, state);
    assert.equal(listed.projects.length, 1);
    assert.equal(listed.projects[0].name, 'already-here');
    const removed = await unregisterHubProject(state, entry.id);
    assert.equal(removed.folderKept, project);
    assert.equal(await fs.readFile(path.join(project, 'README.md'), 'utf8'), 'keep me');
    assert.equal((await listHubProjects(root, state)).projects.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('rejects non-existent local folders', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-hub-'));
  try {
    await assert.rejects(() => registerHubProject(path.join(root, 'state'), { path: path.join(root, 'missing') }), /existing project folder/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('runner rejects arbitrary shell text instead of treating it as a package script', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-runner-'));
  const state = path.join(root, 'state');
  const project = path.join(root, 'safe-project');
  try {
    await fs.mkdir(path.join(project, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(project, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
    const entry = await registerHubProject(state, { path: project });
    await assert.rejects(() => startHubProject(state, entry.id, 'dev && calc'), /valid script/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
