import assert from "node:assert/strict";
import {
  anatomicalHandedness,
  assignHands,
  fuseHandedness,
  landmarkChirality,
  MAX_TRACKED_HANDS,
  selectPersonHands,
} from "./handAssignment.ts";

type Hd = "Left" | "Right";
const at = (x: number, label: Hd) => ({ wrist: { x, y: 0.5, z: 0 }, label });
const R = 0.22;
const last = (l?: number, r?: number) => {
  const m = new Map<Hd, { x: number; y: number; z: number }>();
  if (l !== undefined) m.set("Left", { x: l, y: 0.5, z: 0 });
  if (r !== undefined) m.set("Right", { x: r, y: 0.5, z: 0 });
  return m;
};

function handCloud(side: "Left" | "Right") {
  const sign = side === "Right" ? 1 : -1;
  const wrist = { x: 0.5, y: 0.7, z: 0 };
  const points = Array.from({ length: 21 }, () => ({ ...wrist }));
  points[0] = wrist;
  points[5] = { x: 0.5 - 0.12 * sign, y: 0.45, z: -0.02 };
  points[9] = { x: 0.5, y: 0.42, z: -0.03 };
  points[17] = { x: 0.5 + 0.12 * sign, y: 0.48, z: -0.02 };
  points[4] = { x: 0.5 - 0.2 * sign, y: 0.55, z: -0.01 };
  points[2] = { ...points[4] };
  return points;
}

assert.equal(landmarkChirality(handCloud("Right"))?.label, "Right");
assert.equal(landmarkChirality(handCloud("Left"))?.label, "Left");
assert.equal(fuseHandedness("Left", 0.4, handCloud("Right")).label, "Right");
assert.equal(fuseHandedness("Left", 0.92, handCloud("Right")).label, "Left");
console.log("ok  skeleton chirality knows left from right");

assert.equal(MAX_TRACKED_HANDS, 2);

{
  const pair = selectPersonHands([at(0.3, "Left"), at(0.58, "Right")]);
  assert.equal(pair.length, 2, "one person's two hands stay");
}

{
  const mixed = selectPersonHands([
    { wrist: { x: 0.16, y: 0.22, z: 0 }, label: "Left" },
    { wrist: { x: 0.84, y: 0.78, z: 0 }, label: "Right" },
  ]);
  assert.equal(mixed.length, 1, "two strangers each showing one hand become one");
}

{
  const four = selectPersonHands([
    { wrist: { x: 0.28, y: 0.62, z: 0 }, label: "Left" },
    { wrist: { x: 0.52, y: 0.6, z: 0 }, label: "Right" },
    { wrist: { x: 0.24, y: 0.18, z: 0 }, label: "Left" },
    { wrist: { x: 0.48, y: 0.2, z: 0 }, label: "Right" },
  ]);
  assert.equal(four.length, 2);
  const ys = four.map((hand) => hand.wrist.y);
  assert.ok(
    ys.every((y) => y > 0.5) || ys.every((y) => y < 0.35),
    "the pair is one person, not one hand from each",
  );
}

{
  const locked = selectPersonHands(
    [
      { wrist: { x: 0.28, y: 0.62, z: 0 }, label: "Left" },
      { wrist: { x: 0.52, y: 0.6, z: 0 }, label: "Right" },
      { wrist: { x: 0.24, y: 0.18, z: 0 }, label: "Left" },
      { wrist: { x: 0.48, y: 0.2, z: 0 }, label: "Right" },
    ],
    last(0.3, 0.5),
  );
  assert.equal(locked.length, 2);
  assert.ok(
    locked.every((hand) => hand.wrist.y > 0.5),
    "the already-tracked person keeps the gloves",
  );
}
console.log("ok  only one person, at most two hands");

assert.equal(anatomicalHandedness("Left", true), "Left");
assert.equal(anatomicalHandedness("Left", false), "Right");
assert.equal(anatomicalHandedness("Right", true), "Right");
console.log("ok  handedness follows the explicit mirror contract");

// 1. Nothing tracked yet: the label decides.
{
  const out = assignHands([at(0.3, "Left"), at(0.7, "Right")], last(), R);
  assert.equal(out.get("Left")!.wrist.x, 0.3);
  assert.equal(out.get("Right")!.wrist.x, 0.7);
  console.log("ok  fresh hands use the label");
}

