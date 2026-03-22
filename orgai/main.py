from __future__ import annotations

import argparse
import os
import sys

from .commands import ParsedCommand, parse_command
from .git import commit_minutes, create_branch, current_branch, push_branch
from .meeting import Meeting, MeetingState
from .storage import load_session, save_session

END_KEYWORDS = {"end", "done", "終了"}


class Ansi:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    CYAN = "\033[36m"


class OrgaiApp:
    def __init__(self, git_enabled: bool = True) -> None:
        self.meeting = load_session()
        self.git_enabled = git_enabled
        self.thread_drift_count = 0
        self.enable_color = sys.stdout.isatty() and os.getenv("NO_COLOR") is None

    def run(self) -> None:
        mode = "git-enabled" if self.git_enabled else "git-disabled"
        print(
            self._colorize(
                f"orgai CLI ready ({mode}). Type /start <topic> to begin, /end to close, /status for state."
            )
        )
        while True:
            try:
                raw = input("> ").strip()
            except (KeyboardInterrupt, EOFError):
                print(f"\n{self._paint('Exiting orgai.', Ansi.DIM)}")
                break

            if not raw:
                continue

            cmd = parse_command(raw)
            if cmd:
                print(self._colorize(self.handle_command(cmd)))
                continue

            print(self._colorize(self.handle_text(raw)))

    def handle_command(self, cmd: ParsedCommand) -> str:
        handlers = {
            "start": self._cmd_start,
            "end": self._cmd_end,
            "focus": self._cmd_focus,
            "park": self._cmd_park,
            "status": self._cmd_status,
            "decide": self._cmd_decide,
            "task": self._cmd_task,
            "note": self._cmd_note,
        }
        handler = handlers.get(cmd.name)
        if not handler:
            return f"Unknown command: /{cmd.name}"
        return handler(cmd.args)

    def handle_text(self, text: str) -> str:
        if self.meeting is None or self.meeting.state == MeetingState.IDLE:
            return "No active meeting. Start one with /start <topic>."

        if self.meeting.state == MeetingState.RUNNING and text.strip().lower() in END_KEYWORDS:
            return self._cmd_end("")

        if self.meeting.state != MeetingState.RUNNING:
            return f"Meeting is in state={self.meeting.state.value}; command processing only."

        classification = classify_topic(self.meeting.topic, self.meeting.minutes.current_focus, text)
        if classification == "off-topic":
            self.meeting.minutes.add_parking_lot(text)
            self.thread_drift_count += 1
            self._maybe_rotate_focus(text)
            save_session(self.meeting)
            return "Captured in Parking Lot (off-topic)."

        self.meeting.minutes.add_discussion(text)
        if classification == "derived":
            self.meeting.minutes.add_parking_lot(f"Derived thread: {text}")
            self.thread_drift_count += 1
            self._maybe_rotate_focus(text)
        else:
            self.thread_drift_count = 0
        save_session(self.meeting)
        return "Added to discussion."

    def _cmd_start(self, args: str) -> str:
        topic = args.strip()
        if not topic:
            return "Usage: /start <topic>"
        if self.meeting and self.meeting.state in {MeetingState.RUNNING, MeetingState.CLOSING}:
            return f"Meeting already active: {self.meeting.topic} ({self.meeting.state.value})"

        started_from = current_branch() if self.git_enabled else "main"
        self.meeting = Meeting.start(topic=topic, started_from_branch=started_from)
        save_session(self.meeting)

        if not self.git_enabled:
            return f"Meeting started: {topic}\nGit mode disabled; branch creation skipped."

        branch_result = create_branch(self.meeting.branch)
        if branch_result.ok:
            return f"Meeting started: {topic}\n{branch_result.message}"

        return (
            f"Meeting started: {topic}\n"
            f"{branch_result.message}\n\nRun:\n{branch_result.command}\nThen continue."
        )

    def _cmd_end(self, _: str) -> str:
        if self.meeting is None:
            return "No active meeting."
        if self.meeting.state == MeetingState.DONE:
            return "Meeting is already done."

        self.meeting.state = MeetingState.CLOSING
        md = self.meeting.finalize_to_markdown()
        path = self.meeting.minutes_filename()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(md, encoding="utf-8")

        if not self.git_enabled:
            self.meeting.state = MeetingState.DONE
            save_session(self.meeting)
            return f"Meeting finalized at {path}.\nGit mode disabled; commit/push skipped."

        commit_result = commit_minutes(str(path), self.meeting.topic)
        if not commit_result.ok:
            save_session(self.meeting)
            return f"{commit_result.message}\n\nRun:\n{commit_result.command}\nThen reply \"done\"."

        push_result = push_branch(self.meeting.branch)
        self.meeting.state = MeetingState.DONE
        save_session(self.meeting)

        if not push_result.ok:
            return (
                f"Minutes finalized at {path}.\n"
                f"{push_result.message}\n\nRun:\n{push_result.command}\nThen reply \"done\"."
            )

        return (
            f"Meeting finalized at {path}.\n"
            f"Committed and pushed branch {self.meeting.branch}.\n"
            "PR preparation: create a PR from this branch to your default base branch."
        )

    def _cmd_focus(self, args: str) -> str:
        if not self._ensure_running():
            return "No RUNNING meeting."
        self.meeting.minutes.set_focus(args)
        self.thread_drift_count = 0
        save_session(self.meeting)
        return f"Focus updated: {self.meeting.minutes.current_focus}"

    def _cmd_park(self, args: str) -> str:
        if not self._ensure_running():
            return "No RUNNING meeting."
        self.meeting.minutes.add_parking_lot(args)
        save_session(self.meeting)
        return "Added to parking lot."

    def _cmd_status(self, _: str) -> str:
        if not self.meeting:
            return "State: IDLE"
        return (
            f"State: {self.meeting.state.value}\n"
            f"Topic: {self.meeting.topic}\n"
            f"Branch: {self.meeting.branch}\n"
            f"Focus: {self.meeting.minutes.current_focus or '(none)'}\n"
            f"Discussion items: {len(self.meeting.minutes.discussion)}\n"
            f"Drift counter: {self.thread_drift_count}"
        )

    def _cmd_decide(self, args: str) -> str:
        if not self._ensure_running():
            return "No RUNNING meeting."
        self.meeting.minutes.add_decision_candidate(args)
        save_session(self.meeting)
        return "Decision candidate added."

    def _cmd_task(self, args: str) -> str:
        if not self._ensure_running():
            return "No RUNNING meeting."
        self.meeting.minutes.add_action_item_candidate(args)
        save_session(self.meeting)
        return "Action item candidate added."

    def _cmd_note(self, args: str) -> str:
        if not self._ensure_running():
            return "No RUNNING meeting."
        self.meeting.minutes.add_note(args)
        save_session(self.meeting)
        return "Note added."

    def _ensure_running(self) -> bool:
        return self.meeting is not None and self.meeting.state == MeetingState.RUNNING

    def _maybe_rotate_focus(self, latest_text: str) -> None:
        if self.thread_drift_count < 3:
            return
        if self.meeting is None:
            return
        suggested_focus = f"Refocus needed: {latest_text[:80]}"
        self.meeting.minutes.set_focus(suggested_focus)
        self.thread_drift_count = 0

    def _paint(self, text: str, color: str, *, bold: bool = False) -> str:
        if not self.enable_color:
            return text
        prefix = f"{Ansi.BOLD}{color}" if bold else color
        return f"{prefix}{text}{Ansi.RESET}"

    def _colorize(self, text: str) -> str:
        lowered = text.lower()
        if lowered.startswith("usage:") or "no active meeting" in lowered or "unknown command" in lowered:
            return self._paint(text, Ansi.YELLOW, bold=True)
        if "off-topic" in lowered or "refocus needed" in lowered:
            return self._paint(text, Ansi.YELLOW)
        if "state=" in lowered or lowered.startswith("state:"):
            return self._paint(text, Ansi.BLUE)
        if "finalized" in lowered or "started" in lowered or "added" in lowered or "updated" in lowered:
            return self._paint(text, Ansi.GREEN)
        if "failed" in lowered or "error" in lowered:
            return self._paint(text, Ansi.RED, bold=True)
        return self._paint(text, Ansi.CYAN)


def classify_topic(topic: str, focus: str, text: str) -> str:
    """Heuristic anti-drift classification: on-topic | derived | off-topic."""
    content_tokens = set(text.lower().split())
    topic_tokens = set(topic.lower().split())
    focus_tokens = set(focus.lower().split()) if focus else set()

    overlap = len(topic_tokens.intersection(content_tokens)) + len(focus_tokens.intersection(content_tokens))
    if overlap >= 2:
        return "on-topic"
    if overlap == 1:
        return "derived"
    return "off-topic"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="orgai Meeting Protocol CLI")
    parser.add_argument(
        "--no-git",
        action="store_true",
        help="Disable git branch/commit/push operations (useful for local dry runs).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    OrgaiApp(git_enabled=not args.no_git).run()


if __name__ == "__main__":
    main()
