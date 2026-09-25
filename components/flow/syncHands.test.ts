import assert from "node:assert/strict";
import test from "node:test";
import {
  SYNC_LEAVE_S,
  stepSyncHold,
  syncCanLeave,
  syncSlotFromHand,
  syncSlotFromWrist,
} from "./syncHands.ts";

test("sync slots follow the wrist, not a flipping Left/Right label", () => {
  assert.equal(syncSlotFromWrist(0.2), "Left");
  assert.equal(syncSlotFromWrist(0.8), "Right");
});

test("a missing frame only nicks the hold; a long gap dumps it", () => {
  const nicked = stepSyncHold(0.5, false, 1 / 60);
  assert.ok(nicked > 0.44, "one blink must not restart the lock");
  assert.ok(stepSyncHold(0.5, true, 0.1) > 0.59);
  assert.equal(stepSyncHold(0.5, false, 0.4), 0);
});

test("a mouse with no skeleton still occupies a slot", () => {
  assert.equal(
    syncSlotFromHand({ smoothedLandmarks: [], tracking: "live" }),
    "Right",
  );
  assert.equal(
    syncSlotFromHand({
      smoothedLandmarks: Array.from({ length: 9 }, () => ({ x: 0.2 })),
    }),
    "Left",
  );
});

test("one locked palm is enough to leave", () => {
  assert.equal(syncCanLeave(0, SYNC_LEAVE_S), false);
  assert.equal(syncCanLeave(1, SYNC_LEAVE_S), true);
  assert.equal(syncCanLeave(1, 0), false);
});
