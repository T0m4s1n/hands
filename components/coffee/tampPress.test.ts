import assert from "node:assert/strict";
import test from "node:test";
import {
  TAMP_DURATION,
  TAMP_HIT_AT,
  tampAmount,
  tampHits,
  tampPose,
  tampBusyOnStage,
  tampSetOpen,
} from "./tampPress.ts";

test("a press clip starts high, slams, then recovers", () => {
  const wind = tampPose(0.2);
  const hit = tampPose(TAMP_HIT_AT);
  const done = tampPose(1);
  assert.ok(wind.lift > 0.3, "wind-up lifts the mallet");
  assert.ok(hit.lift < wind.lift, "the slam comes down");
  assert.ok(hit.dust > 0.5, "impact throws dust");
  assert.ok(done.dust < 0.15, "dust dies as it recovers");
  assert.ok(done.lift > hit.lift, "it lifts off the puck again");
});

test("the hit fires once, when the head meets the puck", () => {
  assert.equal(tampHits(0.2, 0.3), false);
  assert.equal(tampHits(0.38, 0.42), true);
  assert.equal(tampHits(0.5, 0.7), false);
  assert.equal(tampAmount(TAMP_DURATION), 1);
  assert.equal(tampAmount(0), 0);
});

test("a started set stays open until the last strike", () => {
  assert.equal(tampSetOpen(true, 0, 3), true);
  assert.equal(tampSetOpen(false, 1, 3), true);
  assert.equal(tampSetOpen(false, 3, 3), false);
  assert.equal(tampSetOpen(false, 0, 3), false);
});

test("grind radians never look like a tamp set in progress", () => {
  assert.equal(tampBusyOnStage("crank", false, 1.5, 3), false);
  assert.equal(tampBusyOnStage("place", false, 1, 3), false);
  assert.equal(tampBusyOnStage("tamp", false, 1, 3), true);
  assert.equal(tampBusyOnStage("tamp", true, 0, 3), true);
});

test("the last strike of the set hits harder than the first", () => {
  const first = tampPose(0.22, 0);
  const last = tampPose(0.22, 2);
  assert.ok(last.lift > first.lift, "finale winds higher");
  const firstHit = tampPose(TAMP_HIT_AT, 0);
  const lastHit = tampPose(TAMP_HIT_AT, 2);
  assert.ok(lastHit.lift < firstHit.lift, "finale slams deeper");
});
