import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSummary,
  parseTranscript,
  participants,
  makeSession,
  buildSystemPrompt,
  summaryToTranscript,
} from "./coach.mjs";

test("speaker selection excludes others even if their words mention the coached person", () => {
  const text =
    "Morgan: Alex should ask Sam.\nAlex: I need more time.\nSam: I can do this.";
  assert.deepEqual(
    makeSession(text, "Alex").ownTurns.map((turn) => turn.text),
    ["I need more time."],
  );
  assert.deepEqual(
    makeSession(text, "Morgan").ownTurns.map((turn) => turn.text),
    ["Alex should ask Sam."],
  );
  assert.throws(() => makeSession(text, "Alex and Morgan"), /Choose your participant name/);
});

test("timestamped, multiline, and Unicode speaker turns are accepted", () => {
  const turns = parseTranscript(
    "[00:01:02] 李明: Could we clarify this?\nI need a deadline.\n00:02 Morgan Lee: We have not decided.",
  );
  assert.deepEqual(participants(turns), ["李明", "Morgan Lee"]);
  assert.equal(turns[0].text, "Could we clarify this? I need a deadline.");
});

test("invalid transcripts fail explicitly", () => {
  assert.throws(() => makeSession("", "Alex"), /at least two/);
  assert.throws(() => makeSession("Unlabelled prose", "Alex"), /at least two/);
});

test("chat prompt is scoped to the selected person and includes the transcript", () => {
  const text = "Morgan: Can we clarify the next step?\nSam: Yes, let us do that.";
  const prompt = buildSystemPrompt(text, "Morgan");
  assert.match(prompt, /Coach Morgan only/);
  assert.ok(prompt.includes(parseTranscript(text)[0].text));
  assert.throws(() => buildSystemPrompt(text, "Nobody"));
});

test("every simulated summary converts to a usable multi-participant transcript", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("../summaries/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.equal(files.length, 10);
  for (const file of files) {
    const meeting = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    const turns = parseTranscript(summaryToTranscript(meeting.summary));
    assert.ok(turns.length >= 6, file);
    assert.ok(participants(turns).length >= 2, file);
    assert.ok(participants(turns).every((n) => /^Participant [A-Z]$/.test(n)), file);
    const segments = meeting.summary.split(" • ").length;
    assert.ok(turns.length >= segments, file);
  }
});

test("every shipped summary passes the summary format check; bad ones fail", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("../summaries/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")))
    validateSummary(JSON.parse(readFileSync(new URL(file, dir), "utf8")).summary);
  assert.throws(() => validateSummary("too short"));
  assert.throws(() => validateSummary("[00:10-00:05] A — Participant A x " + "word ".repeat(90)));
});
