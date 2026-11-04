import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, loadRegistry } from './lib/registry.js';
import { createProfileStore } from './lib/profiles.js';
import { ValidationError, assertId, assertObject } from './lib/validate.js';
import { SECURITY_HEADERS, sendJson, checkHost, checkMutation, readJsonBody } from './lib/http.js';
import { PROVIDER_CLIENTS, MCP_CLIENTS, AGENT_FORMATS, providerSnippet, discoveryCommand, mcpSnippet, agentExport } from './lib/snippets.js';
import {
  toolStatuses, buildOverview, sourceStatus, cloneSource, updateSource, launchAssistant, skillsPreview,
  installedVersions, latestNpmVersions
} from './lib/system.js';
import { createActivityLog } from './lib/activity.js';
import { gitStatus, gitDiff, gitFetch, gitPull, gitCommitPush } from './lib/git.js';
import { testProvider } from './lib/gateway.js';
import { applyKit } from './lib/kits.js';
import { runDoctor } from './lib/doctor.js';
import { gatewayStatus, prepareGateway, gatewayUp, gatewayDown, gatewayLogs } from './lib/docker.js';

export const DEFAULT_PORT = 47821;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

/**
 * @param {{root?: string, configDir?: string, registryRoot?: string, port?: number}} options
 *   root: where sources/, projects/, logs/, backups/ and the default config/ live (the RumiStack folder).
 */
