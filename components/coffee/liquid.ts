/**
 * What is in the cup, and what happens when there is too much of it.
 *
 * A vessel holds a volume, not a percentage. Keeping it that way is what makes
 * pouring behave: the jug loses exactly what the cup gains, a cup that is
 * already half full takes half as much before it runs over, and the overflow is
 * a real number of millilitres that has to go somewhere rather than a level
 * that silently stops at 1.
 *
 * Plain numbers, no three and no React, so all of it can be checked outside a
 * browser.
 */

export type LiquidKind = "coffee" | "espresso" | "water" | "milk" | "foam";

export type LiquidLook = {
  colour: string;
  /** Pale skin that forms on the surface, when the liquid grows one. */
  skin: string | null;
  roughness: number;
  metalness: number;
  /** How much light passes through it. Milk is opaque; water is not. */
  opacity: number;
  /** Thicker liquids climb the wall of the vessel and pour in a fatter rope. */
  thickness: number;
};

/**
 * Each liquid gets its own surface, because "café, agua o leche" should be
 * obvious at a glance without reading the HUD: coffee is dark and glossy under
 * a pale crema, water is clear and barely there, milk is flat and opaque.
 */
export const LIQUIDS: Record<LiquidKind, LiquidLook> = {
  coffee: {
    colour: "#3a1d0e",
    skin: "#c98f5a",
    roughness: 0.16,
    metalness: 0.03,
    opacity: 1,
    thickness: 1,
  },
  espresso: {
    colour: "#241006",
    skin: "#b87a45",
    roughness: 0.12,
    metalness: 0.04,
    opacity: 1,
    thickness: 1.15,
  },
  water: {
    colour: "#9fc4d8",
    skin: null,
    roughness: 0.05,
    metalness: 0,
    opacity: 0.42,
    thickness: 0.75,
  },
  milk: {
    colour: "#f6f1e8",
    skin: null,
    roughness: 0.55,
    metalness: 0,
    opacity: 1,
    thickness: 1.2,
  },
  foam: {
    colour: "#fffaf0",
    skin: null,
    roughness: 0.9,
    metalness: 0,
    opacity: 1,
    thickness: 1.6,
  },
};

/** The inside of something that can hold liquid, in world units. */
export type Vessel = {
  /** How wide the liquid is, which is the inside of the wall, not the outside. */
  radius: number;
  /** How far above the object's base the floor of the inside sits. */
  floor: number;
  /** How deep the inside is, from that floor to the rim. */
  depth: number;
};

/** How much a vessel holds, in world volume. Used as its capacity. */
export function capacity(vessel: Vessel): number {
  return Math.PI * vessel.radius * vessel.radius * vessel.depth;
}

/** Where the surface of `volume` sits above the object's base. */
export function surfaceHeight(vessel: Vessel, volume: number): number {
  const full = capacity(vessel);
  const part = full <= 0 ? 0 : Math.min(1, Math.max(0, volume / full));
  return vessel.floor + part * vessel.depth;
}

/** How full it is, 0 to 1, which is what the HUD and the scoring band read. */
export function fillRatio(vessel: Vessel, volume: number): number {
  const full = capacity(vessel);
  if (full <= 0) return 0;
  return Math.min(1, Math.max(0, volume / full));
}

export type PourResult = {
  /** What the source has left. */
  from: number;
  /** What the destination now holds. */
  into: number;
  /** What actually moved across. */
  moved: number;
  /** What the destination could not take and lost over the rim. */
  spilled: number;
};

/**
 * Moves liquid from one vessel to another for one frame.
 *
 * Three things can cut the pour short and all of them matter: the jug can run
 * dry, the cup can fill up, and the tilt can be too shallow to pour at all.
 * Whatever the cup cannot take is spilled rather than quietly deleted — that
 * overflow is the thing the player is being asked to avoid.
 */
export function pour({
  from,
  into,
  room,
  amount,
}: {
  /** What the source holds now. */
  from: number;
  /** What the destination holds now. */
  into: number;
  /** The destination's capacity. */
  room: number;
  /** How much would move this frame if nothing were in the way. */
  amount: number;
}): PourResult {
  const wanted = Math.max(0, amount);
  // Never pour more than there is.
  const leaving = Math.min(wanted, Math.max(0, from));
  const space = Math.max(0, room - into);
  const accepted = Math.min(leaving, space);
  const spilled = leaving - accepted;

  return {
    from: from - leaving,
    into: into + accepted,
    moved: accepted,
    spilled,
  };
}

/**
 * Where a falling stream is after `t` seconds, given where it left the spout
 * and how fast. Only the drop matters for how it looks — a stream leaving a
 * tipped jug arcs, and an arc is most of what makes it read as liquid rather
 * than a drawn line.
 */
export const GRAVITY = 9.2;

export function streamPoint(
  start: readonly [number, number, number],
  velocity: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    start[0] + velocity[0] * t,
    start[1] + velocity[1] * t,
    start[2] + velocity[2] * t - 0.5 * GRAVITY * t * t,
  ];
}

/**
 * How long a stream takes to fall from `height` to the surface it lands on,
 * given the speed it left with. The positive root of the same arc.
 */
export function fallTime(height: number, upwardSpeed = 0): number {
  if (height <= 0) return 0;
  const disc = upwardSpeed * upwardSpeed + 2 * GRAVITY * height;
  return (upwardSpeed + Math.sqrt(disc)) / GRAVITY;
}
