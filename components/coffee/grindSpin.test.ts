import assert from "node:assert/strict";
import test from "node:test";
import {
  GRIND_DURATION,
  GRIND_MARK,
  GRIND_TRAVEL_MIN,
  grindAmount,
  grindAngle,
  grindBusyOnStage,
  grindPose,
  grindProgress,
} from "./grindSpin.ts";

test("the clip starts empty and only finishes at the end", () => {
  assert.equal(grindProgress(0), 0);
  assert.ok(grindProgress(GRIND_DURATION * 0.4) > 0.3);
  assert.ok(grindProgress(GRIND_DURATION * 0.4) < 0.5);
  assert.equal(grindProgress(GRIND_DURATION), 1);
  assert.equal(grindAmount(0, Math.PI * 4), 0);
  assert.ok(grindAmount(0.5, Math.PI * 4) < Math.PI * 4);
  assert.equal(grindAmount(1, Math.PI * 4), Math.PI * 4);
});

test("the pestle actually travels around the mortar", () => {
  const from = 0.3;
  const mid = grindAngle(from, 0.5, Math.PI * 4);
  const end = grindAngle(from, 1, Math.PI * 4);
  assert.ok(mid > from);
  assert.ok(end > mid);
  assert.ok(end - from >= GRIND_TRAVEL_MIN);
  assert.equal(grindBusyOnStage("crank", true), true);
  assert.equal(grindBusyOnStage("crank", false), false);
  assert.equal(grindBusyOnStage("tamp", true), false);
});

test("the designed mark is a fake score, not a wrist reading", () => {
  assert.ok(GRIND_MARK > 0.8 && GRIND_MARK < 1);
  assert.ok(GRIND_DURATION > 1.5);
});

test("the pestle leans and rocks while it is working", () => {
  const idle = grindPose(0, 0);
  const busy = grindPose(1, 1);
  assert.ok(busy.lean > idle.lean);
});
