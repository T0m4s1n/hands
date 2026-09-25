import type { Handedness, Vec3 } from "./useHandTracking";

/** Hands we publish. The game is one palm — left or right, never both. */
export const MAX_TRACKED_HANDS = 1;
/**
 * A spare detection so a second body in the doorway can be ignored
 * instead of stealing the barista.
 */
export const DETECT_HAND_CANDIDATES = 2;

export type HandDetection = {
  wrist: Vec3;
  /** What the detector thinks this hand is, already corrected for mirroring. */
  label: Handedness;
  /** MediaPipe classification confidence, 0..1. */
  labelScore?: number;
  /** Full cloud, when present — used to tell two people apart by scale. */
  landmarks?: readonly Vec3[];
};

export type HandTrackHint = {
  wrist: Vec3;
  /** Wrist displacement per inference, smoothed by the tracker. */
  velocity?: Vec3;
  /** Number of inference opportunities since this hand was last observed. */
  missed?: number;
  /** Wrist-to-middle-knuckle span, to reject a smaller crowd hand. */
  palmSpan?: number;
};

/**
 * MediaPipe's handedness assumes a selfie-mirrored image. The game performs
 * that mirror before inference, so labels pass through unchanged. Keeping the
 * rule explicit prevents a future camera/display refactor from silently
 * swapping anatomical left and right.
 */
export function anatomicalHandedness(
  category: string | undefined,
  inputMirrored: boolean,
): Handedness {
  const reported: Handedness = category === "Left" ? "Left" : "Right";
  if (inputMirrored) return reported;
  return reported === "Left" ? "Right" : "Left";
}

/**
 * Left/Right from the skeleton itself — thumb side of the palm — not from
 * MediaPipe's per-frame classifier, which flips when a hand turns or leaves
 * the frame.
 *
 * Landmarks are in the mirrored detection frame, the same space the
 * classifier assumes.
 */
export function landmarkChirality(
  landmarks: readonly Vec3[],
): { label: Handedness; score: number } | null {
  const wrist = landmarks[0];
  const index = landmarks[5];
  const pinky = landmarks[17];
  const middle = landmarks[9];
  const thumb = landmarks[4] ?? landmarks[2];
  if (!wrist || !index || !pinky || !middle || !thumb) return null;

  const ix = index.x - wrist.x;
  const iy = index.y - wrist.y;
  const px = pinky.x - wrist.x;
  const py = pinky.y - wrist.y;
  const winding = ix * py - iy * px;
  const span = Math.hypot(ix, iy) * Math.hypot(px, py);
  if (span < 1e-5) return null;

  // Fingers closer to the camera than the wrist: palm-ish view. The back
  // of the hand reverses the 2D winding.
  const fingersCloser = middle.z <= wrist.z;
  const signed = fingersCloser ? winding : -winding;
  const label: Handedness = signed > 0 ? "Right" : "Left";
  const score = Math.min(1, Math.abs(winding) / (span * 0.32));
  return { label, score: Math.max(0.12, score) };
}

/**
 * One anatomical label. The camera is a selfie: wrist X is where the
 * hand *appears*, not which hand it is. A right palm on the left half
 * of the mirror is still the right hand — never read side from X.
 *
 * Detecting on the mirrored frame is what MediaPipe documents, so a
 * decent classifier score is the side. The skeleton only steps in
 * when that score is too weak to trust.
 */
export function fuseHandedness(
  mpLabel: Handedness,
  mpScore: number,
  landmarks?: readonly Vec3[],
): { label: Handedness; score: number } {
  const geo = landmarks ? landmarkChirality(landmarks) : null;

  if (mpScore >= 0.5) {
    return { label: mpLabel, score: mpScore };
  }
  if (geo && geo.score >= 0.74) {
    return { label: geo.label, score: geo.score };
  }
  if (geo && geo.score >= 0.52 && geo.label === mpLabel) {
    return { label: mpLabel, score: Math.max(mpScore, geo.score * 0.9) };
  }
  return { label: mpLabel, score: Math.max(0.2, mpScore) };
}

