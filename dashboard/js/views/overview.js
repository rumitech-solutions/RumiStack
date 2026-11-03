import { h, api, attempt, badge, codeBlock, pageHeader } from '../core.js';

export async function renderOverview(root, { navigate }) {
  const data = await api('GET', '/api/overview');
  const { counts, items } = data;

  root.append(
    ...pageHeader('Overview', 'This laptop compared with your portable profile: what is installed, what is missing and what needs a manual step.'),
    h('div', { class: 'stats' },
      stat(counts.selected, 'tools in profile'),
      stat(counts.installed, 'installed'),
      stat(counts.missing, 'missing'),
      stat(counts.undetectable, 'check manually'))
  );

  if (items.length === 0) {
    root.append(h('div', { class: 'empty' }, 'Your device profile is empty. ', h('button', { class: 'btn small', type: 'button', onclick: () => navigate('device') }, 'Choose tools')));
    return;
  }

  root.append(h('div', { class: 'panel' }, h('table', {},
    h('thead', {}, h('tr', {}, ['Tool', 'Category', 'Installer', 'Status', 'Next step'].map((t) => h('th', {}, t)))),
    h('tbody', {}, items.map((i) => h('tr', {},
      h('td', {}, i.name),
      h('td', { class: 'muted' }, i.category),
      h('td', {}, badge(i.installType)),
      h('td', {}, i.installed === true ? badge('installed', 'ok') : i.installed === false ? badge('missing', 'bad') : badge('not detectable', 'warn')),
      h('td', { class: 'muted' }, i.action)))))));

  if (counts.missing > 0) {
    root.append(
      h('h2', {}, 'Restore what is missing'),
      h('p', { class: 'muted' }, 'Preview first, then confirm each action. Open a new PowerShell window in the RumiStack folder:'),
      codeBlock('.\\scripts\\Restore-Profile.ps1 -WhatIf\n.\\scripts\\Restore-Profile.ps1 -Confirm')
    );
  }

  root.append(h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => attempt(async () => { navigate('overview'); }) }, 'Refresh')));
}

function stat(value, label) {
  return h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label));
}
