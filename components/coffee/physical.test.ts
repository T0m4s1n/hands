import assert from "node:assert/strict";
import {
  capacity,
  fallTime,
  fillRatio,
  LIQUIDS,
  pour,
  streamPoint,
  surfaceHeight,
  type Vessel,
} from "./liquid.ts";
import {
  carryRate,
  landingKick,
  overlap,
  reach,
  restOn,
  settleHeight,
  type Placed,
  type Shape,
} from "./solid.ts";

const near = (a: number, b: number, slack = 1e-6) =>
  assert.ok(Math.abs(a - b) <= slack, `${a} is not within ${slack} of ${b}`);

const cup: Vessel = { radius: 0.4, floor: 0.1, depth: 0.5 };

/* ---------- liquid ---------- */

// 1. A vessel holds what its inside measures, and the level tracks it.
{
  near(capacity(cup), Math.PI * 0.16 * 0.5, 1e-9);
  near(surfaceHeight(cup, 0), 0.1);
  near(surfaceHeight(cup, capacity(cup)), 0.6, 1e-9);
  near(surfaceHeight(cup, capacity(cup) / 2), 0.35, 1e-9);
  // Overfilled, the surface still stops at the rim.
  near(surfaceHeight(cup, capacity(cup) * 5), 0.6, 1e-9);
  near(fillRatio(cup, capacity(cup) * 5), 1);
  console.log("ok  a level follows the volume and stops at the rim");
}

// 2. Pouring moves exactly what it takes: the jug loses what the cup gains.
{
  const room = capacity(cup);
  const out = pour({ from: 1, into: 0, room, amount: 0.05 });
  near(out.from, 0.95);
  near(out.into, 0.05);
  near(out.moved, 0.05);
  assert.equal(out.spilled, 0);
  console.log("ok  what leaves the jug is what arrives in the cup");
}

// 3. An empty jug pours nothing, however far it is tipped.
{
  const out = pour({ from: 0, into: 0.2, room: 1, amount: 0.5 });
  assert.equal(out.moved, 0);
  assert.equal(out.from, 0);
  near(out.into, 0.2);
  console.log("ok  an empty jug pours nothing");
}

// 4. A full cup spills the rest rather than swallowing it.
{
  const out = pour({ from: 1, into: 0.9, room: 1, amount: 0.4 });
  near(out.into, 1, 1e-9);
  near(out.moved, 0.1, 1e-9);
  near(out.spilled, 0.3, 1e-9);
  near(out.from, 0.6, 1e-9);
  assert.ok(out.into <= 1, "never above capacity");
  console.log("ok  overfilling spills instead of vanishing");
}

// 5. Nothing is ever created or destroyed across a pour.
{
  for (const amount of [0, 0.01, 0.3, 5]) {
    for (const start of [0, 0.4, 1]) {
      const out = pour({ from: 1, into: start, room: 1, amount });
      const before = 1 + start;
      const after = out.from + out.into + out.spilled;
      near(after, before, 1e-9);
    }
  }
  console.log("ok  pouring conserves what there was");
}

// 6. Every liquid is visually distinct where it matters.
{
  const colours = new Set(Object.values(LIQUIDS).map((l) => l.colour));
  assert.equal(colours.size, Object.keys(LIQUIDS).length, "no two look alike");
  assert.ok(LIQUIDS.water.opacity < 1, "water is see-through");
  assert.equal(LIQUIDS.milk.opacity, 1, "milk is not");
  assert.ok(LIQUIDS.coffee.skin, "coffee grows a crema");
  assert.equal(LIQUIDS.water.skin, null, "water does not");
  assert.ok(LIQUIDS.foam.thickness > LIQUIDS.water.thickness);
  console.log("ok  the liquids can be told apart");
}

// 7. A stream arcs, and takes longer to fall from higher up.
{
  const start = [0, 0, 1] as const;
  const v = [0.6, 0, 0] as const;
  const p0 = streamPoint(start, v, 0);
  near(p0[0], 0);
  near(p0[2], 1);
  const p1 = streamPoint(start, v, 0.3);
  assert.ok(p1[0] > 0, "it travels forward");
  assert.ok(p1[2] < 1, "and falls while it does");

  assert.equal(fallTime(0), 0);
  assert.ok(fallTime(1.2) > fallTime(0.3), "higher takes longer");
  // Landing at the fall time really does put it on the surface.
  const t = fallTime(1);
  near(streamPoint([0, 0, 1], [0, 0, 0], t)[2], 0, 1e-9);
  console.log("ok  a pour follows an arc and lands when it should");
}

/* ---------- solids ---------- */

