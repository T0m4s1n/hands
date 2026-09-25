import type { Handedness, Vec3 } from "./useHandTracking";

/** Hands we publish. The game is one player with two gloves. */
export const MAX_TRACKED_HANDS = 2;
/**
 * Extra detections so we can choose one person's pair instead of one hand
 * from each stranger MediaPipe happened to rank first.
 */
export const DETECT_HAND_CANDIDATES = 4;

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
 * One label for assignment. Trust a confident classifier, a clear skeleton,
 * or (last) which side of the mirrored frame the wrist sits on.
 */
export function fuseHandedness(
  mpLabel: Handedness,
  mpScore: number,
  landmarks?: readonly Vec3[],
): { label: Handedness; score: number } {
  const geo = landmarks ? landmarkChirality(landmarks) : null;
  const wrist = landmarks?.[0];
  const screen: Handedness | null = wrist
    ? wrist.x < 0.46
      ? "Left"
      : wrist.x > 0.54
        ? "Right"
        : null
    : null;

  if (geo && geo.score >= 0.55 && mpScore >= 0.72 && geo.label === mpLabel) {
    return { label: mpLabel, score: Math.min(1, 0.62 + geo.score * 0.25) };
  }
  if (geo && geo.score >= 0.74 && mpScore < 0.62) {
    return { label: geo.label, score: geo.score };
  }
  if (mpScore >= 0.82) {
    return { label: mpLabel, score: mpScore };
  }
  if (geo && geo.score >= 0.52) {
    return { label: geo.label, score: geo.score * 0.92 };
  }
  if (screen && mpScore < 0.58) {
    return { label: screen, score: 0.42 };
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

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    z: (a.z + b.z) * 0.5,
  };
}

function memoryCenter(
  lastWrist: ReadonlyMap<Handedness, Vec3 | HandTrackHint>,
): Vec3 | null {
  if (lastWrist.size === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  let n = 0;
  for (const value of lastWrist.values()) {
    const wrist = hintOf(value).wrist;
    x += wrist.x;
    y += wrist.y;
    z += wrist.z;
    n += 1;
  }
  return { x: x / n, y: y / n, z: z / n };
}

/**
 * How unlike one person's two hands this pair is. Height and palm size do
 * most of the work: two people in the same frame almost never match on both.
 */
function pairCost(a: HandDetection, b: HandDetection): number {
  const dx = Math.abs(a.wrist.x - b.wrist.x);
  const dy = Math.abs(a.wrist.y - b.wrist.y);
  const dz = Math.abs(a.wrist.z - b.wrist.z);
  const left = palmSpan(a);
  const right = palmSpan(b);
  const scale = Math.abs(left - right) / Math.max(left, right);
  let cost = dy * 2.4 + scale * 1.7 + dz * 0.8;
  cost += Math.abs(dx - 0.3) * 0.55;
  if (dx > 0.7) cost += 1.5;
  if (dy > 0.26) cost += 1.6;
  if (scale > 0.42) cost += 1.3;
  if (a.label !== b.label) cost -= 0.16;
  return cost;
}

const ONE_PERSON_COST = 1.55;
const STAY_WITH_PERSON = 0.4;

function pickPrimary<T extends HandDetection>(
  hands: readonly T[],
  center: Vec3 | null,
): T {
  if (center) {
    return hands.reduce((best, hand) =>
      planeReach(hand.wrist, center) < planeReach(best.wrist, center)
        ? hand
        : best,
    );
  }
  return hands.reduce((best, hand) => {
    const bestSpan = palmSpan(best);
    const nextSpan = palmSpan(hand);
    if (nextSpan > bestSpan * 1.08) return hand;
    if (bestSpan > nextSpan * 1.08) return best;
    return (hand.labelScore ?? 0) > (best.labelScore ?? 0) ? hand : best;
  });
}

/**
 * At most two hands, and they have to look like they belong to the same
 * person. Extra detections (a second player, someone in the doorway) are
 * dropped rather than assigned to the empty glove.
 */
export function selectPersonHands<T extends HandDetection>(
  detections: readonly T[],
  lastWrist: ReadonlyMap<Handedness, Vec3 | HandTrackHint> = new Map(),
): T[] {
  if (detections.length <= 1) return detections.slice(0, MAX_TRACKED_HANDS);
  const center = memoryCenter(lastWrist);

  if (detections.length === 2) {
    if (pairCost(detections[0], detections[1]) <= ONE_PERSON_COST) {
      return detections.slice();
    }
    return [pickPrimary(detections, center)];
  }

  type Pair = { a: T; b: T; cost: number; mid: Vec3 };
  const pairs: Pair[] = [];
  for (let i = 0; i < detections.length; i += 1) {
    for (let j = i + 1; j < detections.length; j += 1) {
      const a = detections[i];
      const b = detections[j];
      const mid = midpoint(a.wrist, b.wrist);
      let cost = pairCost(a, b);
      if (center) cost += planeReach(mid, center) * 1.35;
      pairs.push({ a, b, cost, mid });
    }
  }
  pairs.sort((left, right) => left.cost - right.cost);

  const near = center
    ? pairs.filter((pair) => planeReach(pair.mid, center) < STAY_WITH_PERSON)
    : pairs;
  const pool = near.length > 0 ? near : pairs;
  const best = pool[0];
  if (!best) return detections.slice(0, MAX_TRACKED_HANDS);
  if (best.cost > ONE_PERSON_COST + 0.85) {
    return [pickPrimary(detections, center)];
  }
  return [best.a, best.b];
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
        Math.min(0.2, (hint.missed ?? 0) * 0.04) +
        Math.min(0.16, speed * 1.5);
      for (const detection of detections) {
        if (taken.has(detection)) continue;
        const distance = reach(detection.wrist, expected);
        if (distance > radius) continue;
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
    taken.add(detection);
    claimed.set(free, detection);
  }

  return claimed;
}
