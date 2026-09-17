# Meeting Coach prototype

A browser-only practice space for **one selected meeting participant**. It runs independently of Zoom and the production HTML email skill. The existing evaluator and email contract are unchanged.

From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory prototype
```

Open http://127.0.0.1:4173. No installation, account, API key, or build is required. Use an HTTP server rather than opening `index.html` directly, because the browser loads JavaScript modules.

## Try the complete flow

1. Use the fictional example, enter a synthetic transcript, or choose **Make a scenario**. The generator offers three settings, three practice moments, two lengths, and a custom character name.
2. Choose **Which person are you?**, then open the coaching space. Names come from `Name: speech` transcript lines; timestamp prefixes are supported. Continuation lines belong to the preceding speaker.
3. Review the excerpt-based overview. Other participants provide context; they never receive coaching or their own plans.
4. Use **I’m stuck** to choose a difficulty, optionally attach a transcript moment, adapt suggested wording, and keep it in your plan.
5. Use **I want to work on…** for a structured prepare / practice / reflect exercise. Drafts and checklists survive section changes within the session.
6. Copy your personal plan. Editing the source does not silently change the active coaching identity; opening an updated session explicitly clears the previous plan and drafts.

## Prototype boundaries

The scenario generator is template-based. The overview quotes transcript excerpts; it does not summarize decisions semantically. Coaching phrases and practice partners are scripted. This prototype does not make AI calls, infer intent or diagnoses, evaluate social conformity, send advice, or connect to Zoom. These limits are also stated in the interface.

All session state is held in browser memory and clears on reload. There are no external assets, analytics, browser-storage writes, or network requests for transcript content. Clipboard access happens only when a copy button is clicked. Use fictional meetings only.

`coach.mjs` separates transcript parsing, scenario generation, and exercise content from the UI in `app.mjs`. A future model-backed coach can replace the scripted reasoning while retaining the single-person session contract and structured interface. Model credentials must stay on a server.

## Checks

```sh
node --test prototype/coach.test.mjs
pytest -q
```

Browser checks should cover creating a custom person, each coaching section, changing the selected person, plan isolation, invalid transcript input, keyboard navigation, and narrow screens.
