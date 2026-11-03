import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export async function readJson(file, fallback) {
  try {
    const text = await fs.readFile(file, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return structuredClone(fallback);
    if (err instanceof SyntaxError) throw new Error(`${path.basename(file)} is not valid JSON: ${err.message}`);
    throw err;
  }
}

/** Atomic write: temp file in the same directory, then rename. */
export async function writeJsonAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}
