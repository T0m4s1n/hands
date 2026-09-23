/**
 * The depth sign that was being thrown away.
 *
 * The first case is the bug, pinned so it cannot come back quietly: two bones
 * leaning opposite ways in depth used to be aimed the same way, because the
 * sign came from one value computed once for the whole hand.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import { boneAim, makeAimScratch, DEPTH_DEADZONE } from "./boneAim.ts";

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
/** The camera looks along +Z in the armature space this runs in. */
const VIEW = v(0, 0, 1);
const REACH = 0.82;

function aim(from: Vector3, to: Vector3, restLength = 1, fallback = 1) {
  return boneAim(
    from,
    to,
    VIEW,
    restLength,
    REACH,
    fallback,
    makeAimScratch(),
    new Vector3(),
  );
}

test("two bones leaning opposite ways in depth are aimed opposite ways", () => {
  // The same sideways direction, one leaning toward the camera and one away.
  const toward = aim(v(0, 0, 0), v(0.5, 0, 0.4));
  const away = aim(v(0, 0, 0), v(0.5, 0, -0.4));
  assert.ok(toward.z > 0, `expected a positive lean, got ${toward.z}`);
  assert.ok(away.z < 0, `expected a negative lean, got ${away.z}`);
  // This is the assertion that would have failed before: both used to take the
  // caller's single sign and come back leaning the same way.
  assert.notEqual(Math.sign(toward.z), Math.sign(away.z));
});

test("fingers leaning forward come out in front of ones leaning back", () => {
  // Four fingers of a hand held at an angle, two leaning each way. What is
  // asserted is the grouping, not an ordering: with the bone's length known
  // and its sideways extent measured, the angle to the view axis is fixed by
  // geometry and only the side is free. Two bones with the same sideways
  // extent are at the same angle however different their reported depths —
  // that difference lives entirely in the channel MediaPipe reports at a
  // fifth scale, which is the one this deliberately does not believe.
  // All four sit clear of the dead zone; the pair that straddles it is the
  // next test's job.
  const aimed = [0.3, 0.2, -0.2, -0.3].map(
    (z) => aim(v(0, 0, 0), v(0.4, 0, z)).z,
  );
  assert.ok(aimed[0] > 0 && aimed[1] > 0, "the forward pair should lean forward");
  assert.ok(aimed[2] < 0 && aimed[3] < 0, "the back pair should lean back");
  assert.ok(
    Math.min(aimed[0], aimed[1]) > Math.max(aimed[2], aimed[3]),
    `the groups should not overlap, got ${aimed}`,
  );
});

test("too little depth to read leans on the caller's fallback", () => {
  // A tenth of the dead zone: almost nothing to read, so the fallback decides.
  const tiny = DEPTH_DEADZONE * 0.1;
  const withPalm = aim(v(0, 0, 0), v(0.5, 0, tiny), 1, 1);
  const withBack = aim(v(0, 0, 0), v(0.5, 0, tiny), 1, -1);
  assert.ok(withPalm.z > 0, "should have leaned on the fallback");
  assert.ok(withBack.z < 0, "should have leaned on the other fallback");
});

/** The largest change in aim between neighbouring readings over a sweep. */
function biggestStep(fallback: number, step: number) {
  let previous = aim(v(0, 0, 0), v(0.4, 0, -0.4), 1, fallback).z;
  let worst = 0;
  for (let z = -0.4; z <= 0.4001; z += step) {
    const at = aim(v(0, 0, 0), v(0.4, 0, z), 1, fallback).z;
    worst = Math.max(worst, Math.abs(at - previous));
    previous = at;
  }
  return worst;
}

test("the reading and the fallback blend, they do not switch", () => {
  // The stability property, and the one that matters most here: a hard switch
  // puts the most violent behaviour at exactly the least reliable reading,
  // which is a finger flicking back and forth several times a second.
  //
  // Continuity is not a threshold, so this does not assert one. It refines
  // the sweep and checks the largest jump shrinks with it. A switch would
  // keep jumping the same distance however fine the sweep — that is what
  // makes this test impossible to pass by tuning a number.
  const coarse = biggestStep(-1, 0.004);
  const fine = biggestStep(-1, 0.001);
  assert.ok(
    fine < coarse * 0.4,
    `refining the sweep fourfold should shrink the jump: ${coarse.toFixed(4)} then ${fine.toFixed(4)}`,
  );
  // No absolute bar here on purpose. The aim moves fastest where the bone
  // lies flattest, because normalising a short vector amplifies what is left,
  // so any fixed number would be a guess tuned until it passed rather than a
  // statement about the function. Refinement is the property; this is the
  // evidence for it.
});

test("sweeping the depth never sends the aim backwards", () => {
  const fallback = 1;
  let previous = -Infinity;
  for (let z = -0.5; z <= 0.5001; z += 0.01) {
    const at = aim(v(0, 0, 0), v(0.4, 0, z), 1, fallback).z;
    assert.ok(at >= previous - 1e-9, `aim went backwards at depth ${z}`);
    previous = at;
  }
});

test("the dead zone scales with bone length", () => {
  // The same absolute depth is readable on a short bone and noise on a long
  // one, which is why the threshold is a share of the bone rather than a
  // number of units.
  const depth = 0.05;
  const shortBone = aim(v(0, 0, 0), v(0.1, 0, depth), 0.2, -1);
  const longBone = aim(v(0, 0, 0), v(0.5, 0, depth), 2, -1);
  assert.ok(shortBone.z > 0, "the short bone's depth should be believed");
  assert.ok(longBone.z < 0, "the long bone's should fall back");
});

test("always unit length, whatever goes in", () => {
  const cases: [Vector3, Vector3, number][] = [
    [v(0, 0, 0), v(1, 0, 0), 1],
    [v(0, 0, 0), v(0, 0, 1), 1],
    [v(0, 0, 0), v(0, 0, -1), 1],
    [v(0, 0, 0), v(0, 0, 0), 1],
    [v(0, 0, 0), v(1e-9, 1e-9, 1e-9), 1],
    [v(0, 0, 0), v(50, -30, 90), 0.4],
    [v(3, -2, 5), v(3, -2, 5), 0.01],
  ];
  for (const [from, to, rest] of cases) {
    const out = aim(from, to, rest);
    assert.ok(
      Number.isFinite(out.x + out.y + out.z),
      `produced a NaN for ${to.toArray()}`,
    );
    assert.ok(
      Math.abs(out.length() - 1) < 1e-9,
      `not unit length for ${to.toArray()}: ${out.length()}`,
    );
  }
});

test("a bone longer than its reach keeps its sideways direction", () => {
  // Nothing left over for depth, so it lies flat across the view.
  const out = aim(v(0, 0, 0), v(5, 0, 0.01), 1);
  assert.ok(Math.abs(out.z) < 1e-9, `should be flat, got z ${out.z}`);
  assert.ok(out.x > 0.99);
});

test("the sideways direction is preserved, not invented", () => {
  const out = aim(v(0, 0, 0), v(0.3, 0.4, 0.2));
  // The x:y ratio of the input must survive; only depth is reconstructed.
  assert.ok(Math.abs(out.x / out.y - 0.3 / 0.4) < 1e-9);
});
