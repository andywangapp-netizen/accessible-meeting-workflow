# Public run: transcript → endpoint or plugin

## Offline (default)

```text
generate transcript → evaluate(skill, output file)
```

No network. This is enough to measure a deep-reasoning **skill** if you already have the model output.

For the root `SKILL.md`, the model output must be a standalone HTML document. The
evaluator does not render or execute it; it parses the document and applies the
pack's structural, accessibility, safety, and fact-grounding gates.

## Pack and send

`ameval pack-payload` writes a JSON file with only:

- `transcript` (synthetic text)
- `skill_markdown` (the public pack instructions you passed)
- `request` (human instruction, e.g. email the coach report)
- `required_headings` and `delivery_slot` (the public output contract)
- `output_format` (for this repo, `html`)

There is **no** hidden answer key or private account id in the payload.

`ameval send-payload` POSTs that JSON only if `AMEVAL_PUBLIC_ENDPOINT` is set locally. The request is:

- `POST` with `Content-Type: application/json`
- optional `Authorization: Bearer …` from `AMEVAL_PUBLIC_TOKEN` if you set it
- **no retries** on this mutating call

If the variable is empty, the command prints the payload path and exits. That is success for intern setup.

## Email slot

The first delivery channel is email. The evaluator checks that the report can be an email body (required sections present). It does **not** send mail. Sending is your Zoom Workflow’s job after the plugin run.

### Skip email when the transcript is unavailable

Require actual readable, non-empty transcript text before generating an email.
A recording reference, meeting metadata, notes, or summary alone does not
satisfy this requirement. If no usable transcript can be obtained, the skill
returns exactly `Skipped: no transcript available` as plain text.

Configure the condition after AI reasoning:

- `response` equals `Skipped: no transcript available` → Output node, with key
  `status` and value set to the AI node's `response` variable.
- A successful HTML email response → Gmail, using `response` as Email Body.
- Empty, missing, or unexpected output → a no-send Output branch, not Gmail.

Do not use “response is not empty” as the send condition: the skip message is
also non-empty. Do not leave Gmail on an unrestricted default branch. Changing
`SKILL.md` does not configure these routes in Zoom. The existing HTML scorer
scores generated cards, not skip status messages.

Verify with two workflow runs: a supplied transcript reaches email approval;
a missing transcript never reaches the Gmail node.

## Production end-to-end (deep-reasoning node)

```text
synthetic transcript
  → you sign in on public Zoom (Chrome)
  → Codex/Coworker plugin or Workflow UI runs deep reasoning with --skill
  → save output.html
  → ameval evaluate
```

Pass the skill **manually** (`--skill .`). Do not ask the model to invent a disability pack during eval.

## Testing without a real meeting transcript

Use the separate [testing skill](../testing/autism-friendly-meeting-card-test/SKILL.md)
in a test workflow instead of the production skill. It is self-contained; when
packaging it for import, use `testing/autism-friendly-meeting-card-test/` as the
skill root. Attach only this variant to the test reasoning node.

The test node needs a human-input/clarification capability that can pause for
an answer. The skill presents a fictional transcript for approval or editing,
then produces a visibly labelled simulated email body. It does not create HITL
tools or configure Zoom. Availability of such a tool must be verified in your
Zoom node; Gmail's send approval alone is not transcript review.

In this test workflow only, allow the reasoning node to run without an upstream
real-transcript condition. Keep the condition after reasoning described above:
route the exact skip message to Output and only successful HTML to Gmail. Keep the production transcript condition unchanged.
Configure Gmail with a test recipient and send approval when exercising delivery.

Manual checks in Zoom:

- Approve: the node pauses for review, then returns labelled HTML using the fixture.
- Edit and approve: the HTML reflects the edited transcript, including removed facts.
- Cancel: the response is `Skipped: no transcript available` and Gmail is skipped.
- No HITL tool or failed interaction: the response is `Skipped: no transcript available` and Gmail is skipped.
- Pending review: the node does not complete and Gmail does not run.

These runtime checks require Zoom; local skill validation does not prove that
Zoom exposes a human-input tool or that its condition routes skip messages correctly.