function reach(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function planeReach(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function palmSpan(hand: HandDetection): number {
  const mid = hand.landmarks?.[9];
  if (!mid) return 0.14;
  return Math.max(1e-4, reach(hand.wrist, mid));
}

/**
 * Background hands shrink. A lean-in grows the palm — that is still
 * the barista, and rejecting it is what made recognition die.
 */
function smallerCrowdHand(
  hint: HandTrackHint,
  detection: HandDetection,
  distance: number,
): boolean {
  if (!hint.palmSpan || hint.palmSpan <= 1e-4 || distance <= 0.1) return false;
  const next = palmSpan(detection);
  return (hint.palmSpan - next) / hint.palmSpan > 0.45;
}

/**
 * A real wrist step, a lean-in, or a reach still match.
 * Tighter than this dropped the barista mid-gesture.
 */
const LOCK_RADIUS = 0.5;

function pickPrimary<T extends HandDetection>(hands: readonly T[]): T {
  return hands.reduce((best, hand) => {
    const bestSpan = palmSpan(best);
    const nextSpan = palmSpan(hand);
    if (nextSpan > bestSpan * 1.08) return hand;
    if (bestSpan > nextSpan * 1.08) return best;
    return (hand.labelScore ?? 0) > (best.labelScore ?? 0) ? hand : best;
  });
}

function nearestToMemory<T extends HandDetection>(
  detections: readonly T[],
  lastWrist: ReadonlyMap<Handedness, Vec3 | HandTrackHint>,
): T[] {
  const open = new Map(lastWrist);
  const taken = new Set<T>();
  const picked: T[] = [];
  for (;;) {
    let bestSide: Handedness | undefined;
    let bestDetection: T | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [side, memory] of open) {
      const hint = hintOf(memory);
      const expected = predicted(hint);
      const speed = Math.hypot(hint.velocity?.x ?? 0, hint.velocity?.y ?? 0);
      const radius = LOCK_RADIUS + Math.min(0.16, speed * 1.5);
      for (const detection of detections) {
        if (taken.has(detection)) continue;
        const dist = planeReach(detection.wrist, expected);
        if (dist > radius) continue;
        if (smallerCrowdHand(hint, detection, dist)) continue;
        if (dist < bestDist) {
          bestDist = dist;
          bestSide = side;
          bestDetection = detection;
        }
      }
    }
    if (!bestSide || !bestDetection) break;
    open.delete(bestSide);
    taken.add(bestDetection);
    picked.push(bestDetection);
  }
  return picked;
}

/**
 * One hand. The closest or biggest palm wins; a second detection is
 * dropped rather than assigned to an empty glove.
 *
 * Once a wrist is locked, only something near that memory may keep it.
 * A stranger across the frame does not inherit the glove.
 */
export function selectPersonHands<T extends HandDetection>(
  detections: readonly T[],
  lastWrist: ReadonlyMap<Handedness, Vec3 | HandTrackHint> = new Map(),
): T[] {
  if (detections.length === 0) return [];
  if (lastWrist.size > 0) {
    const locked = nearestToMemory(detections, lastWrist);
    return locked.slice(0, MAX_TRACKED_HANDS);
  }
  if (detections.length === 1) return detections.slice();
  return [pickPrimary(detections)];
}

function hintOf(value: Vec3 | HandTrackHint): HandTrackHint {
  return "wrist" in value ? value : { wrist: value };
}

function predicted(hint: HandTrackHint): Vec3 {
  const steps = Math.min(3, 1 + (hint.missed ?? 0));
  return {
    x: hint.wrist.x + (hint.velocity?.x ?? 0) * steps,
    y: hint.wrist.y + (hint.velocity?.y ?? 0) * steps,
    z: hint.wrist.z + (hint.velocity?.z ?? 0) * steps,
  };
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
  lastWrist: ReadonlyMap<Handedness, Vec3 | HandTrackHint>,
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
    let bestReach = Number.POSITIVE_INFINITY;
    for (const [handedness, memory] of open) {
      const hint = hintOf(memory);
      const expected = predicted(hint);
      const speed = Math.hypot(hint.velocity?.x ?? 0, hint.velocity?.y ?? 0);
      const radius =
        matchRadius +
        Math.min(0.18, (hint.missed ?? 0) * 0.04) +
        Math.min(0.16, speed * 1.5);
      for (const detection of detections) {
        if (taken.has(detection)) continue;
        const distance = reach(detection.wrist, expected);
        if (distance > radius) continue;
        if (smallerCrowdHand(hint, detection, distance)) continue;
        // Position and velocity own identity. The classifier only breaks close
        // ties because its label can flip when fingers overlap or leave frame.
        const labelPenalty =
          detection.label === handedness
            ? 0
            : 0.025 * (detection.labelScore ?? 0.5);
        const score = distance + labelPenalty;
        if (score < bestReach) {
          bestReach = score;
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

  const leftovers = detections
    .filter((detection) => !taken.has(detection))
    .slice()
    .sort((a, b) => a.wrist.x - b.wrist.x);
  const leftoverLabels = new Set(leftovers.map((item) => item.label));
  const messy = leftoverLabels.size < leftovers.length;
  for (const detection of leftovers) {
    const other: Handedness = detection.label === "Left" ? "Right" : "Left";
    let free: Handedness | undefined;
    if (messy) {
      if (!claimed.has("Left") && detection.wrist.x <= 0.5) free = "Left";
      else if (!claimed.has("Right") && detection.wrist.x >= 0.5) free = "Right";
      else if (!claimed.has("Left")) free = "Left";
      else if (!claimed.has("Right")) free = "Right";
    } else {
      free = !claimed.has(detection.label)
        ? detection.label
        : !claimed.has(other)
          ? other
          : undefined;
    }
    if (!free) continue;
    // A leftover may reopen a remembered slot only if it still sits
    // near that wrist. A far one is a stranger; a near one is the
    // barista coming back after a blink.
    const remembered = lastWrist.get(free);
    if (remembered) {
      const hint = hintOf(remembered);
      if (planeReach(detection.wrist, predicted(hint)) > matchRadius) continue;
    }
    taken.add(detection);
    claimed.set(free, detection);
  }

  return claimed;
}
