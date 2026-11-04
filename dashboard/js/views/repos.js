import { h, api, attempt, icon, badge, avatar, confirmDialog, pageHeader, loadInto, emptyState, copyText, toast } from '../core.js';

export async function renderRepos(root, { navigate }) {
  const box = h('div', {});
  const input = h('input', { type: 'url', placeholder: 'https://github.com/owner/repository', 'aria-label': 'GitHub repository link', autocomplete: 'off', spellcheck: 'false' });
  const addBtn = h('button', { class: 'btn primary', type: 'button' }, icon('plus', 15), 'Add & clone');

  async function add() {
    if (!input.value.trim()) return;
    addBtn.disabled = true;
    addBtn.replaceChildren(icon('refresh', 15), 'Cloning…');
    const res = await attempt(() => api('POST', '/api/repos/add', { url: input.value }), 'Repository added');
    addBtn.disabled = false;
    addBtn.replaceChildren(icon('plus', 15), 'Add & clone');
    if (res) { input.value = ''; navigate('repos'); }
  }
  addBtn.addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  root.append(
    ...pageHeader('Repositories', 'Paste any GitHub link. RumiStack clones it into your workspace folder and remembers it in your portable profile, so every laptop gets the same list.', { iconName: 'layers' }),
    h('div', { class: 'panel' },
      h('div', { class: 'row', style: 'gap:10px;align-items:stretch' }, h('div', { class: 'search-field', style: 'flex:1' }, icon('git', 16), input), addBtn),
      h('p', { class: 'faint', style: 'margin:10px 0 0' }, 'Public repositories and private ones your Git sign-in can access. Cloned code is never run by RumiStack.')),
    h('div', { style: 'height:18px' }),
    box
  );

  await loadInto(box, () => api('GET', '/api/repos'), ({ folder, repos }) => {
    const missing = repos.filter((r) => !r.cloned);
    const out = [h('div', { class: 'row space', style: 'margin-bottom:10px;flex-wrap:wrap' },
      h('div', {}, h('strong', {}, 'Workspace folder'), h('div', { class: 'muted' }, h('code', {}, folder))),
      missing.length ? h('button', { class: 'btn small primary', type: 'button', onclick: async () => {
        for (const r of missing) if (!(await attempt(() => api('POST', '/api/repos/clone', { id: r.id })))) return navigate('repos');
        navigate('repos');
      } }, icon('download', 13), `Clone ${missing.length} missing`) : null)];

    if (repos.length === 0) {
      out.push(h('div', { class: 'panel' }, emptyState('layers', 'No repositories yet', 'Paste a GitHub link above to add your first one.')));
      return out;
    }
    out.push(h('div', { class: 'grid' }, repos.map((r) => h('div', { class: 'card' },
      h('div', { class: 'row space' }, h('div', { class: 'row' }, avatar(r.id, r.id.replace(/-/g, ' ')), h('strong', { style: 'word-break:break-all' }, r.url.replace('https://github.com/', ''))),
        r.cloned ? (r.dirty ? badge('local changes', 'warn') : badge('cloned', 'ok')) : badge('not on this laptop', 'warn')),
      h('dl', { class: 'kv' }, h('dt', {}, 'Folder'), h('dd', {}, r.path), r.branch ? [h('dt', {}, 'Branch'), h('dd', {}, r.branch)] : null),
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        r.cloned ? null : h('button', { class: 'btn small primary', type: 'button', onclick: async () => { if (await attempt(() => api('POST', '/api/repos/clone', { id: r.id }), 'Cloned')) navigate('repos'); } }, icon('download', 13), 'Clone'),
        r.cloned ? h('button', { class: 'btn small', type: 'button', onclick: async (e) => {
          e.currentTarget.disabled = true;
          const res = await attempt(() => api('POST', '/api/repos/update', { id: r.id }));
          if (res) { toast(res.skipped ?? (res.updated ? 'Updated' : 'Already up to date'), res.skipped ? 'info' : 'ok'); navigate('repos'); } else e.currentTarget.disabled = false;
        } }, icon('refresh', 13), 'Update') : null,
        r.cloned ? h('button', { class: 'btn small', type: 'button', onclick: (e) => copyText(`${folder}\\${r.id}`.replace(/\\\\/g, '\\'), e.currentTarget) }, icon('copy', 13), 'Copy path') : null,
        h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
          const ok = await confirmDialog({ title: 'Remove from list?', message: `Removes ${r.id} from your portable list. The folder ${r.path} is NOT deleted; delete it yourself if you no longer need it.`, confirmLabel: 'Remove', danger: true });
          if (ok && await attempt(() => api('POST', '/api/repos/remove', { id: r.id }), 'Removed from list')) navigate('repos');
        } }, icon('trash', 13), 'Remove'))))));
    return out;
  });
}
