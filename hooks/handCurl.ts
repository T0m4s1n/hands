/**
 * How closed a real hand is, from MediaPipe landmarks.
 *
 * This is a number per finger — not a 21-bone reconstruction. The puppet
 * uses it to fold; grab uses it so a fist counts as well as a pinch.
 */

export type CurlPoint = { x: number; y: number; z: number };

function dist(a: CurlPoint, b: CurlPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * 0 straight, 1 shut. A selfie fist often stays almost colinear in 3D
 * (the tips only collapse in the image), so bend alone reads open.
 */
export function fingerFold(
  mcp: CurlPoint,
  pip: CurlPoint,
  tip: CurlPoint,
): number {
  const bone = dist(mcp, pip) + dist(pip, tip);
  const reach = dist(mcp, tip);
  const bend =
    bone < 1e-5 ? 0 : Math.min(1, Math.max(0, (bone - reach) / (bone * 0.48)));
  const planarBone =
    Math.hypot(pip.x - mcp.x, pip.y - mcp.y) +
    Math.hypot(tip.x - pip.x, tip.y - pip.y);
  const planarReach = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
  const collapse =
    planarBone < 1e-5
      ? 0
      : Math.min(1, Math.max(0, 1 - planarReach / planarBone));
  return Math.max(bend, collapse);
}

const BONES = [
  [2, 3, 4],
  [5, 6, 8],
  [9, 10, 12],
  [13, 14, 16],
  [17, 18, 20],
] as const;

export function handFolds(
  landmarks: readonly CurlPoint[] | undefined,
): number[] {
  if (!landmarks || landmarks.length < 21) return [0, 0, 0, 0, 0];
  return BONES.map(([mcp, pip, tip]) =>
    fingerFold(landmarks[mcp], landmarks[pip], landmarks[tip]),
  );
}

/** Four-finger fist, 0 open → 1 closed. Thumb is ignored on purpose. */
export function handFist(landmarks: readonly CurlPoint[] | undefined): number {
  const folds = handFolds(landmarks);
  const four = [folds[1], folds[2], folds[3], folds[4]].sort((a, b) => b - a);
  return (four[0] + four[1] + four[2]) / 3;
}

/**
 * What the puppet should show: the real folds, with a grab floor so a
 * confirmed pinch still looks like a shut mitt, not a claw.
 */
export function gloveFolds(
  landmarks: readonly CurlPoint[] | undefined,
  grabbing: boolean,
): number[] {
  const folds = handFolds(landmarks);
  const fist = handFist(landmarks);
  const floor = grabbing ? Math.max(0.88, fist) : 0;
  return folds.map((fold, i) =>
    Math.max(i === 0 ? floor * 0.82 : floor, fold),
  );
}

/**
 * Smaller is more closed — same units as pinch, so the existing latch
 * can take a fist or a pinch without a second machine. A half-closed
 * webcam fist already counts: MediaPipe rarely reports a tight 1.0.
 */
export function grabClosure(
  pinch: number,
  fist: number,
): number {
  const f = Math.min(1, Math.max(0, fist));
  // A loose webcam curl is not a fist. Only the last third of the fold
  // should beat a pinch — otherwise a bent finger grabs by accident.
  const useful = Math.max(0, (f - 0.42) / 0.58);
  const closed = useful * useful * (3 - 2 * useful);
  return Math.min(pinch, 1 - closed);
}
