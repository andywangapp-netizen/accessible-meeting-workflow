"""Score a deep-reasoning report against a pack schema and case facts.

The public autism pack emits HTML.  The verifier therefore parses the
document with the standard-library :mod:`html.parser` instead of trusting
regular expressions for DOM and safety checks.  Markdown remains supported
for small third-party packs that use the original schema shape.
"""

from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
import re
from typing import Any


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _fact_tokens(text: str) -> list[str]:
    """Return meaningful, lightly stemmed words for a fact comparison."""
    stopwords = {"the", "and", "for", "with", "from", "that", "this", "same", "last"}
    tokens: list[str] = []
    for token in re.split(r"[^a-z0-9]+", _norm(text)):
        if len(token) <= 3 or token in stopwords:
            continue
        # The cases use simple English inflections (emails/reviews/cards).
        stem = token[:-1] if token.endswith("s") and len(token) > 4 else token
        if stem not in tokens:
            tokens.append(stem)
    return tokens


def _fact_coverage(tokens: list[str], section: str) -> float:
    if not tokens:
        return 1.0
    normalized_section = _norm(section)
    return sum(token in normalized_section for token in tokens) / len(tokens)


def _section(output: str, heading: str) -> str:
    """Return text under ``## heading`` until the next ``##`` or end."""
    pattern = rf"(?im)^##\s*{re.escape(heading)}\s*$"
    match = re.search(pattern, output)
    if not match:
        return ""
    rest = output[match.end() :]
    nxt = re.search(r"(?m)^##\s+", rest)
    return rest[: nxt.start()] if nxt else rest


class _ReportHTMLParser(HTMLParser):
    """Collect only the small, public-safe surface needed by the verifier."""

    _HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tag_counts: Counter[str] = Counter()
        self.elements: list[tuple[str, dict[str, str | None]]] = []
        self.headings: list[tuple[str, str]] = []
        self.sections: dict[str, str] = {}
        self.visible_parts: list[str] = []
        self.style_parts: list[str] = []
        self._active_section: str | None = None
        self._heading_tag: str | None = None
        self._heading_parts: list[str] = []
        self._in_style = False
        self.has_html_doctype = False

    def handle_decl(self, decl: str) -> None:
        if decl.strip().lower() == "doctype html":
            self.has_html_doctype = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized_tag = tag.lower()
        normalized_attrs = {name.lower(): value for name, value in attrs}
        self.tag_counts[normalized_tag] += 1
        self.elements.append((normalized_tag, normalized_attrs))
        if normalized_tag in self._HEADING_TAGS:
            # Do not let the heading text leak into the previous section.
            self._heading_tag = normalized_tag
            self._heading_parts = []
            if normalized_tag == "h2":
                self._active_section = None
        elif normalized_tag == "style":
            self._in_style = True

    def handle_endtag(self, tag: str) -> None:
        normalized_tag = tag.lower()
        if normalized_tag == "style":
            self._in_style = False
        if self._heading_tag == normalized_tag:
            heading = _norm(" ".join(self._heading_parts))
            self.headings.append((normalized_tag, heading))
            if normalized_tag == "h2" and heading:
                self._active_section = heading
                self.sections.setdefault(heading, "")
            self._heading_tag = None
            self._heading_parts = []

    def handle_data(self, data: str) -> None:
        if self._in_style:
            self.style_parts.append(data)
            return
        if self._heading_tag:
            self._heading_parts.append(data)
            return
        if data.strip():
            self.visible_parts.append(data)
            if self._active_section:
                self.sections[self._active_section] += " " + data

    @property
    def visible_text(self) -> str:
        return _norm(" ".join(self.visible_parts))

    @property
    def style_text(self) -> str:
        return _norm(" ".join(self.style_parts))


def _has_meta(parser: _ReportHTMLParser, *, attr: str, value: str | None = None) -> bool:
    expected = value.lower() if value is not None else None
    for tag, attrs in parser.elements:
        if tag != "meta":
            continue
        candidate = (attrs.get(attr) or "").lower()
        if expected is None and candidate:
            return True
        if expected is not None and candidate == expected:
            return True
    return False


