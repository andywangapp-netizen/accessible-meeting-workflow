"""Local readiness checks. Never print cookies, tokens, or URLs."""

from __future__ import annotations

import subprocess


def chrome_zoom_tab_present() -> dict[str, object]:
    """Ask macOS Chrome whether any tab *title* looks like Zoom.

    Reads titles only, never URLs or cookies. Returns a small dict:
    present flag and tab count. On non-macOS or if Chrome Apple Events
    are off, ``present`` is False and ``error`` is set.
    """
    script = r"""
tell application "Google Chrome"
  set n to 0
  repeat with w in windows
    repeat with t in tabs of w
      set tname to title of t
      if tname contains "Zoom" then
        set n to n + 1
      end if
    end repeat
  end repeat
  return n as string
end tell
"""
    try:
        out = subprocess.check_output(
            ["osascript", "-e", script],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=8,
        )
        count = int((out or "0").strip() or "0")
        return {"present": count > 0, "zoom_tab_count": count}
    except (OSError, subprocess.CalledProcessError, ValueError, subprocess.TimeoutExpired) as exc:
        return {"present": False, "zoom_tab_count": 0, "error": type(exc).__name__}
