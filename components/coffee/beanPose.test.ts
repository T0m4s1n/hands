import assert from "node:assert/strict";
import test from "node:test";
import { BEAN_REST, beanJump, beanLocalPose } from "./beanPose.ts";

test("tracking noise below the rest deadzone does not animate the heap", () => {
  assert.equal(beanJump(0), 0);
  assert.equal(beanJump(BEAN_REST - 0.01), 0);
  assert.ok(beanJump(0.4) > 0);
});

test("a still heap sits in the same place at any clock reading", () => {
  const early = beanLocalPose(3, 0.7, true, 0, 0);
  const late = beanLocalPose(3, 0.7, true, 0, 40);
  assert.deepEqual(early, late);
});

test("work hops a bean without sending it around the bowl", () => {
  const rest = beanLocalPose(5, 0.7, true, 0, 1);
  const hop = beanLocalPose(5, 0.7, true, 1, 1);
  assert.ok(Math.hypot(hop.x - rest.x, hop.y - rest.y) < 0.08);
  assert.ok(hop.z >= rest.z);
});
