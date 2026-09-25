import { approach } from "../coffee/anim.ts";

/** How eagerly the reticle sits still. Webcam tremor dies here. */
export const CURSOR_STILL_RATE = 5;
/** How eagerly it follows a real swipe. Still far below the old 0.72/frame. */
export const CURSOR_MOVE_RATE = 14;
/** Image-plane travel that counts as a swipe, not a shake. */
export const CURSOR_SPAN = 0.05;
/** Hops smaller than this only creep — they never speed the chase. */
export const CURSOR_DEAD = 0.008;
/** Residual settle onto the true tip so we do not park a few pixels off. */
export const CURSOR_CREEP = 2.4;

export type CursorSmooth = {
  x: number;
  y: number;
  seeded: boolean;
};

export function emptyCursorSmooth(): CursorSmooth {
  return { x: 0.5, y: 0.5, seeded: false };
}

export function seedCursor(state: CursorSmooth, x: number, y: number) {
  state.x = x;
  state.y = y;
  state.seeded = true;
}

function chaseRate(travel: number): number {
  if (travel < CURSOR_DEAD) return CURSOR_CREEP;
  const moving = Math.min(1, travel / CURSOR_SPAN);
  const eased = moving * moving;
  return CURSOR_STILL_RATE + (CURSOR_MOVE_RATE - CURSOR_STILL_RATE) * eased;
}

/**
 * Frame-rate independent fingertip follow. A still hand barely moves the
 * reticle; a swipe is allowed to catch up. First sample snaps so a new
 * lock does not ease in from the last café.
 */
export function stepMenuCursor(
  state: CursorSmooth,
  target: { x: number; y: number },
  dt: number,
): { x: number; y: number } {
  if (!state.seeded) {
    seedCursor(state, target.x, target.y);
    return { x: state.x, y: state.y };
  }

  const travel = Math.hypot(target.x - state.x, target.y - state.y);
  const t = Math.min(0.08, Math.max(0, dt));
  const rate = chaseRate(travel);
  state.x = approach(state.x, target.x, rate, t);
  state.y = approach(state.y, target.y, rate, t);
  return { x: state.x, y: state.y };
}
