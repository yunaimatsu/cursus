#!/usr/bin/env -S node --experimental-strip-types
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';

const BASE_DIR = '.mtg';
const SESSION_FILE = path.join(BASE_DIR, 'session.json');
const EVENT_DIR = path.join(BASE_DIR, 'events');
const DOC_FILE = path.join('docs', 'knowledge', 'decisions.md');
const ISSUE_FILE = path.join('docs', 'issues', 'tasks.md');
const EXEC_FILE = path.join(BASE_DIR, 'exec.jsonl');
const MINUTES_DIR = path.join('docs', 'minutes');

const ALLOWED_EVENT_TYPES = new Set(['note', 'decision', 'task', 'parking']);

type EventItem = { type: string; text: string; timestamp: string; sessionId: string };
type Session = {
  session_id: string;
  topic: string;
  status: string;
  started_at: string;
  current_focus: string;
  retrieval_sources: Array<{ path: string; type: string; score: number }>;
};

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD_CYAN = '\x1b[1;36m';

function styledLabel(label: string): string {
  const upper = label.toUpperCase();
  if (!process.stdout.isTTY) return upper;
  return `${ANSI_BOLD_CYAN}${upper}${ANSI_RESET}`;
}

function renderField(label: string, value: string): string {
  return `${styledLabel(label)}: ${value}`;
}

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function ensureDirs(): void {
  mkdirSync(BASE_DIR, { recursive: true });
  mkdirSync(EVENT_DIR, { recursive: true });
}

function loadActiveSession(): Session | null {
  if (!existsSync(SESSION_FILE)) return null;
  return JSON.parse(readFileSync(SESSION_FILE, 'utf-8')) as Session;
}

function saveSession(session: Session | null): void {
  ensureDirs();
  if (session === null) {
    if (existsSync(SESSION_FILE)) unlinkSync(SESSION_FILE);
    return;
  }
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8');
}

function sessionEventFile(sessionId: string): string {
  return path.join(EVENT_DIR, `${sessionId}.jsonl`);
}

function appendEvent(sessionId: string, eventType: string, text: string): EventItem {
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    throw new Error(`Unsupported event type: ${eventType}`);
  }
  const event: EventItem = { type: eventType, text, timestamp: utcNow(), sessionId };
  appendFileSync(sessionEventFile(sessionId), `${JSON.stringify(event)}\n`, 'utf-8');
  return event;
}

