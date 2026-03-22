from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class Minutes:
    """Single source of truth for meeting contents."""

    summary: str = ""
    discussion: list[str] = field(default_factory=list)
    decisions: list[str] = field(default_factory=list)
    decision_candidates: list[str] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)
    action_items: list[str] = field(default_factory=list)
    action_item_candidates: list[str] = field(default_factory=list)
    parking_lot: list[str] = field(default_factory=list)
    current_focus: str = ""

    def add_discussion(self, text: str) -> None:
        text = text.strip()
        if text:
            self.discussion.append(text)

    def add_parking_lot(self, text: str) -> None:
        text = text.strip()
        if text:
            self.parking_lot.append(text)

    def set_focus(self, text: str) -> None:
        self.current_focus = text.strip()

    def add_decision_candidate(self, text: str) -> None:
        text = text.strip()
        if text:
            self.decision_candidates.append(text)

    def add_action_item_candidate(self, text: str) -> None:
        text = text.strip()
        if text:
            self.action_item_candidates.append(text)

    def add_note(self, text: str) -> None:
        self.add_discussion(f"NOTE: {text.strip()}")

    def finalize(self) -> None:
        """Promote candidates if explicit items are absent."""
        if not self.decisions and self.decision_candidates:
            self.decisions.extend(self.decision_candidates)
        if not self.action_items and self.action_item_candidates:
            self.action_items.extend(self.action_item_candidates)

        if not self.decisions:
            self.open_questions.append("No final decision recorded; follow-up required.")
        if not self.action_items:
            self.action_items.append("Owner TBD: schedule follow-up to assign concrete tasks.")

        if not self.summary and self.discussion:
            preview = " ".join(self.discussion[:2])
            self.summary = preview[:280]

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "discussion": self.discussion,
            "decisions": self.decisions,
            "decision_candidates": self.decision_candidates,
            "open_questions": self.open_questions,
            "action_items": self.action_items,
            "action_item_candidates": self.action_item_candidates,
            "parking_lot": self.parking_lot,
            "current_focus": self.current_focus,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "Minutes":
        return cls(
            summary=payload.get("summary", ""),
            discussion=list(payload.get("discussion", [])),
            decisions=list(payload.get("decisions", [])),
            decision_candidates=list(payload.get("decision_candidates", [])),
            open_questions=list(payload.get("open_questions", [])),
            action_items=list(payload.get("action_items", [])),
            action_item_candidates=list(payload.get("action_item_candidates", [])),
            parking_lot=list(payload.get("parking_lot", [])),
            current_focus=payload.get("current_focus", ""),
        )


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
