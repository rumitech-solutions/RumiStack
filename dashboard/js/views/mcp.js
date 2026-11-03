import { h, api, attempt, field, checkboxes, readChecked, pageHeader, codeBlock, notes, badge, toast } from '../core.js';

export async function renderMcp(root) {
  const data = await api('GET', '/api/mcp');
  let servers = data.servers;
  let editing = null;

  const idIn = h('input', { type: 'text', placeholder: 'context7' });
  const nameIn = h('input', { type: 'text', placeholder: 'Context7' });
  const transport = h('select', {}, h('option', { value: 'stdio' }, 'stdio (local command)'), h('option', { value: 'http' }, 'Streamable HTTP (remote)'));
  const cmdIn = h('input', { type: 'text', placeholder: 'npx' });
  const argsIn = h('textarea', { rows: 3, placeholder: '-y\n@upstash/context7-mcp' });
  const urlIn = h('input', { type: 'text', placeholder: 'https://example.com/mcp' });
  const envIn = h('input', { type: 'text', placeholder: 'CONTEXT7_API_KEY, OTHER_VAR' });
  const headerIn = h('textarea', { rows: 2, placeholder: 'Authorization=GITHUB_PERSONAL_ACCESS_TOKEN' });
  const stdioFields = h('div', { class: 'form-grid' }, field('Command', cmdIn, 'A bare executable name (npx, uvx, node…). No paths or spaces.'), field('Arguments', argsIn, 'One per line.'));
  const httpFields = h('div', {}, field('URL', urlIn, 'HTTPS (HTTP only for localhost).'), field('Header = ENV_VAR_NAME', headerIn, 'Headers filled from environment variables, one per line.'));
  let clientBox = checkboxes(data.clients, data.clients.map((c) => c.id), 'clients');
  const clientHolder = h('div', {}, clientBox);
  const listBox = h('div', {});
  const outBox = h('div', {});

  function sync() {
    const http = transport.value === 'http';
    stdioFields.hidden = http;
    httpFields.hidden = !http;
  }
  transport.addEventListener('change', sync);

  function fill(s) {
    idIn.value = s.id; nameIn.value = s.name; transport.value = s.transport;
    cmdIn.value = s.command ?? ''; argsIn.value = (s.args ?? []).join('\n'); urlIn.value = s.url ?? '';
    envIn.value = (s.envVars ?? []).join(', ');
    headerIn.value = Object.entries(s.headerEnv ?? {}).map(([k, v]) => `${k}=${v}`).join('\n');
    clientBox = checkboxes(data.clients, s.clients?.length ? s.clients : data.clients.map((c) => c.id), 'clients');
    clientHolder.replaceChildren(clientBox);
    sync();
  }

  function formServer() {
    const headerEnv = {};
    for (const line of headerIn.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
      const i = line.indexOf('=');
      if (i < 1) throw new Error(`Header line "${line}" must look like Header=ENV_VAR_NAME.`);
      headerEnv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    const s = {
      id: idIn.value.trim(), name: nameIn.value.trim(), transport: transport.value,
      envVars: envIn.value.split(',').map((v) => v.trim()).filter(Boolean),
      clients: readChecked(clientBox, 'clients')
    };
    if (s.transport === 'stdio') { s.command = cmdIn.value.trim(); s.args = argsIn.value.split(/\r?\n/).map((a) => a.trim()).filter(Boolean); }
    else { s.url = urlIn.value.trim(); s.headerEnv = headerEnv; }
    return s;
  }

  async function persist(next, message) {
    const res = await attempt(() => api('PUT', '/api/mcp', { schemaVersion: 1, servers: next }), message);
    if (res) { servers = res.servers; drawList(); return true; }
    return false;
  }

  async function save() {
    let s;
    try { s = formServer(); } catch (err) { toast(err.message, 'error'); return; }
    if (!editing && servers.some((x) => x.id === s.id)) { toast(`A server with id "${s.id}" already exists. Select it to edit.`, 'error'); return; }
    const others = servers.filter((x) => x.id !== (editing ?? s.id));
    if (await persist([...others, s], 'MCP profile saved. Nothing was installed or started.')) editing = s.id;
  }

  async function snippet(client) {
    if (!editing) { toast('Save and select a server first.', 'error'); return; }
    const res = await attempt(() => api('POST', '/api/mcp/snippet', { id: editing, client }));
    if (res) outBox.replaceChildren(h('h2', {}, `Config for ${client}`), res.filename ? h('p', { class: 'muted' }, `Target file: ${res.filename}`) : null, codeBlock(res.snippet), ...notes(res.notes));
  }

  function drawList() {
    listBox.replaceChildren(...(servers.length === 0
      ? [h('div', { class: 'empty' }, 'No MCP profiles yet. Start from a template below.')]
      : servers.map((s) => h('div', { class: 'list-item', 'aria-selected': String(s.id === editing), onclick: () => { editing = s.id; fill(s); outBox.replaceChildren(); drawList(); } },
        h('div', {}, h('strong', {}, s.name), h('div', { class: 'muted' }, s.transport === 'http' ? s.url : `${s.command} ${s.args.join(' ')}`)),
        h('div', { class: 'row' }, badge(s.transport),
          h('button', { class: 'btn small danger', type: 'button', onclick: async (e) => { e.stopPropagation(); if (await persist(servers.filter((x) => x.id !== s.id), 'MCP profile removed') && editing === s.id) editing = null; } }, 'Delete'))))));
  }

  root.append(
    ...pageHeader('MCP server manager', 'Portable MCP definitions with per-client config previews. Saving a profile is not installation, connection or a health check.'),
    h('div', { class: 'notice' }, 'RumiStack never starts an MCP process, installs a package, performs OAuth or edits a client config. Credentials are referenced by environment-variable NAME only, so re-authenticate on each laptop.'),
    h('h2', {}, 'Saved servers'), listBox,
    h('h2', {}, 'Templates'),
    h('div', { class: 'row' }, data.templates.map((t) => h('button', { class: 'btn', type: 'button', title: t.description, onclick: () => { editing = null; fill({ ...t, id: t.id, clients: data.clients.map((c) => c.id) }); drawList(); } }, t.name))),
    h('div', { class: 'panel' },
      h('div', { class: 'form-grid' }, field('ID', idIn, 'Lowercase letters, digits, hyphens.'), field('Name', nameIn), field('Transport', transport)),
      stdioFields, httpFields,
      field('Environment variables the server needs', envIn, 'Names only, comma-separated.'),
      field('Show snippets for', clientHolder),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save MCP profile'))),
    h('h2', {}, 'Generate client config'),
    h('div', { class: 'row' }, data.clients.map((c) => h('button', { class: 'btn', type: 'button', onclick: () => snippet(c.id) }, c.name))),
    outBox
  );
  sync();
  drawList();
}
