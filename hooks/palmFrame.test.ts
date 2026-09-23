/**
 * The frame the palm plate and the cuff are placed with, and the rescaling
 * everything drawn from landmarks is measured in.
 *
 * The first two cases are a bug this outlived: flattened to the image plane, a
 * hand pitched forward or turned on its axis produced a frame identical to a
 * flat one, to the last decimal. Not damped — identical. They are kept because
 * the same flattening would be an easy thing to reintroduce by accident.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import {
  makeFrame,
  palmFrame,
  lockSpan,
  deepen,
  LOCKED_SPAN,
} from "./palmFrame.ts";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** A hand held flat, facing the camera. */
const FLAT = {
  wrist: v(0, 0, 0),
  middle: v(0, 1, 0),
  index: v(-0.4, 0.8, 0),
  pinky: v(0.4, 0.8, 0),
};

/** The same hand pitched forward: the knuckles lean away from the camera. */
const PITCHED = { ...FLAT, middle: v(0, 1, -0.6) };

/** The same hand turned: the little finger goes back, the index comes forward. */
const YAWED = {
  ...FLAT,
  index: v(-0.4, 0.8, 0.35),
  pinky: v(0.4, 0.8, -0.35),
};

function frameOf(pose: typeof FLAT, tilt: number) {
  return palmFrame(
    pose.wrist,
    pose.middle,
    pose.index,
    pose.pinky,
    tilt,
    makeFrame(),
  );
}

/** Angle between two normals, in degrees. */
function turn(a: Vector3, b: Vector3) {
  return (Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180) / Math.PI;
}

test("flattened, a pitched hand is indistinguishable from a flat one", () => {
  const flat = frameOf(FLAT, 0);
  const pitched = frameOf(PITCHED, 0);
  assert.equal(turn(flat.normal, pitched.normal), 0);
});

test("flattened, a turned hand is indistinguishable from a flat one", () => {
  const flat = frameOf(FLAT, 0);
  const yawed = frameOf(YAWED, 0);
  assert.equal(turn(flat.normal, yawed.normal), 0);
});

test("with tilt, pitch turns the frame", () => {
  const flat = frameOf(FLAT, 0);
  const pitched = frameOf(PITCHED, 0.7);
  assert.ok(
    turn(flat.normal, pitched.normal) > 15,
    "a hand leaning 0.6 away should turn the frame well past fifteen degrees",
  );
});

test("with tilt, yaw turns the frame", () => {
  const flat = frameOf(FLAT, 0);
  const yawed = frameOf(YAWED, 0.7);
  assert.ok(turn(flat.normal, yawed.normal) > 15);
});

test("more tilt believed means more turn", () => {
  const flat = frameOf(FLAT, 0);
  let last = -1;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const at = turn(flat.normal, frameOf(PITCHED, t).normal);
    assert.ok(at >= last, `turn went backwards at tilt ${t}`);
    last = at;
  }
  assert.ok(last > 25, "believing all of it should turn it furthest");
});

test("the frame is orthonormal even when the two seed vectors are skewed", () => {
  // Deliberately crooked: nothing here is square to anything.
  const skewed = palmFrame(
    v(0, 0, 0),
    v(0, 1, -0.5),
    v(-0.4, 0.9, 0.3),
    v(0.5, 0.6, -0.2),
    0.7,
    makeFrame(),
  );
  for (const axis of [skewed.side, skewed.up, skewed.normal]) {
    assert.ok(Math.abs(axis.length() - 1) < 1e-9, "axis is not unit length");
  }
  assert.ok(Math.abs(skewed.side.dot(skewed.up)) < 1e-9);
  assert.ok(Math.abs(skewed.up.dot(skewed.normal)) < 1e-9);
  assert.ok(Math.abs(skewed.side.dot(skewed.normal)) < 1e-9);
});

test("degenerate landmarks still give a usable frame", () => {
  // Every landmark on top of every other: nothing to measure at all.
  const nothing = v(0, 0, 0);
  const frame = palmFrame(nothing, nothing, nothing, nothing, 0.7, makeFrame());
  for (const axis of [frame.side, frame.up, frame.normal]) {
    assert.ok(Number.isFinite(axis.x + axis.y + axis.z), "produced a NaN");
    assert.ok(Math.abs(axis.length() - 1) < 1e-9);
  }
});






test("lockSpan puts any hand at the same size about its wrist", () => {
  // Near the camera and far from it, the same pose must come out the same
  // size, or the hand pulses as the player leans.
  for (const scale of [0.2, 1, 4.5]) {
    const points = [
      v(1, 2, -3),
      ...Array.from({ length: 8 }, (_, i) => v(i * 0.1, i * 0.2, i * 0.05)),
      v(0, 1, 0),
    ].map((p) => p.multiplyScalar(scale));
    const wristBefore = points[0].clone();
    lockSpan(points, new Vector3());
    assert.ok(
      Math.abs(points[0].distanceTo(points[9]) - LOCKED_SPAN) < 1e-9,
      `span wrong at scale ${scale}`,
    );
    assert.ok(
      points[0].distanceTo(wristBefore) < 1e-9,
      "the wrist must not move: everything is scaled about it",
    );
  }
});

test("lockSpan leaves a degenerate cloud alone rather than exploding it", () => {
  const points = Array.from({ length: 21 }, () => v(0, 0, 0));
  lockSpan(points, new Vector3());
  for (const point of points) {
    assert.ok(Number.isFinite(point.x + point.y + point.z), "produced a NaN");
  }
});

test("deepen scales depth about the wrist and leaves the wrist alone", () => {
  const points = [v(0, 0, 2), v(1, 1, 2.5), v(2, 2, 1)];
  deepen(points, 3);
  assert.equal(points[0].z, 2, "the wrist must not move");
  // Each point keeps its side of the wrist and triples its distance from it.
  assert.ok(Math.abs(points[1].z - (2 + 0.5 * 3)) < 1e-9);
  assert.ok(Math.abs(points[2].z - (2 - 1 * 3)) < 1e-9);
});

test("deepen leaves x and y untouched", () => {
  const points = [v(0, 0, 0), v(1.5, -2.5, 0.4)];
  deepen(points, 4);
  assert.equal(points[1].x, 1.5);
  assert.equal(points[1].y, -2.5);
});

test("deepen at 1 changes nothing, and at 0 flattens the hand", () => {
  const same = [v(0, 0, 1), v(0, 0, 3)];
  deepen(same, 1);
  assert.equal(same[1].z, 3);

  const flat = [v(0, 0, 1), v(0, 0, 3), v(0, 0, -5)];
  deepen(flat, 0);
  for (const point of flat) assert.equal(point.z, 1, "all onto the wrist plane");
});

test("deepen separates what was overlapping, which is the whole point", () => {
  // Two fingertips a hair apart in depth: at rest they z-fight, opened out
  // they are unambiguously one behind the other.
  const points = [v(0, 0, 0), v(0.2, 0.5, 0.01), v(0.21, 0.5, -0.01)];
  const before = Math.abs(points[1].z - points[2].z);
  deepen(points, 4);
  const after = Math.abs(points[1].z - points[2].z);
  assert.ok(after > before * 3.9, `${before} should have opened out, got ${after}`);
});
