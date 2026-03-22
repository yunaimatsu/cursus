import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PathLike } from 'node:fs';
import os from 'node:os';

export interface OrgaiConfig {
  llm: {
    agents: Record<AgentName, AgentConfig>;
    providers: Record<string, ProviderConfig>;
  };
  meeting: {
    endKeywords: Set<string>;
    allowedEventTypes: Set<string>;
  };
  paths: {
    baseDir: string;
    sessionFile: string;
    eventDir: string;
    docFile: string;
    issueFile: string;
    execFile: string;
    minutesDir: string;
  };
  retrieval: {
    topEntries: number;
    topInnerEntries: number;
    previewLines: number;
    maxContentChars: number;
    maxSources: number;
    excludedDirs: Set<string>;
    excludedExtensions: Set<string>;
    fallbackFiles: string[];
  };
}

export interface ProviderConfig {
  apiKey: string;
  disabled: boolean;
  baseURL?: string;
  endpoint?: string;
  apiVersion?: string;
  headers?: Record<string, string>;
}

export type AgentName = 'coder' | 'summarizer' | 'task' | 'title';

export interface AgentConfig {
  model: string;
  maxTokens: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

const DEFAULTS = {
  llm: {
    agents: {
      coder: { model: '', maxTokens: 8000, reasoningEffort: 'medium' as const },
      summarizer: { model: '', maxTokens: 2000, reasoningEffort: 'low' as const },
      task: { model: '', maxTokens: 2000, reasoningEffort: 'low' as const },
      title: { model: '', maxTokens: 80, reasoningEffort: 'low' as const },
    },
    providers: {
      openai: { apiKey: '', disabled: false },
      anthropic: { apiKey: '', disabled: false },
      gemini: { apiKey: '', disabled: false },
      groq: { apiKey: '', disabled: false, baseURL: 'https://api.groq.com/openai/v1' },
      openrouter: { apiKey: '', disabled: false, baseURL: 'https://openrouter.ai/api/v1' },
      azure: { apiKey: '', disabled: false, endpoint: '' },
      vertexai: { apiKey: '', disabled: false, endpoint: '' },
      xai: { apiKey: '', disabled: false, baseURL: 'https://api.x.ai/v1' },
      local: { apiKey: 'dummy', disabled: false, baseURL: 'http://localhost:11434/v1' },
    },
  },
  meeting: {
    endKeywords: ['end', 'done', '終了'],
    allowedEventTypes: ['note', 'decision', 'task', 'parking'],
  },
  paths: {
    baseDir: '.mtg',
    sessionFile: 'session.json',
    eventDir: 'events',
    docFile: path.join('docs', 'knowledge', 'decisions.md'),
    issueFile: path.join('docs', 'issues', 'tasks.md'),
    execFile: 'exec.jsonl',
    minutesDir: path.join('docs', 'minutes'),
  },
  retrieval: {
    topEntries: 8,
    topInnerEntries: 8,
    previewLines: 40,
    maxContentChars: 30000,
    maxSources: 5,
    excludedDirs: ['.git', '.mtg'],
    excludedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.pyc'],
    fallbackFiles: ['README.md', 'orgai/main.ts'],
  },
};

export const GLASSBLOCK_DIR = '.glassblock';
export const GLASSBLOCK_CONFIG_FILE = 'config.toml';
export const GLOBAL_CONFIG_DIR = path.join('.config', 'glassblock');

function parseLineValue(text: string, key: string, section?: string): string | null {
  const lines = text.split(/\r?\n/);
  const currentSection = section ?? '';
  let activeSection = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      activeSection = sectionMatch[1]?.trim() ?? '';
      continue;
    }

    if (activeSection !== currentSection) continue;

    if (!line.startsWith(`${key} = `)) continue;
    return line.split('=').slice(1).join('=').trim();
  }

  return null;
}

function parseTomlString(text: string, key: string, section?: string): string | null {
  const value = parseLineValue(text, key, section);
  if (!value) return null;
  const match = value.match(/^"(.*)"$/);
  return match ? match[1] : null;
}

