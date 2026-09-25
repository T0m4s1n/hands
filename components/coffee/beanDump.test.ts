import assert from "node:assert/strict";
import test from "node:test";
import {
  dumpAmount,
  dumpReleases,
  scoopDumpPose,
  spawnDumpBean,
  stepDumpBean,
} from "./beanDump.ts";

test("the dump clip starts flat and finishes tipped", () => {
  const start = scoopDumpPose(0);
  const end = scoopDumpPose(1);
  assert.equal(start.roll, 0);
  assert.ok(end.roll > 1.2);
  assert.ok(scoopDumpPose(0.5).lift > start.lift);
});

test("beans leave after the wrist has begun to turn", () => {
  assert.equal(dumpReleases(0.1), false);
  assert.equal(dumpReleases(0.42), true);
  assert.equal(dumpAmount(0), 0);
  assert.equal(dumpAmount(99), 1);
});

test("a dumped bean falls into the bowl and stays there", () => {
  const from = { x: 0, y: 0, z: 1.2 };
  const bowl = { x: 0.2, y: 0.1, z: 0.2, radius: 0.7 };
  const bean = spawnDumpBean(0, from, bowl);
  for (let i = 0; i < 80; i++) stepDumpBean(bean, 1 / 30, bowl);
  assert.ok(bean.z >= bowl.z - 1e-6);
  assert.ok(Math.hypot(bean.x - bowl.x, bean.y - bowl.y) <= bowl.radius + 1e-6);
  assert.equal(bean.settled, true);
});

test("a long frame cannot fling a bean through the floor", () => {
  const bean = spawnDumpBean(4, { x: 0, y: 0, z: 0.4 }, { x: 0, y: 0, z: 0.2 });
  stepDumpBean(bean, 2, { x: 0, y: 0, z: 0.2, radius: 0.8 });
  assert.ok(Number.isFinite(bean.z));
  assert.ok(bean.z >= 0.2 - 1e-6);
});
