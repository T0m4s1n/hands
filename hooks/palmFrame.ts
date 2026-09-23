/**
 * Which way a hand is facing, from four of its landmarks.
 *
 * This was written to orient a rigged glove, and orienting that glove was the
 * most dangerous thing in the hand: a frame that shook shook the whole model,
 * and a frame that flipped rebuilt its skeleton. The glove is gone and the
 * hand is now built straight on the landmarks, so nothing here decides where a
 * finger goes any more.
 *
 * What is left of the job is small and safe. The palm plate needs a plane to
 * lie in and the cuff needs an axis to ring, and if depth noise shakes this
 * frame, a plate and a cuff shake. `tilt` scales how much of the reported
 * depth to use, and at 1 the plate simply lies where the knuckles do.
 *
 * `lockSpan` also lives here, because the hand and the debug overlay both have
 * to be measured the same way before either can be compared with the other.
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
 * The visual size the hand is locked to, in world units.
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

/**
 * Stretches a landmark cloud's depth about its wrist, in place.
 *
 * MediaPipe reports depth at roughly a fifth of the scale of the other two
 * axes. `WORLD_Z` in the tracker undoes part of that, but it was chosen when
 * depth only ever decided the shape of a finger, and it is deliberately timid.
 * What it leaves is a hand flat enough that no finger ever passes behind
 * another — and a hand whose parts never occlude each other does not read as a
 * solid object at all, however well it is shaded.
 *
 * About the wrist rather than the origin, so the hand deepens where it stands
 * instead of sliding toward or away from the camera as the scale changes.
 */
export function deepen(points: Vector3[], scale: number): void {
  if (points.length === 0 || scale === 1) return;
  const wristZ = points[0].z;
  for (const point of points) {
    point.z = wristZ + (point.z - wristZ) * scale;
  }
}
