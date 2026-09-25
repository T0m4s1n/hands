import assert from "node:assert/strict";
import { test } from "node:test";
import { mouthOf } from "./mouth.ts";

test("mouth sits on the wide end of a spatula, not the handle", () => {
  const points = [
    // Diamond blade on −X (tip, belly, neck)
    { x: -0.78, y: 0, z: 0.04 },
    { x: -0.62, y: -0.12, z: 0.04 },
    { x: -0.62, y: 0.12, z: 0.04 },
    { x: -0.52, y: -0.18, z: 0.04 },
    { x: -0.52, y: 0.18, z: 0.04 },
    { x: -0.4, y: -0.2, z: 0.05 },
    { x: -0.4, y: 0.2, z: 0.05 },
    { x: -0.3, y: 0, z: 0.04 },
    // Thin handle on +X
    { x: 0.7, y: -0.04, z: 0.05 },
    { x: 0.7, y: 0.04, z: 0.05 },
    { x: 0.78, y: 0, z: 0.06 },
  ];
  const [x, y, z] = mouthOf(points, 0.08);
  assert.ok(x < -0.4, `expected the blade, not the neck, got x=${x}`);
  assert.ok(x > -0.72, `should not hang off the tip, got x=${x}`);
  assert.equal(y, 0);
  assert.ok(z > 0.1 && z < 0.16, `heap should rest on the blade, got z=${z}`);
});