def _has_viewport_meta(parser: _ReportHTMLParser) -> bool:
    for tag, attrs in parser.elements:
        if tag != "meta" or (attrs.get("name") or "").lower() != "viewport":
            continue
        content = _norm(attrs.get("content") or "")
        if "width=device-width" in content and "initial-scale=1" in content:
            return True
    return False


def _validate_html(output: str, schema: dict[str, Any]) -> dict[str, Any]:
    """Validate the standalone HTML and return parsed sections and failures."""

    failures: list[str] = []
    parser = _ReportHTMLParser()
    try:
        parser.feed(output)
        parser.close()
    except Exception as exc:  # pragma: no cover - defensive parser boundary
        failures.append("invalid_html:" + type(exc).__name__)

    if "```" in output:
        failures.append("html_code_fence")
    if not parser.has_html_doctype:
        failures.append("missing_doctype")
    if parser.tag_counts["html"] != 1:
        failures.append("missing_or_duplicate_html")
    if parser.tag_counts["head"] != 1 or parser.tag_counts["body"] != 1:
        failures.append("missing_document_regions")
    if parser.tag_counts["main"] != 1:
        failures.append("main_landmark")
    if parser.tag_counts["h1"] != 1:
        failures.append("single_h1")
    if parser.tag_counts["title"] != 1:
        failures.append("title_element")

    for tag, attrs in parser.elements:
        for name, value in attrs.items():
            if name.startswith("on"):
                failures.append("inline_event_handler")
                break
            if name == "tabindex":
                try:
                    if int((value or "0").strip()) > 0:
                        failures.append("positive_tabindex")
                except ValueError:
                    failures.append("invalid_tabindex")
            if name == "autoplay":
                failures.append("autoplay")
        if tag == "img" and not (attrs.get("alt") or "").strip():
            failures.append("image_missing_alt")
        if (attrs.get("http-equiv") or "").lower() == "refresh":
            failures.append("meta_refresh")
        for attr_name in ("href", "src", "action", "poster"):
            value = (attrs.get(attr_name) or "").strip().lower()
            if value.startswith(("http:", "https:", "//", "javascript:", "data:", "mailto:")):
                failures.append("external_or_active_resource")
                break

    for forbidden_tag in schema.get("forbidden_elements") or []:
        name = str(forbidden_tag).lower().strip()
        if name and parser.tag_counts[name]:
            failures.append("forbidden_element:" + name)
    if not bool(schema.get("allow_external_resources", False)):
        if re.search(r"(?i)url\s*\(\s*['\"]?(?:https?:|//|data:)", parser.style_text):
            failures.append("external_or_active_resource")

    # The public pack must not become a transport for credentials, internal
    # hosts, or prompt-injection text.  These are deliberately conservative
    # shape checks; they do not attempt to classify ordinary meeting prose.
    safety_text = parser.visible_text
    sensitive_patterns = (
        r"-----BEGIN [A-Z ]+PRIVATE KEY-----",
        r"\bAKIA[0-9A-Z]{16}\b",
        r"\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b",
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        r"(?i)\b(?:zoomdev|git\.zoom\.us|corp\.zoom\.us)\b",
        r"(?i)\b(?:system|developer) prompt\b|\bhidden (?:rubric|instruction)s?\b|\bignore (?:all|any) previous\b",
    )
    if any(re.search(pattern, safety_text) for pattern in sensitive_patterns):
        failures.append("sensitive_or_hidden_content")

    # Required element checks are intentionally small and explainable so an
    # intern can fix a report without relying on a browser-only accessibility
    # audit.
    required_elements = [str(item).lower() for item in schema.get("required_elements") or []]
    for requirement in required_elements:
        if requirement == "!doctype" and not parser.has_html_doctype:
            failures.append("required_element:!doctype")
        elif requirement == "html[lang]":
            html_attrs = [attrs for tag, attrs in parser.elements if tag == "html"]
            if not html_attrs or not (html_attrs[0].get("lang") or "").strip():
                failures.append("required_element:html[lang]")
        elif requirement == "meta[charset]" and not _has_meta(parser, attr="charset"):
            failures.append("required_element:meta[charset]")
        elif requirement == "meta[name=viewport]":
            if not _has_viewport_meta(parser):
                failures.append("required_element:meta[name=viewport]")
        elif requirement in {"title", "main", "h1", "section", "style"}:
            if parser.tag_counts[requirement] == 0:
                failures.append("required_element:" + requirement)
        elif requirement == ":focus-visible" and ":focus-visible" not in parser.style_text:
            failures.append("required_css::focus-visible")
        elif requirement == "prefers-reduced-motion" and "prefers-reduced-motion" not in parser.style_text:
            failures.append("required_css:prefers-reduced-motion")

    required_headings = [str(h) for h in schema.get("required_headings") or []]
    h2_headings = [text for tag, text in parser.headings if tag == "h2"]
    missing: list[str] = []
    positions: list[int] = []
    search_from = 0
    for heading in required_headings:
        normalized = _norm(heading)
        try:
            position = h2_headings.index(normalized, search_from)
        except ValueError:
            missing.append(heading)
        else:
            positions.append(position)
            search_from = position + 1
            if not parser.sections.get(normalized, "").strip():
                failures.append("empty_section:" + heading)
    if missing:
        failures.append("missing_headings:" + ",".join(missing))
    if parser.tag_counts["section"] < len(required_headings):
        failures.append("section_count")
    if parser.tag_counts["ul"] + parser.tag_counts["ol"] < 3:
        failures.append("list_structure")

    # Return the parsed heading section even when the document fails another
    # gate; factual checks should still explain the failure.
    return {
        "parser": parser,
        "failures": failures,
        "missing_headings": missing,
        "heading_count": len(required_headings) - len(missing),
        "sections": parser.sections,
    }


