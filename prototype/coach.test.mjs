import test from "node:test";
import assert from "node:assert/strict";
import {
  generateTranscript,
  parseTranscript,
  participants,
  makeSession,
} from "./coach.mjs";

test("every generator combination preserves exactly one selected identity", () => {
  for (const setting of ["work", "study", "community"]) {
    for (const challenge of ["clarity", "capacity", "speaking"]) {
      for (const length of ["short", "long"]) {
        for (const name of ["Alex", "Morgan", "sam", "李明", "<b>Alex</b>"]) {
          const text = generateTranscript({ name, setting, challenge, length });
          const session = makeSession(text, name);
          assert.equal(participants(session.turns).length, 3);
          assert.equal(session.person, name);
          assert.ok(session.ownTurns.length >= 2);
          assert.ok(session.ownTurns.every((turn) => turn.speaker === name));
          assert.equal(session.turns.length, length === "long" ? 13 : 8);
        }
      }
    }
  }
});

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
  assert.throws(() => makeSession(text, "Alex and Morgan"), /Choose your name/);
});

test("timestamped, multiline, and Unicode speaker turns are accepted", () => {
  const turns = parseTranscript(
    "[00:01:02] 李明: Could we clarify this?\nI need a deadline.\n00:02 Morgan Lee: We have not decided.",
  );
  assert.deepEqual(participants(turns), ["李明", "Morgan Lee"]);
  assert.equal(turns[0].text, "Could we clarify this? I need a deadline.");
});

test("invalid transcript and generator names fail explicitly", () => {
  assert.throws(() => makeSession("", "Alex"), /at least two/);
  assert.throws(() => makeSession("Unlabelled prose", "Alex"), /at least two/);
  for (const name of ["", "123", "A: B", "Alex\nMorgan", "a".repeat(51)]) {
    assert.throws(() => generateTranscript({ name }), /character name/);
  }
});
