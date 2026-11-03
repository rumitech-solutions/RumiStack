import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createApp } from '../server/index.js';

/** Starts the real server on an ephemeral loopback port with an empty temporary config folder. */
export async function startTestServer() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rumistack-test-'));
  const app = await createApp({ root: dir, configDir: path.join(dir, 'config') });
  const port = await app.listen(0);
  const base = `http://127.0.0.1:${port}`;

  async function call(method, route, body, headers = {}) {
    const init = { method, headers: { ...headers } };
    if (body !== undefined) {
      init.headers['Content-Type'] ??= 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(base + route, init);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  }

  /** Raw request so tests can set Host / Origin precisely. */
  function raw(method, route, headers = {}, body) {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, text: data }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  return {
    port, base, dir, call, raw,
    get: (r) => call('GET', r),
    put: (r, b, h) => call('PUT', r, b, h),
    post: (r, b, h) => call('POST', r, b, h),
    async close() {
      await app.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  };
}
