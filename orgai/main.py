from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

BASE_DIR = Path('.mtg')
SESSION_FILE = BASE_DIR / 'session.json'
EVENT_DIR = BASE_DIR / 'events'
DOC_FILE = Path('docs/knowledge/decisions.md')
ISSUE_FILE = Path('docs/issues/tasks.md')
EXEC_FILE = BASE_DIR / 'exec.jsonl'
MINUTES_DIR = Path('docs/minutes')

ALLOWED_EVENT_TYPES = {'note', 'decision', 'task', 'parking'}


@dataclass
class Session:
    session_id: str
    topic: str
    status: str
    started_at: str
    current_focus: str
    retrieval_sources: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            'session_id': self.session_id,
            'topic': self.topic,
            'status': self.status,
            'started_at': self.started_at,
            'current_focus': self.current_focus,
            'retrieval_sources': self.retrieval_sources,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> 'Session':
        return cls(
            session_id=payload['session_id'],
            topic=payload['topic'],
            status=payload['status'],
            started_at=payload['started_at'],
            current_focus=payload.get('current_focus', payload['topic']),
            retrieval_sources=list(payload.get('retrieval_sources', [])),
        )


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dirs() -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    EVENT_DIR.mkdir(parents=True, exist_ok=True)


def load_active_session() -> Session | None:
    if not SESSION_FILE.exists():
        return None
    return Session.from_dict(json.loads(SESSION_FILE.read_text(encoding='utf-8')))


def save_session(session: Session | None) -> None:
    ensure_dirs()
    if session is None:
        if SESSION_FILE.exists():
            SESSION_FILE.unlink()
        return
    SESSION_FILE.write_text(json.dumps(session.to_dict(), indent=2), encoding='utf-8')


def session_event_file(session_id: str) -> Path:
    return EVENT_DIR / f'{session_id}.jsonl'


def append_event(session_id: str, event_type: str, text: str) -> dict[str, Any]:
    if event_type not in ALLOWED_EVENT_TYPES:
        raise ValueError(f'Unsupported event type: {event_type}')
    event = {
        'type': event_type,
        'text': text,
        'timestamp': utc_now(),
        'sessionId': session_id,
    }
    path = session_event_file(session_id)
    with path.open('a', encoding='utf-8') as fh:
        fh.write(json.dumps(event, ensure_ascii=False) + '\n')
    return event


def read_events(session_id: str) -> list[dict[str, Any]]:
    path = session_event_file(session_id)
    if not path.exists():
        return []
    events: list[dict[str, Any]] = []
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.strip():
            events.append(json.loads(line))
    return events


def tokenize(text: str) -> set[str]:
    parts = [''.join(ch for ch in token.lower() if ch.isalnum()) for token in text.split()]
    return {p for p in parts if p}


def retrieval_candidates(topic: str) -> list[dict[str, Any]]:
    topic_tokens = tokenize(topic)
    files = [
        path
        for path in Path('.').glob('**/*')
        if path.is_file() and '.git' not in path.parts and '.mtg' not in path.parts
    ]
    scored: list[dict[str, Any]] = []
    for path in files:
        if path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.gif', '.pdf', '.pyc'}:
            continue
        text = path.read_text(encoding='utf-8', errors='ignore')[:20000]
        if not text.strip():
            continue
        content_tokens = tokenize(text)
        overlap = len(topic_tokens.intersection(content_tokens))
        if overlap <= 0:
            continue
        kind = 'code' if path.suffix in {'.py', '.ts', '.tsx', '.js', '.jsx', '.rs', '.go', '.java'} else 'doc'
        if 'decision' in str(path).lower():
            kind = 'decision'
        # doc > event > code preference via bonus
        bonus = 0.15 if kind == 'doc' else 0.1 if kind == 'decision' else 0.0
        score = min(0.99, overlap / max(len(topic_tokens), 1) + bonus)
        scored.append({'path': str(path), 'type': kind, 'score': round(score, 2)})
    scored.sort(key=lambda item: (item['score'], 1 if item['type'] == 'doc' else 0), reverse=True)
    if not scored:
        fallbacks = [Path('README.md'), Path('orgai/main.py')]
        for fb in fallbacks:
            if fb.exists():
                scored.append({'path': str(fb), 'type': 'doc' if fb.suffix == '.md' else 'code', 'score': 0.01})
    return scored[:5]


def cmd_session_ls() -> int:
    session = load_active_session()
    if not session:
        print('No active session.')
        return 0
    print(f"{session.session_id}\t{session.topic}\t{session.status}\t{session.started_at}")
    return 0


