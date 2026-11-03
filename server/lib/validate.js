// Strict validation helpers shared by every profile type.
// Rule of thumb: unknown fields, secrets and malformed identifiers are rejected, never "fixed".

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const ENV_NAME_RE = /^[A-Z_][A-Z0-9_]{0,63}$/;
export const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/;
export const COMMAND_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const VSCODE_EXT_RE = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i;
export const HEADER_RE = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;

const SECRET_PATTERNS = [
  ['an OpenAI-style API key', /\bsk-[A-Za-z0-9_-]{16,}/],
  ['a GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/],
  ['a GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{30,}/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['an AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/],
  ['an assigned secret value', /\b(?:api[_-]?key|secret|token|password|passwd)\b["']?\s*[:=]\s*["']?[A-Za-z0-9._~+/-]{16,}/i]
];

/** Returns a human label if the text looks like it embeds a credential, otherwise null. */
export function looksLikeSecret(text) {
  if (typeof text !== 'string') return null;
  for (const [label, re] of SECRET_PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}

/** Walks any JSON value and throws if a string looks like a credential. */
export function scanForSecrets(value, where = 'value') {
  if (typeof value === 'string') {
    const hit = looksLikeSecret(value);
    if (hit) throw new ValidationError(`${where} appears to contain ${hit}. Store only environment-variable names, never secret values.`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => scanForSecrets(v, `${where}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) scanForSecrets(v, `${where}.${k}`);
  }
}

export function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${name} must be an object.`);
  }
  return value;
}

export function rejectUnknown(obj, allowed, name) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new ValidationError(`${name} contains unknown field "${key}".`);
  }
}

export function assertSchemaVersion(obj, name) {
  if (obj.schemaVersion !== 1) throw new ValidationError(`${name}.schemaVersion must be 1.`);
}

export function assertId(value, name) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new ValidationError(`${name} must be 1-63 characters of lowercase letters, digits and hyphens, starting with a letter or digit.`);
  }
  return value;
}

export function assertText(value, name, { min = 1, max = 200, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return undefined;
    throw new ValidationError(`${name} is required.`);
  }
  if (typeof value !== 'string') throw new ValidationError(`${name} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ValidationError(`${name} must be between ${min} and ${max} characters.`);
  }
  // Control characters (other than tab/newline) have no place in profile text.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)) {
    throw new ValidationError(`${name} contains control characters.`);
  }
  return trimmed;
}

export function assertEnvName(value, name) {
  if (typeof value !== 'string' || !ENV_NAME_RE.test(value)) {
    throw new ValidationError(`${name} must be an environment-variable NAME such as MY_API_KEY (A-Z, 0-9, underscore). Never paste the key itself.`);
  }
  const hit = looksLikeSecret(value);
  if (hit) throw new ValidationError(`${name} looks like ${hit}, not a variable name.`);
  return value;
}

export function assertModelId(value, name = 'model') {
  if (typeof value !== 'string' || !MODEL_RE.test(value)) {
    throw new ValidationError(`${name} must be a model ID of 1-128 safe characters (letters, digits, . _ : / @ + -).`);
  }
  return value;
}

export function assertArray(value, name, { max = 100 } = {}) {
  if (!Array.isArray(value)) throw new ValidationError(`${name} must be an array.`);
  if (value.length > max) throw new ValidationError(`${name} may contain at most ${max} entries.`);
  return value;
}

export function assertUnique(values, name) {
  const seen = new Set();
  for (const v of values) {
    if (seen.has(v)) throw new ValidationError(`${name} contains a duplicate: ${v}.`);
    seen.add(v);
  }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function isLoopbackHost(hostname) {
  return LOOPBACK_HOSTS.has(String(hostname).toLowerCase());
}

/**
 * HTTPS for anything remote; HTTP only for loopback. No credentials, query string or fragment.
 */
export function assertUrl(value, name) {
  if (typeof value !== 'string' || value.length > 300) throw new ValidationError(`${name} must be a URL of at most 300 characters.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError(`${name} is not a valid URL.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ValidationError(`${name} must use http or https.`);
  if (url.protocol === 'http:' && !isLoopbackHost(url.hostname)) {
    throw new ValidationError(`${name} must use HTTPS unless it points at localhost/127.0.0.1.`);
  }
  if (url.username || url.password) throw new ValidationError(`${name} must not contain credentials.`);
  if (url.search) throw new ValidationError(`${name} must not contain a query string (it could carry a secret).`);
  if (url.hash) throw new ValidationError(`${name} must not contain a fragment.`);
  return value;
}
