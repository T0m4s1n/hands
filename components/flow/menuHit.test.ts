import assert from "node:assert/strict";
import test from "node:test";
import { hitMenuOption, type MenuHitBox } from "./menuHit.ts";

const boxes: MenuHitBox[] = [
  { i: 0, left: 0, right: 100, top: 0, bottom: 40 },
  { i: 1, left: 0, right: 100, top: 50, bottom: 90 },
  { i: 2, left: 0, right: 100, top: 100, bottom: 140 },
];

test("a tip on a row selects that café", () => {
  assert.equal(hitMenuOption(40, 20, boxes), 0);
  assert.equal(hitMenuOption(40, 70, boxes), 1);
});

test("a sticky row survives a small twitch off the name", () => {
  assert.equal(hitMenuOption(40, 44, boxes, 0), 0);
  assert.equal(hitMenuOption(40, 70, boxes, 0), 1);
});

test("empty space is not a café", () => {
  assert.equal(hitMenuOption(200, 200, boxes, 1), -1);
});
