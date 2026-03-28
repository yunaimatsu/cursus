import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.ts';

type TaskStatus = 'working' | 'waiting you' | 'PR made' | 'merged';

type TaskItem = {
  id: string;
  prompt: string;
  status: TaskStatus;
  branch: string;
  createdAt: string;
  updatedAt: string;
  details: string[];
};

type BoardState = {
  tasks: TaskItem[];
  focused: number;
};

const CONFIG = loadConfig();
const BOARD_DIR = path.join(CONFIG.paths.baseDir, 'board');
const BOARD_FILE = path.join(BOARD_DIR, 'tasks.json');

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40) || 'task';
}

function branchName(prompt: string): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `task/${stamp}-${slugify(prompt)}`;
}

function ensureBoardDir(): void {
  mkdirSync(BOARD_DIR, { recursive: true });
}

function loadBoardState(): BoardState {
  ensureBoardDir();
  if (!existsSync(BOARD_FILE)) return { tasks: [], focused: 0 };
  try {
    const parsed = JSON.parse(readFileSync(BOARD_FILE, 'utf-8')) as BoardState;
    parsed.tasks ??= [];
    parsed.focused = Math.max(0, Math.min(parsed.focused ?? 0, Math.max(0, parsed.tasks.length - 1)));
    return parsed;
  } catch {
    return { tasks: [], focused: 0 };
  }
}