// 2. THE REGRESSION: labels flip but the hands have barely moved. Identity must
//    follow position, not the flipped label.
{
  const out = assignHands(
    [at(0.32, "Right"), at(0.68, "Left")],
    last(0.3, 0.7),
    R,
  );
  assert.equal(out.get("Left")!.wrist.x, 0.32, "left kept its own hand");
  assert.equal(out.get("Right")!.wrist.x, 0.68, "right kept its own hand");
  console.log("ok  flipped labels do not swap the hands");
}

// 3. THE DROP: both detections carry the same label. Neither may be discarded.
{
  const out = assignHands(
    [at(0.31, "Left"), at(0.69, "Left")],
    last(0.3, 0.7),
    R,
  );
  assert.equal(out.size, 2, "both hands still assigned");
  assert.equal(out.get("Left")!.wrist.x, 0.31);
  assert.equal(out.get("Right")!.wrist.x, 0.69);
  console.log("ok  duplicate labels keep both hands");
}

// 4. Same label with nothing tracked: the second falls back to the free side
//    rather than being dropped.
{
  const out = assignHands([at(0.3, "Left"), at(0.7, "Left")], last(), R);
  assert.equal(out.size, 2);
  assert.equal(out.get("Left")!.wrist.x, 0.3, "leftmost duplicate sits in Left");
  assert.equal(out.get("Right")!.wrist.x, 0.7, "rightmost duplicate sits in Right");
  console.log("ok  duplicate labels on a fresh frame keep both hands");
}

{
  const out = assignHands([at(0.28, "Right"), at(0.74, "Right")], last(), R);
  assert.equal(out.get("Left")!.wrist.x, 0.28);
  assert.equal(out.get("Right")!.wrist.x, 0.74);
  console.log("ok  two Right labels still split by side of the frame");
}

// 5. A hand that jumps further than the match radius is treated as a new hand,
//    so a genuine swap of which hand is on screen still resolves by label.
{
  const out = assignHands([at(0.9, "Right")], last(0.3), R);
  assert.equal(out.get("Right")!.wrist.x, 0.9);
  assert.equal(out.has("Left"), false, "the far hand is not claimed as Left");
  console.log("ok  a far jump is not matched by continuity");
}

// 6. One hand tracked, one detection nearby: it stays that hand even when the
//    label says otherwise.
{
  const out = assignHands([at(0.34, "Right")], last(0.3), R);
  assert.equal(out.has("Left"), true);
  assert.equal(out.has("Right"), false);
  console.log("ok  a lone hand keeps its identity through a label flip");
}

// 7. Hands crossing over: each still claims its nearest.
{
  const out = assignHands(
    [at(0.45, "Left"), at(0.55, "Right")],
    last(0.44, 0.56),
    R,
  );
  assert.equal(out.get("Left")!.wrist.x, 0.45);
  assert.equal(out.get("Right")!.wrist.x, 0.55);
  console.log("ok  hands close together keep their own identity");
}

// 8. Both detections land near the Right hand. Taking hands in order lets Left
//    grab the closer one first; settling the globally closest pair keeps that
//    detection with the hand it actually belongs to.
{
  const out = assignHands(
    [at(0.58, "Right"), at(0.62, "Right")],
    last(0.4, 0.6),
    R,
  );
  assert.equal(out.get("Right")!.wrist.x, 0.58, "right keeps the nearest");
  assert.equal(out.size, 2, "the other detection still gets a hand");
  console.log("ok  the closest pair wins over hand order");
}

// 9. At the exact crossing point, last position alone would swap identities.
//    Motion prediction keeps each anatomical hand travelling in its direction.
{
  const memory = new Map<Hd, {
    wrist: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
  }>([
    ["Left", {
      wrist: { x: 0.48, y: 0.5, z: 0 },
      velocity: { x: 0.08, y: 0, z: 0 },
    }],
    ["Right", {
      wrist: { x: 0.52, y: 0.5, z: 0 },
      velocity: { x: -0.08, y: 0, z: 0 },
    }],
  ]);
  const out = assignHands(
    [at(0.42, "Right"), at(0.58, "Left")],
    memory,
    R,
  );
  assert.equal(out.get("Left")!.wrist.x, 0.58);
  assert.equal(out.get("Right")!.wrist.x, 0.42);
  console.log("ok  crossing hands keep identity from motion");
}

console.log("\nall assignment tests passed");
