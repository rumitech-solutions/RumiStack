// One-file export/import of every portable profile, for moving to another laptop without Git.
// Profiles are secret-free by construction; import re-validates every profile before anything is written.

import { FILES } from './profiles.js';
import { ValidationError, assertObject, rejectUnknown } from './validate.js';

export const BUNDLE_FORMAT = 'rumistack-bundle';

export async function exportBundle(store, appVersion) {
  const profiles = {};
  for (const kind of Object.keys(FILES)) profiles[kind] = await store.load(kind);
  return { format: BUNDLE_FORMAT, bundleVersion: 1, exportedAt: new Date().toISOString(), appVersion, profiles };
}

/** Validates the whole bundle first; writes only when every profile is valid and `dryRun` is false. */
export async function importBundle(store, bundle, { dryRun = true } = {}) {
  assertObject(bundle, 'bundle');
  rejectUnknown(bundle, ['format', 'bundleVersion', 'exportedAt', 'appVersion', 'profiles'], 'bundle');
  if (bundle.format !== BUNDLE_FORMAT || bundle.bundleVersion !== 1) throw new ValidationError('This is not a RumiStack bundle (format or version mismatch).');
  assertObject(bundle.profiles, 'bundle.profiles');
  rejectUnknown(bundle.profiles, Object.keys(FILES), 'bundle.profiles');

  const plan = [];
  for (const [kind, value] of Object.entries(bundle.profiles)) {
    let clean;
    try { clean = store.validate(kind, value); } catch (err) { throw new ValidationError(`${kind}: ${err.message}`, err.status ?? 400); }
    const current = await store.load(kind);
    plan.push({ kind, clean, changed: JSON.stringify(current) !== JSON.stringify(clean) });
  }
  if (!dryRun) for (const p of plan.filter((x) => x.changed)) await store.save(p.kind, p.clean);
  return { applied: !dryRun, profiles: plan.map((p) => ({ kind: p.kind, changed: p.changed })) };
}
