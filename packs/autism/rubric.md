# Rubric

The offline evaluator is fail-closed. A model report passes only when all of
these are true:

1. It is a standalone HTML document with the required metadata, landmarks,
   headings, and accessibility hooks from `schema.json`.
2. It has no scripts, remote resources, positive `tabindex`, autoplay, or
   missing image alt text.
3. Every required heading exists in the required order.
4. Decided items match the case `facts.json` `decided` list (paraphrase is
   allowed).
5. Nothing in `facts.json` `not_decided` is written as a decision.
6. Next steps are concrete (who / what) when the transcript named a person.
7. No forbidden phrase from `forbidden.md` appears, and the report does not
   claim that anyone has a diagnosis.

The evaluator checks structure and safety deterministically. Human review is
still needed for tone, usefulness, and whether the layout works for the
intended reader.
