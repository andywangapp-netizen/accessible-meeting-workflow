"""Validate the summary assets that the test skill offers to users."""

import json
import re

import pytest

from ameval.files import repo_root


ROOT = repo_root()
SUMMARIES = sorted((ROOT / "summaries").glob("*.json"))


def test_catalog_has_ten_distinct_reachable_meetings() -> None:
    assert len(SUMMARIES) == 10
    meetings = [json.loads(path.read_text(encoding="utf-8")) for path in SUMMARIES]
    for field in ("id", "title", "scenario", "summary"):
        assert len({meeting[field] for meeting in meetings}) == 10

    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    links = re.findall(r"\]\((summaries/[^)]+\.json)\)", skill)
    assert len(links) == 10
    assert {ROOT / link for link in links} == set(SUMMARIES)


@pytest.mark.parametrize("path", SUMMARIES, ids=lambda path: path.stem)
def test_meeting_json_contains_summary_without_dialogue(path) -> None:
    meeting = json.loads(path.read_text(encoding="utf-8"))
    assert meeting["id"] == path.stem
    assert meeting["simulated"] is True
    assert meeting["title"].strip() and meeting["scenario"].strip()
    participants = meeting["participants"]
    assert len(participants) >= 3
    assert len(set(participants)) == len(participants)
    assert all(isinstance(name, str) and name.strip() for name in participants)
    summary = meeting["summary"]
    assert 80 <= len(summary.split()) <= 350
    assert not re.search(r"^\[\d{2}:\d{2}\]", summary, re.MULTILINE)
    assert "transcript" not in meeting and "duration_seconds" not in meeting
