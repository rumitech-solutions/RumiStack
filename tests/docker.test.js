import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { startTestServer } from './helpers.js';
import { parsePs, bindsOutsideLoopback } from '../server/lib/docker.js';

const posix = process.platform !== 'win32'; // the fake docker below is a POSIX script

test('parsePs reads both compose output formats', () => {
  const lines = '{"Service":"a","State":"running","Health":"healthy"}\n{"Service":"b","State":"exited"}';
  assert.deepEqual(parsePs(lines).map((c) => [c.service, c.state, c.health]), [['a', 'running', 'healthy'], ['b', 'exited', '']]);
  assert.equal(parsePs('[{"Service":"a","State":"running"}]').length, 1);
  assert.deepEqual(parsePs(''), []);
  assert.deepEqual(parsePs('not json'), []);
});

test('bindsOutsideLoopback only flags non-loopback values of the named keys', () => {
  assert.equal(bindsOutsideLoopback('HOST_BIND=0.0.0.0\n', ['HOST_BIND']), true);
  assert.equal(bindsOutsideLoopback('HOST_BIND=127.0.0.1\n', ['HOST_BIND']), false);
  assert.equal(bindsOutsideLoopback('# HOST_BIND=0.0.0.0\n', ['HOST_BIND']), false);
  assert.equal(bindsOutsideLoopback('OTHER=0.0.0.0\n', ['HOST_BIND']), false);
  assert.equal(bindsOutsideLoopback('APP_BIND_HOST="::"', ['APP_BIND_HOST']), true);
  assert.equal(bindsOutsideLoopback('', ['HOST_BIND']), false);
});

test('gateways refuse to act on anything that is not cloned or not in the registry', async () => {
  const t = await startTestServer();
  try {
    const list = await t.get('/api/gateways');
    assert.equal(list.status, 200);
    assert.deepEqual(list.json.gateways.map((g) => g.id).sort(), ['freellmapi', 'omniroute']);
    assert.ok(list.json.gateways.every((g) => g.cloned === false && g.running === false));
    assert.equal((await t.post('/api/gateways/up', { id: 'git' })).status, 404);      // real tool, no docker entry
    assert.equal((await t.post('/api/gateways/up', { id: 'nope' })).status, 404);
    assert.equal((await t.post('/api/gateways/up', { id: '../x' })).status, 400);
    assert.equal((await t.post('/api/gateways/prepare', { id: 'omniroute' })).status, 409);
    assert.equal((await t.post('/api/gateways/up', { id: 'omniroute' })).status, 409);
    assert.equal((await t.call('POST', '/api/gateways/up', 'id=omniroute', { 'Content-Type': 'text/plain' })).status, 415);
  } finally { await t.close(); }
});

test('gateway lifecycle with a fake docker: prepare, start, status, logs, stop', { skip: !posix }, async () => {
  const bin = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-fakedocker-'));
  const logFile = path.join(bin, 'calls.log');
  const stateFile = path.join(bin, 'running');
  await fs.writeFile(path.join(bin, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logFile)}, a.join(' ') + '\\n');
const has = (w) => a.includes(w);
if (a[0] === '--version') console.log('Docker version 99.0.0');
else if (a[0] === 'info') console.log('99.0.0');
else if (a[0] === 'compose' && a[1] === 'version') console.log('2.99.0');
else if (has('up')) fs.writeFileSync(${JSON.stringify(stateFile)}, '1');
else if (has('down')) fs.rmSync(${JSON.stringify(stateFile)}, { force: true });
else if (has('ps')) { if (fs.existsSync(${JSON.stringify(stateFile)})) console.log('{"Service":"app","State":"running","Health":"healthy"}'); }
else if (has('logs')) console.log('hello from the container');
`, { mode: 0o755 });

  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
  const t = await startTestServer();
  try {
    for (const id of ['freellmapi', 'omniroute']) {
      const dir = path.join(t.dir, 'sources', id);
      await fs.mkdir(path.join(dir, '.git'), { recursive: true });
      await fs.writeFile(path.join(dir, 'docker-compose.yml'), 'services: {}\n');
      await fs.writeFile(path.join(dir, '.env.example'), 'ENCRYPTION_KEY=your-64-char-hex-key-here\nPORT=3001\n');
    }

    const before = (await t.get('/api/gateways')).json;
    assert.equal(before.docker.daemon, true);
    const free = () => t.get('/api/gateways').then((r) => r.json.gateways.find((g) => g.id === 'freellmapi'));
    assert.equal((await free()).envReady, false);
    assert.equal((await t.post('/api/gateways/up', { id: 'freellmapi' })).status, 409); // needs .env first

    const prep = await t.post('/api/gateways/prepare', { id: 'freellmapi' });
    assert.equal(prep.status, 200);
    assert.deepEqual(prep.json, { id: 'freellmapi', created: true, generated: ['ENCRYPTION_KEY'] });
    const env = await fs.readFile(path.join(t.dir, 'sources/freellmapi/.env'), 'utf8');
    const key = /^ENCRYPTION_KEY=([0-9a-f]{64})$/m.exec(env)?.[1];
    assert.ok(key, 'a random 64-hex key is written to .env');
    assert.ok(!prep.text.includes(key), 'the generated key is never returned to the browser');
    assert.equal((await t.post('/api/gateways/prepare', { id: 'freellmapi' })).json.created, false);
    assert.ok((await t.post('/api/gateways/prepare', { id: 'freellmapi' })).json.generated.length === 0);
    assert.equal(await fs.readFile(path.join(t.dir, 'sources/freellmapi/.env'), 'utf8'), env, '.env is never overwritten');
    assert.ok(!(await fs.readFile(path.join(t.dir, 'logs/activity.jsonl'), 'utf8')).includes(key), 'the key is not journalled');

    assert.equal((await t.post('/api/gateways/up', { id: 'freellmapi' })).status, 200);
    let g = await free();
    assert.equal(g.running, true);
    assert.deepEqual(g.containers, [{ service: 'app', state: 'running', health: 'healthy' }]);
    assert.equal(g.exposed, false);

    const logs = await t.post('/api/gateways/logs', { id: 'freellmapi' });
    assert.match(logs.json.logs, /hello from the container/);

    await fs.appendFile(path.join(t.dir, 'sources/freellmapi/.env'), 'HOST_BIND=0.0.0.0\n');
    assert.equal((await free()).exposed, true);

    assert.equal((await t.post('/api/gateways/down', { id: 'freellmapi' })).status, 200);
    assert.equal((await free()).running, false);

    // OmniRoute runs only its "base" profile
    await t.post('/api/gateways/prepare', { id: 'omniroute' });
    assert.equal((await t.post('/api/gateways/up', { id: 'omniroute' })).status, 200);

    const calls = (await fs.readFile(logFile, 'utf8')).split('\n').filter(Boolean);
    assert.ok(calls.includes('compose up -d'));
    assert.ok(calls.includes('compose --profile base up -d'));
    assert.ok(calls.includes('compose down'));
    assert.ok(!calls.some((c) => /\s(-v|--volumes|--profile cli|--profile autoupdate)\b/.test(c)), 'never removes volumes or enables risky profiles');
    const activity = await t.get('/api/activity');
    assert.ok(activity.json.entries.some((e) => e.action === 'gateway:start'));
  } finally {
    process.env.PATH = oldPath;
    await t.close();
    await fs.rm(bin, { recursive: true, force: true });
  }
});
