// DOM helpers and shared UI building blocks. Text is always inserted as text nodes, never as HTML.

import { icon } from './icons.js';
export { icon };

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let value;
  for (const [key, val] of Object.entries(props ?? {})) {
    if (val === null || val === undefined || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'value') value = val;
    else if (key === 'style') el.style.cssText = String(val); // CSSOM is allowed by our CSP; the style attribute is not
    else if (key === 'checked') el.checked = Boolean(val);
    else if (key === 'disabled') el.disabled = Boolean(val);
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
    else el.setAttribute(key, val === true ? '' : String(val));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  if (value !== undefined) el.value = value;
  return el;
}

export async function api(method, path, body) {
  const init = { method, headers: {} };
  // The server requires a JSON content type on every write, so body-less writes send an empty object.
  if (body === undefined && method !== 'GET' && method !== 'DELETE') body = {};
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}

// ---------------------------------------------------------------- feedback

export function toast(message, kind = 'info') {
  const name = kind === 'ok' ? 'check' : kind === 'error' ? 'alert' : 'info';
  const el = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, icon(name, 18), h('span', {}, message));
  document.getElementById('toasts').append(el);
  const ttl = kind === 'error' ? 8000 : 3800;
  el.style.setProperty('--ttl', `${ttl}ms`);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 250); }, ttl);
}

/** Runs an async action, reporting failure as an error toast. */
export async function attempt(action, successMessage) {
  try {
    const result = await action();
    if (successMessage) toast(successMessage, 'ok');
    return result;
  } catch (err) {
    toast(err.message, 'error');
    return undefined;
  }
}

export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      button.classList.add('copied');
      const original = [...button.childNodes];
      button.replaceChildren(icon('check', 14), 'Copied');
      setTimeout(() => { button.classList.remove('copied'); button.replaceChildren(...original); }, 1400);
    } else {
      toast('Copied to clipboard', 'ok');
    }
  } catch {
    toast('Copy failed. Select the text and copy it manually.', 'error');
  }
}

// ---------------------------------------------------------------- modal

/** Opens a native <dialog>. Resolves with the value passed to close(), or undefined when dismissed. */
export function modal({ title, body, actions = [], wide = false }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: `modal${wide ? ' wide' : ''}`, 'aria-label': title });
    const close = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.append(
      h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => close(undefined) }, icon('x', 16))),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-actions' }, actions.map((a) =>
        h('button', { class: `btn ${a.kind ?? ''}`, type: 'button', onclick: () => close(a.value) }, a.label))) : null
    );
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(undefined); });
    document.body.append(dialog);
    dialog.showModal();
    (dialog.querySelector('.btn.primary, .btn.danger') ?? dialog.querySelector('button'))?.focus();
  });
}

export async function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, details }) {
  const result = await modal({
    title,
    body: [h('p', {}, message), details ?? null],
    actions: [{ label: 'Cancel', value: false }, { label: confirmLabel, value: true, kind: danger ? 'danger' : 'primary' }]
  });
  return result === true;
}

// ---------------------------------------------------------------- small components

export function badge(text, kind = '') {
  return h('span', { class: `badge ${kind}` }, text);
}

export function statusIcon(status) {
  const map = { ok: 'check', warn: 'alert', fail: 'x', info: 'info' };
  return h('span', { class: `status-icon ${status}` }, icon(map[status] ?? 'info', 14));
}

export function hueOf(text) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % 360;
}

export function avatar(id, name, size = 38) {
  const initials = String(name).split(/[\s/-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const el = h('div', { class: 'avatar', 'aria-hidden': 'true' }, initials || '?');
  el.style.setProperty('--hue', String(hueOf(id)));
  el.style.setProperty('--size', `${size}px`);
  return el;
}

export function timeAgo(iso) {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  if (sec < 86400 * 14) return `${Math.round(sec / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function codeBlock(text, lang) {
  const copy = h('button', { class: 'btn small ghost', type: 'button' }, icon('copy', 14), 'Copy');
  copy.addEventListener('click', () => copyText(text, copy));
  return h('div', { class: 'code' }, h('div', { class: 'code-bar' }, h('span', {}, lang ?? 'code'), copy), h('pre', {}, text));
}

export function notes(list) {
  return (list ?? []).map((n) => h('div', { class: 'notice info' }, icon('info', 16), h('span', {}, n)));
}

export function field(label, control, hint) {
  return h('div', { class: 'field' }, h('label', {}, label), control, hint ? h('small', {}, hint) : null);
}

export function checkboxes(options, selected, name) {
  const chosen = new Set(selected);
  return h('div', { class: 'checks' }, options.map((o) =>
    h('label', {}, h('input', { type: 'checkbox', name, value: o.id, checked: chosen.has(o.id) }), h('span', {}, o.name))));
}

export function readChecked(container, name) {
  return [...container.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
}

export function pageHeader(title, lede, { iconName, actions } = {}) {
  return [h('header', { class: 'page-head' },
    h('div', { class: 'page-title' },
      iconName ? h('span', { class: 'page-icon' }, icon(iconName, 22)) : null,
      h('div', {}, h('h1', {}, title), h('p', { class: 'lede' }, lede))),
    actions ? h('div', { class: 'page-actions' }, actions) : null)];
}

export function installCommand(tool) {
  const i = tool.install;
  if (i.type === 'npm') return `npm install -g ${i.package}`;
  if (i.type === 'winget') return `winget install --id ${i.package} --exact`;
  return null;
}

export function updateCommand(tool) {
  const i = tool.install;
  if (i.type === 'npm') return `npm install -g ${i.package}@latest`;
  if (i.type === 'winget') return `winget upgrade --id ${i.package} --exact`;
  return null;
}

export function skeleton(rows = 3) {
  return h('div', { class: 'skeleton-group', 'aria-busy': 'true', 'aria-label': 'Loading' },
    Array.from({ length: rows }, (_, i) => h('div', { class: 'skeleton', style: `width:${92 - i * 11}%` })));
}

/** Shows a skeleton in `target`, then replaces it with whatever `build(data)` returns. */
export async function loadInto(target, load, build) {
  target.replaceChildren(skeleton(3));
  try {
    const data = await load();
    const out = build(data);
    target.replaceChildren(...[out].flat().filter(Boolean));
    stagger(target);
  } catch (err) {
    target.replaceChildren(h('div', { class: 'notice' }, icon('alert', 16), h('span', {}, `Could not load: ${err.message}`)));
  }
}

/** Gives children a staggered entrance delay via a CSS variable. */
export function stagger(container, selector = ':scope > *') {
  [...container.querySelectorAll(selector)].slice(0, 24).forEach((node, i) => node.style.setProperty('--i', String(i)));
}

/** replaceChildren that skips null/undefined/false instead of rendering them as text. */
export function fill(container, ...children) {
  container.replaceChildren(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
}

export function emptyState(iconName, title, text, actions) {
  return h('div', { class: 'empty' }, h('span', { class: 'empty-icon' }, icon(iconName, 26)), h('strong', {}, title), text ? h('p', {}, text) : null, actions ? h('div', { class: 'row center' }, actions) : null);
}
