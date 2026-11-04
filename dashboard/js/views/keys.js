import { h, api, icon, badge, pageHeader, loadInto, emptyState, copyText, codeBlock } from '../core.js';

export async function renderKeys(root, { navigate }) {
  const box = h('div', {});
  root.append(
    ...pageHeader('Keys', 'Which API-key environment variables your profiles use, and whether each one is set on this laptop. RumiStack only checks that a variable exists; it never reads, shows or stores the value.', {
      iconName: 'shield',
      actions: [h('button', { class: 'btn', type: 'button', onclick: () => navigate('keys') }, icon('refresh', 15), 'Re-check')]
    }),
    box
  );

  await loadInto(box, () => api('GET', '/api/keys'), ({ keys, missing }) => {
    if (keys.length === 0) {
      return h('div', { class: 'panel' }, emptyState('shield', 'No keys referenced yet', 'Add a provider profile or an MCP server that uses an environment variable, and it will be listed here.',
        [h('button', { class: 'btn primary', type: 'button', onclick: () => navigate('providers') }, 'Open Provider manager')]));
    }
    const out = [h('div', { class: `notice ${missing ? '' : 'info'}` }, icon(missing ? 'alert' : 'check', 16),
      h('span', {}, missing ? `${missing} of ${keys.length} variable(s) are not set on this laptop.` : `All ${keys.length} variable(s) are set on this laptop.`))];
    out.push(h('div', { style: 'height:14px' }));
    out.push(h('div', { class: 'grid' }, keys.map((k) => h('div', { class: 'card' },
      h('div', { class: 'row space' }, h('code', { style: 'word-break:break-all' }, k.name), k.set ? badge('set', 'ok') : badge('not set', 'warn')),
      h('p', {}, k.usedBy.map((u) => `${u.label} (${u.kind})`).join(', ')),
      k.set ? null : h('button', { class: 'btn small', type: 'button', onclick: (e) => copyText(`[Environment]::SetEnvironmentVariable('${k.name}', '<paste your key here>', 'User')`, e.currentTarget) }, icon('copy', 13), 'Copy PowerShell command')))));
    if (missing) {
      out.push(h('h2', {}, icon('terminal', 16), 'How to set a missing key'),
        h('div', { class: 'panel' },
          h('ol', { class: 'muted', style: 'margin:0 0 12px;padding-left:20px' },
            h('li', {}, 'Copy the command for the variable, open PowerShell, paste it and replace the placeholder with your real key.'),
            h('li', {}, 'Close and restart RumiStack (and any assistant) so it sees the new variable, then press Re-check.')),
          codeBlock("[Environment]::SetEnvironmentVariable('NAME', '<paste your key here>', 'User')", 'powershell'),
          h('p', { class: 'faint', style: 'margin:10px 0 0' }, 'The key stays in your Windows user environment. It is never written to RumiStack files or Git.')));
    }
    return out;
  });
}
