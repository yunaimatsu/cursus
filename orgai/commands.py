from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ParsedCommand:
    name: str
    args: str


def parse_command(raw: str) -> ParsedCommand | None:
    text = raw.strip()
    if not text.startswith("/"):
        return None

    parts = text[1:].split(maxsplit=1)
    name = parts[0].lower() if parts and parts[0] else ""
    args = parts[1] if len(parts) > 1 else ""
    if not name:
        return None
    return ParsedCommand(name=name, args=args)
