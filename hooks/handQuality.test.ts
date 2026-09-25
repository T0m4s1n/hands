import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_SKELETON_QUALITY,
  blendWorldDepth,
  keepGoodHands,
  skeletonQuality,
} from "./handQuality.ts";

const OPEN_HAND: { x: number; y: number; z: number }[] = [
  { x: 0.3, y: 0.6, z: 0 },
  { x: 0.26, y: 0.54, z: 0 },
  { x: 0.23, y: 0.48, z: 0 },
  { x: 0.21, y: 0.43, z: 0 },
  { x: 0.2, y: 0.38, z: 0 },
  { x: 0.28, y: 0.42, z: 0 },
  { x: 0.28, y: 0.34, z: 0 },
  { x: 0.28, y: 0.28, z: 0 },
  { x: 0.28, y: 0.22, z: 0 },
  { x: 0.32, y: 0.4, z: 0 },
  { x: 0.32, y: 0.32, z: 0 },
  { x: 0.32, y: 0.26, z: 0 },
  { x: 0.32, y: 0.2, z: 0 },
  { x: 0.36, y: 0.42, z: 0 },
  { x: 0.36, y: 0.35, z: 0 },
  { x: 0.36, y: 0.29, z: 0 },
  { x: 0.36, y: 0.24, z: 0 },
  { x: 0.4, y: 0.45, z: 0 },
  { x: 0.4, y: 0.4, z: 0 },
  { x: 0.4, y: 0.36, z: 0 },
  { x: 0.4, y: 0.32, z: 0 },
];

test("a real open hand is accepted", () => {
  assert.ok(skeletonQuality(OPEN_HAND) >= 0.6);
});

test("a hand held up to the lens is still a hand", () => {
  const wrist = OPEN_HAND[0];
  const close = OPEN_HAND.map((point) => ({
    x: wrist.x + (point.x - wrist.x) * 4,
    y: wrist.y + (point.y - wrist.y) * 4,
    z: point.z,
  }));
  assert.ok(skeletonQuality(close) >= MIN_SKELETON_QUALITY);
  assert.equal(keepGoodHands([{ raw: close, labelScore: 0.5 }]).length, 1);
});

test("a collapsed cloud is junk", () => {
  const flat = OPEN_HAND.map(() => ({ x: 0.5, y: 0.5, z: 0 }));
  assert.equal(skeletonQuality(flat), 0);
});

test("keepGoodHands drops the collapsed detection", () => {
  const flat = OPEN_HAND.map(() => ({ x: 0.5, y: 0.5, z: 0 }));
  const kept = keepGoodHands([
    { raw: OPEN_HAND, labelScore: 0.4 },
    { raw: flat, labelScore: 0.99 },
  ]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].raw, OPEN_HAND);
});

test("blendWorldDepth keeps image x/y and borrows relative world z", () => {
  const world = OPEN_HAND.map((point, i) => ({
    ...point,
    z: i === 8 ? 0.04 : 0,
  }));
  const fused = blendWorldDepth(OPEN_HAND, world);
  assert.equal(fused[8].x, OPEN_HAND[8].x);
  assert.ok(fused[8].z > fused[0].z);
});
