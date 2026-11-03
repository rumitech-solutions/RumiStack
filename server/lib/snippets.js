// Generates reviewable config snippets. Nothing here touches the filesystem or the network,
// and no snippet ever contains a secret value: only environment-variable references.

import { ValidationError } from './validate.js';

const tomlStr = (s) => JSON.stringify(String(s)); // JSON strings are valid TOML basic strings
const psStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

export const PROVIDER_CLIENTS = [
  { id: 'claude-code', name: 'Claude Code', language: 'powershell' },
  { id: 'opencode', name: 'OpenCode', language: 'json' },
  { id: 'codex', name: 'Codex CLI', language: 'toml' }
];

export function providerSnippet(profile, client) {
  const has = (p) => profile.protocols.includes(p);
  const notes = [];

  if (client === 'claude-code') {
    if (!has('anthropic-messages')) {
      throw new ValidationError('Claude Code needs the Anthropic Messages protocol. Tick it only if your gateway really exposes /v1/messages.');
    }
    const base = profile.baseUrl.replace(/\/v1$/, '');
    notes.push('Claude Code appends /v1/messages itself, so the trailing /v1 is removed from the base URL.');
    notes.push(`Set ${profile.apiKeyEnv} in your own shell or secret manager first; the snippet only references it.`);
    return {
      client, language: 'powershell', filename: null, notes,
      snippet: [
        `$env:ANTHROPIC_BASE_URL = ${psStr(base)}`,
        `$env:ANTHROPIC_AUTH_TOKEN = $env:${profile.apiKeyEnv}`,
        `$env:ANTHROPIC_MODEL = ${psStr(profile.model)}`,
        'claude'
      ].join('\n')
    };
  }

  if (client === 'opencode') {
    if (!has('openai-chat')) {
      throw new ValidationError('The generated OpenCode config uses an OpenAI-compatible provider, which needs the OpenAI Chat Completions protocol.');
    }
    notes.push('Merge the provider entry into opencode.json (project) or ~/.config/opencode/opencode.json (global). Do not replace the file.');
    notes.push('The key is read from the environment at runtime via {env:NAME}.');
    const config = {
      $schema: 'https://opencode.ai/config.json',
      provider: {
        [profile.id]: {
          npm: '@ai-sdk/openai-compatible',
          name: profile.name,
          options: { baseURL: profile.baseUrl, apiKey: `{env:${profile.apiKeyEnv}}` },
          models: { [profile.model]: { name: profile.model } }
        }
      },
      model: `${profile.id}/${profile.model}`
    };
    return { client, language: 'json', filename: 'opencode.json', notes, snippet: JSON.stringify(config, null, 2) };
  }

  if (client === 'codex') {
    if (!has('openai-chat') && !has('openai-responses')) {
      throw new ValidationError('Codex CLI needs OpenAI Chat Completions or OpenAI Responses support.');
    }
    const wire = has('openai-responses') ? 'responses' : 'chat';
    notes.push('Merge into ~/.codex/config.toml. Keep your existing keys; only add this provider table and the two top-level lines.');
    notes.push(`wire_api = "${wire}" was chosen from your protocol flags. Check your installed Codex release for the wire formats it supports.`);
    return {
      client, language: 'toml', filename: 'config.toml', notes,
      snippet: [
        `model = ${tomlStr(profile.model)}`,
        `model_provider = ${tomlStr(profile.id)}`,
        '',
        `[model_providers.${profile.id}]`,
        `name = ${tomlStr(profile.name)}`,
        `base_url = ${tomlStr(profile.baseUrl)}`,
        `env_key = ${tomlStr(profile.apiKeyEnv)}`,
        `wire_api = ${tomlStr(wire)}`
      ].join('\n')
    };
  }

  throw new ValidationError(`Unsupported client "${client}".`);
}

export function discoveryCommand(profile) {
  return {
    language: 'powershell',
    command: [
      `Invoke-RestMethod -Uri ${psStr(profile.baseUrl + '/models')} \``,
      `  -Headers @{ Authorization = "Bearer $env:${profile.apiKeyEnv}" } |`,
      '  Select-Object -ExpandProperty data | Select-Object -ExpandProperty id'
    ].join('\n'),
    notes: [`Reads the key from $env:${profile.apiKeyEnv} at run time; RumiStack never sees or stores it.`]
  };
}

// ---------------------------------------------------------------- MCP

export const MCP_CLIENTS = [
  { id: 'claude-code', name: 'Claude Code', language: 'powershell' },
  { id: 'opencode', name: 'OpenCode', language: 'json' },
  { id: 'codex', name: 'Codex CLI', language: 'toml' },
  { id: 'vscode', name: 'VS Code', language: 'json' }
];

