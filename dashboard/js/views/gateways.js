import { h, api, attempt, icon, badge, avatar, codeBlock, confirmDialog, modal, pageHeader, loadInto, emptyState, toast } from '../core.js';

function stateBadge(g) {
  if (!g.cloned) return badge('not cloned', '');
  if (g.running) return badge('running', 'ok');
  if (g.containers.length) return badge('stopped', 'warn');
  return badge('not started', '');
}

export async function renderGateways(root, { navigate }) {
  const box = h('div', {});
  root.append(
    ...pageHeader('Gateways', 'Run self-hosted gateways in Docker straight from their own upstream compose files. Ports stay on 127.0.0.1 and nothing is exposed to your network.', {
      iconName: 'box',
      actions: [h('button', { class: 'btn', type: 'button', onclick: () => navigate('gateways') }, icon('refresh', 15), 'Refresh')]
    }),
    box
  );

  await loadInto(box, () => api('GET', '/api/gateways'), ({ docker, gateways }) => {
    const out = [];
    if (!docker.cli) {
      out.push(h('div', { class: 'notice' }, icon('alert', 16), h('span', {}, 'Docker was not found on this laptop. Install Docker Desktop (winget install --id Docker.DockerDesktop --exact), start it, then refresh.')));
    } else if (!docker.compose) {
      out.push(h('div', { class: 'notice' }, icon('alert', 16), h('span', {}, 'Docker is installed but the compose plugin is missing. Update Docker Desktop.')));
    } else if (!docker.daemon) {
      out.push(h('div', { class: 'notice' }, icon('alert', 16), h('span', {}, 'The Docker engine is not running. Start Docker Desktop, then refresh.')));
    } else {
      out.push(h('div', { class: 'notice info' }, icon('check', 16), h('span', {}, `Docker engine ${docker.engineVersion} with Compose ${docker.composeVersion} is ready.`)));
    }
    out.push(h('div', { style: 'height:14px' }));

    const usable = docker.cli && docker.compose && docker.daemon;
    out.push(h('div', { class: 'grid' }, gateways.map((g) => card(g, usable, navigate))));
    return out;
  });
}

function card(g, usable, navigate) {
  const run = async (label, path, success) => {
    toast(`${label}… this can take a while on the first run.`, 'info');
    if (await attempt(() => api('POST', path, { id: g.id }), success)) navigate('gateways');
  };

  async function prepare() {
    const res = await attempt(() => api('POST', '/api/gateways/prepare', { id: g.id }));
    if (!res) return;
    toast(res.created ? `.env created${res.generated.length ? ` and ${res.generated.join(', ')} generated locally` : ''}. Review it before starting.` : '.env already exists', 'ok');
    navigate('gateways');
  }

  async function start() {
    const ok = await confirmDialog({
      title: `Start ${g.name}?`,
      message: `Runs docker compose up -d in sources/${g.id}. The first start may download or build images.`,
      details: g.note ? h('p', { class: 'muted' }, g.note) : null,
      confirmLabel: 'Start'
    });
    if (ok) run(`Starting ${g.name}`, '/api/gateways/up', `${g.name} started`);
  }

  async function stop() {
    const ok = await confirmDialog({ title: `Stop ${g.name}?`, message: 'Stops and removes the containers. Data volumes are kept.', confirmLabel: 'Stop', danger: true });
    if (ok) run(`Stopping ${g.name}`, '/api/gateways/down', `${g.name} stopped`);
  }

  async function logs() {
    const res = await attempt(() => api('POST', '/api/gateways/logs', { id: g.id }));
    if (!res) return;
    await modal({ title: `${g.name} logs`, wide: true, body: [codeBlock(res.logs || '(no output)', 'logs'), res.truncated ? h('p', { class: 'faint' }, 'Showing the last 64 KB.') : null], actions: [{ label: 'Close', value: true, kind: 'primary' }] });
  }

  const actions = [];
  if (!g.cloned) {
    actions.push(h('button', { class: 'btn small primary', type: 'button', onclick: async () => {
      if (await attempt(() => api('POST', '/api/sources/clone', { id: g.id }), `Cloned ${g.name}`)) navigate('gateways');
    } }, icon('download', 13), 'Clone source'));
  } else {
    if (!g.envReady) actions.push(h('button', { class: 'btn small', type: 'button', disabled: !g.composeFile, onclick: prepare }, icon('file', 13), 'Prepare .env'));
    if (g.running) {
      actions.push(h('button', { class: 'btn small danger', type: 'button', disabled: !usable, onclick: stop }, icon('x', 13), 'Stop'));
      actions.push(h('a', { class: 'btn small', href: g.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 13), 'Open'));
    } else {
      actions.push(h('button', { class: 'btn small primary', type: 'button', disabled: !usable || !g.envReady || !g.composeFile, onclick: start }, icon('play', 13), 'Start'));
    }
    if (g.containers.length) actions.push(h('button', { class: 'btn small', type: 'button', disabled: !usable, onclick: logs }, icon('terminal', 13), 'Logs'));
  }

  return h('div', { class: 'card' },
    h('div', { class: 'row space' }, h('div', { class: 'row' }, avatar(g.id, g.name), h('strong', {}, g.name)), stateBadge(g)),
    h('p', { class: 'muted' }, g.description),
    g.cloned && !g.composeFile ? h('div', { class: 'notice' }, icon('alert', 16), h('span', {}, 'No compose file found in the checkout. The upstream layout may have changed.')) : null,
    g.exposed ? h('div', { class: 'notice' }, icon('alert', 16), h('span', {}, 'Your .env publishes this gateway beyond 127.0.0.1. Set the bind host back to 127.0.0.1 unless you really need LAN access.')) : null,
    g.containers.length ? h('div', { class: 'row', style: 'flex-wrap:wrap' }, g.containers.map((c) => badge(`${c.service}: ${c.state}${c.health ? ` (${c.health})` : ''}`, c.state === 'running' ? 'ok' : 'warn'))) : null,
    h('dl', { class: 'kv' }, h('dt', {}, 'Default URL'), h('dd', {}, g.url), h('dt', {}, 'Environment'), h('dd', {}, g.envReady ? '.env present (local only)' : 'not prepared')),
    h('div', { class: 'row', style: 'margin-top:12px;flex-wrap:wrap' }, actions));
}
