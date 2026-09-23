#!/usr/bin/env python3
"""Combine transcript JSON files and update a single stable Drive file."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
FILE_ID = "1ZuFUhpNjHCu6oINxXloEm3mdsu7dxd2d"
API = "https://www.googleapis.com/drive/v3/files"
UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
SCOPES = ["https://www.googleapis.com/auth/drive"]


def request(session, method, url, **kwargs):
    response = session.request(method, url, timeout=60, **kwargs)
    if not response.ok:
        # Do not print response bodies or headers that might contain credentials.
        raise RuntimeError(f"Drive {method} failed (HTTP {response.status_code})")
    return response.json()


def build_bundle(directory):
    transcripts = []
    for path in sorted(directory.glob("*.json")):
        meeting = json.loads(path.read_bytes())
        if (not isinstance(meeting, dict) or meeting.get("id") != path.stem or
                not isinstance(meeting.get("transcript"), str) or
                not meeting["transcript"].strip()):
            raise ValueError(f"Invalid transcript: {path.name}")
        transcripts.append(meeting)
    if not transcripts:
        raise ValueError(f"No transcript JSON files in {directory}")
    return (json.dumps({"schema_version": 1, "transcripts": transcripts},
                       ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sync(session, directory, file_id, dry_run=False):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", file_id):
        raise ValueError("Expected a Drive file ID, not a URL")
    data = build_bundle(directory)
    checksum = hashlib.md5(data).hexdigest()
    params = {"fields": "id,mimeType,md5Checksum,trashed", "supportsAllDrives": "true"}
    remote = request(session, "GET", f"{API}/{file_id}", params=params)
    if remote.get("trashed") or remote.get("mimeType") != "application/json":
        raise RuntimeError("Sync target must be an existing, untrashed JSON file")
    if remote.get("md5Checksum") == checksum:
        print("Bundle unchanged", flush=True)
        return "unchanged"
    if dry_run:
        print("Would update transcript bundle", flush=True)
        return "updated"
    request(session, "PATCH", f"{UPLOAD}/{file_id}",
            params={"uploadType": "media", "fields": "id", "supportsAllDrives": "true"},
            data=data, headers={"Content-Type": "application/json"})
    verified = request(session, "GET", f"{API}/{file_id}", params=params)
    if verified.get("md5Checksum") != checksum:
        raise RuntimeError("Bundle upload verification failed")
    print("Updated transcript bundle", flush=True)
    return "updated"


def make_session():
    import google.auth
    from google.auth.transport.requests import AuthorizedSession

    config = os.environ.get("GOOGLE_DRIVE_CREDENTIALS_JSON")
    if config:
        credentials, _ = google.auth.load_credentials_from_dict(json.loads(config), scopes=SCOPES)
    else:
        credentials, _ = google.auth.default(scopes=SCOPES)
    return AuthorizedSession(credentials)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file-id", default=os.environ.get("GOOGLE_DRIVE_TRANSCRIPTS_FILE_ID", FILE_ID))
    parser.add_argument("--build-only", type=Path, help="Write the combined JSON locally without authentication")
    parser.add_argument("--directory", type=Path, default=ROOT / "transcripts")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--watch", action="store_true", help="Check for content changes repeatedly")
    parser.add_argument("--interval", type=float, default=5)
    args = parser.parse_args()
    if args.interval < 1:
        parser.error("--interval must be at least 1 second")
    if args.build_only:
        args.build_only.parent.mkdir(parents=True, exist_ok=True)
        args.build_only.write_bytes(build_bundle(args.directory))
        return
    if not args.file_id:
        parser.error("--file-id or GOOGLE_DRIVE_TRANSCRIPTS_FILE_ID is required")
    session = make_session()
    previous = None
    while True:
        try:
            signature = hashlib.sha256(build_bundle(args.directory)).hexdigest()
            if signature != previous:
                sync(session, args.directory, args.file_id, args.dry_run)
                previous = signature  # Failed uploads are retried on the next watch pass.
        except (ValueError, RuntimeError, OSError) as error:
            if not args.watch:
                raise
            print(f"Sync paused: {error}", file=sys.stderr, flush=True)
        if not args.watch:
            return
        time.sleep(args.interval)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as error:
        print(f"Sync failed ({type(error).__name__}). Check Drive credentials, access, and configuration.", file=sys.stderr)
        sys.exit(1)
