/**
 * Where a heap belongs on an elongated tool: on the blade, not the handle.
 *
 * Guessing a sign after a yaw is how beans ended up on the shaft. Measuring
 * the fitted vertices in the same local frame the cargo lives in does not.
 *
 * The widest slice of Kenney's spatula is the neck — where the diamond meets
 * the handle. The mouth is further toward the tip of that wide half.
 */

export type Point = { x: number; y: number; z: number };

const BINS = 10;
/** Distance from the tip toward the middle, as a fraction of that half. */
const SEAT = 0.32;

export function mouthOf(
  points: readonly Point[],
  lift = 0.08,
): [number, number, number] {
  if (points.length === 0) return [0, 0, lift];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let top = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
    if (point.z > top) top = point.z;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const axis: "x" | "y" = spanX >= spanY ? "x" : "y";
  const min = axis === "x" ? minX : minY;
  const max = axis === "x" ? maxX : maxY;
  const span = (max - min) || 1e-6;
  const mid = (min + max) / 2;

  const bins = Array.from({ length: BINS }, () => ({
    n: 0,
    minP: Infinity,
    maxP: -Infinity,
  }));

  for (const point of points) {
    const along = axis === "x" ? point.x : point.y;
    const perp = axis === "x" ? point.y : point.x;
    const index = Math.min(
      BINS - 1,
      Math.max(0, Math.floor(((along - min) / span) * BINS)),
    );
    const bin = bins[index];
    bin.n += 1;
    if (perp < bin.minP) bin.minP = perp;
    if (perp > bin.maxP) bin.maxP = perp;
  }

  let lowWidth = 0;
  let highWidth = 0;
  bins.forEach((bin, index) => {
    if (!bin.n) return;
    const width = bin.maxP - bin.minP;
    const centre = min + ((index + 0.5) / BINS) * span;
    if (centre < mid) lowWidth = Math.max(lowWidth, width);
    else highWidth = Math.max(highWidth, width);
  });

  const tip = lowWidth >= highWidth ? min : max;
  const along = tip + (mid - tip) * SEAT;
  return axis === "x" ? [along, 0, top + lift] : [0, along, top + lift];
}
