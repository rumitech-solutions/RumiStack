import { ValidationError } from './validate.js';

export const MAX_BODY = 256 * 1024;

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store'
};

export function sendJson(res, status, body, extra = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload), ...SECURITY_HEADERS, ...extra });
  res.end(payload);
}

export function allowedHosts(port) {
  return new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
}

/**
 * DNS-rebinding defence: the Host header must be a loopback name with our port.
 */
export function checkHost(req, port) {
  const host = String(req.headers.host ?? '').toLowerCase();
  if (!allowedHosts(port).has(host)) throw new ValidationError('Unexpected Host header.', 403);
}

/**
 * Mutating requests: reject cross-origin browser requests, and require JSON.
 * Non-browser clients (no Origin, no Sec-Fetch-Site) are allowed because the server only listens on loopback.
 */
export function checkMutation(req, port) {
  const origin = req.headers.origin;
  if (origin !== undefined) {
    const o = String(origin).toLowerCase();
    const ok = [`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`];
    if (!ok.includes(o)) throw new ValidationError('Cross-origin request rejected.', 403);
  }
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') throw new ValidationError('Cross-site request rejected.', 403);
  const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (req.method !== 'DELETE' && type !== 'application/json') throw new ValidationError('Content-Type must be application/json.', 415);
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return; // keep draining so the client can read our 413 instead of a reset
      size += chunk.length;
      if (size > MAX_BODY) {
        tooLarge = true;
        chunks.length = 0;
        reject(new ValidationError('Request body too large.', 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (size === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ValidationError('Request body is not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}
