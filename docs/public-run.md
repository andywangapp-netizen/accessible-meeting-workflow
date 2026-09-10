# Public run: transcript → endpoint or plugin

## Offline (default)

```text
generate transcript → evaluate(skill, output file)
```

No network. This is enough to measure a deep-reasoning **skill** if you already have the model output.

For `packs/autism`, the model output must be a standalone HTML document. The
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

## Production end-to-end (deep-reasoning node)

```text
synthetic transcript
  → you sign in on public Zoom (Chrome)
  → Codex/Coworker plugin or Workflow UI runs deep reasoning with --skill
  → save output.html
  → ameval evaluate
```

Pass the skill **manually** (`--skill packs/autism`). Do not ask the model to invent a disability pack during eval.
