import type { Handedness, Vec3 } from "./useHandTracking";

export type HandDetection = {
  wrist: Vec3;
  /** What the detector thinks this hand is, already corrected for mirroring. */
  label: Handedness;
};

function reach(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Works out which tracked hand each detection belongs to.
 *
 * The detector's handedness label is a per-frame classification, and it flips
 * when a hand tilts or goes half out of frame. Trusting it frame to frame
 * teleports both hands across the scene at once the moment it does. Two
 * detections can also come back carrying the same label, and then one of them
 * has nowhere to go and the hand it belonged to freezes and disappears.
 *
 * Continuity is much steadier: a wrist is within a short distance of wherever
 * it was a moment ago. So each hand seen last frame claims the nearest
 * detection first, and the label only gets to decide for a detection that
 * nothing claimed — that is, a hand that has just appeared.
 */
export function assignHands<T extends HandDetection>(
  detections: readonly T[],
  lastWrist: ReadonlyMap<Handedness, Vec3>,
  matchRadius: number,
): Map<Handedness, T> {
  const claimed = new Map<Handedness, T>();
  const taken = new Set<T>();
  const open = new Map(lastWrist);

  // Always settle the closest pair anywhere on the table first. Going hand by
  // hand instead would let whichever hand is considered first walk off with a
  // detection that sits far nearer the other one.
  for (;;) {
    let bestHand: Handedness | undefined;
    let bestDetection: T | undefined;
    let bestReach = matchRadius;
    for (const [handedness, wrist] of open) {
      for (const detection of detections) {
        if (taken.has(detection)) continue;
        const distance = reach(detection.wrist, wrist);
        if (distance < bestReach) {
          bestReach = distance;
          bestHand = handedness;
          bestDetection = detection;
        }
      }
    }
    if (!bestHand || !bestDetection) break;
    open.delete(bestHand);
    taken.add(bestDetection);
    claimed.set(bestHand, bestDetection);
  }

  for (const detection of detections) {
    if (taken.has(detection)) continue;
    const other: Handedness = detection.label === "Left" ? "Right" : "Left";
    const free = !claimed.has(detection.label)
      ? detection.label
      : !claimed.has(other)
        ? other
        : undefined;
    if (!free) continue;
    taken.add(detection);
    claimed.set(free, detection);
  }

  return claimed;
}
