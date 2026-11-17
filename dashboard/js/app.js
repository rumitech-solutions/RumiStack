import { h, api, icon, toast, skeleton } from './core.js';
import { openPalette } from './palette.js';
import { renderGuides } from './views/guides.js';
import { renderSetup } from './views/setup.js';
import { renderOverview } from './views/overview.js';
import { renderCatalogue } from './views/catalogue.js';
import { renderDevice } from './views/device.js';
import { renderSync } from './views/sync.js';
import { renderLinks } from './views/links.js';
import { renderRepos } from './views/repos.js';
import { renderProviders } from './views/providers.js';
import { renderSkills } from './views/skills.js';
import { renderAgents } from './views/agents.js';
import { renderMcp } from './views/mcp.js';
import { renderActivity } from './views/activity.js';
import { renderKeys } from './views/keys.js';
import { renderProjects } from './views/projects.js';
import { renderPrompts } from './views/prompts.js';
import { renderSettings, showShortcuts } from './views/settings.js';
import { THEMES, getTheme, setTheme, applyPrefs } from './prefs.js';
applyPrefs();

const VIEWS = [
  { id: 'overview', label: 'Home', icon: 'home', group: 'Workspace', render: renderOverview },
  { id: 'setup', label: 'Setup wizard', icon: 'wand-sparkles', group: 'Workspace', render: renderSetup },
  { id: 'guides', label: 'Guides & help', icon: 'book-open', group: 'Workspace', render: renderGuides },
  { id: 'catalogue', label: 'Tool library', icon: 'grid', group: 'Workspace', render: renderCatalogue },
  { id: 'projects', label: 'Projects', icon: 'terminal', group: 'Workspace', render: renderProjects },
  { id: 'repos', label: 'Repositories', icon: 'layers', group: 'Workspace', render: renderRepos },
  { id: 'providers', label: 'AI providers', icon: 'server', group: 'AI setup', render: renderProviders },
  { id: 'skills', label: 'Skills', icon: 'sparkles', group: 'AI setup', render: renderSkills },
  { id: 'agents', label: 'Agents', icon: 'bot', group: 'AI setup', render: renderAgents },
  { id: 'mcp', label: 'MCP integrations', icon: 'plug', group: 'AI setup', render: renderMcp },
  { id: 'device', label: 'Setup profile', icon: 'laptop', group: 'More & advanced', render: renderDevice },
  { id: 'links', label: 'Saved resources', icon: 'file', group: 'More & advanced', render: renderLinks },
  { id: 'sync', label: 'Backup & sync', icon: 'git', group: 'More & advanced', render: renderSync },
  { id: 'prompts', label: 'Prompt library', icon: 'sparkles', group: 'More & advanced', render: renderPrompts },
  { id: 'keys', label: 'API keys', icon: 'shield', group: 'More & advanced', render: renderKeys },
  { id: 'activity', label: 'Activity', icon: 'activity', group: 'More & advanced', render: renderActivity },
  { id: 'settings', label: 'Settings', icon: 'cpu', group: 'More & advanced', render: renderSettings }
];

// ---------------------------------------------------------------- theme

// ---------------------------------------------------------------- shell

const themeBtn = h('button', { class: 'icon-btn', type: 'button', onclick: cycleTheme });
function paintThemeButton() {
  const t = getTheme();
  themeBtn.replaceChildren(icon(t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'auto', 17));
  themeBtn.title = `Theme: ${t} (click to change)`;
  themeBtn.setAttribute('aria-label', `Theme: ${t}. Click to change.`);
}
function cycleTheme() {
  setTheme(THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length]);
  toast(`Theme: ${getTheme()}`);
}
document.addEventListener('rumistack-theme', () => paintThemeButton());

const crumb = h('strong', {}, 'Overview');
const statusPill = h('span', { class: 'status-pill', role: 'status' }, h('i'), 'Local server');
const main = h('main', { id: 'main', tabindex: '-1' });
const versionLabel = h('small', {}, 'loading…');
const navButtons = new Map();
const syncPip = h('span', { class: 'pip', hidden: true });

const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' });
let lastGroup = null;
let groupNode = null;
for (const v of VIEWS) {
  if (v.group !== lastGroup) {
    lastGroup = v.group;
    groupNode = h('details', { class: 'nav-section', open: v.group !== 'More & advanced' },
      h('summary', { class: 'nav-label' }, v.group));
    nav.append(groupNode);
  }
  const btn = h('button', { class: 'nav-item', type: 'button', onclick: () => navigate(v.id) }, icon(v.icon, 18), h('span', {}, v.label), v.id === 'sync' ? syncPip : null);
  navButtons.set(v.id, btn);
  groupNode.append(btn);
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
      themeBtn,
      h('button', { class: 'icon-btn', type: 'button', title: 'Settings', 'aria-label': 'Settings', onclick: () => navigate('settings') }, icon('cpu', 17)),
      statusPill),
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
  for (const section of nav.querySelectorAll('.nav-section')) section.open = section.contains(navButtons.get(id));
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
  { label: 'Start setup wizard', icon: 'wand-sparkles', keywords: 'first run onboarding setup', run: () => navigate('setup') },
  { label: 'Keyboard shortcuts', icon: 'command', keywords: 'keys help hotkeys', run: showShortcuts },
  { label: 'Export a bundle of all profiles', icon: 'download', keywords: 'backup move laptop', run: () => navigate('settings') },
  { label: 'Toggle theme (auto / light / dark)', icon: 'sun', keywords: 'dark light appearance', run: cycleTheme },
  { label: 'Check tools for updates', icon: 'refresh', keywords: 'outdated versions npm', run: () => navigate('catalogue', { check: '1' }) },
  { label: 'Apply a starter kit', icon: 'layers', keywords: 'bundle preset', run: () => navigate('device') },
  { label: 'Commit and push config', icon: 'push', keywords: 'git sync', run: () => navigate('sync') },
  { label: 'Restore a config backup', icon: 'restore', keywords: 'undo rollback', run: () => navigate('sync') }
];
function palette() { openPalette({ views: VIEWS, navigate, actions }); }
const GO = { u: 'setup', j: 'projects', y: 'keys', i: 'prompts', o: 'overview', c: 'catalogue', d: 'device', r: 'repos', l: 'links', s: 'sync', g: 'guides', p: 'providers', k: 'skills', a: 'agents', m: 'mcp', h: 'activity' };
let chord = null;
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') || document.activeElement?.isContentEditable;
  if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (chord) {
    clearTimeout(chord);
    chord = null;
    const target = GO[e.key.toLowerCase()];
    if (target) { e.preventDefault(); navigate(target); }
    return;
  }
  if (e.key === '/') { e.preventDefault(); palette(); }
  else if (e.key === '?') { e.preventDefault(); showShortcuts(); }
  else if (e.key === 't') { cycleTheme(); }
  else if (e.key === 'g') { chord = setTimeout(() => { chord = null; }, 1200); }
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
