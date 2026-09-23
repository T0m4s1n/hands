/**
 * Which way a hand is facing, from four of its landmarks.
 *
 * This used to live inline in the glove and was built from vectors flattened
 * to z = 0. Flattening bought stability at a price nobody had priced: it threw
 * away two of the three rotations. A hand could roll in the image plane and do
 * nothing else — pitch it forward or turn the palm and the glove did not move,
 * however far the player went. Measured against a flat hand, both came out at
 * exactly zero degrees.
 *
 * Pitch is the depth between the wrist and the middle knuckle; yaw is the
 * depth between the index and little knuckles. Both are real readings. Both
 * are noisy, because depth always is. `tilt` is how much of them to believe,
 * which is the same bargain `WORLD_Z` strikes in the tracker: less than the
 * truth, and far more than nothing.
 *
 * Out-parameters rather than fresh vectors, because this runs once per hand
 * per frame.
 */

import { Vector3 } from "three";

const AXIS_Z = new Vector3(0, 0, 1);

export type Frame = {
  up: Vector3;
  across: Vector3;
  normal: Vector3;
  side: Vector3;
  /**
   * How long the two seed vectors were before they were normalised.
   *
   * A normalised vector says nothing about how much there was to measure. With
   * the fingers folded or the hand held edge-on, the span across the knuckles
   * collapses to almost nothing and its direction becomes pure noise — but it
   * normalises to unit length like any other, and can sit perfectly square to
   * `up` while meaning nothing at all. Anything deciding something expensive
   * from this frame has to be able to tell that case apart.
   */
  upSpan: number;
  acrossSpan: number;
};

export function makeFrame(): Frame {
  return {
    up: new Vector3(),
    across: new Vector3(),
    normal: new Vector3(),
    side: new Vector3(),
    upSpan: 0,
    acrossSpan: 0,
  };
}

/**
 * Writes an orthonormal frame into `out`.
 *
 * `tilt` of 0 reproduces the old flat behaviour exactly, which is what the
 * layout decision still wants; 1 believes the reported depth in full.
 *
 * The frame comes out orthonormal however skewed the two vectors that seeded
 * it. `normal` is a cross product so it is square to both, and `side` is a
 * cross product of those two — so a real hand, which is never square either,
 * cannot shear the model that gets posed with this.
 */
export function palmFrame(
  wrist: Vector3,
  middleMcp: Vector3,
  indexMcp: Vector3,
  pinkyMcp: Vector3,
  tilt: number,
  out: Frame,
): Frame {
  out.up.copy(middleMcp).sub(wrist);
  out.up.z *= tilt;
  out.upSpan = out.up.length();
  if (out.up.lengthSq() < 1e-8) out.up.set(0, 1, 0);
  else out.up.normalize();

  out.across.copy(pinkyMcp).sub(indexMcp);
  out.across.z *= tilt;
  out.acrossSpan = out.across.length();
  if (out.across.lengthSq() < 1e-8) {
    out.across.crossVectors(AXIS_Z, out.up);
    if (out.across.lengthSq() < 1e-8) out.across.set(1, 0, 0);
  }
  out.across.normalize();

  out.normal.crossVectors(out.across, out.up);
  if (out.normal.lengthSq() < 1e-8) out.normal.copy(AXIS_Z);
  out.normal.normalize();
  out.side.crossVectors(out.up, out.normal).normalize();
  return out;
}

/**
 * Which way round the fingers run on screen, as +1 or -1.
 *
 * Read from a flat frame on purpose, even though the frame above no longer is.
 * Orienting the hand wrong for one frame is a wobble; picking the wrong model
 * rebuilds the rig, so this stays on the steady reading. Chasing depth noise
 * here is what used to flip the glove between faces mid-gesture.
 *
 * For two vectors in the plane a cross product is only its z term, so the sign
 * is read straight off without building a third vector.
 */
export function layoutSign(frame: Frame): number {
  return (
    Math.sign(frame.across.x * frame.up.y - frame.across.y * frame.up.x) || 1
  );
}

/**
 * How much to trust `layoutSign`. Near edge-on the two axes close up on each
 * other and the sign stops meaning anything, so the caller waits.
 */
export function layoutSkew(frame: Frame): number {
  return Math.abs(frame.across.dot(frame.up));
}

/**
 * How much of a hand there was to measure across the knuckles, relative to its
 * length: 0 when the span has collapsed, around 0.5 for an open hand.
 *
 * Skew alone does not catch this, and that gap is why the glove would turn
 * inside out from nothing. Fold the fingers or hold the hand edge-on and the
 * span across the knuckles shrinks to noise — but noise normalises to unit
 * length like anything else, and lands square to `up` about as often as not,
 * so it sails through a skew check. The sign it carries is then a coin flip,
 * and acting on it rebuilds the rig and mirrors the model mid-gesture.
 */
export function layoutSpread(frame: Frame): number {
  return frame.acrossSpan / Math.max(frame.upSpan, 1e-5);
}

/**
 * The visual size the glove is locked to, in world units.
 *
 * Apparent hand size grows and shrinks with distance to the camera, and
 * following it made the glove — and the reach the game tests against — pulse
 * in and out. Anything that wants to be compared against the posed glove has
 * to be measured in the same units, which is what `lockSpan` is for.
 */
export const LOCKED_SPAN = 0.85;

/**
 * Rescales a landmark cloud about its wrist so the wrist-to-middle-knuckle
 * span is `LOCKED_SPAN`, in place.
 *
 * The debug overlay needs this as much as the glove does. Drawn at their own
 * apparent size over a glove drawn at a fixed one, the landmarks sit wherever
 * the player happens to be sitting and every disagreement looks enormous — so
 * the one view meant to tell you whether a problem is in the tracking or in
 * the model could not tell you either.
 */
export function lockSpan(points: Vector3[], scratch: Vector3): void {
  if (points.length < 10) return;
  scratch.copy(points[0]);
  const measured = Math.max(points[0].distanceTo(points[9]), 1e-5);
  const fit = LOCKED_SPAN / measured;
  for (const point of points) {
    point.sub(scratch).multiplyScalar(fit).add(scratch);
  }
}
