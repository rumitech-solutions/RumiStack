// Read-only health report shown on the dashboard Overview. Mirrors scripts/Doctor.ps1 with extra checks.

import { findCommand } from './system.js';
import { FILES } from './profiles.js';
import { dockerAvailability } from './docker.js';

export async function runDoctor({ store, overview, gitState, sources }) {
  const checks = [];
  const add = (id, label, status, detail, fix) => checks.push({ id, label, status, detail, ...(fix ? { fix } : {}) });
  const isWindows = process.platform === 'win32';

  // runtime
  const [major, minor] = process.versions.node.split('.').map(Number);
  add('node', 'Node.js 20 or newer', major >= 20 ? 'ok' : 'fail', `RumiStack is running on Node ${process.versions.node}.`,
    major >= 20 ? undefined : 'winget install --id OpenJS.NodeJS.LTS --exact');
  const skillsNodeOk = major > 22 || (major === 22 && minor >= 20);
  add('node-skills', 'Node.js 22.20+ for the Skills CLI', skillsNodeOk ? 'ok' : 'warn',
    skillsNodeOk ? 'Restore-Skills.ps1 can run.' : 'Restore-Skills.ps1 will refuse to install until Node is 22.20 or newer.',
    skillsNodeOk ? undefined : 'winget upgrade --id OpenJS.NodeJS.LTS --exact');

  // commands
  const git = await findCommand('git');
  add('git', 'Git', git ? 'ok' : 'fail', git ? `Found at ${git}.` : 'Git is required for sync and source checkouts.', git ? undefined : 'winget install --id Git.Git --exact');
  for (const [cmd, label, why] of [['gh', 'GitHub CLI', 'only needed for Publish-To-GitHub.ps1'], ['docker', 'Docker', 'needed for self-hosted gateways'], ['code', 'VS Code command', 'needed to restore VS Code extensions']]) {
    const found = await findCommand(cmd);
    add(cmd, label, found ? 'ok' : 'info', found ? `Found at ${found}.` : `Not found (${why}).`);
  }
  if (await findCommand('docker')) {
    const d = await dockerAvailability();
    if (!d.compose) add('docker-compose', 'Docker Compose', 'warn', 'The compose plugin was not found; gateways cannot be started from the dashboard.', 'Update Docker Desktop');
    else add('docker-daemon', 'Docker engine running', d.daemon ? 'ok' : 'info', d.daemon ? `Engine ${d.engineVersion}.` : 'Docker is installed but the engine is not running. Start Docker Desktop before using Gateways.');
  }
  if (isWindows) {
    const winget = await findCommand('winget');
    add('winget', 'winget', winget ? 'ok' : 'warn', winget ? 'Available for restores.' : 'Without winget, winget-typed tools must be installed manually.');
  }

  // profiles
  for (const kind of Object.keys(FILES)) {
    try {
      await store.load(kind);
      add(`profile-${kind}`, `${FILES[kind]} is valid`, 'ok', 'Schema and secret checks passed.');
    } catch (err) {
      add(`profile-${kind}`, `${FILES[kind]} is valid`, 'fail', err.message);
    }
  }

  // this laptop vs profile
  if (overview.counts.selected > 0) {
    const missing = overview.counts.missing;
    add('coverage', 'Device profile matches this laptop', missing === 0 ? 'ok' : 'warn',
      missing === 0 ? `All ${overview.counts.installed} detectable tool(s) are installed.` : `${missing} tool(s) from your profile are missing.`,
      missing === 0 ? undefined : '.\\scripts\\Restore-Profile.ps1 -WhatIf');
  } else {
    add('coverage', 'Device profile matches this laptop', 'info', 'Your device profile is empty. Pick tools or apply a starter kit.');
  }

  // sync
  if (!gitState.repo) {
    add('repo', 'Git repository', 'warn', 'This folder is not a Git repository, so cross-laptop sync is unavailable.', 'git init -b main');
  } else {
    add('repo', 'Git repository', 'ok', `On branch ${gitState.branch ?? '(detached)'}.`);
    add('remote', 'Remote configured', gitState.remote ? 'ok' : 'warn', gitState.remote ? gitState.remote : 'No "origin" remote; pushes and pulls are unavailable.');
    if (gitState.behind > 0) add('behind', 'Up to date with remote', 'warn', `${gitState.behind} commit(s) to pull.`, 'Use Sync → Pull');
    if (gitState.configChanges.length > 0) add('config-changes', 'Config changes committed', 'info', `${gitState.configChanges.length} config file(s) have uncommitted changes.`);
  }
  const dirty = sources.filter((s) => s.cloned && s.dirty);
  if (dirty.length) add('sources-dirty', 'Source checkouts clean', 'info', `${dirty.map((s) => s.id).join(', ')} have local changes and will be skipped on update.`);

  const scored = checks.filter((c) => c.status !== 'info');
  const points = scored.reduce((sum, c) => sum + (c.status === 'ok' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);
  return { checks, score: scored.length ? Math.round((points / scored.length) * 100) : 100 };
}
