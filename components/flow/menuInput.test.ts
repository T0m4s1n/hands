import assert from "node:assert/strict";
import test from "node:test";
import type { TrackedHand } from "../../hooks/useHandTracking.ts";
import {
  MENU_HOLD_S,
  MENU_LEAVE_GRACE_MS,
  MENU_PINCH_AFTER_S,
  canDwellSelect,
  canPinchSelect,
  holdInterrupted,
  menuHoldAmount,
} from "./menuInput.ts";

function hand(points: number): TrackedHand {
  return {
    handedness: "Right",
    tracking: "live",
    landmarks: [],
    smoothedLandmarks: Array.from({ length: points }, () => ({
      x: 0,
      y: 0,
      z: 0,
    })),
    cursor: { x: 0, y: 0, z: 0 },
    pinchDistance: 1,
    isGrabbing: false,
  };
}

test("camera hand may confirm a menu option by dwelling", () => {
  assert.equal(canDwellSelect(hand(21)), true);
});

test("mouse fallback never selects merely by resting over an option", () => {
  assert.equal(canDwellSelect(hand(0)), false);
  assert.equal(canDwellSelect(undefined), false);
});

test("a fast sweep does not finish a dwell or a pinch", () => {
  assert.ok(MENU_HOLD_S > 1.05);
  assert.ok(MENU_HOLD_S < 1.6);
  assert.ok(MENU_PINCH_AFTER_S > 0.4);
  assert.ok(menuHoldAmount(200) < 0.25);
  assert.equal(menuHoldAmount(MENU_HOLD_S * 1000), 1);
  assert.equal(canPinchSelect(120), false);
  assert.equal(canPinchSelect(MENU_PINCH_AFTER_S * 1000), true);
  assert.equal(holdInterrupted(80), false);
  assert.equal(holdInterrupted(MENU_LEAVE_GRACE_MS), true);
});
