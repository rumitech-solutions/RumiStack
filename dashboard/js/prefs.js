// Appearance preferences, kept in this browser only (localStorage). Applied on <html> as data attributes.

export const ACCENTS = [
  { id: 'violet', name: 'Violet' }, { id: 'ocean', name: 'Ocean' }, { id: 'emerald', name: 'Emerald' },
  { id: 'rose', name: 'Rose' }, { id: 'amber', name: 'Amber' }
];
const KEYS = { accent: 'rumistack-accent', density: 'rumistack-density', motion: 'rumistack-motion' };
const ALLOWED = { accent: ACCENTS.map((a) => a.id), density: ['comfortable', 'compact'], motion: ['full', 'reduced'] };
const DEFAULTS = { accent: 'violet', density: 'comfortable', motion: 'full' };

export function getPref(name) {
  try {
    const v = localStorage.getItem(KEYS[name]);
    if (ALLOWED[name].includes(v)) return v;
  } catch { /* storage unavailable */ }
  return DEFAULTS[name];
}

export function setPref(name, value) {
  if (!ALLOWED[name].includes(value)) return;
  try { if (value === DEFAULTS[name]) localStorage.removeItem(KEYS[name]); else localStorage.setItem(KEYS[name], value); } catch { /* storage unavailable */ }
  applyPrefs();
}

export function applyPrefs() {
  const root = document.documentElement;
  for (const name of Object.keys(KEYS)) {
    const v = getPref(name);
    if (v === DEFAULTS[name]) root.removeAttribute(`data-${name}`); else root.setAttribute(`data-${name}`, v);
  }
}

// ---- theme (auto follows the system; light/dark are forced)

export const THEMES = ['auto', 'light', 'dark'];

export function getTheme() {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'auto';
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { if (theme === 'auto') localStorage.removeItem('rumistack-theme'); else localStorage.setItem('rumistack-theme', theme); } catch { /* storage unavailable */ }
  document.dispatchEvent(new CustomEvent('rumistack-theme'));
}
