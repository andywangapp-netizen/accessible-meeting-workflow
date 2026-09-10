"""Load case folders, skill packs, and local env files without logging secrets."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    """Return the repository root (parent of ``src/``)."""
    return Path(__file__).resolve().parents[2]


def read_text(path: Path) -> str:
    """Read a UTF-8 text file."""
    return path.read_text(encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    """Load a JSON object from disk."""
    data = json.loads(read_text(path))
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return data


def load_pack(pack_dir: Path) -> dict[str, Any]:
    """Load a skill pack directory (SKILL.md + schema.json + forbidden.md)."""
    schema = load_json(pack_dir / "schema.json")
    forbidden_text = read_text(pack_dir / "forbidden.md")
    phrases = [
        line[2:].strip()
        for line in forbidden_text.splitlines()
        if line.startswith("- ")
    ]
    return {
        "dir": pack_dir,
        "skill_markdown": read_text(pack_dir / "SKILL.md"),
        "schema": schema,
        "forbidden_phrases": phrases,
        "rubric_markdown": read_text(pack_dir / "rubric.md")
        if (pack_dir / "rubric.md").exists()
        else "",
    }


def load_case(case_dir: Path) -> dict[str, Any]:
    """Load a synthetic case folder (transcript, request, facts)."""
    return {
        "dir": case_dir,
        "transcript": read_text(case_dir / "transcript.md"),
        "request": read_text(case_dir / "request.txt").strip(),
        "facts": load_json(case_dir / "facts.json"),
    }


def load_dotenv(path: Path) -> None:
    """Load KEY=VALUE lines into os.environ if the file exists. Skip comments."""
    if not path.is_file():
        return
    for raw in read_text(path).splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip()
