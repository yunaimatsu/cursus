from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import uuid4

from .minutes import Minutes, utc_now_iso


class MeetingState(str, Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    CLOSING = "CLOSING"
    DONE = "DONE"


@dataclass
class Meeting:
    id: str
    topic: str
    state: MeetingState
    branch: str
    started_from_branch: str
    minutes: Minutes
    created_at: str

    @classmethod
    def start(cls, topic: str, started_from_branch: str) -> "Meeting":
        date = datetime.now(timezone.utc).date().isoformat()
        slug = slugify(topic)
        branch = f"mtg/{date}-{slug}"
        return cls(
            id=str(uuid4()),
            topic=topic.strip(),
            state=MeetingState.RUNNING,
            branch=branch,
            started_from_branch=started_from_branch,
            minutes=Minutes(current_focus=topic.strip()),
            created_at=utc_now_iso(),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "topic": self.topic,
            "state": self.state.value,
            "branch": self.branch,
            "started_from_branch": self.started_from_branch,
            "minutes": self.minutes.to_dict(),
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "Meeting":
        return cls(
            id=payload["id"],
            topic=payload["topic"],
            state=MeetingState(payload["state"]),
            branch=payload["branch"],
            started_from_branch=payload["started_from_branch"],
            minutes=Minutes.from_dict(payload["minutes"]),
            created_at=payload.get("created_at", utc_now_iso()),
        )

    def finalize_to_markdown(self) -> str:
        self.minutes.finalize()
        date = datetime.now(timezone.utc).date().isoformat()
        timestamp = utc_now_iso()

        yaml = "\n".join(
            [
                "---",
                f"title: {self.topic}",
                f"meeting_name: {self.topic}",
                f"topic: {self.topic}",
                f"date: {date}",
                f"timestamp: {timestamp}",
                "tool: orgai",
                "meeting_type: general",
                "participants: [user, orgai]",
                f"objective: Discuss {self.topic}",
                "constraints: []",
                f"started_from_branch: {self.started_from_branch}",
                f"branch: {self.branch}",
                "status: done",
                "---",
                "",
            ]
        )

        def section(title: str, items: list[str]) -> str:
            body = "\n".join([f"- {i}" for i in items]) if items else "- None"
            return f"# {title}\n{body}\n"

        discussion = section("Discussion", self.minutes.discussion)
        decisions = section("Decisions", self.minutes.decisions)
        open_questions = section("Open Questions", self.minutes.open_questions)
        action_items = section("Action Items", self.minutes.action_items)
        parking = section("Parking Lot", self.minutes.parking_lot)

        return f"{yaml}{discussion}\n{decisions}\n{open_questions}\n{action_items}\n{parking}"

    def minutes_filename(self) -> Path:
        date = datetime.now(timezone.utc).date().isoformat()
        slug = slugify(self.topic)
        return Path("docs/minutes") / f"{date}-{slug}-orgai.md"


def slugify(text: str) -> str:
    compact = "-".join(text.strip().lower().split())
    keep = [c for c in compact if c.isalnum() or c == "-"]
    return "".join(keep)[:60] or "meeting"
