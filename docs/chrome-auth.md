# Chrome / Codex login (public Zoom)

Use this when you evaluate the **deep-reasoning node** against production-shaped Zoom Workflow using **your public Zoom account**.

## Rules

1. You log in. The harness does not.
2. Use `https://zoom.us` (or the public Zoom site your **personal** account already uses). Do not commit private or employer-only hosts.
3. Never paste a password, OTP, cookie jar, or JWT into chat, `runs/`, or git.
4. Codex **Computer Use** or a Chrome helper may click around **after** the session exists. If a login wall appears, stop automation and finish login yourself.

## Suggested Codex / Chrome flow

1. Open Chrome yourself and sign in to Zoom.
2. Keep that window in the normal (non-incognito) profile.
3. In Codex or Coworker, ask the agent to **reuse the existing Zoom tab**, not to create a private window.
4. Open the Zoom Workflow plugin surface you are testing.
5. Paste the synthetic transcript from `cases/.../transcript.md` and attach the root `SKILL.md`.
6. Run deep reasoning. Save the visible HTML report to `runs/<date>/output.html`.
7. Back in this repo: `ameval evaluate --skill . --case ... --output runs/<date>/output.html`.

## Optional tab check (macOS, local only)

```bash
ameval doctor --chrome
```

This only asks Chrome for **tab titles** (whether the title looks like Zoom). It never reads URLs, cookies, or Zoom storage.
