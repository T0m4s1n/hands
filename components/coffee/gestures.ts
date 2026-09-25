/**
 * Reading intent out of a tracked hand.
 *
 * Everything here works in the image plane — across the camera frame and up it.
 * MediaPipe reports depth at roughly a fifth of the scale of the other two axes
 * and with far more noise, so a gesture asking the player to push toward or away
 * from the camera would be scored mostly on jitter. Every movement below is one
 * the camera can genuinely see.
 *
 * No React and no three in this file on purpose: it is all arithmetic over
 * numbers, so it can be run and checked outside a browser.
 */

export type Point = { x: number; y: number; z: number };

const WRIST = 0;
const MIDDLE_MCP = 9;

/** Past this much roll away from where you picked it up, it starts pouring. */
export const TILT_START = 0.45;
/** And at this much, it is pouring as fast as it will go. */
export const TILT_FULL = 1.15;

/**
 * A turn bigger than this between two frames is the tracker jumping, not a
 * wrist: nobody cranks a handle at thirty-odd radians a second.
 */
export const MAX_TURN_STEP = 0.6;
/** Fastest a real wrist swings the pestle. A teleport is always faster. */
export const MAX_CRANK_RATE = 7;

/** The shortest way round from one angle to another, in -PI..PI. */
export function angleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Which way the palm is pointing, as seen by the camera: the angle of the line
 * from the wrist to the middle knuckle. It is the longest line across the hand,
 * so it is also the steadiest, which is why tipping is measured along it rather
 * than along the knuckles.
 */
export function palmAngle(landmarks: readonly Point[]): number {
  const wrist = landmarks[WRIST];
  const knuckle = landmarks[MIDDLE_MCP];
  if (!wrist || !knuckle) return 0;
  return Math.atan2(knuckle.y - wrist.y, knuckle.x - wrist.x);
}

/**
 * How fast something tips out, from 0 to 1, given how far the hand has rolled
 * from where it was picked up. Holding it level pours nothing, which is what
 * lets a player stop.
 */
export function pourFlow(tilt: number): number {
  const past = Math.abs(tilt) - TILT_START;
  if (past <= 0) return 0;
  return Math.min(1, past / (TILT_FULL - TILT_START));
}

/* ---------- turning ---------- */

export type TurnState = { angle: number; turned: number };

export function newTurn(angle: number): TurnState {
  return { angle, turned: 0 };
}

/**
 * Adds however far the handle moved round the circle since the last frame.
 * Direction does not matter — turning it back the other way still grinds — so
 * the total only ever grows.
 *
 * A tracker jump does not move the handle. Following it used to hide score
 * debt, and instead teleported the pestle when a hand left or re-entered
 * the frame.
 *
 * @returns the amount added, which is zero when the step looked like a glitch.
 */
export function updateTurn(state: TurnState, angle: number): number {
  const step = angleDelta(state.angle, angle);
  if (Math.abs(step) > MAX_TURN_STEP) return 0;
  state.angle = angle;
  const moved = Math.abs(step);
  state.turned += moved;
  return moved;
}

/**
 * Drive the mill handle toward the hand. Jumps stay put. Accepted motion
 * is rate-limited so the pestle swings instead of snapping.
 */
export function driveCrank(
  state: TurnState,
  handAngle: number,
  dt: number,
): number {
  const step = angleDelta(state.angle, handAngle);
  if (Math.abs(step) > MAX_TURN_STEP) return 0;
  const cap = MAX_CRANK_RATE * Math.min(0.08, Math.max(0, dt));
  const applied = Math.abs(step) <= cap ? step : Math.sign(step) * cap;
  state.angle += applied;
  const moved = Math.abs(applied);
  state.turned += moved;
  return moved;
}

/**
 * A published hand may drive the mill. Coast is a blink mid-circle;
 * driveCrank already ignores jumps, so a coasting wrist cannot teleport.
 */
export function crankHandIsLive(
  hand?: { tracking?: "live" | "coasting" } | null,
) {
  return Boolean(hand);
}

/* ---------- strokes: shaking, pressing ---------- */

export type StrokeState = {
  /** Which way it is travelling: +1, -1, or 0 before it has moved at all. */
  dir: number;
  /** The furthest point reached in that direction. */
  extreme: number;
  /** Strokes counted so far, in both directions. */
  count: number;
};

export function newStroke(value: number): StrokeState {
  return { dir: 0, extreme: value, count: 0 };
}

/**
 * Counts movement back and forth along one axis. A stroke begins once the value
 * has come back `amplitude` from the furthest point it reached, which both
 * ignores tracking jitter and stops a slow drift from counting as shaking.
 *
 * @returns the direction of the stroke that just began, or 0 if none did. The
 *   caller can therefore count every stroke (shaking) or only the ones going
 *   one way (pressing down).
 */
export function updateStroke(
  state: StrokeState,
  value: number,
  amplitude: number,
): number {
  if (state.dir === 0) {
    const moved = value - state.extreme;
    if (Math.abs(moved) < amplitude) return 0;
    state.dir = Math.sign(moved);
    state.extreme = value;
    state.count += 1;
    return state.dir;
  }

  // Still going the same way: carry the furthest point along with it.
  if ((value - state.extreme) * state.dir > 0) {
    state.extreme = value;
    return 0;
  }

  // Coming back — but only far enough back counts as having turned around.
  if ((state.extreme - value) * state.dir >= amplitude) {
    state.dir = -state.dir;
    state.extreme = value;
    state.count += 1;
    return state.dir;
  }

  return 0;
}
