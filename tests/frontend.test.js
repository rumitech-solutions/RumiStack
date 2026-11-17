import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from '../server/lib/registry.js';

function javascriptFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? javascriptFiles(full) : entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

test('all browser modules pass Node syntax parsing without executing browser code', () => {
  const files = javascriptFiles(path.join(REPO_ROOT, 'dashboard', 'js'));
  assert.ok(files.length > 0, 'dashboard JavaScript files should exist');
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, `${path.relative(REPO_ROOT, file)} failed syntax check:\n${result.stderr || result.stdout}`);
  }
});
