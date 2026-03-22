from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    import tomli as tomllib


DEFAULT_END_KEYWORDS = {"end", "done", "終了"}
DEFAULT_COLOR_RULES = {
    "usage": "yellow_bold",
    "warning": "yellow",
    "status": "blue",
    "success": "green",
    "error": "red_bold",
    "default": "cyan",
    "exit": "dim",
}


@dataclass
class ColorConfig:
    enabled: bool | None = None
    rules: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_COLOR_RULES))


@dataclass
class OrgaiConfig:
    end_keywords: set[str] = field(default_factory=lambda: set(DEFAULT_END_KEYWORDS))
    color: ColorConfig = field(default_factory=ColorConfig)


def load_config(path: Path | None) -> OrgaiConfig:
    if path is None:
        path = Path("orgai.toml")

    if not path.exists():
        return OrgaiConfig()

    payload = tomllib.loads(path.read_text(encoding="utf-8"))
    return _to_config(payload)


def _to_config(payload: dict[str, Any]) -> OrgaiConfig:
    end_keywords = set(DEFAULT_END_KEYWORDS)
    raw_keywords = payload.get("meeting", {}).get("end_keywords")
    if isinstance(raw_keywords, list):
        end_keywords = {str(item).strip().lower() for item in raw_keywords if str(item).strip()}

    color_enabled: bool | None = None
    color_rules = dict(DEFAULT_COLOR_RULES)

    raw_color = payload.get("color", {})
    if isinstance(raw_color, dict):
        if "enabled" in raw_color:
            color_enabled = bool(raw_color["enabled"])
        raw_rules = raw_color.get("rules")
        if isinstance(raw_rules, dict):
            for key, value in raw_rules.items():
                if key in color_rules and isinstance(value, str) and value.strip():
                    color_rules[key] = value.strip().lower()

    return OrgaiConfig(
        end_keywords=end_keywords,
        color=ColorConfig(enabled=color_enabled, rules=color_rules),
    )
