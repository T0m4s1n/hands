import assert from "node:assert/strict";
import test from "node:test";
import {
  COAST_FOR_MS,
  IDENTITY_MEMORY_MS,
  MATCH_RADIUS,
  smoothLandmarks,
  trackFrame,
  type PersistedHand,
  type TrackedDetection,
} from "./trackFrame.ts";

const THRESHOLDS = { enter: 0.4, exit: 0.62 };

const OPEN_HAND: { x: number; y: number; z: number }[] = [
  { x: 0.3, y: 0.6, z: 0 },
  { x: 0.26, y: 0.54, z: 0 },
  { x: 0.23, y: 0.48, z: 0 },
  { x: 0.21, y: 0.43, z: 0 },
  { x: 0.2, y: 0.38, z: 0 },
  { x: 0.28, y: 0.42, z: 0 },
  { x: 0.28, y: 0.34, z: 0 },
  { x: 0.28, y: 0.28, z: 0 },
  { x: 0.28, y: 0.22, z: 0 },
  { x: 0.32, y: 0.4, z: 0 },
  { x: 0.32, y: 0.32, z: 0 },
  { x: 0.32, y: 0.26, z: 0 },
  { x: 0.32, y: 0.2, z: 0 },
  { x: 0.36, y: 0.42, z: 0 },
  { x: 0.36, y: 0.35, z: 0 },
  { x: 0.36, y: 0.29, z: 0 },
  { x: 0.36, y: 0.24, z: 0 },
  { x: 0.4, y: 0.45, z: 0 },
  { x: 0.4, y: 0.4, z: 0 },
  { x: 0.4, y: 0.36, z: 0 },
  { x: 0.4, y: 0.32, z: 0 },
];

function detection(
  x: number,
  label: "Left" | "Right",
  score = 0.9,
  y = 0.6,
): TrackedDetection {
  const raw = OPEN_HAND.map((point) => ({
    ...point,
    x: point.x + (x - 0.3),
    y: point.y + (y - 0.6),
  }));
  return { raw, wrist: raw[0], label, labelScore: score };
}

test("smoothLandmarks settles in the same wall-clock time at any tick rate", () => {
  const start = OPEN_HAND;
  const target = OPEN_HAND.map((point) => ({ ...point, x: point.x + 0.2 }));
  const a = smoothLandmarks(start, target, 1 / 24);
  const b = smoothLandmarks(
    smoothLandmarks(start, target, 1 / 72),
    target,
    1 / 36,
  );
  assert.ok(Math.abs(a[0].x - b[0].x) < 0.002);
});

test("a flipped MediaPipe label does not steal the play hand", () => {
  const persist = new Map<"Left" | "Right", PersistedHand>();
  trackFrame(persist, [detection(0.3, "Left")], 1 / 24, THRESHOLDS);
  const next = trackFrame(
    persist,
    [detection(0.31, "Right", 0.95)],
    1 / 24,
    THRESHOLDS,
  );
  assert.equal(next.length, 1);
  assert.equal(next[0].handedness, "Left");
  assert.ok(next[0].smoothedLandmarks[0].x < 0.4);
});

test("a lone right hand is not kept as left", () => {
  const persist = new Map<"Left" | "Right", PersistedHand>();
  trackFrame(persist, [detection(0.28, "Left", 0.4)], 1 / 24, THRESHOLDS);
  let next = trackFrame(
    persist,
    [detection(0.29, "Right", 0.9)],
    1 / 24,
    THRESHOLDS,
  );
  for (let i = 0; i < 5; i += 1) {
    next = trackFrame(
      persist,
      [detection(0.29, "Right", 0.9)],
      1 / 24,
      THRESHOLDS,
    );
  }
  assert.equal(next.length, 1);
  assert.equal(next[0].handedness, "Right");
});

test("coasting keeps a hand live long enough to finish a blink", () => {
  const persist = new Map<"Left" | "Right", PersistedHand>();
  trackFrame(persist, [detection(0.3, "Left")], 1 / 24, THRESHOLDS);
  const coast = trackFrame(persist, [], 1 / 24, THRESHOLDS);
  assert.equal(coast.length, 1);
  assert.equal(coast[0].tracking, "coasting");
  assert.equal(coast[0].handedness, "Left");
});

test("identity survives after the visual coast ends", () => {
  const persist = new Map<"Left" | "Right", PersistedHand>();
  trackFrame(persist, [detection(0.3, "Left")], 1 / 24, THRESHOLDS);
  let visible = 0;
  let elapsed = 0;
  while (elapsed < IDENTITY_MEMORY_MS - 80) {
    const dt = 1 / 24;
    const hands = trackFrame(persist, [], dt, THRESHOLDS);
    elapsed += dt * 1000;
    if (hands.length) visible = elapsed;
  }
  assert.ok(visible >= COAST_FOR_MS - 80);
  assert.ok(visible < IDENTITY_MEMORY_MS);
  assert.equal(persist.has("Left"), true);
  const back = trackFrame(
    persist,
    [detection(0.32, "Right", 0.99)],
    1 / 24,
    THRESHOLDS,
  );
  assert.equal(back[0].handedness, "Left");
});

test("MATCH_RADIUS stays wide enough for a natural wrist step", () => {
  assert.ok(MATCH_RADIUS >= 0.25);
});

test("a crowd around the barista does not steal the play hand", () => {
  const persist = new Map<"Left" | "Right", PersistedHand>();
  trackFrame(persist, [detection(0.3, "Left")], 1 / 24, THRESHOLDS);
  const next = trackFrame(
    persist,
    [
      detection(0.31, "Left"),
      detection(0.16, "Left"),
      detection(0.44, "Right"),
    ],
    1 / 24,
    THRESHOLDS,
  );
  assert.equal(next.length, 1);
  assert.ok(next[0].smoothedLandmarks[0].x < 0.4);
});

test("when the player leaves, a far palm does not inherit the glove", () => {
  const persist = new Map<"Left" | "Right", PersistedHand>();
  trackFrame(persist, [detection(0.3, "Left")], 1 / 24, THRESHOLDS);
  const next = trackFrame(
    persist,
    [detection(0.92, "Left", 0.9, 0.08)],
    1 / 24,
    THRESHOLDS,
  );
  assert.equal(next.length, 1);
  assert.equal(next[0].tracking, "coasting");
  assert.ok(Math.abs(next[0].smoothedLandmarks[0].x - 0.3) < 0.06);
});

test("never publishes more than one hand, even when four are detected", () => {
  const persist = new Map<"Left" | "Right", PersistedHand>();
  const next = trackFrame(
    persist,
    [
      detection(0.28, "Left"),
      detection(0.52, "Right"),
      detection(0.24, "Left"),
      detection(0.48, "Right"),
    ],
    1 / 24,
    THRESHOLDS,
  );
  assert.ok(next.length <= 1);
});

test("published wrist follows the live camera, not the lagged shape", () => {
  const persist = new Map<"Left" | "Right", PersistedHand>();
  trackFrame(persist, [detection(0.3, "Left")], 1 / 24, THRESHOLDS);
  const next = trackFrame(
    persist,
    [detection(0.52, "Left")],
    1 / 24,
    THRESHOLDS,
  );
  assert.ok(Math.abs(next[0].smoothedLandmarks[0].x - 0.52) < 0.012);
});
