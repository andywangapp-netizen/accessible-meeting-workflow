# Accessible Meeting Workflow

Public intern project for **Accessible Meeting Coach**.

After a fictional meeting, one autism-friendly skill turns the transcript into
a calm, predictable, standalone HTML coach report with a presenting outline.
This repo scores that deep-reasoning skill. Email is the first
delivery slot; this harness never sends it.

This is a **small public harness**. There are no real customer accounts, hidden answer keys, or private APIs here.

## Two jobs

1. **Generate a synthetic meeting transcript** and pack it for a public Zoom Workflow / Codex plugin run.
2. **Evaluate deep reasoning** by passing a skill by hand (`--skill`) and scoring the report (sections, safety, invented facts).

You do **not** need Zoom login for offline scoring. Live production-shaped runs use **your public Zoom account** in Chrome.

## Requirements

- Python 3.9+
- Optional: Chrome, already signed in to [zoom.us](https://zoom.us) with an account you own

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

Check that the CLI is on your path:

```bash
ameval generate --list
```

You should see `classroom_support` and `team_standup`.

## Offline eval (no Zoom)

Use the shipped sample report, or any HTML document you captured from a model:

```bash
# Score the good HTML sample (should PASS)
ameval evaluate \
  --skill . \
  --case cases/frozen/classroom_support \
  --output examples/sample_dp_output.html

# Score the bad HTML sample (should FAIL)
ameval evaluate \
  --skill . \
  --case cases/frozen/classroom_support \
  --output examples/sample_dp_output.fail.html
```

Make a fresh synthetic case, then score against it:

```bash
ameval generate --template classroom_support --out cases/generated/classroom_support

ameval evaluate \
  --skill . \
  --case cases/generated/classroom_support \
  --output runs/<id>/output.html
```

`evaluate` only reads files. It never sends network traffic and never needs a token.

Run unit tests:

```bash
pytest -q
```

## Commands

| Command | What it does |
|---|---|
| `ameval generate --list` | List synthetic meeting templates |
| `ameval generate --template <id> --out <dir>` | Write `transcript.md`, `request.txt`, `facts.json` |
| `ameval evaluate --skill <pack> --case <dir> --output <html>` | Score a deep-reasoning HTML report |
| `ameval pack-payload --skill <pack> --case <dir> --out <json>` | Write JSON to paste into a plugin (no hidden fields) |
| `ameval send-payload --payload <json>` | POST that JSON only if you set a local endpoint |
| `ameval doctor` | List templates |
| `ameval doctor --chrome` | macOS: whether a Chrome tab *title* looks like Zoom (no URLs, no cookies) |

Exit code `0` from `evaluate` means PASS. Non-zero means FAIL.

## What a passing report looks like

The root `SKILL.md` requires one complete HTML document with a labelled
`article.meeting-card`. It must include these `<h2>` headings, in this order:

- `<h2>One-sentence summary</h2>`
- `<h2>What was decided</h2>`
- `<h2>What was not decided</h2>`
- `<h2>Next steps</h2>`
- `<h2>Possible confusion points</h2>`
- `<h2>Presenting outline</h2>`

The scorer also checks:

- Fails on diagnostic or shaming phrases (`forbidden.md`)
- Checks `facts.json` so the report does not invent decisions
- Requires a single `<main>`, responsive metadata, readable inline CSS,
  visible focus styling, and reduced-motion support
- Rejects scripts, remote resources, positive `tabindex`, autoplay, and
  images without alt text
- Treats **email** as the delivery slot (the page must be usable as an email
  body; this repo does not send mail)

Pass a skill **manually**. Do not ask the model to invent a disability pack during eval.

```bash
ameval evaluate --skill . --case cases/frozen/classroom_support --output path/to/output.html
```

## Attach from GitHub to a DP node

The root `SKILL.md` currently contains the testing-only
`autism-friendly-meeting-card-test` skill, with ten full-length fictional meeting
transcripts in `transcripts/`. The sync script combines them into one Drive JSON
file for the reasoning node; dialogue is not embedded in the skill.
It is not a production meeting summarizer.

For updates to the Drive copies, use the [automatic transcript sync](docs/drive-sync.md).
It supports local watch mode and a GitHub Actions workflow for changes pushed
to `main`, updating the single combined Drive file in place.

1. Open the AI reasoning node and expand **Skills**.
2. Select **+**, then **GitHub repo**.
3. Enter `andywangapp-netizen/accessible-meeting-workflow` and select **Scan**.
4. Attach `autism-friendly-meeting-card-test`.
5. Under **Resources → Google Drive**, select `zoom-transcripts.json`; see
   [Drive sync setup](docs/drive-sync.md) for the file link.
6. Configure the node to offer the ten transcript choices or accept pasted text,
   following [test setup](docs/public-run.md#testing-without-a-real-meeting-transcript).
   Remove old Meeting and Meeting Participants variable chips and the instruction
   to summarize the exact trigger meeting. Remove Zoom Meetings lookup tools
   from this test node.

Repository scans read GitHub, not local edits. Publish skill changes and refresh
the imported skill before expecting Zoom to use them. Changing the node prompt
in Zoom takes effect independently of publishing the repository. Existing run
cards retain their original output; start a fresh test to check a draft change.

The downstream Gmail node owns recipients, subject, approval, and delivery.
After transcript selection or pasting, the user selects which participant they
are. The email focuses on their tasks, without a separate transcript-approval
question. See test setup for input and skip routing
requirements. The two short CLI evaluation cases remain separate from this
ten-meeting selection catalog.

## Production-shaped run (your public Zoom)

Use this when you want to exercise a real **deep-reasoning** node end-to-end.

1. Generate a synthetic transcript (`ameval generate …`).
2. Sign in to **public Zoom** (`zoom.us`) in Chrome **yourself**. Do not put a password, cookie, or JWT in this repo.
3. Codex or Coworker may drive Chrome (**Computer Use** or a Chrome helper) **after** you are logged in. If a login wall appears, stop automation and finish login yourself.
4. In the Zoom Workflow plugin, attach the root `SKILL.md`, run the deep-reasoning node, and save the visible HTML card to `runs/<id>/output.html` (`runs/` is gitignored).
5. Score it:

```bash
ameval evaluate \
  --skill . \
  --case cases/generated/classroom_support \
  --output runs/<id>/output.html
```

Optional payload to paste or POST:

```bash
ameval pack-payload \
  --skill . \
  --case cases/generated/classroom_support \
  --out runs/payload.json
```

To POST, copy `.env.example` to `.env` (never commit `.env`) and set `AMEVAL_PUBLIC_ENDPOINT` to **your** URL. This repo ships **no default URL**. If the variable is empty, `send-payload` prints `offline` and exits 0.

More detail: [docs/public-run.md](docs/public-run.md), [docs/chrome-auth.md](docs/chrome-auth.md).

## Layout

```text
README.md                 This file
ETHICS.md                 Data and language rules
SKILL.md                  Testing-only skill with transcript resource selection
transcripts/              Ten full-length simulated meeting JSON files
schema.json               Deterministic HTML output contract
rubric.md / forbidden.md  Public evaluation and respectful-language rules
cases/frozen/             Checked-in synthetic meetings
cases/generated/          Your generated copies (ok to gitignore locally)
examples/                 Sample PASS / FAIL reports
src/ameval/               CLI: generate, pack, evaluate
docs/                     Public-run and auth notes
tests/                    Offline scorer tests
```

## Must-have vs later

**Must-have:** template-shaped transcript → hand-passed HTML skill → score the deep-reasoning output. Email is the delivery slot in the schema.

**Out of scope:** additional disability packs, Zoom Team Chat, phone / voice, and production connectors. Keep the public surface small; do not add hidden metadata to make scores look better.

## What we left out on purpose

Private employer eval systems, credentials, and hidden answer keys are **not** here. See [docs/WHAT_WE_LEFT_OUT.md](docs/WHAT_WE_LEFT_OUT.md).

Never commit:

- `.env`, JWTs, cookies, `runs/` captures
- Real meeting recordings or real people’s disability status

## Ethics

This is communication support, not diagnosis or therapy. Synthetic meetings only. No real minors. Read [ETHICS.md](ETHICS.md).

## License

MIT. See [LICENSE](LICENSE).
