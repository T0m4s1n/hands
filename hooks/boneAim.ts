/**
 * Which way one finger bone points, from the two landmarks that span it.
 *
 * MediaPipe reports depth at roughly a fifth of the scale of the other two
 * axes and with far more noise, so a bone's depth cannot be read off the
 * landmarks and used as-is: a finger curling toward the camera collapses into
 * a near-zero vector that is mostly noise, which is why closing a fist used to
 * fall apart. The sideways part of the bone is trustworthy though, and the
 * bone's own length is known, so the missing depth is the remaining side of a
 * right triangle.
 *
 * That much was already here. What was missing was the sign.
 *
 * Of the two directions that right triangle allows, the old code always took
 * the one folding toward the palm, and took it from a single value computed
 * once for the whole hand. Every bone was pushed the same way. A hand held at
 * an angle — fingers genuinely at different depths, and the tracker reporting
 * them correctly — could not be expressed at all: every finger collapsed onto
 * the same axis and the model sat there nearly flat while the landmarks beside
 * it clearly showed otherwise.
 *
 * The magnitude of the reported depth is still not believed. The sign is. It
 * is the one part of that reading which survives being a fifth of the scale
 * and noisy, and it is the difference between a hand that can be held at an
 * angle and one that cannot.
 */

import { Vector3 } from "three";

/**
 * Below this share of the bone's own length, the reported depth is too small
 * to have a meaningful sign and the caller's fallback is used instead. Scaled
 * by bone length rather than absolute, so a fingertip is not judged by the
 * same threshold as a metacarpal.
 */
export const DEPTH_DEADZONE = 0.12;

export type AimScratch = { perp: Vector3 };

export function makeAimScratch(): AimScratch {
  return { perp: new Vector3() };
}

/**
 * Writes the unit direction of the bone from `from` to `to` into `out`.
 *
 * `fallbackSign` is used only where the tracked depth is too small to read —
 * it is the "fold toward the palm" guess, which is right far more often than
 * it is wrong, but which must not override a reading that disagrees with it.
 *
 * `out` always comes back unit length and finite, whatever the inputs.
 */
export function boneAim(
  from: Vector3,
  to: Vector3,
  viewAxis: Vector3,
  restLength: number,
  fingerReach: number,
  fallbackSign: number,
  scratch: AimScratch,
  out: Vector3,
): Vector3 {
  out.copy(to).sub(from);
  const measured = out.dot(viewAxis);
  scratch.perp.copy(out).addScaledVector(viewAxis, -measured);
  const sideways = scratch.perp.length();

  // The bone points straight into or out of the screen: there is no sideways
  // part to keep, so the reading's own sign is all there is.
  if (sideways < 1e-5) {
    const sign = measured !== 0 ? Math.sign(measured) : fallbackSign || 1;
    return out.copy(viewAxis).multiplyScalar(sign).normalize();
  }

  const reach = restLength * fingerReach;
  const depth =
    sideways < reach ? Math.sqrt(reach * reach - sideways * sideways) : 0;

  // Believe the sign where there is enough of it to believe.
  const sign =
    Math.abs(measured) > DEPTH_DEADZONE * Math.max(restLength, 1e-5)
      ? Math.sign(measured)
      : fallbackSign || 1;

  out.copy(scratch.perp).addScaledVector(viewAxis, sign * depth);
  const length = out.length();
  if (length < 1e-8) return out.copy(viewAxis).multiplyScalar(fallbackSign || 1);
  return out.divideScalar(length);
}
