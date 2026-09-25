/**
 * Mouse fallback: left click grabs, right-drag rolls the wrist.
 *
 * A camera hand tips by turning. A mouse has no wrist, so the pour used
 * to live only on the wheel — and holding the right button dropped the
 * jug, because grab was `buttons === 1`.
 */

export const POINTER_ROLL_MIN = -1.6;
export const POINTER_ROLL_MAX = 1.6;
/** About a full tip across a short swipe. */
export const POINTER_ROLL_DRAG = 0.008;
export const POINTER_ROLL_WHEEL = 0.004;

export function pointerIsGrabbing(buttons: number): boolean {
  return (buttons & 1) !== 0;
}

export function pointerIsRolling(buttons: number): boolean {
  return (buttons & 2) !== 0;
}

export function clampPointerRoll(roll: number): number {
  return Math.max(POINTER_ROLL_MIN, Math.min(POINTER_ROLL_MAX, roll));
}

/** Horizontal drag while the right button is down. */
export function rollFromDrag(roll: number, movementX: number): number {
  return clampPointerRoll(roll + movementX * POINTER_ROLL_DRAG);
}

export function rollFromWheel(roll: number, deltaY: number): number {
  return clampPointerRoll(roll + deltaY * POINTER_ROLL_WHEEL);
}
