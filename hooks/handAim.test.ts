import assert from "node:assert/strict";
import test from "node:test";
import {
  aimImage,
  aimWorld,
  HAND_HOVER,
  knuckleCenter,
  palmSpan,
  parkCloudAtAim,
} from "./handAim.ts";

function handAt(span: number, wristY: number) {
  const cloud = Array.from({ length: 21 }, () => ({ x: 0.5, y: wristY, z: 0 }));
  cloud[0] = { x: 0.5, y: wristY, z: 0 };
  const knuckleY = wristY - span;
  for (const i of [5, 9, 13, 17]) {
    cloud[i] = { x: 0.5, y: knuckleY, z: 0 };
  }
  return cloud;
}

test("a close-up does not aim as low as the wrist in the frame", () => {
  const close = handAt(0.36, 0.84);
  const play = handAt(0.16, 0.62);
  assert.ok(palmSpan(close) > palmSpan(play));
  const closeAim = aimImage(close);
  const playAim = aimImage(play);
  assert.ok(closeAim.y < close[0].y);
  assert.ok(closeAim.y > knuckleCenter(close).y - 0.02);
  assert.ok(playAim.y < play[0].y);
  assert.ok(playAim.y > knuckleCenter(play).y - 0.05);
  assert.ok(
    Math.abs(closeAim.y - playAim.y) < 0.12,
    "leaning in must not dump the mitt at the front of the counter",
  );
});

test("world aim stays at hover even when landmark z is large", () => {
  const close = handAt(0.36, 0.84);
  close[0].z = -0.8;
  const world = aimWorld(close, (lm) => ({
    x: (lm.x - 0.5) * 7,
    y: (0.5 - lm.y) * 5,
    z: HAND_HOVER + -lm.z * 1.4,
  }));
  assert.equal(world.z, HAND_HOVER);
  assert.ok(world.y > (0.5 - close[0].y) * 5);
});

test("parkCloudAtAim pins the palm to hover without changing the span", () => {
  const cloud = [
    { x: 1, y: -2, z: 0.2 },
    { x: 1.4, y: -1.6, z: 0.5 },
  ];
  const span = Math.hypot(cloud[1].x - cloud[0].x, cloud[1].y - cloud[0].y);
  parkCloudAtAim(cloud, cloud[0], { x: 0, y: 0, z: HAND_HOVER });
  assert.ok(Math.abs(cloud[0].x) < 1e-9);
  assert.ok(Math.abs(cloud[0].y) < 1e-9);
  assert.ok(Math.abs(cloud[0].z - HAND_HOVER) < 1e-9);
  const next = Math.hypot(cloud[1].x - cloud[0].x, cloud[1].y - cloud[0].y);
  assert.ok(Math.abs(next - span) < 1e-9);
});
