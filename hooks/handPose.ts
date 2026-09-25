/**
 * Shared hand pose for the glove and the game.
 *
 * Recognition (pinch thresholds, landmark smoothing) stays in the tracker.
 * Everything that *places* a hand in the world — drawing it, grabbing with
 * it, dropping dots on it — goes through `poseHandWorld` so the visual and
 * the interaction probes cannot drift apart.
 */

import { Vector3 } from "three";
import { poseCloud, type PoseOptions } from "@/hooks/palmFrame";

export type Vec3Like = { x: number; y: number; z: number };

/**
 * The numbers that decide how the hand feels, read at runtime so they can be
 * dialled against a live camera instead of guessed at and rebuilt.
 */
export const handTuning = {
  /** Smoothing in e-folds per second: heavy at rest, light once moving. */
  stillRate: 22,
  movingRate: 120,
  /** Depth is the noisiest axis tracking reports, so it is damped harder. */
  depthDamping: 0.62,
  /**
   * How far to stretch reported depth about the wrist. Above 1 so folded
   * fingers actually sit behind the palm and occlude.
   */
  depthScale: 1.45,
  /** Arriving is a cartoon pop; leaving is a whole-glove fade, never a melt. */
  showRate: 18,
  hideRate: 7,
};

/** Presentation switches for the glove (and anything that must match it). */
export const handView = {
  /**
   * Flip the palm away from the webcam so the player sees the back of the
   * hand (tabletop view). Off by default: the camera sees palms, and matching
   * that is what stops the mitt reading as inverted in the lab and the menu.
   * Turn on for a true top-down barista feel once the camera angle asks for it.
   */
  faceDorsal: false,
  /** Soft palm pad over the knuckle span. */
  showPalm: true,
};

export function poseOptions(): PoseOptions {
  return {
    depthScale: handTuning.depthScale,
    faceDorsal: handView.faceDorsal,
  };
}

const POSE_A = Array.from({ length: 21 }, () => new Vector3());
const POSE_B = Array.from({ length: 21 }, () => new Vector3());
const SCRATCH = new Vector3();
let poseToggle = false;

/**
 * Landmark cloud → world points with the same lock / deepen / dorsal turn
 * the glove uses. Alternates two buffers so two hands in one frame do not
 * overwrite each other mid-read.
 */
export function poseHandWorld(
  landmarks: Vec3Like[],
  toWorld: (lm: Vec3Like) => Vec3Like,
  options: PoseOptions = poseOptions(),
): Vector3[] {
  if (landmarks.length < 21) return [];
  const buf = poseToggle ? POSE_A : POSE_B;
  poseToggle = !poseToggle;
  for (let i = 0; i < 21; i++) {
    const w = toWorld(landmarks[i]);
    buf[i].set(w.x, w.y, w.z);
  }
  poseCloud(buf, SCRATCH, options);
  return buf;
}

/** Palm centre of an already-posed cloud. */
export function posedPalm(points: Vector3[]): Vec3Like {
  return {
    x: (points[0].x + points[9].x) * 0.5,
    y: (points[0].y + points[9].y) * 0.5,
    z: (points[0].z + points[9].z) * 0.5,
  };
}
