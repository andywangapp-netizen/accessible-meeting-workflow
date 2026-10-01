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
    for field in ("id", "title", "summary"):
        assert len({meeting[field] for meeting in meetings}) == 10

    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    links = re.findall(r"\]\((summaries/[^)]+\.json)\)", skill)
    assert len(links) == 10
    assert {ROOT / link for link in links} == set(SUMMARIES)


@pytest.mark.parametrize("path", SUMMARIES, ids=lambda path: path.stem)
def test_meeting_json_contains_timestamped_summary(path) -> None:
    meeting = json.loads(path.read_text(encoding="utf-8"))
    assert meeting["id"] == path.stem
    assert meeting["simulated"] is True
    assert meeting["title"].strip()
    summary = meeting["summary"]
    assert 80 <= len(summary.split()) <= 350
    assert "\n" not in summary
    previous_end = 0
    for segment in summary.split(" • "):
        match = re.fullmatch(
            r"\[(\d{2}):([0-5]\d)-(\d{2}):([0-5]\d)\] [^—]+ — .+", segment
        )
        assert match, segment
        sm, ss, em, es = map(int, match.groups())
        start, end = sm * 60 + ss, em * 60 + es
        assert previous_end <= start < end
        previous_end = end
        assert re.search(r"Participant [A-Z]\b", segment)
    assert "transcript" not in meeting and "duration_seconds" not in meeting
