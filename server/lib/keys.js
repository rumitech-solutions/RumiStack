// Which API-key environment variables referenced by your profiles are set on THIS laptop.
// Only the variable NAME and a set/not-set flag are reported. Values and lengths never leave this process.

export async function keyStatus(store, env = process.env) {
  const [providers, mcp] = await Promise.all([store.load('providers'), store.load('mcp')]);
  const byName = new Map();
  const use = (name, kind, label) => {
    if (!byName.has(name)) byName.set(name, { name, usedBy: [] });
    byName.get(name).usedBy.push({ kind, label });
  };
  for (const p of providers.profiles) use(p.apiKeyEnv, 'provider', p.name);
  for (const s of mcp.servers) {
    for (const n of s.envVars ?? []) use(n, 'mcp', s.name);
    for (const n of Object.values(s.headerEnv ?? {})) use(n, 'mcp', s.name);
  }
  const keys = [...byName.values()].map((k) => ({ ...k, set: typeof env[k.name] === 'string' && env[k.name].length > 0 })).sort((a, b) => a.name.localeCompare(b.name));
  return { keys, missing: keys.filter((k) => !k.set).length };
}
