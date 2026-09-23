/**
 * The carry-height rule, checked outside a browser.
 *
 * These are the cases that used to produce the interpenetration bugs, back
 * when the height came from the hand instead of from the geometry.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { carryOver, overlap, type Placed } from "./solid.ts";

const mortar: Placed = {
  x: 0,
  y: 0,
  z: 0.05,
  shape: { kind: "open", radius: 0.5, height: 0.6, rim: 0.34, floor: 0.12 },
};
const spoon = { kind: "round", radius: 0.12, height: 0.1 } as const;

test("rides low when nothing is near", () => {
  assert.equal(carryOver(spoon, mortar, 6, 0, 0.42), 0.42);
});

test("clears the obstacle's top once it is over it", () => {
  const at = carryOver(spoon, mortar, 0, 0, 0.42);
  assert.ok(at >= mortar.z + mortar.shape.height, `${at} should clear the rim`);
});

test("rises before the footprints meet, not after", () => {
  const touching = 0.5 + 0.12;
  const justOutside = carryOver(spoon, mortar, touching + 0.25, 0, 0.42);
  assert.ok(justOutside > 0.42, "should already be lifting on approach");
  assert.ok(justOutside < carryOver(spoon, mortar, 0, 0, 0.42));
});

test("rises without ever going back down as it comes in", () => {
  let last = -Infinity;
  for (let d = 3; d >= 0; d -= 0.05) {
    const at = carryOver(spoon, mortar, d, 0, 0.42);
    assert.ok(at >= last - 1e-9, `dipped at ${d}`);
    last = at;
  }
});

test("a low obstacle never pulls the ride height down", () => {
  const mat: Placed = {
    x: 0,
    y: 0,
    z: 0,
    shape: { kind: "slab", halfLong: 1, halfShort: 1, height: 0.02 },
  };
  assert.equal(carryOver(spoon, mat, 0, 0, 0.42), 0.42);
});

test("at the height it decides, it is no longer overlapping", () => {
  // The whole point: ride at the decided height and the separation that used
  // to fight the hand has nothing left to do.
  const z = carryOver(spoon, mortar, 0, 0, 0.42);
  assert.equal(overlap({ x: 0, y: 0, z, shape: spoon }, mortar), null);
});
