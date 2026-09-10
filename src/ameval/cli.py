"""Command-line entry: generate transcripts, pack payloads, evaluate skills."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ameval.doctor import chrome_zoom_tab_present
from ameval.files import load_case, load_dotenv, load_pack, read_text, repo_root
from ameval.payload import build_payload, endpoint_from_env, send_payload, write_payload
from ameval.transcripts import list_templates, write_case
from ameval.verify import evaluate


def _add_skill_case(p: argparse.ArgumentParser) -> None:
    p.add_argument("--skill", required=True, help="Skill directory, e.g. the repository root (.)")
    p.add_argument("--case", required=True, help="Case directory with transcript.md and facts.json")


def main(argv: list[str] | None = None) -> int:
    """Run the intern eval CLI."""
    load_dotenv(repo_root() / ".env")
    parser = argparse.ArgumentParser(
        prog="ameval",
        description="Synthetic transcripts and deep-reasoning eval for the public HTML skill.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_gen = sub.add_parser("generate", help="Write a synthetic meeting case folder")
    p_gen.add_argument("--template", help="Template id (use generate --list)")
    p_gen.add_argument("--out", help="Output directory")
    p_gen.add_argument("--list", action="store_true", help="List templates and exit")

    p_eval = sub.add_parser("evaluate", help="Score a deep-reasoning HTML report")
    _add_skill_case(p_eval)
    p_eval.add_argument("--output", required=True, help="Path to model HTML output")

    p_pack = sub.add_parser("pack-payload", help="Write JSON to paste or POST (no hidden fields)")
    _add_skill_case(p_pack)
    p_pack.add_argument("--out", required=True, help="Payload JSON path")

    p_send = sub.add_parser("send-payload", help="POST payload to AMEVAL_PUBLIC_ENDPOINT if set")
    p_send.add_argument("--payload", required=True, help="JSON from pack-payload")

    p_doc = sub.add_parser("doctor", help="Local checks; optional Chrome Zoom-title presence")
    p_doc.add_argument("--chrome", action="store_true", help="Check Chrome tab titles for Zoom (no URLs)")

    args = parser.parse_args(argv)
    if args.cmd == "generate":
        if args.list:
            print("\n".join(list_templates()))
            return 0
        if not args.template or not args.out:
            print("generate requires --template and --out (or --list)", file=sys.stderr)
            return 2
        out = write_case(args.template, Path(args.out))
        print(str(out))
        return 0

    if args.cmd == "evaluate":
        pack = load_pack(Path(args.skill))
        case = load_case(Path(args.case))
        output = read_text(Path(args.output))
        report = evaluate(
            output=output,
            schema=pack["schema"],
            forbidden_phrases=pack["forbidden_phrases"],
            facts=case["facts"],
        )
        print(json.dumps(report, indent=2))
        return 0 if report["pass"] else 1

    if args.cmd == "pack-payload":
        pack = load_pack(Path(args.skill))
        case = load_case(Path(args.case))
        payload = build_payload(
            transcript=case["transcript"],
            request=case["request"],
            skill_markdown=pack["skill_markdown"],
            schema=pack["schema"],
        )
        path = write_payload(payload, Path(args.out))
        print(str(path))
        return 0

    if args.cmd == "send-payload":
        payload = json.loads(read_text(Path(args.payload)))
        url, token = endpoint_from_env()
        if not url:
            print("offline: AMEVAL_PUBLIC_ENDPOINT is empty; not sending")
            return 0
        status, body_len = send_payload(payload, url, token)
        print(json.dumps({"http_status": status, "response_body_length": body_len}))
        return 0 if 200 <= status < 300 else 1

    if args.cmd == "doctor":
        print(json.dumps({"templates": list_templates()}))
        if args.chrome:
            print(json.dumps(chrome_zoom_tab_present()))
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
