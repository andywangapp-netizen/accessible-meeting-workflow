"""Build and optionally POST a public payload. No default URL. No retries."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def build_payload(*, transcript: str, request: str, skill_markdown: str, schema: dict[str, Any]) -> dict[str, Any]:
    """Visible fields only: transcript, request, skill, and output contract."""
    return {
        "transcript": transcript,
        "request": request,
        "skill_markdown": skill_markdown,
        "required_headings": list(schema.get("required_headings") or []),
        "output_format": schema.get("output_format") or "markdown",
        "delivery_slot": schema.get("delivery_slot") or "email",
    }


def write_payload(payload: dict[str, Any], path: Path) -> Path:
    """Write payload JSON for paste into a plugin or a local POST."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def send_payload(payload: dict[str, Any], endpoint: str, token: str | None) -> tuple[int, int]:
    """POST JSON to the intern's own public endpoint.

    Does not retry. Returns (http_status, body_length) so callers can log
    size without logging the body (may contain meeting text).

    Raises:
        ValueError: If endpoint is empty.
        urllib.error.URLError: On transport failure.
    """
    if not endpoint.strip():
        raise ValueError("No public endpoint configured")
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
            return int(resp.status), len(body)
    except urllib.error.HTTPError as exc:
        return int(exc.code), 0


def endpoint_from_env() -> tuple[str, str | None]:
    """Read local endpoint settings. Empty endpoint means offline-only."""
    url = (os.environ.get("AMEVAL_PUBLIC_ENDPOINT") or "").strip()
    token = (os.environ.get("AMEVAL_PUBLIC_TOKEN") or "").strip() or None
    return url, token
