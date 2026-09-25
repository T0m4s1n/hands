import assert from "node:assert/strict";
import test from "node:test";
import {
  COUNTDOWN_BEATS,
  GO_BEAT_MS,
  NUMBER_BEAT_MS,
  countdownBeatDuration,
  countdownBeatSound,
} from "./countdownSchedule.ts";

test("countdown includes a visible go beat before gameplay", () => {
  assert.deepEqual(COUNTDOWN_BEATS, ["3", "2", "1", "¡YA!"]);
  assert.equal(countdownBeatSound(3), "go");
  assert.equal(countdownBeatDuration(3), GO_BEAT_MS);
});

test("number beats remain synchronized to their tick animation", () => {
  for (let index = 0; index < 3; index++) {
    assert.equal(countdownBeatSound(index), "tick");
    assert.equal(countdownBeatDuration(index), NUMBER_BEAT_MS);
  }
});

test("out-of-range beats never request audio", () => {
  assert.equal(countdownBeatSound(-1), null);
  assert.equal(countdownBeatSound(COUNTDOWN_BEATS.length), null);
});
