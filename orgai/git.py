from __future__ import annotations

import subprocess
from dataclasses import dataclass


@dataclass
class GitResult:
    ok: bool
    message: str
    command: str = ""


def _run(command: list[str]) -> tuple[bool, str]:
    proc = subprocess.run(command, text=True, capture_output=True)
    if proc.returncode == 0:
        return True, proc.stdout.strip() or "ok"
    return False, (proc.stderr.strip() or proc.stdout.strip() or "unknown git error")


def current_branch() -> str:
    ok, out = _run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    return out if ok else "main"


def create_branch(branch: str) -> GitResult:
    ok, out = _run(["git", "checkout", "-b", branch])
    if ok:
        return GitResult(True, f"Created and switched to branch {branch}")
    return GitResult(False, f"Blocked: failed to create branch: {out}", command=f"git checkout -b {branch}")


def commit_minutes(path: str, topic: str) -> GitResult:
    ok, out = _run(["git", "add", path])
    if not ok:
        return GitResult(False, f"Blocked: git add failed: {out}", command=f"git add {path}")

    message = f"mtg: add minutes for {topic}"
    ok, out = _run(["git", "commit", "-m", message])
    if not ok:
        return GitResult(False, f"Blocked: git commit failed: {out}", command=f"git commit -m \"{message}\"")
    return GitResult(True, out)


def push_branch(branch: str) -> GitResult:
    ok, out = _run(["git", "push", "--set-upstream", "origin", branch])
    if ok:
        return GitResult(True, out)
    return GitResult(
        False,
        f"Blocked: git push failed (auth or remote issue): {out}",
        command=f"git push --set-upstream origin {branch}",
    )
