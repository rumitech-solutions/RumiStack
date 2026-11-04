import { h, api, icon, toast, skeleton } from './core.js';
import { openPalette } from './palette.js';
import { renderOverview } from './views/overview.js';
import { renderCatalogue } from './views/catalogue.js';
import { renderDevice } from './views/device.js';
import { renderSync } from './views/sync.js';
import { renderRepos } from './views/repos.js';
import { renderGateways } from './views/gateways.js';
import { renderProviders } from './views/providers.js';
import { renderSkills } from './views/skills.js';
import { renderAgents } from './views/agents.js';
import { renderMcp } from './views/mcp.js';
import { renderActivity } from './views/activity.js';

const VIEWS = [
  { id: 'overview', label: 'Overview', icon: 'home', group: 'Workspace', render: renderOverview },
  { id: 'catalogue', label: 'Catalogue', icon: 'grid', group: 'Workspace', render: renderCatalogue },
  { id: 'device', label: 'Device sync', icon: 'laptop', group: 'Workspace', render: renderDevice },
  { id: 'repos', label: 'Repositories', icon: 'layers', group: 'Workspace', render: renderRepos },
  { id: 'sync', label: 'Sync & backups', icon: 'git', group: 'Workspace', render: renderSync },
  { id: 'gateways', label: 'Gateways (Docker)', icon: 'box', group: 'Configure', render: renderGateways },
  { id: 'providers', label: 'Provider manager', icon: 'server', group: 'Configure', render: renderProviders },
  { id: 'skills', label: 'Skills marketplace', icon: 'sparkles', group: 'Configure', render: renderSkills },
  { id: 'agents', label: 'Agent manager', icon: 'bot', group: 'Configure', render: renderAgents },
  { id: 'mcp', label: 'MCP servers', icon: 'plug', group: 'Configure', render: renderMcp },
  { id: 'activity', label: 'Activity', icon: 'activity', group: 'System', render: renderActivity }
];

// ---------------------------------------------------------------- theme

const THEMES = ['auto', 'light', 'dark'];
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'auto';
}
function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { if (theme === 'auto') localStorage.removeItem('rumistack-theme'); else localStorage.setItem('rumistack-theme', theme); } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------- shell

const themeBtn = h('button', { class: 'icon-btn', type: 'button', onclick: cycleTheme });
function paintThemeButton() {
  const t = currentTheme();
  themeBtn.replaceChildren(icon(t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'auto', 17));
  themeBtn.title = `Theme: ${t} (click to change)`;
  themeBtn.setAttribute('aria-label', `Theme: ${t}. Click to change.`);
}
function cycleTheme() {
  applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);
  paintThemeButton();
  toast(`Theme: ${currentTheme()}`);
}

const crumb = h('strong', {}, 'Overview');
const statusPill = h('span', { class: 'status-pill', role: 'status' }, h('i'), 'Local server');
const main = h('main', { id: 'main', tabindex: '-1' });
const versionLabel = h('small', {}, 'loading…');
const navButtons = new Map();
const syncPip = h('span', { class: 'pip', hidden: true });

const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' });
let lastGroup = null;
for (const v of VIEWS) {
  if (v.group !== lastGroup) { lastGroup = v.group; nav.append(h('div', { class: 'nav-label' }, v.group)); }
  const btn = h('button', { class: 'nav-item', type: 'button', onclick: () => navigate(v.id) }, icon(v.icon, 18), h('span', {}, v.label), v.id === 'sync' ? syncPip : null);
  navButtons.set(v.id, btn);
  nav.append(btn);
}

const app = document.getElementById('app');
app.replaceChildren(h('div', { class: 'shell' },
  h('aside', { class: 'sidebar' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, icon('logo', 22)), h('div', {}, h('strong', {}, 'RumiStack'), versionLabel)),
    nav,
    h('div', { class: 'sidebar-foot' }, h('p', { class: 'sidebar-note' }, 'Local only · 127.0.0.1', h('br'), 'Secrets are never stored here.'))),
  h('div', { class: 'content' },
    h('header', { class: 'topbar' },
      h('div', { class: 'crumbs' }, 'RumiStack', icon('chevron', 14), crumb),
      h('div', { class: 'spacer' }),
      h('button', { class: 'search-trigger', type: 'button', onclick: () => palette(), 'aria-label': 'Open command palette' }, icon('search', 16), h('span', {}, 'Search or jump to…'), h('kbd', {}, 'Ctrl K')),
      themeBtn, statusPill),
    main)));
paintThemeButton();

// ---------------------------------------------------------------- routing

function parseHash() {
  const raw = location.hash.slice(1);
  const [id, query = ''] = raw.split('?');
  return { id: VIEWS.some((v) => v.id === id) ? id : 'overview', params: Object.fromEntries(new URLSearchParams(query)) };
}

function navigate(id, params) {
  const query = params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : '';
  const next = `#${id}${query}`;
  if (location.hash === next) show(); else location.hash = next;
}

let token = 0;
async function show() {
  const { id, params } = parseHash();
  const view = VIEWS.find((v) => v.id === id);
  const mine = ++token;
  for (const [vid, btn] of navButtons) {
    if (vid === id) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  }
  crumb.textContent = view.label;
  document.title = `${view.label} · RumiStack`;
  main.replaceChildren(h('div', { class: 'view' }, skeleton(4)));
  try {
    const content = h('div', { class: 'view' });
    await view.render(content, { navigate, params });
    if (mine !== token) return; // a newer navigation won
    main.replaceChildren(content);
  } catch (err) {
    if (mine !== token) return;
    main.replaceChildren(h('div', { class: 'view' }, h('div', { class: 'notice' }, icon('alert', 16), h('span', {}, `Could not load this view: ${err.message}`))));
  }
  window.scrollTo({ top: 0 });
  main.focus({ preventScroll: true });
  refreshSyncPip();
}
window.addEventListener('hashchange', show);

// ---------------------------------------------------------------- palette + shortcuts

const actions = [
  { label: 'Toggle theme (auto / light / dark)', icon: 'sun', keywords: 'dark light appearance', run: cycleTheme },
  { label: 'Check tools for updates', icon: 'refresh', keywords: 'outdated versions npm', run: () => navigate('catalogue', { check: '1' }) },
  { label: 'Apply a starter kit', icon: 'layers', keywords: 'bundle preset', run: () => navigate('device') },
  { label: 'Commit and push config', icon: 'push', keywords: 'git sync', run: () => navigate('sync') },
  { label: 'Restore a config backup', icon: 'restore', keywords: 'undo rollback', run: () => navigate('sync') }
];
function palette() { openPalette({ views: VIEWS, navigate, actions }); }
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
  else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') && !document.querySelector('dialog[open]')) { e.preventDefault(); palette(); }
});

// ---------------------------------------------------------------- live status

async function refreshSyncPip() {
  try {
    const st = await api('GET', '/api/git/status');
    const n = st.repo ? st.configChanges.length : 0;
    syncPip.hidden = n === 0;
    syncPip.textContent = String(n);
    syncPip.title = `${n} uncommitted config change(s)`;
  } catch { /* the pip is a convenience */ }
}

async function heartbeat() {
  try {
    const meta = await api('GET', '/api/meta');
    versionLabel.textContent = `v${meta.version} · ${meta.platform}`;
    statusPill.className = 'status-pill';
    statusPill.replaceChildren(h('i'), 'Local server');
  } catch {
    statusPill.className = 'status-pill offline';
    statusPill.replaceChildren(h('i'), 'Server offline');
  }
}
heartbeat();
setInterval(heartbeat, 15000);
show();
