import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './store.js';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Tracked, read-only catalogues shipped with RumiStack. */
export async function loadRegistry(root = REPO_ROOT) {
  const dir = path.join(root, 'registry');
  const [tools, providers, skills, mcp, kits] = await Promise.all([
    readJson(path.join(dir, 'tools.json')),
    readJson(path.join(dir, 'providers.json')),
    readJson(path.join(dir, 'skills.json')),
    readJson(path.join(dir, 'mcp.json')),
    readJson(path.join(dir, 'kits.json'))
  ]);
  return { tools, providers, skills, mcp, kits };
}
