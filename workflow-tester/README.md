# Meeting Workflow · Node Lab

A separate Zoom-style workflow tester: simulated meeting event → AI reasoning → HTML email output. It replaces skill discovery with a searchable, explicit registry and direct SKILL.md attachments. It never sends emails, creates Gmail drafts, or retrieves real Zoom meetings.

## Run locally

Requires Node.js 22+; no dependencies or installation.

```sh
node workflow-tester/server.mjs
```

Open http://127.0.0.1:4174. The server reads the repository `.env`, followed by `workflow-tester/.env`, and keeps the API key out of the browser. Set `OPENAI_API_KEY` to enable real AI execution; `OPENAI_MODEL` is optional. Existing coaching prototype stays on port 4173.

1. Select one of **all ten** bundled summaries, or choose **Paste my own summary**. No catalog entry is selected automatically.
2. Inspect the attached testing skill. Use **Browse skills** to search it or import another `.md` file directly. Imported skills last for this browser session.
3. Choose **AI reasoning** or **Template dry run**, adjust task instructions and the action ceiling, then **Test workflow**.
4. Inspect **Preview**, **HTML**, and **Run log**. Copy or download the exact standalone HTML body.
5. **Export template** downloads the configuration, selected source, full attached skill and output mapping. **Import** restores it; run again for fresh output. No credentials are exported. Custom text is kept in memory unless you explicitly export it.

The trigger configuration mirrors the Zoom UI but is metadata: testing runs immediately, without waiting for meeting events or the configured offset. The output node maps `{{2.response}}` to an HTML preview. Missing source content produces the exact `Skipped: no summary available` status and no email. Skills generate within this tester's fixed six-section meeting-card adapter; it is not a general-purpose agent/tool executor.

## Actual AI vs template mode

**AI reasoning** sends only the selected complete summary, attached skill and task instructions to OpenAI. It performs one generation and at most one validation repair, never exceeding the action ceiling. The six sections use Structured Outputs; each generated item must cite one or more numbered source excerpts. The renderer escapes model/source text and supplies the predictable HTML structure. Validated references check that evidence exists; they do not prove semantic correctness. Review decisions, conditions, dates and completeness in the output.

**Template dry run** makes no AI calls. It displays the source excerpts in the presenting-outline section and marks the other sections unclassified. It verifies template wiring and HTML rendering, not the skill's reasoning or adherence. Its label appears in both the UI and downloaded email. When the server has no key, this mode is initially selected. A failed AI call never silently falls back to template mode.

The browser preview is an empty-permissions sandboxed iframe. The output renderer cannot emit model-provided scripts, remote resources, arbitrary markup or links. The server serves only allowlisted assets; it rejects cross-origin run requests and oversized input. There are no sending integrations. Session configurations and imported content are not stored on the server.

## Hosted version

A private Site is registered, but publication is pending. The working local preview is http://127.0.0.1:4174.

The deployment-ready Worker uses the same runtime as the local server. When published, it starts with template dry runs because the local API credential is **not uploaded**. To enable hosted AI, configure `OPENAI_API_KEY` as a server-side Sites runtime secret and optionally `OPENAI_MODEL`. The existing local key enables local AI immediately.

The local server, tests and build all read the existing repository `SKILL.md` and `summaries/` directly. There is no duplicate resource folder. The build embeds those sources into the generated `worker/index.js` deployment artifact because the hosted Worker cannot read the local repository. Rebuild from this repository whenever the original skill or summaries change.

```sh
cd workflow-tester
npm test
npm run build
npm run validate
```

The AI adapter follows the official [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs). It deliberately renders HTML on the server rather than trusting arbitrary model HTML.
