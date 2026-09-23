/**
 * The surface of a liquid, simulated rather than drawn.
 *
 * A flat disc that changes height is a gauge. What makes it read as liquid is
 * that it answers back: the stream dents it where it lands, the dent runs
 * outward as a ring, bounces off the wall of the cup and comes back, and the
 * whole thing flattens out again once you stop. That is the wave equation, and
 * on a grid this small it costs almost nothing.
 *
 *     ∂²u/∂t² = c² ∇²u
 *
 * Solved the usual explicit way: the next height comes from the current one,
 * the previous one, and how much the neighbours disagree with the middle.
 *
 * Plain numbers, so the whole thing can be checked outside a browser.
 */

export type Slosh = {
  /** How many cells across. The grid is square and the disc is cut out of it. */
  size: number;
  /** Heights now, and one step ago. */
  now: Float32Array;
  was: Float32Array;
  /** Scratch, so a step allocates nothing. */
  next: Float32Array;
};

export function createSlosh(size = 16): Slosh {
  const cells = size * size;
  return {
    size,
    now: new Float32Array(cells),
    was: new Float32Array(cells),
    next: new Float32Array(cells),
  };
}

/**
 * How fast a ripple crosses the grid. Above about 0.5 the explicit solver
 * stops being stable and the surface explodes into noise, so it is clamped
 * well below that — a wobbling cup of coffee is not worth a NaN.
 */
const MAX_SPEED = 0.42;

/**
 * Advances the surface by one step.
 *
 * `damping` is how quickly it goes still: 0 never settles, 1 settles at once.
 * `dt` is scaled into the step rather than used directly, because an explicit
 * solver run with a real frame time is one long frame away from blowing up.
 */
export function stepSlosh(
  state: Slosh,
  dt: number,
  speed = 0.32,
  damping = 0.06,
): void {
  const { size, now, was, next } = state;
  // A long frame is spread over the steps it should have been, never crammed
  // into one that the solver cannot take.
  const steps = Math.min(3, Math.max(1, Math.round(dt * 90)));
  const c = Math.min(MAX_SPEED, Math.max(0, speed));
  const keep = 1 - Math.min(1, Math.max(0, damping));

  for (let step = 0; step < steps; step++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        // Edges reflect: the wall of the cup is what a ripple bounces off.
        const left = now[y * size + (x > 0 ? x - 1 : x)];
        const right = now[y * size + (x < size - 1 ? x + 1 : x)];
        const up = now[(y > 0 ? y - 1 : y) * size + x];
        const down = now[(y < size - 1 ? y + 1 : y) * size + x];

        const pull = (left + right + up + down) * 0.25 - now[i];
        const value = now[i] + (now[i] - was[i]) * keep + pull * c * 2;
        next[i] = value;
      }
    }
    was.set(now);
    now.set(next);
  }
}

/**
 * Dents the surface at (x, y), given in -1..1 across the grid. This is what a
 * falling stream does where it lands, and what a cup does when it is set down
 * hard.
 *
 * The dent is balanced by a ring of raised liquid around it, so the splash adds
 * up to nothing overall. That matters more than it sounds: the walls of a cup
 * reflect, which means the simulation conserves whatever you put into it, so a
 * splash that only pushed down would spread out into the whole surface sitting
 * permanently lower and never coming back. Displacing rather than removing is
 * also what a real impact does — the liquid pushed out of the middle has to go
 * somewhere, and it goes up around the edge.
 */
export function splash(
  state: Slosh,
  x: number,
  y: number,
  strength: number,
  spread = 1.6,
): void {
  const { size, now } = state;
  const half = (size - 1) / 2;
  const cx = (x + 1) * half;
  const cy = (y + 1) * half;
  const reach = Math.max(1, spread);

  const from = Math.max(0, Math.floor(cx - reach));
  const to = Math.min(size - 1, Math.ceil(cx + reach));
  const top = Math.max(0, Math.floor(cy - reach));
  const bottom = Math.min(size - 1, Math.ceil(cy + reach));

  // Weigh the cells first, then take the average out, so what goes down and
  // what comes up cancel exactly.
  let total = 0;
  let touched = 0;
  for (let gy = top; gy <= bottom; gy++) {
    for (let gx = from; gx <= to; gx++) {
      const away = Math.hypot(gx - cx, gy - cy) / reach;
      if (away > 1) continue;
      // A smooth dip rather than a spike, so the ripple that leaves it is
      // round instead of square.
      total += 0.5 + 0.5 * Math.cos(away * Math.PI);
      touched++;
    }
  }
  if (touched === 0) return;
  const mean = total / touched;
  // Scaling a kernel that already sums to zero keeps it summing to zero, so
  // this only fixes what `strength` means: the depth of the dent itself.
  const scale = 1 / Math.max(1e-3, 1 - mean);

  for (let gy = top; gy <= bottom; gy++) {
    for (let gx = from; gx <= to; gx++) {
      const away = Math.hypot(gx - cx, gy - cy) / reach;
      if (away > 1) continue;
      const weight = 0.5 + 0.5 * Math.cos(away * Math.PI);
      now[gy * size + gx] -= strength * (weight - mean) * scale;
    }
  }
}

/** Flattens the surface without waiting for it to settle. */
export function calmSlosh(state: Slosh): void {
  state.now.fill(0);
  state.was.fill(0);
  state.next.fill(0);
}

/**
 * Reads the height at a point in -1..1, smoothing between cells so the surface
 * is not visibly made of squares.
 */
export function sampleSlosh(state: Slosh, x: number, y: number): number {
  const { size, now } = state;
  const half = (size - 1) / 2;
  const fx = Math.min(size - 1, Math.max(0, (x + 1) * half));
  const fy = Math.min(size - 1, Math.max(0, (y + 1) * half));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const top = now[y0 * size + x0] * (1 - tx) + now[y0 * size + x1] * tx;
  const bottom = now[y1 * size + x0] * (1 - tx) + now[y1 * size + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/** How choppy the surface is overall, for deciding when it has gone still. */
export function agitation(state: Slosh): number {
  let total = 0;
  for (let i = 0; i < state.now.length; i++) total += Math.abs(state.now[i]);
  return total / state.now.length;
}