function readEvents(sessionId: string): EventItem[] {
  const eventPath = sessionEventFile(sessionId);
  if (!existsSync(eventPath)) return [];
  return readFileSync(eventPath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as EventItem);
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .split(/\s+/)
    .map((token) => token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  return new Set(tokens);
}

function runTool(command: string[], traces?: string[], objective?: string): [boolean, string] {
  if (traces && objective) {
    traces.push(`Reading ${objective === '.' ? 'root' : objective}... (\`${command.join(' ')}\`)`);
  }
  const proc = spawnSync(command[0], command.slice(1), { encoding: 'utf-8' });
  if (proc.status === 0) return [true, proc.stdout || ''];
  return [false, proc.stderr || proc.stdout || ''];
}

function toolLs(targetPath: string, traces?: string[]): string[] {
  const [ok] = runTool(['ls', '-1', targetPath], traces, targetPath);
  if (!ok) return [];
  return readdirSync(targetPath)
    .map((name) => path.join(targetPath, name))
    .filter((candidate) => !candidate.split(path.sep).includes('.git') && !candidate.split(path.sep).includes('.mtg'));
}

function toolHead(targetPath: string, lines = 40, traces?: string[]): string {
  const [ok, out] = runTool(['sed', '-n', `1,${lines}p`, targetPath], traces, targetPath);
  return ok ? out : '';
}

function toolCat(targetPath: string, traces?: string[]): string {
  const [ok, out] = runTool(['cat', targetPath], traces, targetPath);
  return ok ? out : '';
}

function scoreName(targetPath: string, topicTokens: Set<string>): number {
  const nameTokens = tokenize(targetPath);
  const overlap = [...topicTokens].filter((token) => nameTokens.has(token)).length;
  return overlap === 0 ? 0 : overlap / Math.max(topicTokens.size, 1);
}

function retrievalCandidates(topic: string): [Array<{ path: string; type: string; score: number }>, string[]] {
  const topicTokens = tokenize(topic);
  const traces: string[] = [];
  const rootEntries = toolLs('.', traces);
  const nameRanked = [...rootEntries].sort((a, b) => scoreName(b, topicTokens) - scoreName(a, topicTokens));

  const shortlisted: string[] = [];
  for (const entry of nameRanked.slice(0, 8)) {
    if (statSync(entry).isDirectory()) {
      const inner = toolLs(entry, traces);
      const innerRanked = [...inner].sort((a, b) => scoreName(b, topicTokens) - scoreName(a, topicTokens));
      shortlisted.push(...innerRanked.slice(0, 8).filter((item) => statSync(item).isFile()));
    } else {
      shortlisted.push(entry);
    }
  }

  if (shortlisted.length === 0) {
    shortlisted.push(...rootEntries.filter((entry) => statSync(entry).isFile()));
  }

  const scored: Array<{ path: string; type: string; score: number }> = [];
  for (const entry of shortlisted) {
    const ext = path.extname(entry).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.pyc'].includes(ext)) continue;

    const preview = toolHead(entry, 40, traces);
    if (!preview.trim()) continue;

    const previewTokens = tokenize(preview);
    const previewOverlap = [...topicTokens].filter((token) => previewTokens.has(token)).length;
    if (previewOverlap <= 0 && scoreName(entry, topicTokens) <= 0) continue;

    const fullText = toolCat(entry, traces).slice(0, 30000);
    const contentTokens = tokenize(fullText);
    let overlap = [...topicTokens].filter((token) => contentTokens.has(token)).length;
    if (overlap <= 0) overlap = previewOverlap;
    if (overlap <= 0) continue;

    let kind = ['.py', '.ts', '.tsx', '.js', '.jsx', '.rs', '.go', '.java'].includes(ext) ? 'code' : 'doc';
    if (entry.toLowerCase().includes('decision')) kind = 'decision';
    const bonus = kind === 'doc' ? 0.15 : kind === 'decision' ? 0.1 : 0.0;
    const score = Math.min(0.99, overlap / Math.max(topicTokens.size, 1) + bonus);
    scored.push({ path: entry, type: kind, score: Number(score.toFixed(2)) });
  }

  scored.sort((a, b) => b.score - a.score || (b.type === 'doc' ? 1 : 0) - (a.type === 'doc' ? 1 : 0));

  if (scored.length === 0) {
    for (const fallback of ['README.md', 'orgai/main.ts']) {
      if (existsSync(fallback)) {
        scored.push({ path: fallback, type: fallback.endsWith('.md') ? 'doc' : 'code', score: 0.01 });
      }
    }
  }
  return [scored.slice(0, 5), traces];
}

function cmdSessionLs(): number {
  const session = loadActiveSession();
  if (!session) {
    console.log('No active session.');
    return 0;
  }
  console.log(`${session.session_id}\t${session.topic}\t${session.status}\t${session.started_at}`);
  return 0;
}

function normalizeLayer(layer?: string): string {
  const key = (layer ?? '').toLowerCase();
  const map: Record<string, string> = {
    session: 'session',
    ss: 'session',
    event: 'event',
    ev: 'event',
    doc: 'doc',
    dc: 'doc',
    exec: 'exec',
    ex: 'exec',
  };
  return map[key] ?? key;
}

function normalizeAction(action?: string): string {
  const key = (action ?? '').toLowerCase();
  const map: Record<string, string> = {
    ls: 'ls',
    up: 'up',
    read: 'read',
    rd: 'read',
    down: 'down',
    dn: 'down',
    write: 'write',
    wr: 'write',
  };
  return map[key] ?? key;
}

async function readTopicPrompt(): Promise<string> {
  if (!process.stdin.isTTY) {
    return readFileSync(0, 'utf-8').trim();
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => {
    rl.question(`${styledLabel('topic')}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function cmdSessionUp(topicFromArgs: string): Promise<number> {
  const input = topicFromArgs || (await readTopicPrompt());
  if (!input) {
    console.log('Topic is required to start a session.');
    return 1;
  }

  ensureDirs();
  const [sources, traces] = retrievalCandidates(input);
  for (const trace of traces) console.log(trace);
  for (const item of sources) console.log(`reading ${item.path} (${item.type}, score=${item.score.toFixed(2)}) ...`);

  const session: Session = {
    session_id: randomUUID(),
    topic: input,
    status: 'active',
    started_at: utcNow(),
    current_focus: input,
    retrieval_sources: sources,
  };
  saveSession(session);
  console.log(`Created session ${session.session_id}`);
  console.log(renderField('topic', input));
  console.log('Context reconstruction complete; session active.');
  return 0;
}

function summaryFromEvents(events: EventItem[]): string {
  const decisions = events.filter((e) => e.type === 'decision').map((e) => e.text);
  const tasks = events.filter((e) => e.type === 'task').map((e) => e.text);
  const notes = events.filter((e) => e.type === 'note').map((e) => e.text);
  const parking = events.filter((e) => e.type === 'parking').map((e) => e.text);

  const current = notes.length ? notes.at(-1) : 'No discussion notes captured yet.';
  const decisionLine = decisions.length ? decisions.slice(-3).join('; ') : 'No final decisions yet.';
  const openIssues = parking.length ? parking.slice(-3).join('; ') : 'No parked issues.';
  const nextActions = tasks.length ? tasks.slice(-3).join('; ') : 'No tasks captured.';
  return `Current discussion: ${current}\nKey decisions: ${decisionLine}\nOpen issues: ${openIssues}\nNext actions: ${nextActions}`;
}

function cmdSessionRead(): number {
  const session = loadActiveSession();
  if (!session) {
    console.log('[STRUCTURED]');
    console.log(renderField('session_id', ''));
    console.log(renderField('topic', ''));
    console.log(renderField('status', 'idle'));
    console.log(renderField('startedAt', ''));
    console.log(renderField('current_focus', ''));
    console.log(renderField('event_count', '0'));
    console.log(renderField('decision_count', '0'));
    console.log(renderField('task_count', '0'));
    console.log('\n[SUMMARY]');
    console.log('No active session.');
    return 0;
  }

  const events = readEvents(session.session_id);
  const decisionCount = events.filter((event) => event.type === 'decision').length;
  const taskCount = events.filter((event) => event.type === 'task').length;

  console.log('[STRUCTURED]');
  console.log(renderField('session_id', session.session_id));
  console.log(renderField('topic', session.topic));
  console.log(renderField('status', session.status));
  console.log(renderField('startedAt', session.started_at));
  console.log(renderField('current_focus', session.current_focus));
  console.log(renderField('event_count', String(events.length)));
  console.log(renderField('decision_count', String(decisionCount)));
  console.log(renderField('task_count', String(taskCount)));
  console.log('\n[SUMMARY]');
  console.log(summaryFromEvents(events));
  return 0;
}

function writeMinutes(session: Session, events: EventItem[]): string {
  mkdirSync(MINUTES_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = [...tokenize(session.topic)].join('-') || 'meeting';
  const outputPath = path.join(MINUTES_DIR, `${stamp}-${slug}-mtg.md`);

  const lines = (eventType: string): string[] => {
    const values = events.filter((event) => event.type === eventType).map((event) => event.text);
    return values.length ? values : ['None'];
  };

  const markdown = [
    '---',
    `session_id: ${session.session_id}`,
    `topic: ${session.topic}`,
    `started_at: ${session.started_at}`,
    `ended_at: ${utcNow()}`,
    '---',
    '',
    '# Discussion',
    ...lines('note').map((item) => `- ${item}`),
    '',
    '# Decisions',
    ...lines('decision').map((item) => `- ${item}`),
    '',
    '# Tasks',
    ...lines('task').map((item) => `- ${item}`),
    '',
    '# Parking Lot',
    ...lines('parking').map((item) => `- ${item}`),
    '',
  ];

  writeFileSync(outputPath, markdown.join('\n'), 'utf-8');
  return outputPath;
}

function appendCuratedDocs(session: Session, events: EventItem[]): void {
  const decisions = events.filter((event) => event.type === 'decision').map((event) => event.text);
  if (!decisions.length) return;

  mkdirSync(path.dirname(DOC_FILE), { recursive: true });
  appendFileSync(DOC_FILE, `\n## ${session.topic} (${new Date().toISOString().slice(0, 10)})\n`, 'utf-8');
  for (const decision of decisions) appendFileSync(DOC_FILE, `- ${decision}\n`, 'utf-8');
}

function appendTasksIssue(session: Session, events: EventItem[]): void {
  const tasks = events.filter((event) => event.type === 'task').map((event) => event.text);
  if (!tasks.length) return;

  mkdirSync(path.dirname(ISSUE_FILE), { recursive: true });
  appendFileSync(ISSUE_FILE, `\n## ${session.topic} (${new Date().toISOString().slice(0, 10)})\n`, 'utf-8');
  for (const task of tasks) appendFileSync(ISSUE_FILE, `- [ ] ${task}\n`, 'utf-8');
}

function appendExec(action: string, detail: string): void {
  ensureDirs();
  appendFileSync(EXEC_FILE, `${JSON.stringify({ action, detail, timestamp: utcNow() })}\n`, 'utf-8');
}

function cmdSessionDown(doGit: boolean): number {
  const session = loadActiveSession();
  if (!session) {
    console.log('No active session.');
    return 1;
  }

  const events = readEvents(session.session_id);
  session.status = 'ended';
  const minutesPath = writeMinutes(session, events);
  appendCuratedDocs(session, events);
  appendTasksIssue(session, events);

  if (doGit) {
    spawnSync('git', ['add', minutesPath, DOC_FILE, ISSUE_FILE], { stdio: 'inherit' });
    spawnSync('git', ['commit', '-m', `mtg: commit session ${session.session_id}`], { stdio: 'inherit' });
    appendExec('commit', `Committed minutes/docs for session ${session.session_id}`);
  }

  saveSession(null);
  console.log(`Session ${session.session_id} marked ended.`);
  console.log(`Minutes written: ${minutesPath}`);
  console.log('Session is immutable and cannot be resumed.');
  return 0;
}

function cmdEventWrite(eventType: string, text: string): number {
  const session = loadActiveSession();
  if (!session || session.status !== 'active') {
    console.log('No active session. Run: cs ss up <topic>');
    return 1;
  }
  appendEvent(session.session_id, eventType, text);
  console.log(`Appended ${eventType} event.`);
  return 0;
}

function cmdEventRead(query?: string): number {
  const session = loadActiveSession();
  const events: EventItem[] = [];
  if (session) {
    events.push(...readEvents(session.session_id));
  } else if (existsSync(EVENT_DIR)) {
    for (const name of readdirSync(EVENT_DIR).filter((n) => n.endsWith('.jsonl'))) {
      const lines = readFileSync(path.join(EVENT_DIR, name), 'utf-8').split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) events.push(JSON.parse(line));
      }
    }
  }

  for (const event of events) {
    const rendered = JSON.stringify(event);
    if (query && !rendered.toLowerCase().includes(query.toLowerCase())) continue;
    console.log(rendered);
  }
  return 0;
}

function cmdDocWrite(text: string): number {
  mkdirSync(path.dirname(DOC_FILE), { recursive: true });
  appendFileSync(DOC_FILE, `- ${text.trim()}\n`, 'utf-8');
  console.log(`Wrote curated doc entry to ${DOC_FILE}`);
  return 0;
}

function cmdDocRead(query?: string): number {
  if (!existsSync(DOC_FILE)) return 0;
  for (const line of readFileSync(DOC_FILE, 'utf-8').split(/\r?\n/)) {
    if (query && !line.toLowerCase().includes(query.toLowerCase())) continue;
    console.log(line);
  }
  return 0;
}

function cmdExecWrite(action: string): number {
  appendExec(action, action);
  console.log(`Execution action recorded: ${action}`);
  return 0;
}

function cmdExecRead(): number {
  if (!existsSync(EXEC_FILE)) return 0;
  console.log(readFileSync(EXEC_FILE, 'utf-8').trimEnd());
  return 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const doGit = args.includes('--git');
  const filtered = args.filter((arg) => arg !== '--git');

  const [rawLayer, rawAction, ...rest] = filtered;
  const layer = normalizeLayer(rawLayer);
  const action = normalizeAction(rawAction);
  const maybeTopicArg = rest.join(' ').trim().replace(/^topic\s*:\s*/i, '');

  if (layer === 'session' && action === 'ls') process.exit(cmdSessionLs());
  if (layer === 'session' && action === 'up') process.exit(await cmdSessionUp(maybeTopicArg));
  if (layer === 'session' && action === 'read') process.exit(cmdSessionRead());
  if (layer === 'session' && action === 'down') process.exit(cmdSessionDown(doGit));

  if (layer === 'event' && action === 'write') process.exit(cmdEventWrite(rest[0] ?? '', rest.slice(1).join(' ')));
  if (layer === 'event' && action === 'read') process.exit(cmdEventRead(rest[0]));

  if (layer === 'doc' && action === 'write') process.exit(cmdDocWrite(rest.join(' ')));
  if (layer === 'doc' && action === 'read') process.exit(cmdDocRead(rest[0]));

  if (layer === 'exec' && action === 'write') process.exit(cmdExecWrite(rest.join(' ')));
  if (layer === 'exec' && action === 'read') process.exit(cmdExecRead());

  console.error('Usage: cs [--git] <ss|ev|dc|ex> <action> [args...]');
  process.exit(1);
}

void main();