export async function createApp(options = {}) {
  const root = path.resolve(options.root ?? REPO_ROOT);
  const configDir = path.resolve(options.configDir ?? path.join(root, 'config'));
  const registry = await loadRegistry(options.registryRoot ?? REPO_ROOT);
  const store = createProfileStore(configDir, registry, { backupsDir: path.join(root, 'backups') });
  const activity = createActivityLog(root);
  const pkg = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const dashboardDir = path.join(REPO_ROOT, 'dashboard');
  let boundPort = options.port ?? DEFAULT_PORT;

  const body = async (req) => assertObject(await readJsonBody(req), 'request body');
  const findIn = (list, id, what) => {
    const item = list.find((x) => x.id === id);
    if (!item) throw new ValidationError(`${what} not found. Save it first.`, 404);
    return item;
  };

  /** Validated save + journal entry. */
  const saver = (kind, describe) => async (req) => {
    const saved = await store.save(kind, await body(req));
    await activity.log(`save:${kind}`, describe(saved));
    return saved;
  };

  const routes = {
    'GET /api/meta': async () => ({
      name: 'RumiStack', version: pkg.version, platform: process.platform, node: process.version,
      registryUpdated: registry.tools.updated, port: boundPort
    }),

    'GET /api/registry/tools': async () => ({
      updated: registry.tools.updated, categories: registry.tools.categories, tools: registry.tools.tools
    }),
    'GET /api/tools/status': async () => ({ statuses: await toolStatuses(registry.tools.tools) }),
    'GET /api/tools/versions': async () => {
      const statuses = await toolStatuses(registry.tools.tools);
      return { versions: await installedVersions(registry.tools.tools, statuses) };
    },
    'POST /api/tools/latest': async () => {
      const latest = await latestNpmVersions(registry.tools.tools);
      await activity.log('check:updates', `${Object.values(latest).filter(Boolean).length} npm version(s) looked up`);
      return { latest };
    },

    // ---- device profile
    'GET /api/profile': async () => ({ profile: await store.load('device') }),
    'PUT /api/profile': async (req) => ({ profile: await saver('device', (p) => `${p.tools.length} tools, ${p.sources.length} sources`)(req) }),
    'GET /api/profile/export': async () => ({ __download: 'portable-profile.json', data: await store.load('device') }),
    'GET /api/overview': async () => {
      const [profile, statuses] = await Promise.all([store.load('device'), toolStatuses(registry.tools.tools)]);
      return buildOverview(profile, registry, statuses);
    },

    // ---- starter kits
    'GET /api/kits': async () => ({ kits: registry.kits.kits }),
    'POST /api/kits/apply': async (req) => {
      const kit = findIn(registry.kits.kits, assertId((await body(req)).id, 'id'), 'Kit');
      const [device, mcp] = await Promise.all([store.load('device'), store.load('mcp')]);
      const next = applyKit(kit, device, mcp, registry);
      // validate both before writing either, so a bad kit cannot half-apply
      const cleanDevice = store.validate('device', next.device);
      const cleanMcp = store.validate('mcp', next.mcp);
      await store.save('device', cleanDevice);
      await store.save('mcp', cleanMcp);
      const n = next.added;
      await activity.log('kit:apply', `${kit.name}: +${n.tools.length} tools, +${n.sources.length} sources, +${n.mcp.length} MCP`);
      return { added: n, profile: cleanDevice };
    },

    // ---- providers
    'GET /api/providers': async () => ({
      presets: registry.providers.presets, protocols: registry.providers.protocols, clients: PROVIDER_CLIENTS,
      ...(await store.load('providers'))
    }),
    'PUT /api/providers': saver('providers', (p) => `${p.profiles.length} provider profile(s)`),
    'POST /api/providers/snippet': async (req) => {
      const { id, client } = await body(req);
      return providerSnippet(findIn((await store.load('providers')).profiles, assertId(id, 'id'), 'Provider profile'), client);
    },
    'POST /api/providers/discovery': async (req) => {
      const { id } = await body(req);
      return discoveryCommand(findIn((await store.load('providers')).profiles, assertId(id, 'id'), 'Provider profile'));
    },
    'POST /api/providers/test': async (req) => {
      const { id } = await body(req);
      const profile = findIn((await store.load('providers')).profiles, assertId(id, 'id'), 'Provider profile');
      const result = await testProvider(profile);
      await activity.log('test:provider', `${profile.id}: ${result.ok ? 'ok' : 'failed'}${result.status ? ` (HTTP ${result.status})` : ''}`);
      return result;
    },

    // ---- skills
    'GET /api/skills': async () => ({
      assistants: registry.skills.assistants, sources: registry.skills.sources, updated: registry.skills.updated,
      ...(await store.load('skills'))
    }),
    'PUT /api/skills': saver('skills', (p) => `${p.selections.length} skill selection(s)`),
    'GET /api/skills/preview': async () => skillsPreview((await store.load('skills')).selections, registry),

    // ---- agents
    'GET /api/agents': async () => ({ formats: AGENT_FORMATS.map(({ id, name }) => ({ id, name })), ...(await store.load('agents')) }),
    'PUT /api/agents': saver('agents', (p) => `${p.profiles.length} agent profile(s)`),
    'POST /api/agents/export': async (req) => {
      const { id, format } = await body(req);
      return agentExport(findIn((await store.load('agents')).profiles, assertId(id, 'id'), 'Agent profile'), format);
    },

    // ---- MCP
    'GET /api/mcp': async () => ({ templates: registry.mcp.templates, clients: MCP_CLIENTS, ...(await store.load('mcp')) }),
    'PUT /api/mcp': saver('mcp', (p) => `${p.servers.length} MCP server(s)`),
    'POST /api/mcp/snippet': async (req) => {
      const { id, client } = await body(req);
      return mcpSnippet(findIn((await store.load('mcp')).servers, assertId(id, 'id'), 'MCP server profile'), client);
    },

    // ---- source checkouts and launching
    'GET /api/sources': async () => ({ sources: await sourceStatus(root, registry) }),
    'POST /api/sources/clone': async (req) => {
      const result = await cloneSource(root, registry, assertId((await body(req)).id, 'id'));
      await activity.log('source:clone', result.id);
      return result;
    },
    'POST /api/sources/update': async (req) => {
      const result = await updateSource(root, registry, assertId((await body(req)).id, 'id'));
      await activity.log('source:update', `${result.id}: ${result.skipped ?? (result.updated ? 'updated' : 'up to date')}`);
      return result;
    },
    'POST /api/launch': async (req) => {
      const result = await launchAssistant(root, registry, assertId((await body(req)).id, 'id'));
      await activity.log('launch', result.id);
      return result;
    },

    // ---- docker gateways (upstream compose files, fixed arguments)
    'GET /api/gateways': async () => gatewayStatus(root, registry),
    'POST /api/gateways/prepare': async (req) => {
      const result = await prepareGateway(root, registry, assertId((await body(req)).id, 'id'));
      await activity.log('gateway:prepare', `${result.id}: ${result.created ? 'created .env' : '.env already existed'}`);
      return result;
    },
    'POST /api/gateways/up': async (req) => {
      const result = await gatewayUp(root, registry, assertId((await body(req)).id, 'id'));
      await activity.log('gateway:start', result.id);
      return result;
    },
    'POST /api/gateways/down': async (req) => {
      const result = await gatewayDown(root, registry, assertId((await body(req)).id, 'id'));
      await activity.log('gateway:stop', result.id);
      return result;
    },
    'POST /api/gateways/logs': async (req) => gatewayLogs(root, registry, assertId((await body(req)).id, 'id')),

    // ---- sync (git), backups, activity, health
    'GET /api/git/status': async () => gitStatus(root),
    'GET /api/git/diff': async () => gitDiff(root),
    'POST /api/git/fetch': async () => {
      const r = await gitFetch(root);
      await activity.log('git:fetch', 'origin');
      return r;
    },
    'POST /api/git/pull': async () => {
      const r = await gitPull(root);
      await activity.log('git:pull', r.upToDate ? 'already up to date' : r.output);
      return r;
    },
    'POST /api/git/commit': async (req) => {
      const { message, push } = await body(req);
      if (push !== undefined && typeof push !== 'boolean') throw new ValidationError('push must be true or false.');
      const r = await gitCommitPush(root, { message, push: push === true });
      await activity.log('git:commit', `${r.committed.length} file(s)${r.pushed ? ', pushed' : r.pushError ? ', push failed' : ''}`);
      return r;
    },
    'GET /api/backups': async () => ({ backups: await store.listBackups() }),
    'POST /api/backups/restore': async (req) => {
      const result = await store.restoreBackup((await body(req)).file);
      await activity.log('backup:restore', `${result.kind} restored`);
      return { kind: result.kind };
    },
    'GET /api/activity': async (req) => {
      const limit = new URL(req.url, 'http://127.0.0.1').searchParams.get('limit');
      return { entries: await activity.recent(limit) };
    },
    'GET /api/doctor': async () => {
      const [profile, statuses, gitState, sources] = await Promise.all([
        store.load('device'), toolStatuses(registry.tools.tools), gitStatus(root), sourceStatus(root, registry)
      ]);
      return runDoctor({ store, overview: buildOverview(profile, registry, statuses), gitState, sources });
    }
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