function saveBoardState(state: BoardState): void {
  ensureBoardDir();
  writeFileSync(BOARD_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function createBranch(name: string): string | null {
  const proc = spawnSync('git', ['branch', name], { encoding: 'utf-8' });
  if (proc.status === 0) return null;

  const alreadyExists = (proc.stderr || proc.stdout || '').includes('already exists');
  if (alreadyExists) return null;
  return (proc.stderr || proc.stdout || 'failed to create branch').trim();
}

function wrap(text: string, width: number): string[] {
  if (width <= 8) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function clear(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

function printLine(text = ''): void {
  process.stdout.write(`${text}\n`);
}

function statusBadge(status: TaskStatus): string {
  switch (status) {
    case 'working':
      return '[WORKING]';
    case 'waiting you':
      return '[WAITING YOU]';
    case 'PR made':
      return '[PR MADE]';
    case 'merged':
      return '[MERGED]';
  }
}

function nextStatus(status: TaskStatus): TaskStatus {
  if (status === 'working') return 'waiting you';
  if (status === 'waiting you') return 'PR made';
  if (status === 'PR made') return 'merged';
  return 'working';
}

function statusColor(status: TaskStatus): string {
  if (status === 'working') return '\x1b[33m';
  if (status === 'waiting you') return '\x1b[36m';
  if (status === 'PR made') return '\x1b[35m';
  return '\x1b[32m';
}

function render(state: BoardState, promptLines: string[], showDetail: boolean, detailInput: string): void {
  clear();
  const width = process.stdout.columns || 100;
  const height = process.stdout.rows || 34;
  const topHeight = Math.max(8, Math.floor(height * 0.45));
  const bottomHeight = height - topHeight - 2;

  printLine('┌─ prompt board ─────────────────────────────────────────────────────────────────────┐');
  const renderedPrompt = promptLines.length ? promptLines : [''];
  for (let i = 0; i < topHeight - 2; i += 1) {
    const line = renderedPrompt[i] ?? '';
    printLine(`│ ${line.padEnd(Math.max(0, width - 4)).slice(0, width - 4)} │`);
  }
  printLine('└──────────────────────────────────────────────────────────────────────────────────────┘');

  printLine('┌─ task board (j/k: move, Enter: detail, n: newline, s: next status, q: quit) ─────┐');
  for (let i = 0; i < bottomHeight - 2; i += 1) {
    const task = state.tasks[i];
    if (!task) {
      printLine(`│ ${''.padEnd(Math.max(0, width - 4))} │`);
      continue;
    }
    const focused = i === state.focused ? '>' : ' ';
    const colored = `${statusColor(task.status)}${statusBadge(task.status)}\x1b[0m`;
    const title = task.prompt.replace(/\s+/g, ' ').slice(0, 48);
    const row = `${focused} ${colored} ${task.branch} :: ${title}`;
    printLine(`│ ${row.padEnd(Math.max(0, width - 4)).slice(0, width - 4)} │`);
  }
  printLine('└──────────────────────────────────────────────────────────────────────────────────────┘');

  if (showDetail) {
    const focusedTask = state.tasks[state.focused];
    printLine('┌─ task detail panel (i: add instruction, Esc: close detail) ───────────────────────┐');
    if (focusedTask) {
      const details = focusedTask.details.slice(-4).flatMap((item) => wrap(`- ${item}`, width - 4));
      const header = `${focusedTask.id.slice(0, 8)} ${focusedTask.branch} ${focusedTask.status}`;
      printLine(`│ ${header.padEnd(Math.max(0, width - 4)).slice(0, width - 4)} │`);
      const slots = 4;
      for (let i = 0; i < slots; i += 1) {
        const line = details[i] ?? '';
        printLine(`│ ${line.padEnd(Math.max(0, width - 4)).slice(0, width - 4)} │`);
      }
      const inputLine = detailInput ? `instruction> ${detailInput}` : 'instruction> ';
      printLine(`│ ${inputLine.padEnd(Math.max(0, width - 4)).slice(0, width - 4)} │`);
    } else {
      printLine(`│ ${'No tasks'.padEnd(Math.max(0, width - 4))} │`);
      printLine(`│ ${''.padEnd(Math.max(0, width - 4))} │`);
      printLine(`│ ${''.padEnd(Math.max(0, width - 4))} │`);
      printLine(`│ ${''.padEnd(Math.max(0, width - 4))} │`);
      printLine(`│ ${''.padEnd(Math.max(0, width - 4))} │`);
      printLine(`│ ${''.padEnd(Math.max(0, width - 4))} │`);
    }
    printLine('└──────────────────────────────────────────────────────────────────────────────────────┘');
  }
}

export async function runBoard(): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('board requires a TTY terminal.');
    return 1;
  }

  const state = loadBoardState();
  let prompt = '';
  let detailInput = '';
  let showDetail = false;
  let detailInsert = false;

  const promptLines = () => (prompt ? prompt.split('\n') : ['Type prompt. Enter=queue task / n=newline']);

  const originalRawMode = process.stdin.isRaw;
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf-8');

  const teardown = (): void => {
    process.stdin.setRawMode?.(Boolean(originalRawMode));
    process.stdin.pause();
    process.stdout.write('\x1b[0m\n');
    saveBoardState(state);
  };

  render(state, promptLines(), showDetail, detailInput);

  return await new Promise<number>((resolve) => {
    const onData = (chunk: string): void => {
      if (chunk === '\u0003' || chunk === 'q') {
        process.stdin.off('data', onData);
        teardown();
        resolve(0);
        return;
      }

      if (chunk === '\u001b') {
        if (detailInsert) {
          detailInsert = false;
          detailInput = '';
        } else {
          showDetail = false;
        }
        render(state, promptLines(), showDetail, detailInput);
        return;
      }

      if (chunk === '\u001b[A' || chunk === 'k') {
        state.focused = Math.max(0, state.focused - 1);
        render(state, promptLines(), showDetail, detailInput);
        return;
      }

      if (chunk === '\u001b[B' || chunk === 'j') {
        state.focused = Math.min(Math.max(0, state.tasks.length - 1), state.focused + 1);
        render(state, promptLines(), showDetail, detailInput);
        return;
      }

      if (chunk === 's' && state.tasks[state.focused]) {
        const task = state.tasks[state.focused];
        task.status = nextStatus(task.status);
        task.updatedAt = nowIso();
        task.details.push(`Status changed to ${task.status}`);
        render(state, promptLines(), showDetail, detailInput);
        return;
      }

      if (chunk === 'i' && showDetail && state.tasks[state.focused]) {
        detailInsert = true;
        detailInput = '';
        render(state, promptLines(), showDetail, detailInput);
        return;
      }

      if (chunk === 'n' && !detailInsert) {
        prompt = `${prompt}\n`;
        render(state, promptLines(), showDetail, detailInput);
        return;
      }

      const isEnter = chunk === '\r' || chunk === '\n' || chunk === '\x1b[13;2u';
      if (isEnter) {
        if (detailInsert && showDetail && state.tasks[state.focused]) {
          const trimmed = detailInput.trim();
          if (trimmed) {
            const task = state.tasks[state.focused];
            task.details.push(trimmed);
            task.status = 'working';
            task.updatedAt = nowIso();
          }
          detailInsert = false;
          detailInput = '';
          render(state, promptLines(), showDetail, detailInput);
          return;
        }

        if (showDetail) {
          showDetail = false;
          render(state, promptLines(), showDetail, detailInput);
          return;
        }

        const trimmed = prompt.trim();
        if (!trimmed) {
          showDetail = state.tasks.length > 0;
          render(state, promptLines(), showDetail, detailInput);
          return;
        }

        const branch = branchName(trimmed);
        const branchError = createBranch(branch);
        const task: TaskItem = {
          id: randomUUID(),
          prompt: trimmed,
          status: 'working',
          branch,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          details: [branchError ? `Branch error: ${branchError}` : `Created branch ${branch}`],
        };
        state.tasks.push(task);
        state.focused = state.tasks.length - 1;
        prompt = '';
        showDetail = false;
        saveBoardState(state);
        render(state, promptLines(), showDetail, detailInput);
        return;
      }

      if (chunk === '\u007f') {
        if (detailInsert) {
          detailInput = detailInput.slice(0, -1);
        } else {
          prompt = prompt.slice(0, -1);
        }
        render(state, promptLines(), showDetail, detailInput);
        return;
      }

      if (chunk >= ' ' && chunk.length === 1) {
        if (detailInsert) {
          detailInput += chunk;
        } else {
          prompt += chunk;
        }
        render(state, promptLines(), showDetail, detailInput);
      }
    };

    process.stdin.on('data', onData);
    process.on('SIGINT', () => {
      process.stdin.off('data', onData);
      teardown();
      resolve(0);
    });
  });
}
