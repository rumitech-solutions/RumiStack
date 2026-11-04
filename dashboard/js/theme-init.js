// Runs before first paint (classic script) so saved appearance is applied without a flash.
try {
  const root = document.documentElement;
  const theme = localStorage.getItem('rumistack-theme');
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  const allowed = { accent: ['ocean', 'emerald', 'rose', 'amber'], density: ['compact'], motion: ['reduced'] };
  for (const name of Object.keys(allowed)) {
    const v = localStorage.getItem(`rumistack-${name}`);
    if (allowed[name].includes(v)) root.setAttribute(`data-${name}`, v);
  }
} catch { /* storage can be unavailable; fall back to defaults */ }
