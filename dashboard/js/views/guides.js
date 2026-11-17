import { h, icon, pageHeader, badge } from '../core.js';

const guides = [
  {
    title: '🤖 AI coding assistants',
    description: 'These are the coding platforms you work inside. Pick one primary assistant first; you can add more later.',
    steps: [
      ['1. Choose a platform', 'Open Tool library → AI coding assistants. Examples include Claude Code, OpenCode, Codex CLI, Gemini CLI, Aider and Cline.'],
      ['2. Install it', 'Use the install command shown on its card, or open its official installation guide when the method is manual.'],
      ['3. Sign in and launch', 'Complete the provider login required by that assistant, then launch it from its own terminal or editor.'],
      ['4. Add capabilities later', 'Once the assistant works, explore Skills, Agents and MCP integrations. These are optional add-ons, not prerequisites.']
    ],
    action: ['Open AI coding tools', 'catalogue', { category: 'assistants' }]
  },
  {
    title: '⚡ Model gateways: FreeLLMAPI & OmniRoute',
    description: 'Gateways connect coding assistants to model providers. They are separate services/repositories — Docker is not required by RumiStack.',
    steps: [
      ['1. Import or register the project', 'Open Projects. Import the GitHub repository into a folder you choose, or register an existing local folder if you already installed it. Registering does not move or overwrite files.'],
      ['2. Install dependencies', 'For supported Node projects, use the Project Hub Install action after reviewing the detected package manager. For other runtimes, follow the upstream Windows installation guide.'],
      ['3. Start and inspect', 'Use the Project Hub Start action for a detected Node script, or start it with the upstream documented command. Check Logs and confirm the local API endpoint responds.'],
      ['4. Connect it to your assistant', 'Open AI providers, choose the FreeLLMAPI or OmniRoute preset, confirm the Base URL and model shown by your running service, then save and test the connection. Keep API key values in environment variables.']
    ],
    action: ['Configure AI provider', 'providers']
  },
  {
    title: '🧩 Skills & agent instructions',
    description: 'Skills add reusable workflows; agent profiles hold role-specific instructions. They are optional enhancements.',
    steps: [
      ['1. Pick your assistant', 'In Skills, select the coding assistants you actually use.'],
      ['2. Add only useful skills', 'Search the catalogue and add skills you understand. Choose global or project scope where supported.'],
      ['3. Create agent profiles', 'In Agents, write a focused role prompt such as reviewer, tester or documentation helper.'],
      ['4. Preview before restoring', 'Save your profile and inspect the generated restore commands before running them.']
    ],
    action: ['Open Skills', 'skills']
  },
  {
    title: '🔌 MCP integrations',
    description: 'MCP servers expose tools or context to compatible assistants. Add them only when a workflow needs them.',
    steps: [
      ['1. Choose an MCP template', 'Open MCP integrations and select a server that supports your client.'],
      ['2. Add required settings', 'Provide the required environment-variable names and client selection. Keep secret values outside RumiStack profiles.'],
      ['3. Preview the configuration', 'Generate the client snippet and review the target file path.'],
      ['4. Apply and restart the client', 'Copy the reviewed configuration into the assistant’s config file, then restart that assistant.']
    ],
    action: ['Open MCP integrations', 'mcp']
  },
  {
    title: '📁 Repositories vs Projects',
    description: 'A repository is source code you want to keep or inspect. A project is a working app you want to develop and run.',
    steps: [
      ['Repositories', 'Use Repositories to keep a curated list of GitHub projects and clone/update their source. Cloning never runs the code.'],
      ['Projects', 'Use Projects to import a web app, register an existing folder, install dependencies and start supported Node.js projects.'],
      ['Choose storage', 'Keep your projects under a drive/folder you control, such as D:\\WebProjects or E:\\ClientWork.'],
      ['Stay safe', 'Review a repository before installing dependencies or starting scripts. Those actions can execute project code.']
    ],
    action: ['Open Projects', 'projects']
  },
  {
    title: '🔄 Backups & moving to another laptop',
    description: 'Keep portable settings in sync without copying API keys, login sessions or project databases.',
    steps: [
      ['1. Save your setup', 'Use Setup profile to select the tools and extensions you want on each device.'],
      ['2. Review changes', 'Open Backup & sync and inspect the files before committing.'],
      ['3. Push your configuration', 'Use the built-in Git workflow to commit and push the tracked config files.'],
      ['4. Restore carefully', 'On the next laptop, pull the repository and preview restore scripts with -WhatIf before confirming.']
    ],
    action: ['Open Backup & sync', 'sync']
  }
];

export async function renderGuides(root, { navigate }) {
  root.append(
    ...pageHeader('Guides & help', 'A simple path through RumiStack. Start with one coding assistant, connect a model gateway only if you need one, then add optional capabilities.', { iconName: 'book-open' }),
    h('div', { class: 'hero guide-hero' },
      h('div', {}, h('span', { class: 'eyebrow' }, 'RECOMMENDED FIRST STEPS'),
        h('h2', {}, 'Start small. Add power when you need it.'),
        h('p', {}, 'You do not need to configure every section. For a basic setup, install one coding assistant and start using it. Providers, skills, agents and MCP are optional.')),
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => navigate('catalogue', { category: 'assistants' }) }, icon('grid', 15), 'Choose a coding assistant'),
        h('button', { class: 'btn', type: 'button', onclick: () => navigate('projects') }, icon('folder', 15), 'Open a project'))),
    h('div', { class: 'grid guide-grid' }, guides.map((guide) =>
      h('article', { class: 'card guide-card' },
        h('h2', {}, guide.title),
        h('p', { class: 'muted' }, guide.description),
        h('div', { class: 'guide-steps' }, guide.steps.map(([title, detail]) =>
          h('div', { class: 'guide-step' }, h('strong', {}, title), h('p', {}, detail)))),
        guide.action ? h('button', { class: 'btn small primary', type: 'button', onclick: () => navigate(guide.action[1], guide.action[2]) }, guide.action[0], icon('chevron', 13)) : null
      )))
  );
}