def cmd_session_up(topic: str) -> int:
    ensure_dirs()
    session_id = str(uuid4())
    sources = retrieval_candidates(topic)

    # Mandatory retrieval visibility before loading context.
    for item in sources:
        print(f"reading {item['path']} ({item['type']}, score={item['score']:.2f}) ...")

    session = Session(
        session_id=session_id,
        topic=topic,
        status='active',
        started_at=utc_now(),
        current_focus=topic,
        retrieval_sources=sources,
    )
    save_session(session)
    print(f'Created session {session_id}')
    print(f'Topic set: {topic}')
    print('Context reconstruction complete; session active.')
    return 0


def _summary_from_events(events: list[dict[str, Any]]) -> str:
    decisions = [event['text'] for event in events if event['type'] == 'decision']
    tasks = [event['text'] for event in events if event['type'] == 'task']
    notes = [event['text'] for event in events if event['type'] == 'note']
    parking = [event['text'] for event in events if event['type'] == 'parking']

    current = notes[-1] if notes else 'No discussion notes captured yet.'
    decision_line = '; '.join(decisions[-3:]) if decisions else 'No final decisions yet.'
    open_issues = '; '.join(parking[-3:]) if parking else 'No parked issues.'
    next_actions = '; '.join(tasks[-3:]) if tasks else 'No tasks captured.'

    return (
        f"Current discussion: {current}\n"
        f"Key decisions: {decision_line}\n"
        f"Open issues: {open_issues}\n"
        f"Next actions: {next_actions}"
    )


def cmd_session_read() -> int:
    session = load_active_session()
    if not session:
        print('[STRUCTURED]')
        print('session_id:')
        print('topic:')
        print('status: idle')
        print('startedAt:')
        print('current_focus:')
        print('event_count: 0')
        print('decision_count: 0')
        print('task_count: 0')
        print('\n[SUMMARY]')
        print('No active session.')
        return 0

    events = read_events(session.session_id)
    decision_count = sum(1 for event in events if event['type'] == 'decision')
    task_count = sum(1 for event in events if event['type'] == 'task')

    print('[STRUCTURED]')
    print(f'session_id: {session.session_id}')
    print(f'topic: {session.topic}')
    print(f'status: {session.status}')
    print(f'startedAt: {session.started_at}')
    print(f'current_focus: {session.current_focus}')
    print(f'event_count: {len(events)}')
    print(f'decision_count: {decision_count}')
    print(f'task_count: {task_count}')
    print('\n[SUMMARY]')
    print(_summary_from_events(events))
    return 0


def _write_minutes(session: Session, events: list[dict[str, Any]]) -> Path:
    MINUTES_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    slug = '-'.join(tokenize(session.topic)) or 'meeting'
    path = MINUTES_DIR / f'{stamp}-{slug}-mtg.md'

    def lines(event_type: str) -> list[str]:
        vals = [event['text'] for event in events if event['type'] == event_type]
        return vals or ['None']

    markdown = [
        '---',
        f'session_id: {session.session_id}',
        f'topic: {session.topic}',
        f'started_at: {session.started_at}',
        f'ended_at: {utc_now()}',
        '---',
        '',
        '# Discussion',
        *[f'- {item}' for item in lines('note')],
        '',
        '# Decisions',
        *[f'- {item}' for item in lines('decision')],
        '',
        '# Tasks',
        *[f'- {item}' for item in lines('task')],
        '',
        '# Parking Lot',
        *[f'- {item}' for item in lines('parking')],
        '',
    ]
    path.write_text('\n'.join(markdown), encoding='utf-8')
    return path


def _append_curated_docs(session: Session, events: list[dict[str, Any]]) -> None:
    decisions = [event['text'] for event in events if event['type'] == 'decision']
    if not decisions:
        return
    DOC_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DOC_FILE.open('a', encoding='utf-8') as fh:
        fh.write(f"\n## {session.topic} ({datetime.now(timezone.utc).date().isoformat()})\n")
        for decision in decisions:
            fh.write(f'- {decision}\n')


def _append_tasks_issue(session: Session, events: list[dict[str, Any]]) -> None:
    tasks = [event['text'] for event in events if event['type'] == 'task']
    if not tasks:
        return
    ISSUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with ISSUE_FILE.open('a', encoding='utf-8') as fh:
        fh.write(f"\n## {session.topic} ({datetime.now(timezone.utc).date().isoformat()})\n")
        for task in tasks:
            fh.write(f'- [ ] {task}\n')


def append_exec(action: str, detail: str) -> None:
    ensure_dirs()
    payload = {'action': action, 'detail': detail, 'timestamp': utc_now()}
    with EXEC_FILE.open('a', encoding='utf-8') as fh:
        fh.write(json.dumps(payload, ensure_ascii=False) + '\n')


