/**
 * Bowl contents for held props — plain data so tests can lock placement
 * without loading GLTF / React Three Fiber.
 */

export type CargoSpec = {
  kind: "beans" | "grounds";
  /**
   * Fallback seat in the yawed group's local frame (game units). Same space
   * as the fitted mesh *before* the parent yaw is applied to the world —
   * the yaw turns mesh and beans together.
   */
  offset: readonly [number, number, number];
  radius: number;
  count?: number;
  colour?: string;
  /** Instance radius. Smaller on a flat paddle so the pile reads as coffee. */
  grain?: number;
  /**
   * `wide-end` measures the loaded mesh and sits the heap on the broader
   * end (the spatula blade). Use that for elongated tools; bowls keep the
   * authored offset.
   */
  seat?: "offset" | "wide-end";
};

/** Where loose beans / grounds sit inside each prop that carries them. */
export const CARGO: Partial<
  Record<
    "scoop" | "filter" | "portafilter",
    CargoSpec
  >
> = {
  // Fitted cooking-spoon.glb (local, sibling of the yaw π group): the
  // diamond blade is the wide half on −X (−0.53..−0.27). +X is the handle
  // tip. Parent yaw then swings both the mesh and this heap to the right.
  scoop: {
    kind: "beans",
    offset: [-0.55, 0, 0.11],
    radius: 0.12,
    count: 18,
    colour: "#3b1f10",
    grain: 0.05,
    seat: "wide-end",
  },
  filter: {
    kind: "grounds",
    offset: [0, 0, 0.16],
    radius: 0.4,
    count: 22,
    colour: "#4a2812",
  },
  // After yaw π/2 the handle is +Y; the skillet well is the other way.
  portafilter: {
    kind: "grounds",
    offset: [0, -0.42, 0.2],
    radius: 0.36,
    count: 22,
    colour: "#4a2812",
  },
};
