import { approach } from "../coffee/anim.ts";

/** How eagerly the reticle sits still. Webcam tremor dies here. */
export const CURSOR_STILL_RATE = 6;
/** How eagerly it follows a real swipe. */
export const CURSOR_MOVE_RATE = 28;
/** Image-plane travel that counts as a swipe, not a shake. */
export const CURSOR_SPAN = 0.04;
/** Hops smaller than this only creep — they never speed the chase. */
export const CURSOR_DEAD = 0.007;
/** Residual settle onto the true tip so we do not park a few pixels off. */
export const CURSOR_CREEP = 3.2;
/** First pole: kill landmark noise before the reticle chases. */
export const CURSOR_AIM_RATE = 34;

export type CursorSmooth = {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  seeded: boolean;
};

export function emptyCursorSmooth(): CursorSmooth {
  return { x: 0.5, y: 0.5, aimX: 0.5, aimY: 0.5, seeded: false };
}

export function seedCursor(state: CursorSmooth, x: number, y: number) {
  state.x = x;
  state.y = y;
  state.aimX = x;
  state.aimY = y;
  state.seeded = true;
}

function chaseRate(travel: number): number {
  if (travel < CURSOR_DEAD) return CURSOR_CREEP;
  const moving = Math.min(1, travel / CURSOR_SPAN);
  const eased = moving * moving;
  return CURSOR_STILL_RATE + (CURSOR_MOVE_RATE - CURSOR_STILL_RATE) * eased;
}

/**
 * Two-pole fingertip follow. The aim eats landmark noise; the reticle
 * then chases that cleaned point. A still hand barely moves; a swipe
 * catches up. First sample snaps so a new lock does not ease from afar.
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

  const t = Math.min(0.08, Math.max(0, dt));
  state.aimX = approach(state.aimX, target.x, CURSOR_AIM_RATE, t);
  state.aimY = approach(state.aimY, target.y, CURSOR_AIM_RATE, t);

  const travel = Math.hypot(state.aimX - state.x, state.aimY - state.y);
  const rate = chaseRate(travel);
  state.x = approach(state.x, state.aimX, rate, t);
  state.y = approach(state.y, state.aimY, rate, t);
  return { x: state.x, y: state.y };
}
