import test from 'node:test';
import assert from 'node:assert/strict';
import { setupProgress } from '../server/lib/progress.js';

const gitState = { repo: false, remote: false, configChanges: [], lastCommit: null };

function storeWith(device, providers) {
  return {
    async load(kind) {
      if (kind === 'device') return device;
      if (kind === 'providers') return providers;
      throw new Error(`Unexpected profile: ${kind}`);
    }
  };
}

test('first-run progress requires only a coding platform', async () => {
  const result = await setupProgress({
    store: storeWith({ tools: [], sources: [], vscodeExtensions: [], favorites: [] }, { profiles: [] }),
    gitState
  });
  assert.equal(result.done, 0);
  assert.equal(result.total, 1);
  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[0].id, 'assistant');
  assert.equal(result.steps[0].required, true);
  assert.equal(result.steps[1].required, false);
  assert.equal(result.steps[2].required, false);
});

test('selecting any supported coding assistant completes core setup', async () => {
  const result = await setupProgress({
    store: storeWith({ tools: ['opencode'], sources: [], vscodeExtensions: [], favorites: [] }, { profiles: [] }),
    gitState
  });
  assert.equal(result.done, 1);
  assert.equal(result.total, 1);
  assert.equal(result.steps[0].done, true);
  assert.equal(result.steps[1].done, false);
});

test('DeepSeek Harness is recognized as a primary coding platform', async () => {
  const result = await setupProgress({
    store: storeWith({ tools: ['deepseek-harness'], sources: [], vscodeExtensions: [], favorites: [] }, { profiles: [] }),
    gitState
  });
  assert.equal(result.done, 1);
  assert.equal(result.steps[0].done, true);
});