def cmd_session_down(do_git: bool) -> int:
    session = load_active_session()
    if not session:
        print('No active session.')
        return 1

    events = read_events(session.session_id)
    session.status = 'ended'
    minutes_path = _write_minutes(session, events)
    _append_curated_docs(session, events)
    _append_tasks_issue(session, events)

    if do_git:
        subprocess.run(['git', 'add', str(minutes_path), str(DOC_FILE), str(ISSUE_FILE)], check=False)
        subprocess.run(['git', 'commit', '-m', f'mtg: commit session {session.session_id}'], check=False)
        append_exec('commit', f'Committed minutes/docs for session {session.session_id}')

    save_session(None)
    print(f'Session {session.session_id} marked ended.')
    print(f'Minutes written: {minutes_path}')
    print('Session is immutable and cannot be resumed.')
    return 0


def cmd_event_write(event_type: str, text: str) -> int:
    session = load_active_session()
    if not session or session.status != 'active':
        print('No active session. Run: mtg session up <topic>')
        return 1
    append_event(session.session_id, event_type, text)
    print(f'Appended {event_type} event.')
    return 0


def cmd_event_read(query: str | None) -> int:
    session = load_active_session()
    if session:
        events = read_events(session.session_id)
    else:
        events = []
        for path in EVENT_DIR.glob('*.jsonl') if EVENT_DIR.exists() else []:
            for line in path.read_text(encoding='utf-8').splitlines():
                if line.strip():
                    events.append(json.loads(line))

    for event in events:
        rendered = json.dumps(event, ensure_ascii=False)
        if query and query.lower() not in rendered.lower():
            continue
        print(rendered)
    return 0


def cmd_doc_write(text: str) -> int:
    DOC_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DOC_FILE.open('a', encoding='utf-8') as fh:
        fh.write(f'- {text.strip()}\n')
    print(f'Wrote curated doc entry to {DOC_FILE}')
    return 0


def cmd_doc_read(query: str | None) -> int:
    if not DOC_FILE.exists():
        return 0
    for line in DOC_FILE.read_text(encoding='utf-8').splitlines():
        if query and query.lower() not in line.lower():
            continue
        print(line)
    return 0


def cmd_exec_write(action: str) -> int:
    append_exec(action, action)
    print(f'Execution action recorded: {action}')
    return 0


def cmd_exec_read() -> int:
    if not EXEC_FILE.exists():
        return 0
    print(EXEC_FILE.read_text(encoding='utf-8').rstrip())
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Meeting Command System (mtg)')
    parser.add_argument('--git', action='store_true', help='Enable optional git commit on session down.')
    sub = parser.add_subparsers(dest='layer', required=True)

    session = sub.add_parser('session')
    session_sub = session.add_subparsers(dest='action', required=True)
    session_sub.add_parser('ls')
    up = session_sub.add_parser('up')
    up.add_argument('topic')
    session_sub.add_parser('read')
    session_sub.add_parser('down')

    event = sub.add_parser('event')
    event_sub = event.add_subparsers(dest='action', required=True)
    event_write = event_sub.add_parser('write')
    event_write.add_argument('type')
    event_write.add_argument('text')
    event_read = event_sub.add_parser('read')
    event_read.add_argument('query', nargs='?')

    doc = sub.add_parser('doc')
    doc_sub = doc.add_subparsers(dest='action', required=True)
    doc_write = doc_sub.add_parser('write')
    doc_write.add_argument('text')
    doc_read = doc_sub.add_parser('read')
    doc_read.add_argument('query', nargs='?')

    exec_layer = sub.add_parser('exec')
    exec_sub = exec_layer.add_subparsers(dest='action', required=True)
    exec_write = exec_sub.add_parser('write')
    exec_write.add_argument('action_text')
    exec_sub.add_parser('read')

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.layer == 'session' and args.action == 'ls':
        raise SystemExit(cmd_session_ls())
    if args.layer == 'session' and args.action == 'up':
        raise SystemExit(cmd_session_up(args.topic))
    if args.layer == 'session' and args.action == 'read':
        raise SystemExit(cmd_session_read())
    if args.layer == 'session' and args.action == 'down':
        raise SystemExit(cmd_session_down(do_git=args.git))

    if args.layer == 'event' and args.action == 'write':
        raise SystemExit(cmd_event_write(args.type, args.text))
    if args.layer == 'event' and args.action == 'read':
        raise SystemExit(cmd_event_read(args.query))

    if args.layer == 'doc' and args.action == 'write':
        raise SystemExit(cmd_doc_write(args.text))
    if args.layer == 'doc' and args.action == 'read':
        raise SystemExit(cmd_doc_read(args.query))

    if args.layer == 'exec' and args.action == 'write':
        raise SystemExit(cmd_exec_write(args.action_text))
    if args.layer == 'exec' and args.action == 'read':
        raise SystemExit(cmd_exec_read())


if __name__ == '__main__':
    main()
