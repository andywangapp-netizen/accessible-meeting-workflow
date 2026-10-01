# Meeting Coach prototype

A browser-only practice space for **one selected meeting participant**. It runs independently of Zoom and the production HTML email skill. The existing evaluator and email contract are unchanged.

From the repository root:

```sh
node prototype/server.mjs
```

Open http://127.0.0.1:4173. No installation, account, API key, or build is required. Use an HTTP server rather than opening `index.html` directly, because the browser loads JavaScript modules.

## Try the complete flow

1. Choose one of the ten simulated meeting summaries in `summaries/`, or switch to **Generate with AI**, optionally describe a meeting, and the OpenAI API writes a new fictional summary in the same format (the shipped files are used only as a format reference). You can edit the summary before continuing.
2. Choose **Which person are you?**, then open the coaching space. Participants (Participant A, B, C…) come from the summary's segments, one action per participant clause.
3. Review the excerpt-based overview. Other participants provide context; they never receive coaching or their own plans.
4. Use **I’m stuck** to choose a difficulty, optionally attach a moment from the summary, adapt suggested wording, and keep it in your plan.
5. Use **I want to work on…** for a structured prepare / practice / reflect exercise. Drafts and checklists survive section changes within the session.
6. Copy your personal plan. Editing the source does not silently change the active coaching identity; opening an updated session explicitly clears the previous plan and drafts.

## Optional: AI chat (OpenAI API)

The **Chat with AI** section needs `OPENAI_API_KEY` in `.env`; the local server keeps the key out of the browser:

```sh
cp .env.example .env        # then set OPENAI_API_KEY (and optionally OPENAI_MODEL)
node prototype/server.mjs   # http://127.0.0.1:4173
```

The chat sends your messages and the fictional summary to the OpenAI API, with a system prompt that limits coaching to the selected person. Use fictional meetings only. Without a key, the rest of the prototype works as before and the chat explains how to enable it.

## Prototype boundaries

The overview quotes summary excerpts; it does not summarize decisions semantically. Coaching phrases and practice partners are scripted. Apart from the optional chat and summary generation, this prototype does not make AI calls, infer intent or diagnoses, evaluate social conformity, send advice, or connect to Zoom. These limits are also stated in the interface.

All session state is held in browser memory and clears on reload. There are no external assets, analytics, browser-storage writes, or network requests for meeting content other than the optional OpenAI features. Clipboard access happens only when a copy button is clicked. Use fictional meetings only.

`coach.mjs` separates summary parsing, conversion and validation, and exercise content from the UI in `app.mjs`. A future model-backed coach can replace the scripted reasoning while retaining the single-person session contract and structured interface. Model credentials must stay on a server.

## Checks

```sh
node --test prototype/coach.test.mjs
pytest -q
```

Browser checks should cover creating a custom person, each coaching section, changing the selected person, plan isolation, invalid summary input, keyboard navigation, and narrow screens.
