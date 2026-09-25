import assert from "node:assert/strict";
import test from "node:test";
import {
  canCommitRelease,
  holderIsDriving,
  releaseReason,
} from "./interactionState.ts";

test("opening a tracked hand is an intentional release", () => {
  const reason = releaseReason(true, true, false);
  assert.equal(reason, "opened");
  assert.equal(canCommitRelease(reason, 0.5, 0.04), true);
});

test("tracking loss safely releases without scoring", () => {
  const reason = releaseReason(true, false, true);
  assert.equal(reason, "tracking-lost");
  assert.equal(canCommitRelease(reason, 1, 0.04), false);
});

test("an active pinch and an absent holder do not release", () => {
  assert.equal(releaseReason(true, true, true), "none");
  assert.equal(releaseReason(false, false, false), "none");
});

test("tiny accidental actions are not committed", () => {
  assert.equal(canCommitRelease("opened", 0.04, 0.04), false);
});

test("a coasting holder is still driving the object", () => {
  assert.equal(holderIsDriving({ tracking: "coasting" }), true);
  assert.equal(holderIsDriving({ tracking: "live" }), true);
  assert.equal(holderIsDriving(undefined), false);
  assert.equal(releaseReason(true, holderIsDriving({ tracking: "coasting" }), true), "none");
});
