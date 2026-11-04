// Sync helpers for the control-plane repository. Fixed git arguments only, and only ever the config/ folder
// is committed. No force pushes, no rebases, no resets.

import { run } from './system.js';
import { ValidationError, assertText, scanForSecrets } from './validate.js';

const MAX_DIFF = 200 * 1024;

function lastLine(text) {
  return String(text).split('\n').filter(Boolean).pop() ?? 'unknown error';
}

/** Removes credentials from a remote URL before it is shown anywhere. */
export function sanitizeRemote(url) {
  return String(url ?? '').replace(/\/\/[^/@\s]+@/, '//');
}

export function parsePorcelain(text) {
  return String(text).split('\n').filter(Boolean).map((line) => {
    const m = /^\s*(\S{1,2})\s+(.+)$/.exec(line);
    return m ? { status: m[1], file: m[2].replace(/^"|"$/g, '') } : null;
  }).filter(Boolean);
}

export async function gitStatus(root) {
  const inside = await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root });
  if (!inside.ok || inside.stdout !== 'true') return { repo: false };

  const [branch, upstream, remote, last, all, config] = await Promise.all([
    run('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: root }),
    run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: root }),
    run('git', ['remote', 'get-url', 'origin'], { cwd: root }),
    run('git', ['log', '-1', '--format=%h%x09%s%x09%cI'], { cwd: root }),
    run('git', ['status', '--porcelain'], { cwd: root }),
    run('git', ['status', '--porcelain', '--', 'config'], { cwd: root })
  ]);

  let ahead = null;
  let behind = null;
  if (upstream.ok) {
    const counts = await run('git', ['rev-list', '--left-right', '--count', 'HEAD...@{u}'], { cwd: root });
    if (counts.ok) [ahead, behind] = counts.stdout.split(/\s+/).map(Number);
  }

  const configChanges = parsePorcelain(config.stdout);
  const allChanges = parsePorcelain(all.stdout);
  const [hash, subject, date] = last.ok ? last.stdout.split('\t') : [null, null, null];
  return {
    repo: true,
    branch: branch.ok ? branch.stdout : null,
    upstream: upstream.ok ? upstream.stdout : null,
    remote: remote.ok ? sanitizeRemote(remote.stdout) : null,
    ahead, behind,
    lastCommit: hash ? { hash, subject, date } : null,
    configChanges,
    otherChanges: allChanges.length - configChanges.length
  };
}

export async function gitDiff(root) {
  const res = await run('git', ['diff', 'HEAD', '--', 'config'], { cwd: root, timeout: 20_000 });
  let diff = res.ok ? res.stdout : '';
  const truncated = diff.length > MAX_DIFF;
  if (truncated) diff = diff.slice(0, MAX_DIFF);
  return { diff, truncated };
}

export async function gitFetch(root) {
  const res = await run('git', ['fetch', '--quiet', 'origin'], { cwd: root, timeout: 90_000 });
  if (!res.ok) throw new ValidationError(`git fetch failed: ${lastLine(res.stderr)}`, 502);
  return { fetched: true };
}

export async function gitPull(root) {
  const res = await run('git', ['pull', '--ff-only'], { cwd: root, timeout: 180_000 });
  if (!res.ok) throw new ValidationError(`git pull --ff-only failed: ${lastLine(res.stderr || res.stdout)}`, 409);
  return { output: lastLine(res.stdout), upToDate: /Already up to date/i.test(res.stdout) };
}

/** Commits ONLY config/ and optionally pushes. Never forces. */
export async function gitCommitPush(root, { message, push }) {
  const msg = assertText(message, 'message', { max: 100 });
  if (/[\r\n]/.test(msg)) throw new ValidationError('message must be a single line.');
  scanForSecrets(msg, 'message');

  const add = await run('git', ['add', '--', 'config'], { cwd: root });
  if (!add.ok) throw new ValidationError(`git add failed: ${lastLine(add.stderr)}`, 500);
  const staged = await run('git', ['diff', '--cached', '--name-only', '--', 'config'], { cwd: root });
  if (!staged.stdout) throw new ValidationError('Nothing to commit: config/ has no changes.', 409);

  const commit = await run('git', ['commit', '-m', msg, '--', 'config'], { cwd: root, timeout: 60_000 });
  if (!commit.ok) throw new ValidationError(`git commit failed: ${lastLine(commit.stderr || commit.stdout)}`, 500);
  const result = { committed: staged.stdout.split('\n'), pushed: false };

  if (push) {
    const upstream = await run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: root });
    const args = upstream.ok ? ['push'] : ['push', '-u', 'origin', 'HEAD'];
    const pushed = await run('git', args, { cwd: root, timeout: 180_000 });
    if (!pushed.ok) {
      result.pushError = `Committed locally, but push failed: ${lastLine(pushed.stderr)}`;
    } else {
      result.pushed = true;
    }
  }
  return result;
}
