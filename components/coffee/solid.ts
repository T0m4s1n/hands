/**
 * What each object takes up, what it can stand on, and how heavy it feels.
 *
 * This is not a rigid-body engine and does not pretend to be one. The hands
 * drive every object directly, so a solver that pushed objects around would be
 * fighting the player rather than serving them. What it does instead is the
 * short list of things that were actually going wrong: objects floating above
 * the surface they were dropped on, objects standing inside one another, and
 * everything having the same weightless feel whether it was a teaspoon or a
 * full kettle.
 *
 * Plain numbers, so all of it can be checked outside a browser.
 */

/**
 * The shape an object occupies. Chosen per object rather than wrapping
 * everything in one generous box: a box around a spoon is mostly air, and it
 * was that air that kept things from being set down next to each other.
 */
export type Shape =
  /** Upright and round: cups, mortars, kettles. */
  | { kind: "round"; radius: number; height: number }
  /** Longer than it is wide: spoons, tampers, portafilters with handles. */
  | { kind: "slab"; halfLong: number; halfShort: number; height: number }
  /**
   * Round and open at the top, so other things can be set *inside* it rather
   * than on top of it — the difference between a cup on a saucer and a cup
   * hovering over a mortar.
   */
  | { kind: "open"; radius: number; height: number; rim: number; floor: number };

export type Solid = {
  shape: Shape;
  /**
   * Roughly how heavy it is. Not kilograms — a ratio. A loaded kettle at 3 is
   * three times the drag of a teaspoon at 1, and that is all the number is
   * asked to mean.
   */
  mass: number;
  /** How much it slides before it settles when set down. */
  friction: number;
};

/** How far out the shape reaches across the counter. */
export function reach(shape: Shape): number {
  switch (shape.kind) {
    case "round":
    case "open":
      return shape.radius;
    case "slab":
      // The long half, because it can be turned any way on the counter.
      return shape.halfLong;
  }
}

/** How tall it stands. */
export function height(shape: Shape): number {
  return shape.height;
}

/**
 * The height something set down at (dx, dy) — measured from this object's
 * centre — would come to rest at, or null when it is not over this object at
 * all. An open vessel supports from its inner floor, so a cup dropped into a
 * saucer's well sits in the well rather than on its rim.
 */
export function restOn(
  shape: Shape,
  base: number,
  dx: number,
  dy: number,
): number | null {
  const distance = Math.hypot(dx, dy);
  switch (shape.kind) {
    case "round":
      return distance <= shape.radius ? base + shape.height : null;
    case "slab":
      return Math.abs(dx) <= shape.halfLong && Math.abs(dy) <= shape.halfShort
        ? base + shape.height
        : null;
    case "open":
      if (distance > shape.radius) return null;
      // Inside the rim it drops to the floor; on the rim itself it perches.
      return distance <= shape.rim ? base + shape.floor : base + shape.height;
  }
}

export type Placed = {
  x: number;
  y: number;
  /** The height its base sits at. */
  z: number;
  shape: Shape;
};

/**
 * The height an object should rest at when put down at (x, y): on top of
 * whatever is already there, or on the counter if nothing is.
 *
 * This is the whole cure for floating and for sinking through: a dropped object
 * is never left where the hand let go of it, it is always put down on
 * something.
 */
export function settleHeight(
  x: number,
  y: number,
  counter: number,
  supports: readonly Placed[],
): number {
  let best = counter;
  for (const support of supports) {
    const top = restOn(support.shape, support.z, x - support.x, y - support.y);
    if (top !== null && top > best) best = top;
  }
  return best;
}

/**
 * How far two objects standing at the same height overlap, and which way to
 * push the first one to clear it. Null when they are not touching, or when one
 * is stacked clear above the other.
 */
export function overlap(
  a: Placed,
  b: Placed,
): { dx: number; dy: number; by: number } | null {
  // Stacked rather than side by side: nothing to separate.
  const aTop = a.z + height(a.shape);
  const bTop = b.z + height(b.shape);
  if (a.z >= bTop - 1e-3 || b.z >= aTop - 1e-3) return null;

  // Something sitting inside an open vessel belongs there.
  if (b.shape.kind === "open" || a.shape.kind === "open") {
    const open = b.shape.kind === "open" ? b : a;
    const other = open === b ? a : b;
    const inner = (open.shape as Extract<Shape, { kind: "open" }>).rim;
    if (Math.hypot(other.x - open.x, other.y - open.y) + reach(other.shape) <= inner) {
      return null;
    }
  }

  const want = reach(a.shape) + reach(b.shape);
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  const gap = Math.hypot(dx, dy);
  if (gap >= want) return null;

  // Exactly on top of each other: pick a direction rather than dividing by zero.
  if (gap < 1e-4) {
    dx = 1;
    dy = 0;
  } else {
    dx /= gap;
    dy /= gap;
  }
  const by = want - gap;
  return { dx, dy, by };
}

/**
 * How eagerly an object follows the hand carrying it. Heavy things lag, which
 * is most of what makes them feel heavy — a full kettle that snapped to the
 * hand like a teaspoon was the single biggest reason nothing had any weight.
 */
export function carryRate(mass: number, base = 13): number {
  return base / Math.max(1, mass);
}

/** How hard it lands: heavier things thump, light ones barely register. */
export function landingKick(mass: number, speed: number): number {
  return Math.min(1.4, Math.max(0, speed) * 0.09 * Math.sqrt(Math.max(1, mass)));
}

/**
 * How high a carried object has to ride to pass over what is under it.
 *
 * This is the replacement for asking the hand how high to hold something.
 * Apparent-size depth was the only reading in the tracker with no reliable
 * zero — it is inferred from how big the hand looks against a range the
 * session is still learning — so the height of whatever you were holding
 * drifted and shivered on its own. The collisions were the visible symptom
 * rather than a separate bug: `overlap` only separates two things standing at
 * the same height, so an object whose height flickered flickered in and out of
 * being solid, and walked through the rim it should have slid around.
 *
 * Deciding the height instead fixes both at once. The object lifts as it comes
 * over the obstacle and settles once it is past, the player steers in the two
 * axes a camera can actually see, and there is no moment where something is
 * inside a thing it is meant to be above.
 *
 * The rise starts `approach` before the two footprints meet, so it reads as
 * lifting something over a rim rather than as a step.
 */
export function carryOver(
  carried: Shape,
  obstacle: Placed,
  x: number,
  y: number,
  low: number,
  approach = 0.6,
  clearance = 0.12,
): number {
  const touching = reach(carried) + reach(obstacle.shape);
  const gap = Math.hypot(x - obstacle.x, y - obstacle.y);
  const span = Math.max(approach, 1e-6);
  const near = Math.min(1, Math.max(0, (touching + span - gap) / span));
  const over = obstacle.z + height(obstacle.shape) + clearance;
  if (over <= low) return low;
  return low + (over - low) * near;
}
