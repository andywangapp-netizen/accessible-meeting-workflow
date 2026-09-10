"""Verifier unit tests. Offline only; no Zoom network."""

from __future__ import annotations

from pathlib import Path

from ameval.files import load_case, load_pack, read_text, repo_root
from ameval.payload import build_payload
from ameval.verify import evaluate

ROOT = repo_root()


def test_sample_output_passes_classroom_support() -> None:
    pack = load_pack(ROOT / "packs" / "autism")
    case = load_case(ROOT / "cases" / "frozen" / "classroom_support")
    output = read_text(ROOT / "examples" / "sample_dp_output.html")
    report = evaluate(
        output=output,
        schema=pack["schema"],
        forbidden_phrases=pack["forbidden_phrases"],
        facts=case["facts"],
    )
    assert report["pass"] is True


def test_bad_output_fails() -> None:
    pack = load_pack(ROOT / "packs" / "autism")
    case = load_case(ROOT / "cases" / "frozen" / "classroom_support")
    output = read_text(ROOT / "examples" / "sample_dp_output.fail.html")
    report = evaluate(
        output=output,
        schema=pack["schema"],
        forbidden_phrases=pack["forbidden_phrases"],
        facts=case["facts"],
    )
    assert report["pass"] is False
    assert report["failures"]


def test_html_contract_rejects_markdown() -> None:
    pack = load_pack(ROOT / "packs" / "autism")
    case = load_case(ROOT / "cases" / "frozen" / "classroom_support")
    report = evaluate(
        output="## One-sentence summary\nA meeting.",
        schema=pack["schema"],
        forbidden_phrases=pack["forbidden_phrases"],
        facts=case["facts"],
    )
    assert report["pass"] is False
    assert any(failure.startswith("missing_doctype") for failure in report["failures"])


def test_html_contract_rejects_active_content_and_remote_resources() -> None:
    pack = load_pack(ROOT / "packs" / "autism")
    case = load_case(ROOT / "cases" / "frozen" / "team_standup")
    output = read_text(ROOT / "examples" / "sample_dp_output.html")
    output = output.replace(
        "</head>",
        '<script src="https://example.invalid/track.js"></script></head>',
    )
    report = evaluate(
        output=output,
        schema=pack["schema"],
        forbidden_phrases=pack["forbidden_phrases"],
        facts=case["facts"],
    )
    assert report["pass"] is False
    assert "forbidden_element:script" in report["failures"]
    assert "external_or_active_resource" in report["failures"]


def test_html_contract_rejects_sensitive_visible_text() -> None:
    pack = load_pack(ROOT / "packs" / "autism")
    case = load_case(ROOT / "cases" / "frozen" / "team_standup")
    output = read_text(ROOT / "examples" / "sample_team_standup.html").replace(
        "Alex will review", "alex@example.org Alex will review", 1
    )
    report = evaluate(
        output=output,
        schema=pack["schema"],
        forbidden_phrases=pack["forbidden_phrases"],
        facts=case["facts"],
    )
    assert report["pass"] is False
    assert "sensitive_or_hidden_content" in report["failures"]


def test_factual_gate_rejects_vague_decision_text() -> None:
    pack = load_pack(ROOT / "packs" / "autism")
    case = load_case(ROOT / "cases" / "frozen" / "classroom_support")
    output = read_text(ROOT / "examples" / "sample_dp_output.html").replace(
        "<li>Keep the Thursday 3:15 slot.</li>",
        "<li>The meeting continued.</li>",
    )
    report = evaluate(
        output=output,
        schema=pack["schema"],
        forbidden_phrases=pack["forbidden_phrases"],
        facts=case["facts"],
    )
    assert report["pass"] is False
    assert "missing_decision" in report["failures"]


def test_team_standup_html_sample_contract() -> None:
    pack = load_pack(ROOT / "packs" / "autism")
    case = load_case(ROOT / "cases" / "frozen" / "team_standup")
    output = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Team standup report</title><style>body { line-height: 1.6; } :focus-visible { outline: 3px solid #05c; } @media (prefers-reduced-motion: reduce) { * { transition: none; } }</style></head>
<body><main><h1>Team standup report</h1>
<section><h2>One-sentence summary</h2><p>Alex will review the client memo Thursday morning.</p></section>
<section><h2>What was decided</h2><ul><li>Alex reviews the client memo Thursday morning.</li></ul></section>
<section><h2>What was not decided</h2><ul><li>The public page will not launch this week.</li><li>No header color was chosen.</li></ul></section>
<section><h2>Next steps</h2><ol><li>Alex reviews the client memo Thursday morning.</li><li>Send the decision list by email.</li></ol></section>
<section><h2>Possible confusion points</h2><ul><li>The launch and header color are still open.</li></ul></section>
<section><h2>Presenting outline</h2><ol><li>Alex reviews the memo.</li><li>The launch and header color remain open.</li></ol></section>
</main></body></html>"""
    report = evaluate(
        output=output,
        schema=pack["schema"],
        forbidden_phrases=pack["forbidden_phrases"],
        facts=case["facts"],
    )
    assert report["pass"] is True


def test_payload_exposes_only_public_html_contract() -> None:
    pack = load_pack(ROOT / "packs" / "autism")
    case = load_case(ROOT / "cases" / "frozen" / "classroom_support")
    payload = build_payload(
        transcript=case["transcript"],
        request=case["request"],
        skill_markdown=pack["skill_markdown"],
        schema=pack["schema"],
    )
    assert set(payload) == {
        "transcript",
        "request",
        "skill_markdown",
        "required_headings",
        "output_format",
        "delivery_slot",
    }
    assert payload["output_format"] == "html"
    assert "facts" not in payload
