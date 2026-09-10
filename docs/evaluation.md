# DP-node evaluation

This repository gives an intern a small, repeatable test for a deep-reasoning
(DP) node. The input is synthetic, the skill is public, and the verdict is
offline and deterministic.

## What is evaluated

`ameval evaluate` checks four independent parts of the generated page:

- **HTML contract:** a complete document, responsive metadata, one `main`,
  one `h1`, six ordered `h2` sections, and three report lists.
- **Accessibility:** readable inline CSS, a visible `:focus-visible` style,
  reduced-motion support, no positive `tabindex`, autoplay, or missing image
  alt text.
- **Safety and privacy:** no diagnostic or shaming language, scripts,
  iframes, active content, remote resources, credentials, internal hosts, or
  hidden instructions.
- **Meeting fidelity:** decisions and open items agree with the case's
  `facts.json`; named owners and times are kept when they appear in the
  transcript.

## Offline suite

Run the checked-in examples first:

```bash
ameval evaluate --skill . \
  --case cases/frozen/classroom_support \
  --output examples/sample_dp_output.html

ameval evaluate --skill . \
  --case cases/frozen/team_standup \
  --output examples/sample_team_standup.html
```

The first command should exit `0`. A deliberately unsafe/inaccurate page is
also checked by the unit tests and must exit non-zero:

```bash
pytest -q
```

For a DP-node run, generate a case, attach **only** the transcript and the
root `SKILL.md`, save the returned HTML under the gitignored `runs/`
directory, and run the same command against that file. Keep the JSON verdict
and the HTML page; do not upload account data, production traces, cookies,
tokens, or real meeting content.

## Interpreting a result

`pass: true` means the page met the public structural, safety, and
fact-grounding gates. It is not a clinical assessment and it is not proof that
the page works for every reader. Ask an autistic self-advocate or accessibility
reviewer to assess tone and usability before treating a change as ready.
