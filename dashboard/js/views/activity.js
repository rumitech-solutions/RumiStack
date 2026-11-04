import { h, api, icon, pageHeader, timeAgo, emptyState } from '../core.js';
import { activityIcon } from './overview.js';

export async function renderActivity(root, { navigate }) {
  const data = await api('GET', '/api/activity?limit=200');
  let filter = '';

  const groups = [...new Set(data.entries.map((e) => e.action.split(':')[0]))].sort();
  const chips = h('div', { class: 'chips', style: 'margin-bottom:14px', role: 'group', 'aria-label': 'Filter activity' });
  const list = h('div', { class: 'panel' });

  function draw() {
    chips.replaceChildren(...['', ...groups].map((g) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filter === g), onclick: () => { filter = g; draw(); } }, g || 'All')));
    const shown = data.entries.filter((e) => !filter || e.action.startsWith(`${filter}:`));
    list.replaceChildren(shown.length === 0
      ? emptyState('activity', 'Nothing here yet', 'Every save, sync, backup restore and provider test is journalled locally in logs/activity.jsonl.')
      : h('div', { class: 'timeline' }, shown.map((e, i) => {
        const item = h('div', { class: 'tl-item' }, h('span', { class: 'tl-dot' }, icon(activityIcon(e.action), 14)),
          h('div', { class: 'tl-body' }, h('strong', {}, e.action), h('p', {}, e.detail || '—')),
          h('span', { class: 'tl-time', title: e.ts }, timeAgo(e.ts)));
        item.style.setProperty('--i', String(Math.min(i, 14)));
        return item;
      })));
  }

  root.append(
    ...pageHeader('Activity', 'A local journal of what RumiStack changed on this laptop. It never records secrets, and it is not synced.', {
      iconName: 'activity',
      actions: [h('button', { class: 'btn', type: 'button', onclick: () => navigate('activity') }, icon('refresh', 15), 'Refresh')]
    }),
    chips, list
  );
  draw();
}
