"""Keep the checked-in surface small and obviously public-safe."""

from __future__ import annotations

import re
from pathlib import Path

from ameval.files import repo_root


ROOT = repo_root()


def _public_files() -> list[Path]:
    ignored_parts = {".git", ".venv", ".pytest_cache", "__pycache__", ".mypy_cache"}
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in ignored_parts for part in path.parts):
            continue
        if path.name.endswith(".pyc") or ".egg-info" in path.parts:
            continue
        files.append(path)
    return files


def test_only_production_and_testing_autism_skills_are_public() -> None:
    skill_paths = [path.relative_to(ROOT).as_posix() for path in ROOT.rglob("SKILL.md")]
    assert sorted(skill_paths) == [
        "SKILL.md",
        "testing/autism-friendly-meeting-card-test/SKILL.md",
    ]


def test_public_files_have_no_credential_material() -> None:
    credential_patterns = [
        re.compile(r"-----BEGIN [A-Z ]+PRIVATE KEY-----"),
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
        re.compile(r"\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b"),
        re.compile(r"https?://[^\s)]+(?:localhost|127\.0\.0\.1|[^/]+\.internal)\b", re.IGNORECASE),
    ]
    for path in _public_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        assert not any(pattern.search(text) for pattern in credential_patterns), path


def test_local_secret_paths_are_ignored() -> None:
    ignore_text = (ROOT / ".gitignore").read_text(encoding="utf-8")
    for entry in (".env", "runs/", "*.jwt", "cookies*.json", ".local_secrets/"):
        assert entry in ignore_text