export function mcpSnippet(server, client) {
  const notes = [
    'Review and merge this single entry manually. RumiStack does not edit client configuration, start the server or verify the connection.'
  ];
  if (server.transport === 'stdio' && server.command === 'npx') {
    notes.push('On native Windows some clients cannot spawn npx directly. If the server fails to start, wrap it as: cmd /c npx ...');
  }

  if (client === 'claude-code') {
    const parts = ['claude mcp add'];
    if (server.transport === 'http') {
      parts.push('--transport http', server.id, psStr(server.url));
      for (const [h, env] of Object.entries(server.headerEnv)) parts.push(`--header "${h}: Bearer $env:${env}"`);
      if (Object.keys(server.headerEnv).some((h) => h.toLowerCase() !== 'authorization')) {
        notes.push('Only Authorization headers get the "Bearer" prefix by convention; adjust other headers by hand.');
      }
    } else {
      parts.push(server.id);
      for (const env of server.envVars) parts.push(`-e "${env}=$env:${env}"`);
      parts.push('--', server.command, ...server.args.map(psStr));
    }
    notes.push('Add --scope user or --scope project as needed. Environment variables are expanded by PowerShell when you run the command.');
    return { client, language: 'powershell', filename: null, notes, snippet: parts.join(' ') };
  }

  if (client === 'opencode') {
    let entry;
    if (server.transport === 'http') {
      entry = { type: 'remote', url: server.url, enabled: true };
      const headers = {};
      for (const [h, env] of Object.entries(server.headerEnv)) headers[h] = h.toLowerCase() === 'authorization' ? `Bearer {env:${env}}` : `{env:${env}}`;
      if (Object.keys(headers).length) entry.headers = headers;
    } else {
      entry = { type: 'local', command: [server.command, ...server.args], enabled: true };
      if (server.envVars.length) entry.environment = Object.fromEntries(server.envVars.map((e) => [e, `{env:${e}}`]));
    }
    return { client, language: 'json', filename: 'opencode.json', notes, snippet: JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { [server.id]: entry } }, null, 2) };
  }

  if (client === 'codex') {
    const lines = [`[mcp_servers.${server.id}]`];
    if (server.transport === 'http') {
      lines.push(`url = ${tomlStr(server.url)}`);
      const auth = Object.entries(server.headerEnv).find(([h]) => h.toLowerCase() === 'authorization');
      if (auth) lines.push(`bearer_token_env_var = ${tomlStr(auth[1])}`);
      const others = Object.entries(server.headerEnv).filter(([h]) => h.toLowerCase() !== 'authorization');
      if (others.length) lines.push(`env_http_headers = { ${others.map(([h, e]) => `${tomlStr(h)} = ${tomlStr(e)}`).join(', ')} }`);
    } else {
      lines.push(`command = ${tomlStr(server.command)}`);
      lines.push(`args = [${server.args.map(tomlStr).join(', ')}]`);
      if (server.envVars.length) lines.push(`env_vars = [${server.envVars.map(tomlStr).join(', ')}]`);
    }
    notes.push('Goes in ~/.codex/config.toml. Field names such as env_vars and bearer_token_env_var depend on your Codex release; check its MCP docs.');
    return { client, language: 'toml', filename: 'config.toml', notes, snippet: lines.join('\n') };
  }

  if (client === 'vscode') {
    let entry;
    if (server.transport === 'http') {
      entry = { type: 'http', url: server.url };
      const headers = {};
      for (const [h, env] of Object.entries(server.headerEnv)) headers[h] = h.toLowerCase() === 'authorization' ? `Bearer \${env:${env}}` : `\${env:${env}}`;
      if (Object.keys(headers).length) entry.headers = headers;
    } else {
      entry = { type: 'stdio', command: server.command, args: server.args };
      if (server.envVars.length) entry.env = Object.fromEntries(server.envVars.map((e) => [e, `\${env:${e}}`]));
    }
    notes.push('Goes in .vscode/mcp.json (workspace) or your user MCP configuration. VS Code must be started from a shell where the variables are set, or use its input prompts instead.');
    return { client, language: 'json', filename: 'mcp.json', notes, snippet: JSON.stringify({ servers: { [server.id]: entry } }, null, 2) };
  }

  throw new ValidationError(`Unsupported client "${client}".`);
}

// ---------------------------------------------------------------- agents

export const AGENT_FORMATS = [
  { id: 'universal', name: 'Universal Markdown', filename: (a) => `${a.id}.md` },
  { id: 'claude-code', name: 'Claude Code subagent', filename: (a) => `.claude/agents/${a.id}.md` },
  { id: 'opencode', name: 'OpenCode subagent', filename: (a) => `.opencode/agent/${a.id}.md` },
  { id: 'codex', name: 'Codex AGENTS.md section', filename: () => 'AGENTS.md' }
];

const yamlStr = (s) => JSON.stringify(String(s).replace(/\s+/g, ' ').trim());

export function agentExport(agent, format) {
  const meta = AGENT_FORMATS.find((f) => f.id === format);
  if (!meta) throw new ValidationError(`Unsupported agent format "${format}".`);
  let content;
  if (format === 'universal') {
    content = `# ${agent.name}\n\n${agent.description}\n\n## Instructions\n\n${agent.prompt}\n`;
  } else if (format === 'claude-code') {
    content = `---\nname: ${agent.id}\ndescription: ${yamlStr(agent.description)}\n---\n\n${agent.prompt}\n`;
  } else if (format === 'opencode') {
    content = `---\ndescription: ${yamlStr(agent.description)}\nmode: subagent\n---\n\n${agent.prompt}\n`;
  } else {
    content = `## ${agent.name}\n\n${agent.description}\n\n${agent.prompt}\n`;
  }
  return {
    format,
    filename: meta.filename(agent),
    content,
    notes: format === 'codex'
      ? ['Append this section to your project AGENTS.md; do not overwrite an existing file.']
      : ['Save as a new file after review. RumiStack never overwrites existing assistant files.']
  };
}
