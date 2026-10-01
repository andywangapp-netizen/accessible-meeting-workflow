# Public run: summary → endpoint or plugin

## Offline (default)

```text
generate summary → evaluate(skill, output file)
```

No network. This is enough to measure a deep-reasoning **skill** if you already have the model output.

For the root `SKILL.md`, the model output must be a standalone HTML document. The
evaluator does not render or execute it; it parses the document and applies the
pack's structural, accessibility, safety, and fact-grounding gates.

## Pack and send

`ameval pack-payload` writes a JSON file with only:

- `summary` (synthetic text)
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

### Skip email when the summary is unavailable

Require actual readable, non-empty summary text before generating an email.
A readable prose or bullet-point meeting summary is sufficient; no transcript
or recording is required. A recording reference or meeting metadata alone is
not a summary. If no usable summary can be obtained, the skill
returns exactly `Skipped: no summary available` as plain text.

Configure the condition after AI reasoning:

- `response` equals `Skipped: no summary available` → Output node, with key
  `status` and value set to the AI node's `response` variable.
- A successful HTML email response → Gmail, using `response` as Email Body.
- Empty, missing, or unexpected output → a no-send Output branch, not Gmail.

Do not use “response is not empty” as the send condition: the skip message is
also non-empty. Do not leave Gmail on an unrestricted default branch. Changing
`SKILL.md` does not configure these routes in Zoom. The existing HTML scorer
scores generated cards, not skip status messages.

Verify with two workflow runs: a supplied summary reaches email approval;
a missing summary never reaches the Gmail node.

## Production end-to-end (deep-reasoning node)

```text
synthetic summary
  → you sign in on public Zoom (Chrome)
  → Codex/Coworker plugin or Workflow UI runs deep reasoning with --skill
  → save output.html
  → ameval evaluate
```

Pass the skill **manually** (`--skill .`). Do not ask the model to invent a disability pack during eval.

## Testing without a real meeting summary

Use the root [testing skill](../SKILL.md) in a test workflow. Keep summary text
separate from the skill: attach each of the ten JSON files in `summaries/`
as its own resource in the reasoning node. Replace attached copies when their
source files change.

The ten JSON files provide complete simulated meetings. The two short
`ameval generate` evaluation cases are independent of this catalog.

Remove the old instruction to summarize the exact meeting supplied in Meeting,
remove Meeting and Meeting Participants variable chips from Task instructions,
and remove Zoom Meetings lookup tools from this test node. The trigger starts
the test; its real meeting metadata is not the source for the card. Replace any
old summary-review or approval instructions with this node instruction:

> Use `autism-friendly-meeting-card-test` with the attached meeting-summary resource.

The skill owns source selection, participant questions, evidence rules, HTML
formatting, and the skip response. Keep those instructions in `SKILL.md` rather
than duplicating them in the node. Refresh the imported skill before shortening
the node; older imported versions still require transcripts.

The node needs a human-input capability that supports a numbered selection and
plain-text entry, plus access to the complete attached summary resources. If choice
buttons have a limit, show the full numbered catalog in the question and accept
a typed number or title. Choosing “Paste my own” should ask for text only if it
was not included in the same reply. Do not require JSON or a file upload.
After loading the summary, ask the user to select their participant unless
they already identified themselves. This personalizes the email; it is not a
summary confirmation or review step. Gmail's send approval remains independent.

An existing test card retains the output from its original run. After saving
node changes, start a fresh run. Local skill edits must be published and the imported skill refreshed for Zoom
to load them. Local summary edits require replacing the corresponding attached resources.
Local edits do not change the node's saved Task instructions.

In this test workflow only, allow the reasoning node to run without an upstream
real-summary condition. Keep the condition after reasoning described above:
route the exact skip message to Output and only successful HTML to Gmail.
Any production input condition must check for an available meeting summary,
not a transcript or recording. This repository skill remains testing-only. Configure Gmail with a test
recipient and send approval when exercising delivery.

Manual checks in Zoom:

- Select a catalog entry with a real trigger that has no recording summary:
  the node reads the chosen summary resource, asks which participant the user is, and then
  generates labelled HTML focused on their tasks. It must
  not ask for summary approval, use another entry, or describe the real
  trigger's meeting as having insufficient recorded content.
- Select another entry in a fresh run: only that meeting's facts appear. For
  example, the supplier meeting's final sample quantity is twenty-four, not the
  earlier twenty, and Thursday dispatch is conditional rather than guaranteed.
- Choose “Paste my own” and supply summary text: the report uses that text, is
  labelled as user-provided, and does not inherit fictional catalog facts.
- Supply the summary or an unambiguous catalog choice in the initial request:
  the node proceeds without asking for the same input again.
- Select different participants in the same summary across fresh runs: each
  email focuses on the selected person’s tasks. Other owners remain named on
  relevant dependencies; unrelated tasks are omitted. A participant with no
  assigned tasks gets an explicit statement of that fact, not invented work.
- Submit an invalid choice, blank custom text, or only a link: the node requests
  the missing selection or summary text and does not silently choose a default.
- Cancel, unavailable required input tool, or missing or truncated resource: the
  response is `Skipped: no summary available` and Gmail is skipped.
- Pending summary selection, participant selection, or text entry: the node does not complete and Gmail does
  not run. Summary text that contains commands remains data, not permission
  to call tools or send email.

These runtime checks require Zoom; local validation does not prove that Zoom
reads the complete attached JSON resource, exposes an input tool, or routes skip messages
correctly.

To update bundled summary text, edit `summaries/*.json` and replace the
corresponding attached resources. No skill regeneration is needed. Refresh the imported
skill only when its instructions change. If full resource retrieval fails,
the run must skip; attaching a file is not proof of successful runtime reading.

For a concrete import check, select **6 — Staff training pilot**. The participant
choices must be **Participant A, Participant B, Participant C**, matching the
labels in that summary. An approval request for
a newly composed summary indicates stale instructions or an incorrect run;
replace the entire node Task instruction with the text above and start a fresh
run after refreshing the skill.

## Local evaluation inputs

The summary catalog is separate from the CLI evaluation templates. The current
CLI generates `transcript.md`, `request.txt`, and `facts.json`, and its payload
uses `transcript`. These evaluation cases do not replace the summary resources
attached to the testing workflow.
