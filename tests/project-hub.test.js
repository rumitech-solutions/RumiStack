import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { detectProject, registerHubProject, listHubProjects, unregisterHubProject, startHubProject, projectRunPreview, recordProjectSetupComplete } from '../server/lib/project-hub.js';

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

test('project intelligence reports missing dependencies and runtime health without executing project code', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-health-'));
  const state = path.join(root, 'state');
  const project = path.join(root, 'vite-app');
  try {
    await fs.mkdir(project);
    await fs.writeFile(path.join(project, 'package.json'), JSON.stringify({
      packageManager: 'npm@10.0.0',
      engines: { node: '>=20' },
      dependencies: { vite: '^6.0.0', react: '^19.0.0' },
      scripts: { dev: 'vite --host', build: 'vite build' }
    }));
    await fs.writeFile(path.join(project, 'package-lock.json'), '{}');
    const entry = await registerHubProject(state, { path: project });
    const listed = await listHubProjects(root, state);
    const detected = listed.projects.find((p) => p.id === entry.id);
    assert.equal(detected.framework, 'Vite');
    assert.equal(detected.health.status, 'needs-install');
    assert.equal(detected.dependenciesInstalled, false);
    assert.equal(detected.dependencyCount, 2);
    assert.equal(detected.runtime.manager, 'npm');
    assert.ok(detected.health.issues.some((issue) => issue.includes('Dependencies are not installed')));
    assert.deepEqual(detected.lockfiles, ['package-lock.json']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('project intelligence reports moved folders instead of crashing the whole project list', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-missing-'));
  const state = path.join(root, 'state');
  const project = path.join(root, 'will-move');
  try {
    await fs.mkdir(project);
    const entry = await registerHubProject(state, { path: project });
    await fs.rm(project, { recursive: true, force: true });
    const listed = await listHubProjects(root, state);
    const detected = listed.projects.find((p) => p.id === entry.id);
    assert.equal(detected.missing, true);
    assert.equal(detected.health.status, 'missing-folder');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});


test('detects Python and .NET projects and exposes only supported setup actions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-multiruntime-'));
  try {
    const python = path.join(root, 'python-app');
    const dotnet = path.join(root, 'dotnet-app');
    await fs.mkdir(python);
    await fs.mkdir(dotnet);
    await fs.writeFile(path.join(python, 'requirements.txt'), 'requests==2.32.0');
    await fs.writeFile(path.join(dotnet, 'Sample.csproj'), '<Project />');
    const py = await detectProject(python, null);
    const net = await detectProject(dotnet, null);
    assert.equal(py.ecosystem, 'python');
    assert.equal(py.setupAction, 'python-requirements');
    assert.equal(net.ecosystem, 'dotnet');
    assert.equal(net.setupAction, 'dotnet-restore');
    assert.deepEqual(net.projectFiles, ['Sample.csproj']);
    assert.equal(py.hasPackageJson, false);
    assert.equal(net.hasPackageJson, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('Python projects without a supported dependency manifest remain manual setup', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-python-manual-'));
  try {
    await fs.writeFile(path.join(root, 'pyproject.toml'), '[project]\\nname = "sample"\\n');
    const result = await detectProject(root, null);
    assert.equal(result.ecosystem, 'python');
    assert.equal(result.setupAction, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});


test('detects one safe Python entrypoint and one .NET startup project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-run-targets-'));
  try {
    const python = path.join(root, 'python-app');
    const dotnet = path.join(root, 'dotnet-app');
    await fs.mkdir(python);
    await fs.mkdir(dotnet);
    await fs.writeFile(path.join(python, 'main.py'), 'print("hello")');
    await fs.writeFile(path.join(dotnet, 'App.csproj'), '<Project />');
    const py = await detectProject(python, null);
    const net = await detectProject(dotnet, null);
    assert.equal(py.runTarget, 'main.py');
    assert.deepEqual(py.runCandidates, ['main.py']);
    assert.equal(net.runTarget, 'App.csproj');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('does not guess which Python entrypoint to run when multiple candidates exist', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-ambiguous-run-'));
  const state = path.join(root, 'state');
  const project = path.join(root, 'python-app');
  try {
    await fs.mkdir(project);
    await fs.writeFile(path.join(project, 'main.py'), 'print("main")');
    await fs.writeFile(path.join(project, 'app.py'), 'print("app")');
    const entry = await registerHubProject(state, { path: project });
    await assert.rejects(() => projectRunPreview(state, entry.id), /Multiple Python entrypoints/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('records guided setup completion so Project Hub can recommend the next action', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-setup-complete-'));
  const state = path.join(root, 'state');
  const project = path.join(root, 'python-app');
  try {
    await fs.mkdir(project);
    await fs.writeFile(path.join(project, 'requirements.txt'), 'requests==2.32.0');
    await fs.writeFile(path.join(project, 'main.py'), 'print("ready")');
    const entry = await registerHubProject(state, { path: project });
    let listed = await listHubProjects(root, state);
    assert.equal(listed.projects[0].health.status, 'needs-setup');
    await recordProjectSetupComplete(state, entry.id);
    listed = await listHubProjects(root, state);
    assert.equal(listed.projects[0].setupCompleted, true);
    assert.equal(listed.projects[0].health.status, 'ready');
    assert.equal(typeof listed.projects[0].setupCompletedAt, 'string');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
