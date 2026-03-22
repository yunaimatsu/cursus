import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PathLike } from 'node:fs';
import os from 'node:os';

export interface OrgaiConfig {
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

const DEFAULTS = {
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
export const LEGACY_CONFIG_PATH = 'orgai.toml';

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

  return LEGACY_CONFIG_PATH;
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
