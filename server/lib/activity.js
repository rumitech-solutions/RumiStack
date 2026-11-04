// Append-only local activity journal (logs/activity.jsonl). Best effort: a logging failure never breaks a request.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 1024 * 1024;

export function createActivityLog(root) {
  const dir = path.join(root, 'logs');
  const file = path.join(dir, 'activity.jsonl');

  async function log(action, detail = '') {
    try {
      await fs.mkdir(dir, { recursive: true });
      const stat = await fs.stat(file).catch(() => null);
      if (stat && stat.size > MAX_BYTES) await fs.rename(file, `${file}.1`);
      const entry = { ts: new Date().toISOString(), action: String(action).slice(0, 60), detail: String(detail).slice(0, 300) };
      await fs.appendFile(file, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      /* logging is best effort */
    }
  }

  async function recent(limit = 100) {
    const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
    let text = '';
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      return [];
    }
    const entries = [];
    for (const line of text.split('\n').slice(-n - 1)) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line)); } catch { /* skip a torn line */ }
    }
    return entries.slice(-n).reverse();
  }

  return { log, recent };
}
