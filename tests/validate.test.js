import test from 'node:test';
import assert from 'node:assert/strict';
import { assertUrl, assertEnvName, assertId, assertModelId, looksLikeSecret, scanForSecrets, ValidationError } from '../server/lib/validate.js';

test('assertUrl accepts https and loopback http', () => {
  assert.equal(assertUrl('https://api.example.com/v1', 'u'), 'https://api.example.com/v1');
  assert.equal(assertUrl('http://127.0.0.1:20128/v1', 'u'), 'http://127.0.0.1:20128/v1');
  assert.equal(assertUrl('http://localhost:3000', 'u'), 'http://localhost:3000');
});

test('assertUrl rejects remote http, credentials, query strings and fragments', () => {
  for (const bad of ['http://example.com/v1', 'https://user:pw@example.com', 'https://example.com/v1?key=abc', 'https://example.com/#x', 'ftp://example.com', 'not a url']) {
    assert.throws(() => assertUrl(bad, 'u'), ValidationError, bad);
  }
});

test('assertEnvName only accepts variable names', () => {
  assert.equal(assertEnvName('MY_API_KEY', 'e'), 'MY_API_KEY');
  for (const bad of ['sk-abcdefghijklmnopqrstuvwxyz', 'my_key', 'HAS SPACE', '1BAD', 'AKIAABCDEFGHIJKLMNOP', '']) {
    assert.throws(() => assertEnvName(bad, 'e'), ValidationError, bad);
  }
});

test('assertId and assertModelId enforce safe shapes', () => {
  assert.equal(assertId('my-id-1', 'id'), 'my-id-1');
  for (const bad of ['Upper', '-lead', 'has space', '../x', 'a'.repeat(64)]) assert.throws(() => assertId(bad, 'id'), ValidationError, bad);
  assert.equal(assertModelId('meta-llama/llama-3.3-70b:free', 'm'), 'meta-llama/llama-3.3-70b:free');
  assert.throws(() => assertModelId('bad model; rm -rf', 'm'), ValidationError);
});

test('looksLikeSecret flags common credential shapes and ignores env references', () => {
  const secrets = [
    'sk-abcdefghijklmnopqrstuvwx',
    'ghp_' + 'a'.repeat(36),
    'github_pat_' + 'A'.repeat(40),
    'AKIAIOSFODNN7EXAMPLE',
    '-----BEGIN RSA PRIVATE KEY-----',
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    'api_key = "abcdefghijklmnop1234"'
  ];
  for (const s of secrets) assert.ok(looksLikeSecret(s), s);
  for (const ok of ['Bearer {env:MY_TOKEN}', 'Bearer $env:MY_TOKEN', 'MY_API_KEY', 'Use the API key from your secret manager.']) {
    assert.equal(looksLikeSecret(ok), null, ok);
  }
});

test('scanForSecrets walks nested values and names the path', () => {
  assert.throws(() => scanForSecrets({ a: [{ b: 'sk-abcdefghijklmnopqrstuvwx' }] }, 'cfg'), /cfg\.a\[0\]\.b/);
  assert.doesNotThrow(() => scanForSecrets({ a: ['fine'] }, 'cfg'));
});
