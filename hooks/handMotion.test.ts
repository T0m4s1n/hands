import assert from "node:assert/strict";
import test from "node:test";
import {
  extrapolateCursor,
  landmarkVelocityToWorld,
  pinToLiveWrist,
} from "./handMotion.ts";

const cloud = [
  { x: 0.3, y: 0.5, z: 0.1 },
  { x: 0.32, y: 0.42, z: 0.08 },
];

test("pinToLiveWrist slides the whole cloud so the wrist matches the camera", () => {
  const live = { x: 0.55, y: 0.4, z: 0.2 };
  const pinned = pinToLiveWrist(cloud, live);
  assert.ok(Math.abs(pinned[0].x - live.x) < 1e-9);
  assert.ok(Math.abs(pinned[0].y - live.y) < 1e-9);
  assert.ok(Math.abs(pinned[1].x - (cloud[1].x + 0.25)) < 1e-9);
  assert.ok(Math.abs(pinned[1].y - (cloud[1].y - 0.1)) < 1e-9);
});

test("depth from the camera is only partly trusted", () => {
  const pinned = pinToLiveWrist(cloud, { x: 0.3, y: 0.5, z: 0.6 });
  assert.ok(pinned[0].z > cloud[0].z);
  assert.ok(pinned[0].z < 0.6);
});

test("world motion flips image Y and scales by the table span", () => {
  const world = landmarkVelocityToWorld({ x: 0.1, y: 0.2, z: 0 }, 7, 5.25);
  assert.ok(Math.abs(world.x - 0.7) < 1e-9);
  assert.ok(Math.abs(world.y + 1.05) < 1e-9);
  assert.equal(world.z, 0);
});

test("cursor extrapolation stops inventing motion after a short horizon", () => {
  const start = { x: 0, y: 0, z: 1 };
  const motion = { x: 10, y: 0, z: 0 };
  const near = extrapolateCursor(start, motion, 0.04);
  const far = extrapolateCursor(start, motion, 0.4);
  assert.ok(Math.abs(near.x - 0.4) < 1e-9);
  assert.ok(far.x > near.x);
  assert.ok(Math.abs(far.x - 0.7) < 1e-9);
});
