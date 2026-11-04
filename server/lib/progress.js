// "Getting started" checklist, derived from what already exists on disk. Nothing extra is stored.

export async function setupProgress({ store, gitState, sources }) {
  const [device, providers, repos, links] = await Promise.all([store.load('device'), store.load('providers'), store.load('repos'), store.load('links')]);
  const gatewayCloned = sources.some((s) => ['freellmapi', 'omniroute'].includes(s.id) && s.cloned);
  const steps = [
    { id: 'tools', title: 'Choose your tools', detail: 'Apply a starter kit or pick tools for this laptop.', done: device.tools.length > 0, view: 'device', cta: 'Open Device sync' },
    { id: 'repos', title: 'Add a repository', detail: 'Paste a GitHub link to clone it into your workspace.', done: repos.repos.length > 0, view: 'repos', cta: 'Add a repo' },
    { id: 'links', title: 'Save a link', detail: 'Keep a tool or doc you want to remember.', done: links.links.length > 0, view: 'links', cta: 'Save a link' },
    { id: 'gateway', title: 'Set up a gateway', detail: 'Clone FreeLLMAPI or OmniRoute and run it in Docker.', done: gatewayCloned, view: 'gateways', cta: 'Open Gateways' },
    { id: 'provider', title: 'Add a provider profile', detail: 'Point your assistants at the gateway.', done: providers.profiles.length > 0, view: 'providers', cta: 'Open Providers' },
    { id: 'sync', title: 'Sync to Git', detail: 'Commit config/ so your other laptops can pull it.', done: Boolean(gitState.repo && gitState.remote && gitState.configChanges.length === 0 && gitState.lastCommit), view: 'sync', cta: 'Open Sync' }
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, done: doneCount, total: steps.length };
}
