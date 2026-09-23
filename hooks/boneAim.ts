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
 * How much reported depth counts as a confident reading, as a share of the
 * bone's own length. Below it the caller's fallback takes over, and the two
 * are **blended** across the range rather than switched between.
 *
 * Scaled by bone length rather than absolute, so a fingertip is not judged by
 * the same threshold as a metacarpal.
 *
 * Wide on purpose. The blend is steepest where the bone lies flattest across
 * the view, because that is where the direction vector is shortest and
 * normalising it amplifies whatever is left. A narrow band puts all of that
 * steepness into a few frames of noise; a wide one spreads it out, at the cost
 * of leaning on the fallback further from the crossing.
 */
export const DEPTH_DEADZONE = 0.25;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

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

  // How far the reading leans, and how much of it to believe, in one number:
  // ±1 where it is unambiguous, 0 where there is nothing to read.
  //
  // Blended across that range rather than switched at a threshold, and that
  // is the whole point. A hard switch makes a bone snap between two opposite
  // directions every time the reading wanders over the line, which is a
  // finger flicking back and forth several times a second — the reading is
  // least certain exactly where it is nearest the threshold, so a threshold
  // puts the most violent behaviour at the least reliable point.
  //
  // Blending, a bone whose depth cannot be read leans less rather than
  // leaping: it passes through lying flat across the view, which is the
  // least-wrong answer when nothing is known, and it gets there smoothly.
  const lean = clamp(
    measured / (DEPTH_DEADZONE * Math.max(restLength, 1e-5)),
    -1,
    1,
  );
  const sign = lean + (1 - Math.abs(lean)) * (fallbackSign || 1);

  out.copy(scratch.perp).addScaledVector(viewAxis, sign * depth);
  const length = out.length();
  if (length < 1e-8) return out.copy(viewAxis).multiplyScalar(fallbackSign || 1);
  return out.divideScalar(length);
}