function parseTomlArray(text: string, key: string, section?: string): string[] | null {
  const value = parseLineValue(text, key, section);
  if (!value) return null;
  const match = value.match(/^\[(.*)\]$/);
  if (!match) return null;
  const body = match[1]?.trim() ?? '';
  if (!body) return [];
  return body
    .split(',')
    .map((v) => v.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function parseTomlNumber(text: string, key: string, section?: string): number | null {
  const value = parseLineValue(text, key, section);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function resolveConfigPath(configPath?: PathLike): PathLike {
  if (configPath) return configPath;

  const glassblockConfigPath = path.join(GLASSBLOCK_DIR, GLASSBLOCK_CONFIG_FILE);
  if (existsSync(glassblockConfigPath)) return glassblockConfigPath;

  const globalConfigPath = path.join(os.homedir(), GLOBAL_CONFIG_DIR, GLASSBLOCK_CONFIG_FILE);
  if (existsSync(globalConfigPath)) return globalConfigPath;

  return glassblockConfigPath;
}

export function loadConfig(configPath?: PathLike): OrgaiConfig {
  const resolvedPath = resolveConfigPath(configPath);
  if (!existsSync(resolvedPath)) {
    return buildConfig('');
  }

  const payload = readFileSync(resolvedPath, 'utf-8');
  return buildConfig(payload);
}

function buildConfig(payload: string): OrgaiConfig {
  const providers = buildProviderConfigs(payload);
  const agents = buildAgentConfigs(payload);
  setProviderDefaults(providers);
  setDefaultModelForAgents(agents, providers);
  validateProviders(providers);
  validateAgents(agents, providers);
  const baseDir = parseTomlString(payload, 'base_dir', 'paths') ?? DEFAULTS.paths.baseDir;
  const sessionFileName = parseTomlString(payload, 'session_file', 'paths') ?? DEFAULTS.paths.sessionFile;
  const eventDirName = parseTomlString(payload, 'event_dir', 'paths') ?? DEFAULTS.paths.eventDir;
  const execFileName = parseTomlString(payload, 'exec_file', 'paths') ?? DEFAULTS.paths.execFile;

  const endKeywords =
    parseTomlArray(payload, 'end_keywords', 'meeting') ??
    parseTomlArray(payload, 'end_keywords') ??
    DEFAULTS.meeting.endKeywords;

  const allowedEventTypes =
    parseTomlArray(payload, 'allowed_event_types', 'meeting') ?? DEFAULTS.meeting.allowedEventTypes;

  const topEntries = parseTomlNumber(payload, 'top_entries', 'retrieval') ?? DEFAULTS.retrieval.topEntries;
  const topInnerEntries =
    parseTomlNumber(payload, 'top_inner_entries', 'retrieval') ?? DEFAULTS.retrieval.topInnerEntries;
  const previewLines = parseTomlNumber(payload, 'preview_lines', 'retrieval') ?? DEFAULTS.retrieval.previewLines;
  const maxContentChars =
    parseTomlNumber(payload, 'max_content_chars', 'retrieval') ?? DEFAULTS.retrieval.maxContentChars;
  const maxSources = parseTomlNumber(payload, 'max_sources', 'retrieval') ?? DEFAULTS.retrieval.maxSources;

  const excludedDirs =
    parseTomlArray(payload, 'excluded_dirs', 'retrieval') ??
    DEFAULTS.retrieval.excludedDirs.map((dir) => (dir === '.mtg' ? baseDir : dir));

  return {
    llm: { providers, agents },
    meeting: {
      endKeywords: new Set(endKeywords.map((value) => value.trim().toLowerCase()).filter(Boolean)),
      allowedEventTypes: new Set(allowedEventTypes.map((value) => value.trim().toLowerCase()).filter(Boolean)),
    },
    paths: {
      baseDir,
      sessionFile: path.join(baseDir, sessionFileName),
      eventDir: path.join(baseDir, eventDirName),
      docFile: parseTomlString(payload, 'doc_file', 'paths') ?? DEFAULTS.paths.docFile,
      issueFile: parseTomlString(payload, 'issue_file', 'paths') ?? DEFAULTS.paths.issueFile,
      execFile: path.join(baseDir, execFileName),
      minutesDir: parseTomlString(payload, 'minutes_dir', 'paths') ?? DEFAULTS.paths.minutesDir,
    },
    retrieval: {
      topEntries: Math.max(1, Math.floor(topEntries)),
      topInnerEntries: Math.max(1, Math.floor(topInnerEntries)),
      previewLines: Math.max(1, Math.floor(previewLines)),
      maxContentChars: Math.max(1000, Math.floor(maxContentChars)),
      maxSources: Math.max(1, Math.floor(maxSources)),
      excludedDirs: new Set(excludedDirs),
      excludedExtensions: new Set(
        (parseTomlArray(payload, 'excluded_extensions', 'retrieval') ?? DEFAULTS.retrieval.excludedExtensions).map((ext) =>
          ext.toLowerCase(),
        ),
      ),
      fallbackFiles: parseTomlArray(payload, 'fallback_files', 'retrieval') ?? DEFAULTS.retrieval.fallbackFiles,
    },
  };
}

function buildProviderConfigs(payload: string): Record<string, ProviderConfig> {
  const providers: Record<string, ProviderConfig> = {};
  for (const [name, defaults] of Object.entries(DEFAULTS.llm.providers)) {
    const section = `providers.${name}`;
    const envKey = getProviderEnvKey(name);
    const apiKey = parseTomlString(payload, 'api_key', section) ?? process.env[envKey] ?? defaults.apiKey;
    const baseURL = parseTomlString(payload, 'base_url', section) ?? defaults.baseURL;
    const endpoint = parseTomlString(payload, 'endpoint', section) ?? defaults.endpoint;
    const apiVersion = parseTomlString(payload, 'api_version', section) ?? undefined;
    const headers = parseTomlArray(payload, 'headers', section)?.reduce<Record<string, string>>((acc, item) => {
      const [k, ...rest] = item.split('=');
      if (!k || rest.length === 0) return acc;
      acc[k.trim()] = rest.join('=').trim();
      return acc;
    }, {});
    const disabledValue = parseLineValue(payload, 'disabled', section);
    const disabled = disabledValue ? disabledValue.toLowerCase() === 'true' : defaults.disabled;

    providers[name] = {
      apiKey,
      baseURL,
      endpoint,
      apiVersion,
      headers,
      disabled,
    };
  }

  if (process.env.LOCAL_ENDPOINT) {
    providers.local = {
      ...providers.local,
      baseURL: process.env.LOCAL_ENDPOINT,
      disabled: false,
    };
  }

  return providers;
}

function buildAgentConfigs(payload: string): Record<AgentName, AgentConfig> {
  const agents = Object.fromEntries(
    Object.entries(DEFAULTS.llm.agents).map(([name, config]) => [name, { ...config }]),
  ) as Record<AgentName, AgentConfig>;
  for (const name of Object.keys(agents) as AgentName[]) {
    const section = `agents.${name}`;
    agents[name] = {
      model: parseTomlString(payload, 'model', section) ?? agents[name].model,
      maxTokens: parseTomlNumber(payload, 'max_tokens', section) ?? agents[name].maxTokens,
      reasoningEffort:
        (parseTomlString(payload, 'reasoning_effort', section) as AgentConfig['reasoningEffort']) ??
        agents[name].reasoningEffort,
    };
  }
  return agents;
}

function setProviderDefaults(providers: Record<string, ProviderConfig>): void {
  for (const [name, provider] of Object.entries(providers)) {
    if (provider.apiKey) continue;
    const envKey = getProviderEnvKey(name);
    if (envKey && process.env[envKey]) provider.apiKey = process.env[envKey] ?? '';
  }
  if (providers.azure && process.env.AZURE_OPENAI_ENDPOINT) {
    providers.azure.endpoint = providers.azure.endpoint || process.env.AZURE_OPENAI_ENDPOINT;
    providers.azure.apiVersion = providers.azure.apiVersion || process.env.AZURE_OPENAI_API_VERSION;
  }
  if (providers.local && process.env.LOCAL_ENDPOINT) {
    providers.local.baseURL = process.env.LOCAL_ENDPOINT;
  }
}

function setDefaultModelForAgents(
  agents: Record<AgentName, AgentConfig>,
  providers: Record<string, ProviderConfig>,
): void {
  const priority: Array<{ provider: string; model: string }> = [
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'openai', model: 'gpt-5' },
    { provider: 'gemini', model: 'gemini-2.5-pro' },
    { provider: 'groq', model: 'groq-llama-4' },
    { provider: 'openrouter', model: 'openrouter-auto' },
    { provider: 'azure', model: 'azure-gpt-4.1' },
    { provider: 'vertexai', model: 'vertex-gemini-2.5-pro' },
    { provider: 'xai', model: 'xai-grok-code' },
    { provider: 'local', model: 'local-openai' },
  ];
  const selected = priority.find((item) => {
    const provider = providers[item.provider];
    return provider && !provider.disabled && hasProviderCredentials(item.provider, provider);
  });
  if (!selected) return;

  for (const name of Object.keys(agents) as AgentName[]) {
    if (!agents[name].model) agents[name].model = selected.model;
  }
}

function validateProviders(providers: Record<string, ProviderConfig>): void {
  for (const [name, provider] of Object.entries(providers)) {
    if (provider.disabled) continue;
    if (!hasProviderCredentials(name, provider)) {
      provider.disabled = true;
    }
  }
}

function validateAgents(agents: Record<AgentName, AgentConfig>, providers: Record<string, ProviderConfig>): void {
  const providerByModel = new Map<string, string>([
    ['gpt-5', 'openai'],
    ['claude-sonnet-4', 'anthropic'],
    ['gemini-2.5-pro', 'gemini'],
    ['groq-llama-4', 'groq'],
    ['openrouter-auto', 'openrouter'],
    ['azure-gpt-4.1', 'azure'],
    ['vertex-gemini-2.5-pro', 'vertexai'],
    ['xai-grok-code', 'xai'],
    ['local-openai', 'local'],
  ]);

  for (const name of Object.keys(agents) as AgentName[]) {
    const agent = agents[name];
    const providerName = providerByModel.get(agent.model);
    if (!providerName || providers[providerName]?.disabled) {
      agent.model = selectFirstAvailableModel(providers);
    }
    if (name === 'title') agent.maxTokens = 80;
  }
}

function selectFirstAvailableModel(providers: Record<string, ProviderConfig>): string {
  const fallback = [
    ['anthropic', 'claude-sonnet-4'],
    ['openai', 'gpt-5'],
    ['gemini', 'gemini-2.5-pro'],
    ['groq', 'groq-llama-4'],
    ['openrouter', 'openrouter-auto'],
    ['azure', 'azure-gpt-4.1'],
    ['vertexai', 'vertex-gemini-2.5-pro'],
    ['xai', 'xai-grok-code'],
    ['local', 'local-openai'],
  ] as const;
  for (const [provider, model] of fallback) {
    if (!providers[provider]?.disabled) return model;
  }
  return 'local-openai';
}

function hasProviderCredentials(providerName: string, provider: ProviderConfig): boolean {
  if (providerName === 'local') return Boolean(provider.baseURL || process.env.LOCAL_ENDPOINT);
  if (provider.apiKey) return true;
  if (providerName === 'azure') {
    return Boolean(
      provider.endpoint &&
        (provider.apiKey ||
          process.env.AZURE_CLIENT_ID ||
          process.env.AZURE_TENANT_ID ||
          process.env.AZURE_CLIENT_SECRET),
    );
  }
  if (providerName === 'vertexai') {
    return Boolean(
      (provider.endpoint || process.env.VERTEXAI_PROJECT) &&
        (process.env.VERTEXAI_LOCATION || process.env.GOOGLE_APPLICATION_CREDENTIALS),
    );
  }
  return false;
}

function getProviderEnvKey(providerName: string): string {
  const map: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    azure: 'AZURE_OPENAI_API_KEY',
    vertexai: 'VERTEXAI_API_KEY',
    xai: 'XAI_API_KEY',
    local: 'LOCAL_API_KEY',
  };
  return map[providerName] ?? '';
}
