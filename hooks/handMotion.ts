import type { Vec3 } from "./useHandTracking.ts";

/**
 * How far a live sample may be trusted for display, in seconds.
 * Past this the last detection is shown still rather than invented.
 */
export const FOLLOW_HORIZON_S = 0.07;

/**
 * The glove sits on the live wrist. Shape smoothing is allowed to lag;
 * dragging the whole cloud with it is what made the mitt ignore the camera.
 */
export function pinToLiveWrist(smoothed: Vec3[], live: Vec3): Vec3[] {
  const wrist = smoothed[0];
  if (!wrist) return smoothed;
  const dx = live.x - wrist.x;
  const dy = live.y - wrist.y;
  const dz = (live.z - wrist.z) * 0.4;
  if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 1e-8) return smoothed;
  return smoothed.map((point) => ({
    x: point.x + dx,
    y: point.y + dy,
    z: point.z + dz,
  }));
}

/** Landmark-space step → world units per second on the table. */
export function landmarkVelocityToWorld(
  velPerSec: Vec3,
  worldX: number,
  worldY: number,
): Vec3 {
  return {
    x: velPerSec.x * worldX,
    y: -velPerSec.y * worldY,
    z: 0,
  };
}

/** Advance a published palm by its last known motion, without inventing a long coast. */
export function extrapolateCursor(
  cursor: Vec3,
  motion: Vec3 | undefined,
  ageSec: number,
): Vec3 {
  const t = Math.min(FOLLOW_HORIZON_S, Math.max(0, ageSec));
  if (!motion || t <= 0) return cursor;
  return {
    x: cursor.x + motion.x * t,
    y: cursor.y + motion.y * t,
    z: cursor.z,
  };
}
