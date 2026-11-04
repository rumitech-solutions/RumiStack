// Starter kits: curated bundles that MERGE into the device and MCP profiles. They never remove anything.

export function templateToServer(template, clients) {
  const server = {
    id: template.id,
    name: template.name,
    transport: template.transport,
    envVars: [...(template.envVars ?? [])],
    clients: clients.map((c) => c.id)
  };
  if (template.transport === 'stdio') {
    server.command = template.command;
    server.args = [...(template.args ?? [])];
    server.headerEnv = {};
  } else {
    server.url = template.url;
    server.headerEnv = { ...(template.headerEnv ?? {}) };
    server.args = [];
  }
  return server;
}

export function applyKit(kit, device, mcp, registry) {
  const added = { tools: [], sources: [], vscodeExtensions: [], mcp: [] };
  const nextDevice = { ...device, tools: [...device.tools], sources: [...device.sources], vscodeExtensions: [...device.vscodeExtensions] };
  for (const key of ['tools', 'sources', 'vscodeExtensions']) {
    for (const item of kit[key] ?? []) {
      const exists = key === 'vscodeExtensions'
        ? nextDevice[key].some((e) => e.toLowerCase() === item.toLowerCase())
        : nextDevice[key].includes(item);
      if (!exists) { nextDevice[key].push(item); added[key].push(item); }
    }
  }
  const nextMcp = { ...mcp, servers: [...mcp.servers] };
  for (const id of kit.mcp ?? []) {
    if (nextMcp.servers.some((s) => s.id === id)) continue;
    const template = registry.mcp.templates.find((t) => t.id === id);
    if (!template) continue;
    nextMcp.servers.push(templateToServer(template, registry.mcp.clients));
    added.mcp.push(id);
  }
  return { device: nextDevice, mcp: nextMcp, added };
}
