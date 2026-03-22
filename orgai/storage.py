from __future__ import annotations

import json
from pathlib import Path

from .meeting import Meeting


STATE_FILE = Path(".orgai_session.json")


def save_session(meeting: Meeting | None) -> None:
    if meeting is None:
        if STATE_FILE.exists():
            STATE_FILE.unlink()
        return

    STATE_FILE.write_text(json.dumps(meeting.to_dict(), indent=2), encoding="utf-8")


def load_session() -> Meeting | None:
    if not STATE_FILE.exists():
        return None

    payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return Meeting.from_dict(payload)
