import type { TrackedHand } from "../../hooks/useHandTracking.ts";

/** Camera hands may dwell-select; mouse fallback must require a real click. */
export function canDwellSelect(hand: TrackedHand | undefined): boolean {
  return Boolean(hand && hand.smoothedLandmarks.length >= 9);
}

/** How long the index must rest on a name before the order goes through. */
export const MENU_HOLD_S = 1.2;
/** A twitch off the name must not dump a charge that was almost done. */
export const MENU_LEAVE_GRACE_MS = 240;

/**
 * A pinch or fist only confirms after the tip has already been on that
 * name. Without this, a closed hand sweeping the carta fires an order
 * on the first row it crosses.
 */
export const MENU_PINCH_AFTER_S = 0.55;

export function menuHoldAmount(heldMs: number, holdS = MENU_HOLD_S): number {
  if (heldMs <= 0 || holdS <= 0) return 0;
  return Math.min(1, heldMs / (holdS * 1000));
}

export function canPinchSelect(
  heldMs: number,
  pinchAfterS = MENU_PINCH_AFTER_S,
): boolean {
  return heldMs >= pinchAfterS * 1000;
}

export function holdInterrupted(awayMs: number, graceMs = MENU_LEAVE_GRACE_MS) {
  return awayMs >= graceMs;
}