const round: Shape = { kind: "round", radius: 0.5, height: 0.6 };
const slab: Shape = { kind: "slab", halfLong: 0.8, halfShort: 0.2, height: 0.1 };
const open: Shape = {
  kind: "open",
  radius: 0.9,
  height: 0.5,
  rim: 0.7,
  floor: 0.08,
};

// 8. A collider is the size of the thing, not of a box around it.
{
  assert.equal(reach(round), 0.5);
  assert.equal(reach(slab), 0.8, "a spoon reaches along its handle");
  // A spoon's own width is a quarter of its length; a box would have claimed
  // the whole square and kept anything from being set down beside it.
  assert.ok(slab.halfShort * 4 <= slab.halfLong);
  console.log("ok  shapes follow the object rather than a generic box");
}

// 9. Things rest on top of what is under them, and only when over it.
{
  assert.equal(restOn(round, 0, 0, 0), 0.6);
  assert.equal(restOn(round, 0.2, 0, 0), 0.8, "stacked on a raised base");
  assert.equal(restOn(round, 0, 0.9, 0), null, "not over it at all");
  assert.equal(restOn(slab, 0, 0.7, 0), 0.1, "along the handle");
  assert.equal(restOn(slab, 0, 0, 0.5), null, "off the side of it");
  console.log("ok  support is only offered where there is something under it");
}

// 10. An open vessel takes things inside it, not on top of it.
{
  assert.equal(restOn(open, 0, 0, 0), 0.08, "down to the inner floor");
  assert.equal(restOn(open, 0, 0.8, 0), 0.5, "perched on the rim");
  assert.equal(restOn(open, 0, 1.2, 0), null, "clear of it");
  console.log("ok  a cup dropped in a bowl lands in the bowl");
}

// 11. Dropping something always puts it down on the highest thing under it.
{
  const supports: Placed[] = [
    { x: 0, y: 0, z: 0, shape: round },
    { x: 3, y: 0, z: 0, shape: slab },
  ];
  assert.equal(settleHeight(0, 0, 0, supports), 0.6, "onto the tall one");
  assert.equal(settleHeight(3, 0, 0, supports), 0.1, "onto the flat one");
  assert.equal(settleHeight(9, 9, 0, supports), 0, "onto the counter");
  assert.equal(settleHeight(9, 9, -0.4, supports), -0.4, "counter can be lower");
  console.log("ok  nothing is ever left floating where it was released");
}

// 12. Two things at the same height are pushed apart; stacked ones are not.
{
  const a: Placed = { x: 0.4, y: 0, z: 0, shape: round };
  const b: Placed = { x: 0, y: 0, z: 0, shape: round };
  const hit = overlap(a, b);
  assert.ok(hit, "these do overlap");
  near(hit!.by, 0.6, 1e-9);
  near(hit!.dx, 1);
  near(hit!.dy, 0);

  const far: Placed = { x: 4, y: 0, z: 0, shape: round };
  assert.equal(overlap(far, b), null, "well clear");

  const stacked: Placed = { x: 0, y: 0, z: 0.6, shape: round };
  assert.equal(overlap(stacked, b), null, "standing on it, not through it");
  console.log("ok  side by side is separated, stacked is left alone");
}

// 13. Dead centre on top of each other still resolves, rather than dividing by
//     zero and sending something to NaN.
{
  const a: Placed = { x: 0, y: 0, z: 0, shape: round };
  const b: Placed = { x: 0, y: 0, z: 0, shape: round };
  const hit = overlap(a, b);
  assert.ok(hit);
  assert.ok(Number.isFinite(hit!.dx) && Number.isFinite(hit!.dy));
  near(Math.hypot(hit!.dx, hit!.dy), 1);
  console.log("ok  perfectly overlapping objects still separate cleanly");
}

// 14. A small thing inside an open vessel is left where it is.
{
  const bowl: Placed = { x: 0, y: 0, z: 0, shape: open };
  const pestle: Placed = {
    x: 0.2,
    y: 0,
    z: 0.08,
    shape: { kind: "round", radius: 0.15, height: 0.8 },
  };
  assert.equal(overlap(pestle, bowl), null, "it belongs in there");
  console.log("ok  something standing in a bowl is not pushed out of it");
}

// 15. Weight shows up as drag and as a thump.
{
  assert.ok(carryRate(1) > carryRate(3), "a heavy thing lags behind a light one");
  assert.ok(carryRate(3) > 0, "but still follows");
  assert.equal(carryRate(0.2), carryRate(1), "mass below one is not a speed-up");

  assert.equal(landingKick(2, 0), 0, "set down gently, nothing happens");
  assert.ok(landingKick(3, 4) > landingKick(1, 4), "heavier lands harder");
  assert.ok(landingKick(3, 400) <= 1.4, "and it never goes through the roof");
  console.log("ok  heavy things drag behind the hand and land harder");
}
