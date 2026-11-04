// Runs before first paint (classic script) so the saved theme is applied without a flash.
try {
  const saved = localStorage.getItem('rumistack-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch { /* storage can be unavailable; fall back to the system theme */ }
