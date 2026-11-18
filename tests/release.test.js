import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../server/lib/registry.js';

const read = (file) => readFile(path.join(REPO_ROOT, file), 'utf8');

test('stable release metadata stays in sync', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const [readme, changelog, release] = await Promise.all([
    read('README.md'), read('CHANGELOG.md'), read('docs/RELEASE-1.8.1.md')
  ]);
  assert.equal(pkg.version, '1.8.1');
  assert.match(readme, /version-1.8.1-/);
  assert.match(changelog, /^## \[1.8.1\]/m);
  assert.match(release, /RumiStack v1\.8\.0/);
});


test('Project Hub keeps common import simple and project actions health-aware', async () => {
  const [projects, styles, release] = await Promise.all([
    read('dashboard/js/views/projects.js'), read('dashboard/premium.css'), read('docs/RELEASE-1.8.1.md')
  ]);
  assert.match(projects, /Advanced import options/);
  assert.match(projects, /Already have a project on this laptop\?/);
  assert.match(projects, /Importing only downloads the files/);
  assert.match(projects, /let primaryAction/);
  assert.match(projects, /class: 'project-more'/);
  assert.match(projects, /Run app/);
  assert.match(projects, /setupCompleted/);
  assert.match(styles, /\.project-options/);
  assert.match(styles, /\.project-more-menu/);
  assert.match(release, /Project imports remain download-only/);
});


test('final documentation matches the v1.8.1 dashboard and has clean links', async () => {
  const [readme, index, quickstart, projectGuide, security] = await Promise.all([
    read('README.md'), read('docs/README.md'), read('docs/QUICKSTART.md'),
    read('docs/PROJECT-HUB.md'), read('docs/SECURITY.md')
  ]);
  const escapedNewline = String.fromCharCode(92) + 'n';
  assert.match(readme, /v1\.8\.0 release/);
  assert.equal(readme.includes(escapedNewline + '- ☁️'), false);
  assert.equal(index.includes(escapedNewline + '|'), false);
  assert.match(quickstart, /Guided setup/);
  assert.match(projectGuide, /Advanced import options/);
  assert.match(projectGuide, /More menu/);
  assert.match(security, /dependency installation/i);
});

test('the single Windows launcher starts locally and never updates Git', async () => {
  const [launcher, startScript] = await Promise.all([
    read('Start-RumiStack.bat'), read('scripts/Start-Workspace.ps1')
  ]);
  assert.match(launcher, /scripts\\\\Start-Workspace\\.ps1/);
  assert.match(launcher, /does not update or pull from GitHub/i);
  assert.doesNotMatch(launcher, /git\\s+(fetch|pull|merge)/i);
  assert.match(startScript, /node server\\/index\\.js/);
  assert.match(startScript, /Start-Process \\$url/);
  assert.match(startScript, /alreadyListening/);
  assert.doesNotMatch(startScript, /git\\s+(fetch|pull|merge)/i);
  for (const removed of ['Update-and-Start.bat', 'start.cmd', 'scripts/Update-and-Start.ps1']) {
    await assert.rejects(() => read(removed), { code: 'ENOENT' });
  }
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
  const [service, backup, timer, guide] = await Promise.all([
    read('scripts/install-linux-service.sh'), read('scripts/backup-linux.sh'), read('scripts/install-linux-backup-timer.sh'), read('docs/CLOUD-DEPLOYMENT.md')
  ]);
  assert.match(service, /systemctl --user enable --now rumistack\.service/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(backup, /chmod 600/);
  assert.match(backup, /sources projects state config/);
  assert.match(timer, /OnCalendar=daily/);
  assert.match(timer, /rumistack-backup.timer/);
  assert.match(guide, /Do not add port 47821/);
  assert.match(guide, /sudo loginctl enable-linger/);
});
