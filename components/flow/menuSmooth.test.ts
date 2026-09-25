import assert from "node:assert/strict";
import test from "node:test";
import {
  CURSOR_DEAD,
  emptyCursorSmooth,
  seedCursor,
  stepMenuCursor,
} from "./menuSmooth.ts";

test("the first sample snaps so a new lock does not ease from afar", () => {
  const state = emptyCursorSmooth();
  const next = stepMenuCursor(state, { x: 0.22, y: 0.41 }, 1 / 60);
  assert.equal(next.x, 0.22);
  assert.equal(next.y, 0.41);
});

test("detector tremor under the deadzone barely moves the reticle", () => {
  const state = emptyCursorSmooth();
  seedCursor(state, 0.5, 0.5);
  const hop = CURSOR_DEAD * 0.4;
  stepMenuCursor(state, { x: 0.5 + hop, y: 0.5 }, 1 / 60);
  assert.ok(Math.abs(state.x - 0.5) < hop * 0.2);
});

test("a swipe closes much more of the gap than a shake", () => {
  const still = emptyCursorSmooth();
  const swipe = emptyCursorSmooth();
  seedCursor(still, 0.5, 0.5);
  seedCursor(swipe, 0.5, 0.5);
  stepMenuCursor(still, { x: 0.51, y: 0.5 }, 1 / 60);
  stepMenuCursor(swipe, { x: 0.72, y: 0.5 }, 1 / 60);
  const stillClosed = Math.abs(still.x - 0.5);
  const swipeClosed = Math.abs(swipe.x - 0.5);
  assert.ok(swipeClosed > stillClosed * 4);
  assert.ok(swipeClosed < 0.22 * 0.55, "a swipe must not snap the whole way");
});

test("the same wall-clock swipe lands in the same place at any tick rate", () => {
  const a = emptyCursorSmooth();
  const b = emptyCursorSmooth();
  seedCursor(a, 0.2, 0.5);
  seedCursor(b, 0.2, 0.5);
  stepMenuCursor(a, { x: 0.8, y: 0.5 }, 1 / 30);
  stepMenuCursor(b, { x: 0.8, y: 0.5 }, 1 / 60);
  stepMenuCursor(b, { x: 0.8, y: 0.5 }, 1 / 60);
  assert.ok(Math.abs(a.x - b.x) < 0.004);
});
