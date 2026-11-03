import { h, api, toast } from './core.js';
import { renderOverview } from './views/overview.js';
import { renderCatalogue } from './views/catalogue.js';
import { renderDevice } from './views/device.js';
import { renderProviders } from './views/providers.js';
import { renderSkills } from './views/skills.js';
import { renderAgents } from './views/agents.js';
import { renderMcp } from './views/mcp.js';

const VIEWS = [
  { id: 'overview', label: 'Overview', render: renderOverview },
  { id: 'catalogue', label: 'Catalogue', render: renderCatalogue },
  { id: 'device', label: 'Device sync', render: renderDevice },
  { id: 'providers', label: 'Provider manager', render: renderProviders },
  { id: 'skills', label: 'Skills marketplace', render: renderSkills },
  { id: 'agents', label: 'Agent manager', render: renderAgents },
  { id: 'mcp', label: 'MCP servers', render: renderMcp }
];

const main = document.getElementById('main');
const nav = document.getElementById('nav');

async function show(id) {
  const view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
  for (const btn of nav.children) {
    if (btn.dataset.view === view.id) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  main.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
  try {
    const content = h('div', {});
    await view.render(content, { navigate });
    main.replaceChildren(content);
  } catch (err) {
    main.replaceChildren(h('div', { class: 'notice' }, `Could not load this view: ${err.message}`));
  }
  main.focus();
}

function navigate(id) {
  if (location.hash !== `#${id}`) location.hash = id;
  else show(id);
}

for (const v of VIEWS) {
  nav.append(h('button', { type: 'button', 'data-view': v.id, onclick: () => navigate(v.id) }, v.label));
}
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

try {
  const meta = await api('GET', '/api/meta');
  document.getElementById('version').textContent = `v${meta.version} · ${meta.platform}`;
} catch (err) {
  toast(`Cannot reach the RumiStack server: ${err.message}`, 'error');
}
show(location.hash.slice(1));
