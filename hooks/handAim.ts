/**
 * Where the glove sits on the table.
 *
 * Image X/Y are the only axes the player controls. Camera distance only
 * makes the hand look bigger, and that used to shove the wrist to the
 * bottom of the frame — which mapped to the front of the counter and
 * read as the mitt dropping. Aim from the knuckles, lift a close-up
 * back toward play height, and keep hover fixed.
 */

export type AimPoint = { x: number; y: number; z: number };

/** Height the glove rides above the counter. Never inferred from size. */
export const HAND_HOVER = 0.95;

/** Typical wrist→middle span in image space at playing distance. */
export const REST_PALM_SPAN = 0.18;

/**
 * How much extra apparent size is subtracted from image Y.
 * A laptop camera looks down: closer hands sit lower in the frame.
 */
export const CLOSE_LIFT = 0.48;
/** Never lift more than this, or the mitt stops matching the video. */
export const CLOSE_LIFT_CAP = 0.14;

const KNUCKLES = [5, 9, 13, 17] as const;

export function palmSpan(landmarks: readonly AimPoint[]): number {
  const wrist = landmarks[0];
  const middle = landmarks[9];
  if (!wrist || !middle) return 0;
  return Math.hypot(middle.x - wrist.x, middle.y - wrist.y);
}

export function knuckleCenter(
  landmarks: readonly AimPoint[],
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const index of KNUCKLES) {
    const point = landmarks[index];
    if (!point) continue;
    x += point.x;
    y += point.y;
    n += 1;
  }
  if (n === 0) {
    const wrist = landmarks[0];
    return { x: wrist?.x ?? 0.5, y: wrist?.y ?? 0.5 };
  }
  return { x: x / n, y: y / n };
}

/**
 * Image-space aim: between wrist and knuckles. A close-up only lifts a
 * little — over-correcting made the mitt ignore the real hand.
 */
export function aimImage(landmarks: readonly AimPoint[]): { x: number; y: number } {
  const knuckles = knuckleCenter(landmarks);
  const wrist = landmarks[0] ?? knuckles;
  const extra = Math.max(0, palmSpan(landmarks) - REST_PALM_SPAN);
  return {
    x: wrist.x * 0.35 + knuckles.x * 0.65,
    y: wrist.y * 0.35 + knuckles.y * 0.65 - Math.min(CLOSE_LIFT_CAP, extra * CLOSE_LIFT),
  };
}

export function aimWorld(
  landmarks: readonly AimPoint[],
  toWorld: (lm: AimPoint) => AimPoint,
): AimPoint {
  if (!landmarks[0]) return { x: 0, y: 0, z: HAND_HOVER };
  const image = aimImage(landmarks);
  const world = toWorld({ x: image.x, y: image.y, z: 0 });
  return { x: world.x, y: world.y, z: HAND_HOVER };
}

/** Slide a posed cloud so its palm sits on the aim, height pinned. */
export function parkCloudAtAim(
  cloud: Array<{ x: number; y: number; z: number }>,
  palm: AimPoint,
  aim: AimPoint,
): void {
  const dx = aim.x - palm.x;
  const dy = aim.y - palm.y;
  const dz = HAND_HOVER - palm.z;
  if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 1e-8) return;
  for (const point of cloud) {
    point.x += dx;
    point.y += dy;
    point.z += dz;
  }
}
