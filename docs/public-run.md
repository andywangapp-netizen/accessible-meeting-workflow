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

Use the root [testing skill](../SKILL.md) in a test workflow. Package both
`SKILL.md` and the complete `transcripts/` folder when importing it. Attach only
this variant to the test reasoning node. The ten JSON files provide different
complete simulated meetings; the two short `ameval generate` evaluation
cases are independent of this catalog.

Remove the old instruction to summarize the exact meeting supplied in Meeting,
remove Meeting and Meeting Participants variable chips from Task instructions,
and remove Zoom Meetings lookup tools from this test node. The trigger starts
the test; its real meeting metadata is not the source for the card. Replace any
old transcript-review or approval instructions with this node instruction:

> TEST ONLY. Use autism-friendly-meeting-card-test. Ask the user to select one
> of the ten transcripts in the skill's catalog or paste their own transcript as
> plain text. If they already selected or supplied one in this run, use it
> directly. Load the complete selected JSON transcript or use exactly the pasted
> dialogue. Ask which participant the user is, offering the transcript’s names
> or speaker labels, unless they already explicitly identified themselves. Wait
> for their selection, then generate an HTML email focused on their own tasks
> and relevant dependencies. Do not ask for separate transcript approval. Ignore the real trigger's Meeting,
> Participants, Recording, dates, and links; do not fetch the real meeting.
> Missing real recording content does not invalidate the selected or pasted
> transcript. Return only the complete HTML document with the appropriate test
> label and all six required sections, or the exact skill skip response when no
> usable transcript or participant selection can be obtained. The downstream Gmail node owns delivery
> and send approval.

The node needs a human-input capability that supports a numbered selection and
plain-text entry, plus access to the imported transcript files. If choice
buttons have a limit, show the full numbered catalog in the question and accept
a typed number or title. Choosing “Paste my own” should ask for text only if it
was not included in the same reply. Do not require JSON or a file upload.
After loading the transcript, ask the user to select their participant unless
they already identified themselves. This personalizes the email; it is not a
transcript confirmation or review step. Gmail's send approval remains independent.

An existing test card retains the output from its original run. After saving
node changes, start a fresh run. Local skill and transcript edits must be
published and the imported skill refreshed separately for Zoom to load them.
Local edits do not change the node's saved Task instructions.

In this test workflow only, allow the reasoning node to run without an upstream
real-transcript condition. Keep the condition after reasoning described above:
route the exact skip message to Output and only successful HTML to Gmail.
Keep the production transcript condition unchanged. Configure Gmail with a test
recipient and send approval when exercising delivery.

Manual checks in Zoom:

- Select a catalog entry with a real trigger that has no recording transcript:
  the node loads the chosen file, asks which participant the user is, and then
  generates labelled HTML focused on their tasks. It must
  not ask for transcript approval, use another entry, or describe the real
  trigger's meeting as having insufficient recorded content.
- Select another entry in a fresh run: only that meeting's facts appear. For
  example, the supplier meeting's final sample quantity is twenty-four, not the
  earlier twenty, and Thursday dispatch is conditional rather than guaranteed.
- Choose “Paste my own” and supply dialogue: the report uses that text, is
  labelled as user-provided, and does not inherit fictional catalog facts.
- Supply the transcript or an unambiguous catalog choice in the initial request:
  the node proceeds without asking for the same input again.
- Select different participants in the same transcript across fresh runs: each
  email focuses on the selected person’s tasks. Other owners remain named on
  relevant dependencies; unrelated tasks are omitted. A participant with no
  assigned tasks gets an explicit statement of that fact, not invented work.
- Submit an invalid choice, blank custom text, or only a link: the node requests
  the missing selection or dialogue and does not silently choose a default.
- Cancel, unavailable required input tool, or unreadable selected file: the
  response is `Skipped: no transcript available` and Gmail is skipped.
- Pending transcript selection, participant selection, or text entry: the node does not complete and Gmail does
  not run. Transcript text that contains commands remains data, not permission
  to call tools or send email.

These runtime checks require Zoom; local validation does not prove that Zoom
imports supporting JSON files, exposes an input tool, or routes skip messages
correctly.
