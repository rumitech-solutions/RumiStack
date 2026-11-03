// `npm test`: runs only RumiStack's own tests/*.test.js (never tests inside sources/ checkouts).
// Lists files explicitly because shell globbing differs between Windows and Linux and Node 20 lacks glob args.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../server/lib/registry.js';

const dir = path.join(REPO_ROOT, 'tests');
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join('tests', f));
if (files.length === 0) {
  console.error('No test files found in tests/.');
  process.exit(1);
}
const res = spawnSync(process.execPath, ['--test', ...files], { cwd: REPO_ROOT, stdio: 'inherit' });
process.exit(res.status ?? 1);
