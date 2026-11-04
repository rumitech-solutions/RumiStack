import { h, api, icon, badge, codeBlock, loadInto, pageHeader, statusIcon, timeAgo, emptyState } from '../core.js';
import { svgEl } from '../icons.js';

const ACTIVITY_ICON = { save: 'save', git: 'git', kit: 'layers', backup: 'restore', source: 'download', launch: 'play', test: 'zap', check: 'refresh' };

export function activityIcon(action) {
  return ACTIVITY_ICON[String(action).split(':')[0]] ?? 'activity';
}

function healthRing(score) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const svg = svgEl('svg', { viewBox: '0 0 132 132', width: 132, height: 132, 'aria-hidden': 'true' });
  const defs = svgEl('defs', {});
  const grad = svgEl('linearGradient', { id: 'ring-grad', x1: '0', y1: '0', x2: '1', y2: '1' });
  const s1 = svgEl('stop', { offset: '0' });
  const s2 = svgEl('stop', { offset: '1' });
  s1.style.stopColor = 'var(--accent)';
  s2.style.stopColor = 'var(--accent-2)';
  grad.append(s1, s2);
  defs.append(grad);
  const track = svgEl('circle', { class: 'track', cx: 66, cy: 66, r: R, fill: 'none', 'stroke-width': 10 });
  const bar = svgEl('circle', { class: 'bar', cx: 66, cy: 66, r: R, fill: 'none', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C });
  bar.style.stroke = score >= 85 ? 'url(#ring-grad)' : score >= 60 ? 'var(--warn)' : 'var(--bad)';
  svg.append(defs, track, bar);
  requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dashoffset', String(C * (1 - score / 100)))));
  return h('div', { class: 'ring' }, svg, h('div', { class: 'ring-label' }, h('b', {}, score), h('span', {}, 'health')));
}

export async function renderOverview(root, { navigate }) {
  const hero = h('div', {});
  const stats = h('div', {});
  const checks = h('div', {});
  const recent = h('div', {});
  const laptop = h('div', {});

  root.append(
    ...pageHeader('Overview', 'This laptop compared with your portable profile, plus the health of your RumiStack setup.', {
      iconName: 'home',
      actions: [h('button', { class: 'btn', type: 'button', onclick: () => navigate('overview') }, icon('refresh', 15), 'Refresh')]
    }),
    hero, stats,
    h('div', { class: 'two-col' },
      h('div', {}, h('h2', {}, icon('heart', 16), 'Health checks'), h('div', { class: 'panel' }, checks)),
      h('div', {}, h('h2', {}, icon('activity', 16), 'Recent activity'), h('div', { class: 'panel' }, recent),
        h('div', { class: 'row' }, h('button', { class: 'btn small ghost', type: 'button', onclick: () => navigate('activity') }, 'View all activity', icon('chevron', 14))))),
    h('h2', {}, icon('laptop', 16), 'This laptop vs your profile'),
    h('div', { class: 'panel' }, laptop)
  );

  // Independent requests: each section fills in as soon as its data arrives. The doctor report feeds two
  // sections, so it is requested once and shared.
  let doctorPromise;
  let overviewPromise;
  const doctor = () => (doctorPromise ??= api('GET', '/api/doctor'));
  const overview = () => (overviewPromise ??= api('GET', '/api/overview'));

  loadInto(hero, doctor, (d) => {
    const fails = d.checks.filter((c) => c.status === 'fail').length;
    const warns = d.checks.filter((c) => c.status === 'warn').length;
    const title = d.score >= 90 ? 'Everything looks healthy' : d.score >= 65 ? 'A few things need attention' : 'Setup needs attention';
    const summary = fails + warns === 0 ? 'All checks passed. Your profile, tools and sync are in good shape.'
      : `${fails} failing and ${warns} warning check(s). Details are listed below with the command that fixes each one.`;
    return h('section', { class: 'hero' }, healthRing(d.score),
      h('div', {}, h('h2', {}, title), h('p', {}, summary),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => navigate('device') }, icon('layers', 15), 'Apply a starter kit'),
          h('button', { class: 'btn', type: 'button', onclick: () => navigate('sync') }, icon('git', 15), 'Sync config'))));
  });

  const order = { fail: 0, warn: 1, ok: 2, info: 3 };
  loadInto(checks, doctor, (d) => d.checks.slice().sort((a, b) => order[a.status] - order[b.status]).map((c) =>
    h('div', { class: 'check-row' }, statusIcon(c.status),
      h('div', { class: 'grow' }, h('strong', {}, c.label), h('p', {}, c.detail), c.fix ? codeBlock(c.fix, 'fix') : null))));

  loadInto(recent, () => api('GET', '/api/activity?limit=6'), (a) => a.entries.length === 0
    ? emptyState('activity', 'No activity yet', 'Saves, syncs and restores appear here as you use RumiStack.')
    : h('div', { class: 'timeline' }, a.entries.map((e) =>
      h('div', { class: 'tl-item' }, h('span', { class: 'tl-dot' }, icon(activityIcon(e.action), 14)),
        h('div', { class: 'tl-body' }, h('strong', {}, e.action), h('p', {}, e.detail)), h('span', { class: 'tl-time' }, timeAgo(e.ts))))));

  loadInto(stats, overview, (o) => {
    const c = o.counts;
    const tile = (n, label, iconName, kind) => h('div', { class: `stat ${kind}` }, h('span', { class: 'stat-icon' }, icon(iconName, 20)), h('div', {}, h('b', {}, n), h('span', {}, label)));
    return h('div', { class: 'stats' },
      tile(c.selected, 'tools in profile', 'layers', ''), tile(c.installed, 'installed here', 'check', 'ok'),
      tile(c.missing, 'missing', 'alert', c.missing ? 'bad' : 'ok'), tile(c.undetectable, 'check manually', 'info', c.undetectable ? 'warn' : ''));
  });

  loadInto(laptop, overview, (o) => {
    if (o.items.length === 0) {
      return emptyState('laptop', 'Your device profile is empty', 'Pick tools yourself or start from a kit.',
        h('button', { class: 'btn primary', type: 'button', onclick: () => navigate('device') }, 'Choose tools'));
    }
    const restore = o.counts.missing > 0;
    return [
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Tool', 'Category', 'Installer', 'Status', 'Next step'].map((t) => h('th', {}, t)))),
        h('tbody', {}, o.items.map((i) => h('tr', {},
          h('td', {}, h('strong', {}, i.name)), h('td', { class: 'muted' }, i.category), h('td', {}, badge(i.installType)),
          h('td', {}, i.installed === true ? badge('installed', 'ok') : i.installed === false ? badge('missing', 'bad') : badge('not detectable', 'warn')),
          h('td', { class: 'muted' }, i.action)))))),
      restore ? h('div', {}, h('h2', {}, icon('terminal', 16), 'Restore what is missing'),
        h('p', { class: 'muted' }, 'Preview first, then confirm each action. Open a new PowerShell window in the RumiStack folder:'),
        codeBlock('.\\scripts\\Restore-Profile.ps1 -WhatIf\n.\\scripts\\Restore-Profile.ps1 -Confirm', 'powershell')) : null
    ];
  });
}
