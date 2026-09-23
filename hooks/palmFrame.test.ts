/**
 * The rotations that used to be thrown away.
 *
 * The first two cases are the bug: with the old flat behaviour a hand pitched
 * forward or turned on its axis produced a frame identical to a flat one, to
 * the last decimal. Not damped — identical.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import {
  makeFrame,
  palmFrame,
  layoutSign,
  layoutSkew,
  layoutSpread,
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

test("the layout sign is read from a flat frame and is steady", () => {
  const flat = frameOf(FLAT, 0);
  const sign = layoutSign(flat);
  assert.ok(sign === 1 || sign === -1);
  // Pitching and yawing the hand must not change which model it wears, so
  // long as the sign is taken from the flat frame.
  assert.equal(layoutSign(frameOf(PITCHED, 0)), sign);
  assert.equal(layoutSign(frameOf(YAWED, 0)), sign);
});

test("skew reports how edge-on the hand is", () => {
  // A square hand: the two axes are perpendicular, so the sign is trustworthy.
  assert.ok(layoutSkew(frameOf(FLAT, 0)) < 0.2);
  // Folded flat, the two axes close up and the reading should not be trusted.
  const edgeOn = palmFrame(
    v(0, 0, 0),
    v(0, 1, 0),
    v(0.05, 0.9, 0),
    v(0.5, 0.45, 0),
    0,
    makeFrame(),
  );
  assert.ok(layoutSkew(edgeOn) > 0.5, "an edge-on hand should report high skew");
});

test("a collapsed span is caught by spread where skew lets it through", () => {
  // The failure that turned the glove inside out from nothing: fingers folded,
  // so there is almost no span across the knuckles. What is left is noise —
  // but it normalises like anything else and here it lands perfectly square to
  // `up`, so skew reports the frame as trustworthy when it is not.
  const collapsed = palmFrame(
    v(0, 0, 0),
    v(0, 1, 0),
    v(-0.004, 0.8, 0),
    v(0.004, 0.8, 0),
    0,
    makeFrame(),
  );
  assert.ok(
    layoutSkew(collapsed) < 0.2,
    "skew alone thinks this frame is fine, which is the whole point",
  );
  assert.ok(
    layoutSpread(collapsed) < 0.05,
    `spread should see through it, got ${layoutSpread(collapsed)}`,
  );
});

test("an open hand has plenty of spread", () => {
  const open = frameOf(FLAT, 0);
  assert.ok(
    layoutSpread(open) > 0.3,
    `an open hand should read well above the bar, got ${layoutSpread(open)}`,
  );
});

test("spread falls away as a hand turns edge-on", () => {
  let previous = Infinity;
  // Rolling the knuckle span toward the view axis shortens what is left of it
  // in the plane, which is exactly the case that must stop a model swap.
  for (const width of [0.4, 0.3, 0.2, 0.1, 0.02]) {
    const frame = palmFrame(
      v(0, 0, 0),
      v(0, 1, 0),
      v(-width, 0.8, 0),
      v(width, 0.8, 0),
      0,
      makeFrame(),
    );
    const spread = layoutSpread(frame);
    assert.ok(spread < previous, "spread should shrink with the span");
    previous = spread;
  }
  assert.ok(previous < 0.1, "an edge-on hand should end well under the bar");
});
