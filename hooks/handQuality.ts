import type { Vec3 } from "./useHandTracking.ts";

/**
 * How much a 21-point cloud looks like a real hand.
 *
 * Low light and a drifted tracker both produce the same junk: every joint
 * collapsed onto the wrist, or a palm so huge it is a wall. Feeding those
 * into assignment teleports the glove. Better to drop the frame and coast.
 */
export const MIN_SKELETON_QUALITY = 0.4;

export function skeletonQuality(landmarks: readonly Vec3[]): number {
  if (landmarks.length < 21) return 0;
  const wrist = landmarks[0];
  const index = landmarks[5];
  const middle = landmarks[9];
  const pinky = landmarks[17];
  const thumb = landmarks[4];
  if (!wrist || !index || !middle || !pinky || !thumb) return 0;

  const palm = Math.hypot(middle.x - wrist.x, middle.y - wrist.y);
  const width = Math.hypot(index.x - pinky.x, index.y - pinky.y);
  if (palm < 0.022 || width < 0.016) return 0;
  if (palm > 0.72 || width > 0.88) return 0.08;

  let spread = 0;
  for (const point of landmarks) {
    spread += Math.hypot(point.x - wrist.x, point.y - wrist.y);
  }
  if (spread < 0.18) return 0;

  let score = 0.5;
  const ratio = width / palm;
  if (ratio > 0.4 && ratio < 2.5) score += 0.22;
  if (palm > 0.045 && palm < 0.38) score += 0.16;
  const thumbReach = Math.hypot(thumb.x - wrist.x, thumb.y - wrist.y);
  if (thumbReach > palm * 0.25) score += 0.08;
  return Math.min(1, score);
}

/**
 * Image xy stay where the camera put them. World z (metres about the wrist)
 * is the less jittery reading of which finger is nearer, so we keep the
 * wrist's image depth and replace the relative finger depths.
 */
export function blendWorldDepth(
  image: readonly Vec3[],
  world?: readonly Vec3[] | null,
): Vec3[] {
  if (!world || world.length !== image.length) {
    return image.map((point) => ({ ...point }));
  }
  const imageWrist = image[0]?.z ?? 0;
  const worldWrist = world[0]?.z ?? 0;
  return image.map((point, i) => ({
    x: point.x,
    y: point.y,
    z: imageWrist + (point.z - imageWrist) * 0.35 + (world[i].z - worldWrist) * 0.65,
  }));
}

export function keepGoodHands<T extends { raw: Vec3[]; labelScore?: number }>(
  detections: readonly T[],
): T[] {
  return detections.filter((detection) => {
    const quality = skeletonQuality(detection.raw);
    if (quality >= MIN_SKELETON_QUALITY) return true;
    return quality >= 0.26 && (detection.labelScore ?? 0) >= 0.78;
  });
}