def evaluate(
    *,
    output: str,
    schema: dict[str, Any],
    forbidden_phrases: list[str],
    facts: dict[str, Any],
) -> dict[str, Any]:
    """Run fail-closed checks. Returns a JSON-serializable report.

    Args:
        output: Model / deep-reasoning report (HTML for the public autism pack).
        schema: Pack schema with ``required_headings``.
        forbidden_phrases: Lowercased or mixed phrases from forbidden.md.
        facts: Case ``decided`` / ``not_decided`` lists.
    """
    failures: list[str] = []
    headings = list(schema.get("required_headings") or [])
    output_format = str(schema.get("output_format") or "markdown").lower()
    html_result: dict[str, Any] | None = None
    if output_format == "html":
        html_result = _validate_html(output, schema)
        failures.extend(html_result["failures"])
        missing = list(html_result["missing_headings"])
        heading_count = int(html_result["heading_count"])
        decided_section = str(html_result["sections"].get(_norm("What was decided"), ""))
    else:
        missing = [h for h in headings if not re.search(rf"(?im)^##\s*{re.escape(h)}\s*$", output)]
        if missing:
            failures.append("missing_headings:" + ",".join(missing))
        heading_count = len(headings) - len(missing)
        decided_section = _norm(_section(output, "What was decided"))

    lowered = output.lower()
    if html_result is not None:
        lowered += " " + str(html_result["parser"].visible_text)
    for phrase in forbidden_phrases:
        p = phrase.strip().lower()
        if p and p in lowered:
            failures.append("forbidden_phrase")
            break

    for item in facts.get("decided") or []:
        tokens = _fact_tokens(str(item))
        # Require most meaningful fact words, not just one shared word. This
        # keeps paraphrases possible while rejecting vague summaries.
        if tokens and _fact_coverage(tokens, decided_section) < 0.6:
            failures.append("missing_decision")
            break

    for item in facts.get("not_decided") or []:
        tokens = _fact_tokens(str(item))
        # Fail if a distinctive not-decided phrase is treated as a decision.
        distinctive = tokens[:2]
        if distinctive and all(t in decided_section for t in distinctive):
            failures.append("invented_or_wrong_decision")
            break

    if "email" in _norm(str(schema.get("delivery_slot") or "email")):
        if "email" not in _norm(output + " " + str(facts)):
            # Delivery slot is email; the report should still be usable as a mail body.
            # Do not require the word email if sections exist.
            pass

    passed = not failures
    return {
        "pass": passed,
        "failures": failures,
        "heading_count": heading_count,
        "required_heading_count": len(headings),
    }
