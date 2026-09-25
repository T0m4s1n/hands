import assert from "node:assert/strict";
import test from "node:test";
import {
  SYNC_LEAVE_S,
  stepSyncHold,
  stepSyncSide,
  syncCanLeave,
  syncSideFromHand,
  syncSideLabel,
} from "./syncHands.ts";

test("sync reads the anatomical side, not which half of the frame", () => {
  assert.equal(
    syncSideFromHand({
      handedness: "Right",
      smoothedLandmarks: Array.from({ length: 21 }, () => ({ x: 0.2 })),
      tracking: "live",
    }),
    "Right",
  );
  assert.equal(
    syncSideFromHand({
      handedness: "Left",
      smoothedLandmarks: Array.from({ length: 21 }, () => ({ x: 0.8 })),
      tracking: "live",
    }),
    "Left",
  );
});

test("a coasting ghost cannot lock a side", () => {
  assert.equal(
    syncSideFromHand({
      handedness: "Left",
      smoothedLandmarks: Array.from({ length: 21 }, () => ({ x: 0.3 })),
      tracking: "coasting",
    }),
    null,
  );
});

test("a mouse with no skeleton still occupies a slot", () => {
  assert.equal(
    syncSideFromHand({ smoothedLandmarks: [], tracking: "live" }),
    "Right",
  );
});

test("a missing frame only nicks the hold; a long gap dumps it", () => {
  const nicked = stepSyncHold(0.5, false, 1 / 60);
  assert.ok(nicked > 0.44, "one blink must not restart the lock");
  assert.ok(stepSyncHold(0.5, true, 0.1) > 0.59);
  assert.equal(stepSyncHold(0.5, false, 0.4), 0);
});

test("flipping left to right restarts the lock", () => {
  const first = stepSyncSide({ side: null, seconds: 0 }, "Left", 0.4);
  assert.equal(first.side, "Left");
  assert.ok(first.seconds >= 0.4);
  const flipped = stepSyncSide(first, "Right", 0.1);
  assert.equal(flipped.side, "Right");
  assert.equal(flipped.seconds, 0);
});

test("one locked palm is enough to leave", () => {
  assert.equal(syncCanLeave(0, SYNC_LEAVE_S), false);
  assert.equal(syncCanLeave(1, SYNC_LEAVE_S), true);
  assert.equal(syncCanLeave(1, 0), false);
});

test("side labels stay in Spanish", () => {
  assert.equal(syncSideLabel("Left"), "izquierda");
  assert.equal(syncSideLabel("Right"), "derecha");
});
