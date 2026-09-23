/**
 * Movement that has weight.
 *
 * Linear interpolation toward a target always looks like a machine easing off:
 * it starts fast, ends slow, and never has momentum. A spring carries velocity,
 * so a thing that gets picked up snaps up and settles, and a thing that lands
 * settles into place instead of gliding to a halt. It is most of the difference
 * between an interface that moves and a game that feels alive.
 *
 * Plain numbers, no three and no React, so the maths can be checked outside a
 * browser.
 */

export type Spring = { value: number; velocity: number };

export function spring(value = 0): Spring {
  return { value, velocity: 0 };
}

/**
 * How fast a spring is allowed to be stepped. Frame times spike whenever the
 * tab is backgrounded or the garbage collector runs, and a spring integrated
 * over a long step overshoots hard enough to fling the object off the table.
 */
const MAX_STEP = 1 / 45;

/**
 * Advances a spring toward `target`. `stiffness` is how eagerly it chases;
 * `bounce` from 0 to 1 is how much it overshoots on the way — 0 settles dead,
 * which suits a lid closing, and 0.5 springs, which suits something popping
 * into a hand.
 *
 * Long frames are cut into several short ones, so the result of a stutter is a
 * slightly slow spring rather than an explosion.
 */
export function stepSpring(
  state: Spring,
  target: number,
  stiffness: number,
  dt: number,
  bounce = 0,
): number {
  // Critical damping is 2·sqrt(k); easing off it is what allows overshoot.
  const damping = 2 * Math.sqrt(stiffness) * (1 - bounce * 0.75);
  let left = Math.min(dt, 0.25);
  while (left > 0) {
    const step = Math.min(left, MAX_STEP);
    const accel =
      (target - state.value) * stiffness - state.velocity * damping;
    state.velocity += accel * step;
    state.value += state.velocity * step;
    left -= step;
  }
  return state.value;
}

/** Drops a spring at a value with no momentum, for cuts rather than moves. */
export function setSpring(state: Spring, value: number): void {
  state.value = value;
  state.velocity = 0;
}

/**
 * Frame-rate independent exponential approach, for things that should follow
 * rather than bounce: a colour warming up, a glow fading out.
 */
export function approach(
  current: number,
  target: number,
  rate: number,
  dt: number,
): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Smoothstep, for easing a 0..1 progress into something less mechanical. */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * A short one-shot pulse, for punctuation: it leaps to 1 and falls away. Feed
 * it the seconds since the thing happened.
 */
export function pulse(since: number, length = 0.45): number {
  if (since < 0 || since > length) return 0;
  const t = since / length;
  return Math.sin(t * Math.PI) * (1 - t * 0.35);
}
