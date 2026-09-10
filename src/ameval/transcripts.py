"""Invent short fictional meeting transcripts. No real people."""

from __future__ import annotations

from pathlib import Path

from ameval.files import repo_root

# Built-in templates. All names are fictional.
TEMPLATES: dict[str, dict[str, str]] = {
    "classroom_support": {
        "title": "Fictional classroom support check-in",
        "request": (
            "After this meeting ends, write an accessible coach report and "
            "send it by email. Use the attached skill. Do not diagnose anyone."
        ),
        "transcript": """Classroom support check-in (fiction)

Jordan: Thanks for joining. This is a 20-minute check-in about next week's science block, not a medical review.
Sam: I can do Thursdays after 3. I cannot do Wednesday morning.
Jordan: We will keep the same Thursday 3:15 slot. We will not change the Wednesday exam date; that is still with the main teacher.
Sam: Please send a one-page recap so I can retell this to the other support person. Short sentences help.
Jordan: Agreed. I will email the recap today. We did not pick a new textbook. That is out of scope.
Sam: If two topics get mixed again, flag it in the recap. Today we mixed "lab safety" and "group roles" for a minute.
Jordan: I will label those as two separate next steps: print the lab-safety card, and keep the same group-role card as last week.
Sam: Thanks. No other decisions.
""",
        "facts": """{
  "case_id": "classroom_support",
  "title": "Fictional classroom support check-in",
  "decided": [
    "Keep the Thursday 3:15 slot",
    "Jordan emails a one-page recap today",
    "Print the lab-safety card",
    "Keep the same group-role card as last week"
  ],
  "not_decided": [
    "Change the Wednesday exam date",
    "Pick a new textbook"
  ]
}
""",
    },
    "team_standup": {
        "title": "Fictional team standup",
        "request": "After this meeting ends, write an accessible coach report and send it by email.",
        "transcript": """Weekly team standup (fiction)

Alex: Standup. Blockers only.
Riley: The client memo is drafted. I need a reviewer by Friday.
Alex: I will review it Thursday morning. We are not launching the public page this week.
Riley: Please email me the decision list after we hang up.
Alex: Done. No other decisions. Parking lot: color of the header. We did not choose a color.
""",
        "facts": """{
  "case_id": "team_standup",
  "title": "Fictional team standup",
  "decided": [
    "Alex reviews the client memo Thursday morning"
  ],
  "not_decided": [
    "Launch the public page this week",
    "Header color"
  ]
}
""",
    },
}


def list_templates() -> list[str]:
    """Return built-in template ids."""
    frozen = repo_root() / "cases" / "frozen"
    names = set(TEMPLATES)
    if frozen.is_dir():
        names.update(p.name for p in frozen.iterdir() if p.is_dir())
    return sorted(names)


def write_case(template_id: str, out_dir: Path) -> Path:
    """Write transcript.md, request.txt, and facts.json for a template.

    Args:
        template_id: Key in TEMPLATES, or a frozen case folder name.
        out_dir: Destination directory (created).

    Returns:
        The output directory.
    """
    if template_id not in TEMPLATES:
        frozen = repo_root() / "cases" / "frozen" / template_id
        if not frozen.is_dir():
            known = ", ".join(list_templates())
            raise ValueError(f"Unknown template {template_id!r}. Known: {known}")
        out_dir.mkdir(parents=True, exist_ok=True)
        for name in ("transcript.md", "request.txt", "facts.json"):
            (out_dir / name).write_text(
                (frozen / name).read_text(encoding="utf-8"), encoding="utf-8"
            )
        return out_dir

    spec = TEMPLATES[template_id]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "transcript.md").write_text(spec["transcript"], encoding="utf-8")
    (out_dir / "request.txt").write_text(spec["request"] + "\n", encoding="utf-8")
    (out_dir / "facts.json").write_text(spec["facts"].strip() + "\n", encoding="utf-8")
    return out_dir
