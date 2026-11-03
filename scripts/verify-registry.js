// Opt-in network check: `npm run verify-registry`.
// Confirms every repo/docs URL in the registry still resolves. Read-only HEAD/GET requests.

import { loadRegistry } from '../server/lib/registry.js';

const { tools, skills } = await loadRegistry();
const urls = new Map();
for (const t of tools.tools) {
  urls.set(t.repo, `${t.id} (repo)`);
  urls.set(t.docs, `${t.id} (docs)`);
}
for (const s of skills.sources) if (s.url) urls.set(s.url, `${s.id} (skills source)`);

async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'RumiStack-registry-verify' } });
      if (res.ok) return { ok: true, status: res.status, finalUrl: res.url };
      if (method === 'GET') return { ok: false, status: res.status };
    } catch (err) {
      if (method === 'GET') return { ok: false, status: err.name === 'TimeoutError' ? 'timeout' : err.message };
    }
  }
  return { ok: false, status: 'unknown' };
}

let bad = 0;
const queue = [...urls];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const [url, label] = queue.shift();
    const r = await probe(url);
    if (!r.ok) { bad++; console.log(`FAIL  ${label}  ${url}  -> ${r.status}`); }
    else if (r.finalUrl && r.finalUrl.replace(/\/$/, '') !== url.replace(/\/$/, '')) console.log(`MOVED ${label}  ${url}  -> ${r.finalUrl}`);
  }
}));
console.log(bad === 0 ? `All ${urls.size} URLs resolved.` : `${bad} of ${urls.size} URLs failed. Update registry/tools.json (and its "updated" date).`);
process.exit(bad === 0 ? 0 : 1);
