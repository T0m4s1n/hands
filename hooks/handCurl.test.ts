import assert from "node:assert/strict";
import test from "node:test";
import {
  fingerFold,
  grabClosure,
  gloveFolds,
  handFist,
} from "./handCurl.ts";

const open = { x: 0, y: 0, z: 0 };
const pip = { x: 0, y: 0.4, z: 0 };
const tip = { x: 0, y: 0.8, z: 0 };
const fistTip = { x: 0, y: 0.05, z: 0.12 };

test("a straight finger does not fold", () => {
  assert.equal(fingerFold(open, pip, tip), 0);
});

test("a tip pulled back onto the knuckle reads as a fist fold", () => {
  assert.ok(fingerFold(open, pip, fistTip) > 0.85);
});

test("a webcam fist that only collapses in the image still folds", () => {
  const mcp = { x: 0, y: 0, z: 0 };
  const pip = { x: 0.03, y: 0.06, z: -0.1 };
  const tip = { x: -0.01, y: 0.02, z: -0.14 };
  assert.ok(fingerFold(mcp, pip, tip) > 0.65);
});

test("an empty cloud is an open hand", () => {
  assert.equal(handFist(undefined), 0);
  assert.deepEqual(gloveFolds(undefined, false), [0, 0, 0, 0, 0]);
});

test("a confirmed grab still puts a floor under every finger", () => {
  const folds = gloveFolds(undefined, true);
  for (const fold of folds) assert.ok(fold >= 0.7);
});

test("a closed fist is as grabby as a pinch", () => {
  assert.ok(grabClosure(0.8, 0.85) < 0.2);
  assert.ok(grabClosure(0.15, 0.1) < 0.2);
  assert.ok(grabClosure(0.8, 0.1) > 0.7);
  assert.ok(grabClosure(0.75, 0.5) > 0.55);
  assert.ok(grabClosure(0.75, 0.9) < 0.25);
});
