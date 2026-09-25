import assert from "node:assert/strict";
import test from "node:test";
import {
  gloveChaseRate,
  gloveCurl,
  gloveFollow,
  glovePhase,
  gloveSideSign,
} from "./gloveVisual.ts";

test("a live or coasting hand keeps the designed glove on stage", () => {
  assert.equal(glovePhase(true, { tracking: "live" }), "follow");
  assert.equal(glovePhase(true, { tracking: "coasting" }), "follow");
  assert.equal(glovePhase(true, undefined), "hidden");
  assert.equal(glovePhase(false, { tracking: "live" }), "hidden");
});

test("glove follow is frame-rate independent", () => {
  const a = gloveFollow(0, 1, 12, 1 / 30);
  const b = gloveFollow(gloveFollow(0, 1, 12, 1 / 60), 1, 12, 1 / 60);
  assert.ok(Math.abs(a - b) < 0.002);
});

test("neither glove is mirrored — the palm frame already faces the pinky", () => {
  assert.equal(gloveSideSign("Left"), 1);
  assert.equal(gloveSideSign("Right"), 1);
});

test("a still wrist is chased slowly, a swipe is not", () => {
  const still = gloveChaseRate(0.01, 8, 70, 0.2);
  const swipe = gloveChaseRate(0.4, 8, 70, 0.2);
  assert.ok(still < 16);
  assert.ok(swipe > 50);
});

test("curl stays closed at a full grab and open at rest", () => {
  assert.equal(gloveCurl(0), 0);
  assert.ok(gloveCurl(1) > 0.9);
  assert.ok(gloveCurl(0.3) < gloveCurl(0.8));
  assert.ok(gloveCurl(0.55) > 0.75);
});
