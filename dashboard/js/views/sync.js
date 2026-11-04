import { h, api, attempt, icon, badge, codeBlock, confirmDialog, pageHeader, loadInto, timeAgo, toast, emptyState, field, fill } from '../core.js';

function diffView(text) {
  const rows = text.split('\n').map((line) => {
    let cls = '';
    if (/^(diff |index |--- |\+\+\+ |new file|deleted file)/.test(line)) cls = 'meta';
    else if (line.startsWith('@@')) cls = 'hunk';
    else if (line.startsWith('+')) cls = 'add';
    else if (line.startsWith('-')) cls = 'del';
    return h('div', { class: cls }, line || ' ');
  });
  return h('div', { class: 'diff', tabindex: '0', role: 'region', 'aria-label': 'Config diff' }, rows);
}

export async function renderSync(root, { navigate }) {
  const statusBox = h('div', {});
  const backupBox = h('div', {});

  root.append(
    ...pageHeader('Sync & backups', 'Share your portable profile between laptops through Git, and roll back any change. Only the config/ folder is ever committed.', {
      iconName: 'git',
      actions: [h('button', { class: 'btn', type: 'button', onclick: () => navigate('sync') }, icon('refresh', 15), 'Refresh')]
    }),
    h('div', { class: 'two-col' },
      h('div', {}, statusBox),
      h('div', {}, h('h2', { style: 'margin-top:0' }, icon('restore', 16), 'Config backups'),
        h('p', { class: 'muted', style: 'margin:-4px 0 10px' }, 'A copy of the previous file is kept every time a profile changes (last 20 per profile).'), backupBox)),
    h('h2', {}, icon('laptop', 16), 'On a new laptop'),
    h('div', { class: 'panel' }, h('ol', { class: 'muted', style: 'margin:0;padding-left:20px' },
      h('li', {}, 'Clone this repository to D:\\RumiStack and run Setup-Workspace.ps1 and Start-Workspace.ps1.'),
      h('li', {}, 'Open this page and press Pull if the repository is behind.'),
      h('li', {}, 'Run Restore-Profile.ps1 -WhatIf, then -Confirm. Credentials are never synced; sign in to each tool again.')))
  );

  // ---------------------------------------------------------------- git status
  await loadInto(statusBox, () => api('GET', '/api/git/status'), (st) => {
    if (!st.repo) {
      return h('div', { class: 'panel' }, emptyState('git', 'This folder is not a Git repository',
        'Clone RumiStack from GitHub (recommended), or initialise one here and add your remote:'),
      codeBlock('git init -b main\ngit remote add origin https://github.com/<you>/RumiStack.git', 'powershell'));
    }
    const out = h('div', {});
    const changes = st.configChanges;
    const message = h('input', { type: 'text', value: 'Update RumiStack profiles', maxlength: '100', 'aria-label': 'Commit message' });
    const push = h('input', { type: 'checkbox', checked: Boolean(st.remote) });
    const diffBox = h('div', {});

    async function showDiff(btn) {
      btn.disabled = true;
      const res = await attempt(() => api('GET', '/api/git/diff'));
      btn.disabled = false;
      if (!res) return;
      fill(diffBox, res.diff ? diffView(res.diff) : h('p', { class: 'muted' }, 'No tracked changes to show (new files appear in the list above).'),
        res.truncated ? h('p', { class: 'faint' }, 'Diff truncated at 200 KB.') : null);
    }

    async function commit() {
      const ok = await confirmDialog({
        title: push.checked ? 'Commit and push config?' : 'Commit config?',
        message: `Commits only config/ with the message "${message.value.trim()}"${push.checked ? ' and pushes to ' + (st.upstream ?? 'origin') : ''}. Nothing is forced.`,
        confirmLabel: push.checked ? 'Commit & push' : 'Commit'
      });
      if (!ok) return;
      const res = await attempt(() => api('POST', '/api/git/commit', { message: message.value, push: push.checked }));
      if (!res) return;
      if (res.pushError) toast(res.pushError, 'error'); else toast(res.pushed ? 'Committed and pushed' : 'Committed locally', 'ok');
      navigate('sync');
    }

    async function fetchIt(btn) {
      btn.disabled = true;
      const res = await attempt(() => api('POST', '/api/git/fetch'), 'Fetched from origin');
      btn.disabled = false;
      if (res) navigate('sync');
    }

    async function pullIt(btn) {
      if (changes.length) {
        const ok = await confirmDialog({ title: 'Pull with uncommitted config changes?', message: 'A fast-forward pull will fail if it would overwrite your local config changes. Commit them first if unsure.', confirmLabel: 'Try pull' });
        if (!ok) return;
      }
      btn.disabled = true;
      const res = await attempt(() => api('POST', '/api/git/pull'));
      btn.disabled = false;
      if (res) { toast(res.upToDate ? 'Already up to date' : `Pulled: ${res.output}`, 'ok'); navigate('sync'); }
    }

    out.append(
      h('div', { class: 'panel' },
        h('div', { class: 'row space' }, h('h2', { style: 'margin:0' }, icon('git', 16), st.branch ?? '(detached HEAD)'),
          h('div', { class: 'row' },
            st.ahead > 0 ? badge(`${st.ahead} ahead`, 'accent') : null, st.behind > 0 ? badge(`${st.behind} behind`, 'warn') : null,
            st.upstream && st.ahead === 0 && st.behind === 0 ? badge('in sync', 'ok') : null, !st.upstream ? badge('no upstream', 'warn') : null)),
        h('dl', { class: 'kv', style: 'margin-top:14px' },
          h('dt', {}, 'Remote'), h('dd', {}, st.remote ?? 'none configured'),
          h('dt', {}, 'Tracking'), h('dd', {}, st.upstream ?? '—'),
          h('dt', {}, 'Last commit'), h('dd', {}, st.lastCommit ? `${st.lastCommit.hash} · ${st.lastCommit.subject} · ${timeAgo(st.lastCommit.date)}` : 'no commits yet')),
        h('div', { class: 'row', style: 'margin-top:14px' },
          h('button', { class: 'btn small', type: 'button', disabled: !st.remote, onclick: (e) => fetchIt(e.currentTarget) }, icon('refresh', 13), 'Fetch'),
          h('button', { class: 'btn small', type: 'button', disabled: !st.upstream, onclick: (e) => pullIt(e.currentTarget) }, icon('pull', 13), 'Pull (fast-forward only)'))),

      h('h2', {}, icon('file', 16), 'Config changes', badge(String(changes.length), changes.length ? 'accent' : '')),
      h('div', { class: 'panel' },
        changes.length === 0
          ? emptyState('check', 'Config is committed', 'Edits you make in the dashboard will show up here.')
          : [
            h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, changes.map((c) => h('tr', {}, h('td', {}, badge(c.status === '??' ? 'new' : c.status === 'M' ? 'modified' : c.status, c.status === '??' ? 'ok' : 'accent')), h('td', {}, h('code', {}, c.file))))))),
            h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn small', type: 'button', onclick: (e) => showDiff(e.currentTarget) }, 'View diff')),
            diffBox,
            h('div', { style: 'margin-top:14px' }, field('Commit message', message)),
            h('div', { class: 'row space' },
              h('label', { style: 'display:flex;align-items:center;gap:8px;margin:0;font-weight:500' }, push, 'Push after commit'),
              h('button', { class: 'btn primary', type: 'button', onclick: commit }, icon('push', 15), 'Commit config')),
            st.otherChanges > 0 ? h('p', { class: 'faint', style: 'margin-top:12px' }, `${st.otherChanges} other changed file(s) in the repository are not included.`) : null
          ])
    );
    return out;
  });

  // ---------------------------------------------------------------- backups
  await loadInto(backupBox, () => api('GET', '/api/backups'), (b) => {
    if (b.backups.length === 0) return emptyState('restore', 'No backups yet', 'The first one appears after you change a profile.');
    return h('div', {}, b.backups.slice(0, 30).map((bk) => h('div', { class: 'list-item', style: 'cursor:default' },
      h('div', {}, h('strong', {}, bk.kind), h('div', { class: 'muted', title: bk.createdAt }, `${timeAgo(bk.createdAt)} · ${(bk.size / 1024).toFixed(1)} KB`)),
      h('button', { class: 'btn small', type: 'button', onclick: async () => {
        const ok = await confirmDialog({ title: `Restore ${bk.kind} profile?`, message: `Replaces the current ${bk.kind} profile with the version from ${timeAgo(bk.createdAt)}. The current file is backed up first, so this can be undone.`, confirmLabel: 'Restore' });
        if (!ok) return;
        if (await attempt(() => api('POST', '/api/backups/restore', { file: bk.file }), `Restored ${bk.kind} profile`)) navigate('sync');
      } }, icon('restore', 13), 'Restore'))));
  });
}
