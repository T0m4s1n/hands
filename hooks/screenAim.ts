/**
 * Image-plane aim (0..1) for overlay menus.
 *
 * Shared by tracking (`screenFromHand`) and the recipe carta (`menuAimPoint`).
 * Keep this module free of React / MediaPipe so node:test can lock the contract.
 *
 * INVARIANT: a hand with **no landmarks** (mouse fallback) must still aim via
 * undoing `cursor` with the same world constants. Dropping that path breaks
 * the carta pointer — see `.cursor/rules/recipe-menu.mdc`.
 */

export type AimVec = { x: number; y: number; z: number };

export type AimHand = {
  smoothedLandmarks: AimVec[];
  cursor: AimVec;
};

/** Same horizontal span as `landmarkToWorld` in useHandTracking. */
export const WORLD_X = 7;

/** Updated when the video aspect is known; menus fall back to 4:3-ish. */
let worldY = WORLD_X * 0.75;

export function setAimWorldY(width: number, height: number) {
  if (width > 0 && height > 0) worldY = WORLD_X * (height / width);
}

export function getAimWorldY() {
  return worldY;
}

/**
 * Where a hand aims on the screen, in 0..1.
 * Landmarks win; otherwise undo the world cursor (pointer fallback).
 */
export function screenFromHand(hand: AimHand): { x: number; y: number } {
  if (hand.smoothedLandmarks.length >= 9) {
    const tip = hand.smoothedLandmarks[8];
    return { x: tip.x, y: tip.y };
  }
  return {
    x: hand.cursor.x / WORLD_X + 0.5,
    y: 0.5 - hand.cursor.y / Math.max(worldY, 1e-3),
  };
}

/** Clamped aim for the carta reticle. Never returns null for a finite cursor. */
export function menuAimPoint(
  hand: AimHand,
): { x: number; y: number } | null {
  const screen = screenFromHand(hand);
  if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
  return {
    x: Math.min(1, Math.max(0, screen.x)),
    y: Math.min(1, Math.max(0, screen.y)),
  };
}
