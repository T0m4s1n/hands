/**
 * Presentation for the on-screen glove.
 *
 * Tracking still drives pinch and carry. The drawing must not rebuild a
 * 21-point skeleton — that is what made the mitt look broken and expensive.
 * A designed puppet follows the palm and folds open → fist from the
 * real finger curl, not from a rebuilt skeleton.
 */

export type GlovePhase = "hidden" | "follow";

export function glovePhase(
  active: boolean,
  hand?: { tracking?: "live" | "coasting" } | null,
): GlovePhase {
  return active && hand ? "follow" : "hidden";
}

export function gloveFollow(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * Math.min(dt, 0.08)));
}

/**
 * Webcam noise is a few centimetres of wrist wobble. A real reach is much
 * larger. Chase hard only when the hop is a gesture; sit still otherwise.
 */
export function gloveChaseRate(
  travel: number,
  stillRate: number,
  movingRate: number,
  stillSpan: number,
): number {
  const moving = Math.min(1, Math.max(0, travel / Math.max(1e-4, stillSpan)));
  const eased = moving * moving;
  return stillRate + (movingRate - stillRate) * eased;
}

/** Ignore hops that are just detector jitter. */
export const GLOVE_POS_DEAD = 0.02;
export const GLOVE_TURN_DEAD = 0.0018;

/** Cartoon finger curl, 0 open → 1 fist. Ease-out so a half fold already shuts. */
export function gloveCurl(grab: number) {
  const t = Math.min(1, Math.max(0, grab));
  return t * (2 - t);
}

/**
 * The designed mitt is a right-hand layout: local −X is the thumb, +X the
 * pinky. `palmFrame` already aims +X at the real pinky, so mirroring the
 * left glove again put its thumb on the pinky side — the skeleton and the
 * model could not agree.
 */
export function gloveSideSign(_handedness: "Left" | "Right") {
  return 1;
}
