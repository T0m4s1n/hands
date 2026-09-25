import assert from "node:assert/strict";
import test from "node:test";
import {
  POINTER_ROLL_MAX,
  pointerIsGrabbing,
  pointerIsRolling,
  rollFromDrag,
  rollFromWheel,
} from "./pointerHand.ts";

test("left click grabs even if the right button is also down", () => {
  assert.equal(pointerIsGrabbing(1), true);
  assert.equal(pointerIsGrabbing(3), true);
  assert.equal(pointerIsGrabbing(2), false);
  assert.equal(pointerIsGrabbing(0), false);
});

test("right click is the roll, not a grab", () => {
  assert.equal(pointerIsRolling(2), true);
  assert.equal(pointerIsRolling(3), true);
  assert.equal(pointerIsRolling(1), false);
});

test("a right-drag on X tips the wrist and stops at a real pour", () => {
  const tipped = rollFromDrag(0, 200);
  assert.ok(tipped > 1.2, "a short swipe is a full tip");
  assert.equal(rollFromDrag(0, 800), POINTER_ROLL_MAX);
  assert.ok(rollFromWheel(0, 100) > 0.3);
});
