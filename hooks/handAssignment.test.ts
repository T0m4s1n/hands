import assert from "node:assert/strict";
import { assignHands } from "./handAssignment.ts";

type Hd = "Left" | "Right";
const at = (x: number, label: Hd) => ({ wrist: { x, y: 0.5, z: 0 }, label });
const R = 0.22;
const last = (l?: number, r?: number) => {
  const m = new Map<Hd, { x: number; y: number; z: number }>();
  if (l !== undefined) m.set("Left", { x: l, y: 0.5, z: 0 });
  if (r !== undefined) m.set("Right", { x: r, y: 0.5, z: 0 });
  return m;
};

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
  console.log("ok  duplicate labels on a fresh frame keep both hands");
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

console.log("\nall assignment tests passed");
