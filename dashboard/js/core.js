// Tiny DOM helpers. Text is always inserted as text nodes, never as HTML.

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

export function toast(message, kind = 'info') {
  const el = h('div', { class: `toast ${kind}` }, message);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 8000 : 3500);
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

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard', 'ok');
  } catch {
    toast('Copy failed. Select the text and copy it manually.', 'error');
  }
}

export function codeBlock(text) {
  return h('div', { class: 'code' }, h('button', { class: 'btn small', type: 'button', onclick: () => copyText(text) }, 'Copy'), text);
}

export function notes(list) {
  return (list ?? []).map((n) => h('div', { class: 'notice info' }, n));
}

export function badge(text, kind = '') {
  return h('span', { class: `badge ${kind}` }, text);
}

export function field(label, control, hint) {
  return h('div', { class: 'field' }, h('label', {}, label), control, hint ? h('small', {}, hint) : null);
}

export function checkboxes(options, selected, name) {
  const chosen = new Set(selected);
  return h('div', { class: 'checks' }, options.map((o) =>
    h('label', {}, h('input', { type: 'checkbox', name, value: o.id, checked: chosen.has(o.id) }), o.name)));
}

export function readChecked(container, name) {
  return [...container.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
}

export function pageHeader(title, lede) {
  return [h('h1', {}, title), h('p', { class: 'lede' }, lede)];
}

export function installCommand(tool) {
  const i = tool.install;
  if (i.type === 'npm') return `npm install -g ${i.package}`;
  if (i.type === 'winget') return `winget install --id ${i.package} --exact`;
  return null;
}
