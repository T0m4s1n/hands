import type { Handedness } from "@/hooks/useHandTracking";

/** How long a palm must stay in frame before the slot lights up. */
export const SYNC_LOCK_S = 0.7;
/** After one locked palm, leave for the carta. */
export const SYNC_LEAVE_S = 0.4;
/** A single missed frame must not dump a hold that was almost locked. */
export const SYNC_HOLD_DECAY = 2.4;

/**
 * Anatomical side of the play hand. Tracking already fused MediaPipe
 * with the skeleton — do not re-read wrist X, or a right hand on the
 * left half of the selfie would lock as Left.
 */
export function syncSideFromHand(hand: {
  handedness?: Handedness;
  identityConfidence?: number;
  smoothedLandmarks?: ReadonlyArray<{ x: number }>;
  tracking?: "live" | "coasting";
}): Handedness | null {
  if (hand.tracking === "coasting") return null;
  const bones = hand.smoothedLandmarks?.length ?? 0;
  if (bones >= 9) return hand.handedness ?? null;
  if (bones === 0 && hand.tracking === "live") {
    return hand.handedness ?? "Right";
  }
  return null;
}

export function stepSyncHold(hold: number, seen: boolean, dt: number): number {
  const t = Math.max(0, dt);
  if (seen) return hold + t;
  return Math.max(0, hold - t * SYNC_HOLD_DECAY);
}

/**
 * Keep charging the same side. A flip (left ↔ right) restarts the
 * lock so we do not confirm the wrong palm.
 */
export function stepSyncSide(
  hold: { side: Handedness | null; seconds: number },
  seen: Handedness | null,
  dt: number,
): { side: Handedness | null; seconds: number } {
  if (!seen) {
    return { side: hold.side, seconds: stepSyncHold(hold.seconds, false, dt) };
  }
  if (hold.side && hold.side !== seen) {
    return { side: seen, seconds: 0 };
  }
  return { side: seen, seconds: stepSyncHold(hold.seconds, true, dt) };
}

export function syncCanLeave(lockedCount: number, readyHold: number): boolean {
  return lockedCount >= 1 && readyHold >= SYNC_LEAVE_S;
}

export function syncSideLabel(side: Handedness | null): string {
  if (side === "Left") return "izquierda";
  if (side === "Right") return "derecha";
  return "";
}
