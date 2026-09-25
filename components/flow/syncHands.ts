/** How long a palm must stay in frame before the slot lights up. */
export const SYNC_LOCK_S = 0.7;
/** After one locked palm, leave for the carta. */
export const SYNC_LEAVE_S = 0.4;
/** A single missed frame must not dump a hold that was almost locked. */
export const SYNC_HOLD_DECAY = 2.4;

/**
 * Slot from wrist position in the mirrored frame — not MediaPipe Left/Right.
 * Those labels flip on the first second and reset the sync hold forever.
 */
export function syncSlotFromWrist(x: number): "Left" | "Right" {
  return x < 0.5 ? "Left" : "Right";
}

/**
 * Camera palms use the wrist. A mouse has no skeleton — count it as one
 * live palm so the sync screen can finish without a camera.
 */
export function syncSlotFromHand(hand: {
  smoothedLandmarks?: ReadonlyArray<{ x: number }>;
  tracking?: "live" | "coasting";
}): "Left" | "Right" | null {
  const bones = hand.smoothedLandmarks?.length ?? 0;
  if (bones >= 9) {
    return syncSlotFromWrist(hand.smoothedLandmarks![0]?.x ?? 0.5);
  }
  if (bones === 0 && hand.tracking === "live") return "Right";
  return null;
}

export function stepSyncHold(hold: number, seen: boolean, dt: number): number {
  const t = Math.max(0, dt);
  if (seen) return hold + t;
  return Math.max(0, hold - t * SYNC_HOLD_DECAY);
}

export function syncCanLeave(lockedCount: number, readyHold: number): boolean {
  return lockedCount >= 1 && readyHold >= SYNC_LEAVE_S;
}
