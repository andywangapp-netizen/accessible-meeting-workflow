# Evaluation rubric

The offline evaluator is fail-closed. A DP result passes only when all of
these are true:

1. It is a standalone HTML document containing one labelled
   `article.meeting-card`, the required metadata and landmarks, and the six
   ordered report sections.
2. It has no scripts, remote resources, positive `tabindex`, autoplay, or
   images without alt text.
3. Decided items match the case's `facts.json` while every `not_decided` item
   stays out of the decisions section.
4. Next steps preserve named owners and timing when the meeting supplies them.
5. No forbidden phrase from `forbidden.md` appears, and the report does not
   claim that anyone has a diagnosis.

The evaluator checks structure, safety, and fact grounding deterministically.
Human review is still required for tone, usefulness, and whether the layout
works for its intended reader.
