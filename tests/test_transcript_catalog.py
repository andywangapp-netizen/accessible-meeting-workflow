"""Validate the transcript assets that the test skill offers to users."""

import json
import re

import pytest

from ameval.files import repo_root


ROOT = repo_root()
TRANSCRIPTS = sorted((ROOT / "transcripts").glob("*.json"))


def test_catalog_has_ten_distinct_reachable_meetings() -> None:
    assert len(TRANSCRIPTS) == 10
    meetings = [json.loads(path.read_text(encoding="utf-8")) for path in TRANSCRIPTS]
    for field in ("id", "title", "scenario", "transcript"):
        assert len({meeting[field] for meeting in meetings}) == 10

    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    links = re.findall(r"\]\((transcripts/[^)]+\.json)\)", skill)
    assert len(links) == 10
    assert {ROOT / link for link in links} == set(TRANSCRIPTS)


@pytest.mark.parametrize("path", TRANSCRIPTS, ids=lambda path: path.stem)
def test_meeting_json_contains_complete_consistent_dialogue(path) -> None:
    meeting = json.loads(path.read_text(encoding="utf-8"))
    assert meeting["id"] == path.stem
    assert meeting["simulated"] is True
    assert isinstance(meeting["title"], str) and meeting["title"].strip()
    assert isinstance(meeting["scenario"], str) and meeting["scenario"].strip()
    participants = meeting["participants"]
    assert isinstance(participants, list) and len(participants) >= 3
    assert all(isinstance(name, str) and name.strip() for name in participants)
    assert len(set(participants)) == len(participants)
    assert isinstance(meeting["duration_seconds"], int)

    lines = meeting["transcript"].splitlines()
    assert len(lines) >= 20, "A full meeting needs more than a brief fixture excerpt"
    timestamps, speakers, word_count = [], set(), 0
    for line in lines:
        match = re.fullmatch(r"\[(\d{2}):([0-5]\d)\] ([^:]+): (.+)", line)
        assert match, f"Malformed dialogue line: {line}"
        minutes, seconds, speaker, text = match.groups()
        timestamps.append(int(minutes) * 60 + int(seconds))
        assert speaker in participants
        speakers.add(speaker)
        word_count += len(text.split())
    assert speakers == set(participants)
    assert timestamps[0] == 0
    assert all(a < b for a, b in zip(timestamps, timestamps[1:]))
    assert timestamps[-1] < meeting["duration_seconds"]
    assert word_count >= 900, "Bundled meetings should contain full discussion"
