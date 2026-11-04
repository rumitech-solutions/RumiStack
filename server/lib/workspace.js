// The workspace is the RumiStack folder itself. Every sub-folder is created automatically on start, so no
// separate setup step is needed. All except config/ are git-ignored and stay on this laptop.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const WORKSPACE_DIRS = [
  { name: 'config', purpose: 'Portable profiles. The only folder synced through Git.', synced: true },
  { name: 'sources', purpose: 'Cloned repositories: catalogue sources, gateways and the links you add.', synced: false },
  { name: 'projects', purpose: 'Your own working projects. Assistants launched from the dashboard open here.', synced: false },
  { name: 'backups', purpose: 'Previous copies of your profiles (last 20 each).', synced: false },
  { name: 'logs', purpose: 'Activity journal.', synced: false },
  { name: 'state', purpose: 'Local runtime state.', synced: false }
];

export async function ensureWorkspace(root, configDir) {
  const created = [];
  for (const dir of WORKSPACE_DIRS) {
    const target = dir.name === 'config' ? configDir : path.join(root, dir.name);
    const existed = await fs.stat(target).then((s) => s.isDirectory(), () => false);
    await fs.mkdir(target, { recursive: true });
    if (!existed) created.push(dir.name);
  }
  return created;
}

export async function workspaceInfo(root, configDir) {
  return {
    root,
    folders: await Promise.all(WORKSPACE_DIRS.map(async (d) => {
      const target = d.name === 'config' ? configDir : path.join(root, d.name);
      const entries = await fs.readdir(target).catch(() => null);
      return { ...d, path: target, exists: entries !== null, items: entries ? entries.filter((n) => !n.startsWith('.')).length : 0 };
    }))
  };
}
