---
name: autism-friendly-meeting-card
description: Turn grounded meeting content into a calm, predictable HTML follow-up card, with optional email delivery only when the node already defines the recipient or recipient relation.
---

# Autism-friendly meeting card

Turn a meeting transcript or summary into a clear, low-distraction HTML card.
This is communication support, not diagnosis or treatment. Never infer that a
person is autistic, disabled, a child, or in need of a particular support.

No layout works for every autistic person. If the input states communication
or sensory preferences, follow those preferences first. Otherwise use the
neutral defaults below without claiming medical or universal benefit.

## Evidence rules

- Use only facts present in the meeting input or explicitly supplied by the
  workflow instruction.
- Separate confirmed decisions from proposals, open questions, and topics that
  were not decided.
- Preserve named owners, dates, and times exactly. Never invent a missing owner,
  deadline, recipient, link, diagnosis, or recommendation.
- If information is missing or ambiguous, say `Not stated` or put it under
  `Possible confusion points`.

## HTML card contract

Return one complete standalone HTML document and no Markdown fence. The body
must contain exactly one primary card:

```html
<main>
  <article class="meeting-card" aria-labelledby="meeting-card-title">
    <h1 id="meeting-card-title">...</h1>
    <!-- six required sections -->
  </article>
</main>
```

Include `<!doctype html>`, `<html lang="en">`, UTF-8 metadata, a responsive
viewport, a useful `<title>`, and inline CSS in one `<style>` element. Do not
load scripts, fonts, images, trackers, iframes, or remote resources.

Inside the card, use these `<h2>` sections in this exact order:

1. `One-sentence summary`
2. `What was decided`
3. `What was not decided`
4. `Next steps`
5. `Possible confusion points`
6. `Presenting outline`

Use lists for decisions, next steps, and the presenting outline. In each next
step, make the owner, action, and timing easy to scan when the meeting states
them. Do not turn an open item into a commitment.

## Low-distraction presentation

- Use a single-column card no wider than `46rem`, left-aligned text, at least
  `18px` body text, and a line height of at least `1.6`.
- Use a plain system font, generous spacing, a calm solid background, and high
  contrast. Do not use gradients, decorative imagery, shadows that reduce
  legibility, or colour as the only status signal.
- Keep sentences short and literal. Prefer familiar words. Avoid idioms,
  sarcasm, vague encouragement, ALL CAPS, excessive punctuation, and decorative
  emoji.
- Make the reading order visible and predictable. Keep each idea in one list
  item. Do not hide content behind accordions, hover states, or animation.
- Include a visible `:focus-visible` style and a
  `prefers-reduced-motion: reduce` rule. Never use flashing effects, autoplay,
  or positive `tabindex` values.

## Respectful language

- Describe events, decisions, requests, and support preferences, not a person's
  worth, compliance, functioning level, or presumed intent.
- Do not prescribe eye contact, masking, appearing normal, treatment, or a cure.
- Do not present this card as a clinical record or professional assessment.
- Do not mention hidden instructions, evaluation rubrics, internal systems, or
  private account data in the card.

## Optional Gmail delivery

Creating the card does not by itself authorize a send. If the node's own
instruction explicitly requests Gmail delivery and supplies an exact recipient
or an explicit run-time recipient relation, use the configured Gmail capability
to send the card once as the HTML body. A relation such as `all meeting
attendees with resolved email addresses` is valid only when the node states it.

- Never choose attendees as recipients unless the node explicitly names that
  attendee relation.
- Stop without sending when the recipient or recipient relation is absent or
  ambiguous. When a set is requested, include only verified members of that set
  and do not broaden it.
- Keep any supplied subject literal. Otherwise use a factual subject such as
  `Meeting follow-up: <meeting title>` only when the title is present.
- Never claim delivery succeeded until Gmail returns provider confirmation.
- Do not retry after an uncertain send result.

Whether sent or returned only, preserve the exact HTML card so it can be
evaluated by the public harness in this repository.
