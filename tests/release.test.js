import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../server/lib/registry.js';

const read = (file) => readFile(path.join(REPO_ROOT, file), 'utf8');

test('stable release metadata stays in sync', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const [readme, changelog, release] = await Promise.all([
    read('README.md'), read('CHANGELOG.md'), read('docs/RELEASE-1.6.0.md')
  ]);
  assert.equal(pkg.version, '1.6.0');
  assert.match(readme, /version-1.6.0-/);
  assert.match(changelog, /^## \[1.6.0\]/m);
  assert.match(release, /RumiStack v1\.6\.0/);
});

test('one-click launcher validates and tests before starting', async () => {
  const launcher = await read('scripts/Update-and-Start.ps1');
  const check = launcher.indexOf('& node scripts/check.js');
  const tests = launcher.indexOf('& node scripts/test.js');
  const start = launcher.indexOf("Step 'Starting RumiStack'");
  assert.ok(check >= 0, 'integrity check is present');
  assert.ok(tests > check, 'automated tests run after integrity checks');
  assert.ok(start > tests, 'dashboard starts only after tests pass');
});

test('Linux launcher preserves loopback-only remote access guidance', async () => {
  const [launcher, remoteGuide, server] = await Promise.all([
    read('scripts/start-linux.sh'), read('docs/REMOTE-ACCESS.md'), read('server/index.js')
  ]);
  assert.match(launcher, /Node\.js 20\+/);
  assert.match(launcher, /exec node server\/index\.js/);
  assert.match(remoteGuide, /ssh -N -L 47821:127\.0\.0\.1:47821/);
  assert.match(remoteGuide, /Do not open TCP 47821/);
  assert.match(server, /server\.listen\(port, '127\.0\.0\.1'/);
});

test('cloud deployment automation is private and keeps backups permission-restricted', async () => {
  const [service, backup, guide] = await Promise.all([
    read('scripts/install-linux-service.sh'), read('scripts/backup-linux.sh'), read('docs/CLOUD-DEPLOYMENT.md')
  ]);
  assert.match(service, /systemctl --user enable --now rumistack\.service/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(backup, /chmod 600/);
  assert.match(backup, /sources projects state config/);
  assert.match(guide, /Do not add port 47821/);
  assert.match(guide, /sudo loginctl enable-linger/);
});
