// User-added GitHub repositories. The only input accepted from the browser is a GitHub HTTPS URL, which is
// normalised and turned into a folder name; the checkout always lands in sources/<owner>-<repo>. Cloned
// code is never executed by RumiStack.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { run } from './system.js';
import { ValidationError, ID_RE } from './validate.js';

const URL_RE = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;

/** Accepts https://github.com/owner/repo (optionally with .git, a trailing slash or /tree/... noise is rejected). */
export function parseGitHubUrl(input) {
  if (typeof input !== 'string') throw new ValidationError('A GitHub repository link is required.');
  let text = input.trim().replace(/\/+$/, '').replace(/\.git$/i, '');
  const m = URL_RE.exec(text);
  if (!m) throw new ValidationError('Use a link of the form https://github.com/owner/repository (no extra path, query or credentials).');
  const [, owner, repo] = m;
  if (repo === '.' || repo === '..' || repo.startsWith('.')) throw new ValidationError('That repository name is not allowed.');
  const id = `${owner}-${repo}`.toLowerCase().replace(/[._]+/g, '-').replace(/-+/g, '-').replace(/-$/, '');
  if (!ID_RE.test(id)) throw new ValidationError('That repository name cannot be used as a folder name (too long or unusual characters).');
  return { id, url: `https://github.com/${owner}/${repo}`, owner, repo };
}

function find(profile, id) {
  const repo = profile.repos.find((r) => r.id === id);
  if (!repo) throw new ValidationError(`"${id}" is not in your repository list.`, 404);
  return repo;
}

async function inspect(root, repo) {
  const dir = path.join(root, 'sources', repo.id);
  const cloned = await fs.stat(path.join(dir, '.git')).then(() => true, () => false);
  const out = { id: repo.id, url: repo.url, path: `sources/${repo.id}`, cloned };
  if (cloned) {
    const [status, branch] = await Promise.all([
      run('git', ['status', '--porcelain'], { cwd: dir }),
      run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir })
    ]);
    out.dirty = status.stdout.length > 0;
    out.branch = branch.stdout || null;
  }
  return out;
}

export async function repoStatus(root, profile) {
  return { folder: path.join(root, 'sources'), repos: await Promise.all(profile.repos.map((r) => inspect(root, r))) };
}

async function cloneInto(root, repo) {
  const dest = path.join(root, 'sources', repo.id);
  if (await fs.stat(dest).then(() => true, () => false)) throw new ValidationError(`sources/${repo.id} already exists. Use update instead.`, 409);
  await fs.mkdir(path.join(root, 'sources'), { recursive: true });
  const res = await run('git', ['clone', '--depth', '1', '--no-recurse-submodules', '--', repo.url, dest], { timeout: 15 * 60_000 });
  if (!res.ok) {
    await fs.rm(dest, { recursive: true, force: true }); // a failed clone can leave a partial folder behind
    throw new ValidationError(`git clone failed: ${res.stderr.split('\n').filter(Boolean).pop() || 'unknown error'}`, 502);
  }
}

/** Validates the link, clones it, and only then records it in the profile. */
export async function addRepo(root, store, registry, url) {
  const parsed = parseGitHubUrl(url);
  const profile = await store.load('repos');
  if (profile.repos.some((r) => r.id === parsed.id)) throw new ValidationError(`${parsed.owner}/${parsed.repo} is already in your list.`, 409);
  if (registry.tools.tools.some((t) => t.id === parsed.id)) throw new ValidationError(`"${parsed.id}" clashes with a catalogue entry.`, 409);
  await cloneInto(root, parsed);
  await store.save('repos', { schemaVersion: 1, repos: [...profile.repos, { id: parsed.id, url: parsed.url }] });
  return { id: parsed.id, path: `sources/${parsed.id}` };
}

/** For a laptop where the list came from Git but the folder does not exist yet. */
export async function cloneRepo(root, store, id) {
  const repo = find(await store.load('repos'), id);
  await cloneInto(root, repo);
  return { id, path: `sources/${id}` };
}

export async function updateRepo(root, store, id) {
  const repo = find(await store.load('repos'), id);
  const dir = path.join(root, 'sources', repo.id);
  if (!(await fs.stat(path.join(dir, '.git')).then(() => true, () => false))) throw new ValidationError(`sources/${id} has not been cloned yet.`, 404);
  const status = await run('git', ['status', '--porcelain'], { cwd: dir });
  if (status.stdout.length > 0) return { id, updated: false, skipped: 'Working tree has local changes; left untouched.' };
  const res = await run('git', ['pull', '--ff-only'], { cwd: dir, timeout: 5 * 60_000 });
  if (!res.ok) throw new ValidationError(`git pull --ff-only failed: ${res.stderr.split('\n').filter(Boolean).pop() || 'unknown error'}`, 502);
  return { id, updated: !/Already up to date/i.test(res.stdout), output: res.stdout.split('\n').pop() };
}

/** Removes the entry from the portable list only. The folder on disk is left for the user to delete. */
export async function removeRepo(store, id) {
  const profile = await store.load('repos');
  find(profile, id);
  await store.save('repos', { schemaVersion: 1, repos: profile.repos.filter((r) => r.id !== id) });
  return { id, folderKept: `sources/${id}` };
}
