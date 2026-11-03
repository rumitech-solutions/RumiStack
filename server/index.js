import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, loadRegistry } from './lib/registry.js';
import { createProfileStore } from './lib/profiles.js';
import { ValidationError, assertId, assertObject } from './lib/validate.js';
import { SECURITY_HEADERS, sendJson, checkHost, checkMutation, readJsonBody } from './lib/http.js';
import { PROVIDER_CLIENTS, MCP_CLIENTS, AGENT_FORMATS, providerSnippet, discoveryCommand, mcpSnippet, agentExport } from './lib/snippets.js';
import { toolStatuses, buildOverview, sourceStatus, cloneSource, updateSource, launchAssistant, skillsPreview } from './lib/system.js';

export const DEFAULT_PORT = 47821;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

/**
 * @param {{root?: string, configDir?: string, registryRoot?: string, port?: number}} options
 *   root: where sources/, projects/ and the default config/ live (the RumiStack folder).
 */
export async function createApp(options = {}) {
  const root = path.resolve(options.root ?? REPO_ROOT);
  const configDir = path.resolve(options.configDir ?? path.join(root, 'config'));
  const registry = await loadRegistry(options.registryRoot ?? REPO_ROOT);
  const store = createProfileStore(configDir, registry);
  const pkg = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const dashboardDir = path.join(REPO_ROOT, 'dashboard');
  let boundPort = options.port ?? DEFAULT_PORT;

  const body = async (req) => assertObject(await readJsonBody(req), 'request body');

  const routes = {
    'GET /api/meta': async () => ({
      name: 'RumiStack', version: pkg.version, platform: process.platform, node: process.version,
      registryUpdated: registry.tools.updated, port: boundPort
    }),

    'GET /api/registry/tools': async () => ({
      updated: registry.tools.updated, categories: registry.tools.categories, tools: registry.tools.tools
    }),
    'GET /api/tools/status': async () => ({ statuses: await toolStatuses(registry.tools.tools) }),

    // ---- device profile
    'GET /api/profile': async () => ({ profile: await store.load('device') }),
    'PUT /api/profile': async (req) => ({ profile: await store.save('device', await body(req)) }),
    'GET /api/profile/export': async () => ({ __download: 'portable-profile.json', data: await store.load('device') }),
    'GET /api/overview': async () => {
      const [profile, statuses] = await Promise.all([store.load('device'), toolStatuses(registry.tools.tools)]);
      return buildOverview(profile, registry, statuses);
    },

    // ---- providers
    'GET /api/providers': async () => ({
      presets: registry.providers.presets, protocols: registry.providers.protocols, clients: PROVIDER_CLIENTS,
      ...(await store.load('providers'))
    }),
    'PUT /api/providers': async (req) => store.save('providers', await body(req)),
    'POST /api/providers/snippet': async (req) => {
      const { id, client } = await body(req);
      const profile = (await store.load('providers')).profiles.find((p) => p.id === assertId(id, 'id'));
      if (!profile) throw new ValidationError('Provider profile not found. Save it first.', 404);
      return providerSnippet(profile, client);
    },
    'POST /api/providers/discovery': async (req) => {
      const { id } = await body(req);
      const profile = (await store.load('providers')).profiles.find((p) => p.id === assertId(id, 'id'));
      if (!profile) throw new ValidationError('Provider profile not found. Save it first.', 404);
      return discoveryCommand(profile);
    },

    // ---- skills
    'GET /api/skills': async () => ({
      assistants: registry.skills.assistants, sources: registry.skills.sources, updated: registry.skills.updated,
      ...(await store.load('skills'))
    }),
    'PUT /api/skills': async (req) => store.save('skills', await body(req)),
    'GET /api/skills/preview': async () => skillsPreview((await store.load('skills')).selections, registry),

    // ---- agents
    'GET /api/agents': async () => ({ formats: AGENT_FORMATS.map(({ id, name }) => ({ id, name })), ...(await store.load('agents')) }),
    'PUT /api/agents': async (req) => store.save('agents', await body(req)),
    'POST /api/agents/export': async (req) => {
      const { id, format } = await body(req);
      const agent = (await store.load('agents')).profiles.find((a) => a.id === assertId(id, 'id'));
      if (!agent) throw new ValidationError('Agent profile not found. Save it first.', 404);
      return agentExport(agent, format);
    },

    // ---- MCP
    'GET /api/mcp': async () => ({ templates: registry.mcp.templates, clients: MCP_CLIENTS, ...(await store.load('mcp')) }),
    'PUT /api/mcp': async (req) => store.save('mcp', await body(req)),
    'POST /api/mcp/snippet': async (req) => {
      const { id, client } = await body(req);
      const server = (await store.load('mcp')).servers.find((s) => s.id === assertId(id, 'id'));
      if (!server) throw new ValidationError('MCP server profile not found. Save it first.', 404);
      return mcpSnippet(server, client);
    },

    // ---- source checkouts and launching
    'GET /api/sources': async () => ({ sources: await sourceStatus(root, registry) }),
    'POST /api/sources/clone': async (req) => cloneSource(root, registry, assertId((await body(req)).id, 'id')),
    'POST /api/sources/update': async (req) => updateSource(root, registry, assertId((await body(req)).id, 'id')),
    'POST /api/launch': async (req) => launchAssistant(root, registry, assertId((await body(req)).id, 'id'))
  };

  async function serveStatic(req, res, pathname) {
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(dashboardDir, rel);
    if (file !== dashboardDir && !file.startsWith(dashboardDir + path.sep)) throw new ValidationError('Not found.', 404);
    const type = MIME[path.extname(file)];
    if (!type) throw new ValidationError('Not found.', 404);
    let data;
    try {
      data = await fs.readFile(file);
    } catch {
      throw new ValidationError('Not found.', 404);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length, ...SECURITY_HEADERS });
    res.end(data);
  }

  const server = http.createServer(async (req, res) => {
    try {
      checkHost(req, boundPort);
      const url = new URL(req.url, `http://127.0.0.1:${boundPort}`);
      const method = req.method;
      if (!url.pathname.startsWith('/api/')) {
        if (method !== 'GET' && method !== 'HEAD') throw new ValidationError('Method not allowed.', 405);
        return await serveStatic(req, res, url.pathname);
      }
      if (method !== 'GET') checkMutation(req, boundPort);
      const handler = routes[`${method} ${url.pathname}`];
      if (!handler) throw new ValidationError('Unknown API route.', 404);
      const result = await handler(req);
      if (result && result.__download) {
        return sendJson(res, 200, result.data, { 'Content-Disposition': `attachment; filename="${result.__download}"` });
      }
      return sendJson(res, 200, result);
    } catch (err) {
      if (err instanceof ValidationError) {
        return sendJson(res, err.status, { error: err.message }, err.status === 413 ? { Connection: 'close' } : {});
      }
      console.error('Unexpected error:', err);
      return sendJson(res, 500, { error: 'Internal error. See the server console.' });
    }
  });

  return {
    server, root, configDir, registry,
    /** Always binds to loopback. Pass port 0 for an ephemeral port (tests). */
    listen(port = options.port ?? DEFAULT_PORT) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          boundPort = server.address().port;
          resolve(boundPort);
        });
      });
    },
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.RUMISTACK_PORT ?? DEFAULT_PORT);
  const app = await createApp({ port });
  try {
    await app.listen(port);
  } catch (err) {
    console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use. Is RumiStack already running? (set RUMISTACK_PORT to use another port)` : err);
    process.exit(1);
  }
  console.log(`RumiStack dashboard: http://127.0.0.1:${port}  (Ctrl+C to stop)`);
}
