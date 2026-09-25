import assert from "node:assert/strict";
import test from "node:test";
import { stageCue } from "./stageCue.ts";

test("cue leads the player from finding to grabbing to acting", () => {
  assert.match(
    stageCue({
      kind: "place",
      near: false,
      holding: false,
      working: false,
      pointer: false,
    }),
    /utensilio|brilla/i,
  );
  assert.match(
    stageCue({
      kind: "place",
      near: true,
      holding: false,
      working: false,
      pointer: true,
    }),
    /clic/i,
  );
  assert.match(
    stageCue({
      kind: "place",
      sits: "grinder",
      near: false,
      holding: true,
      working: false,
      pointer: false,
    }),
    /llévalo/i,
  );
  assert.match(
    stageCue({
      kind: "place",
      near: true,
      holding: true,
      working: false,
      pointer: true,
    }),
    /destino|encima/i,
  );
});

test("active pour cue teaches the scoring target", () => {
  assert.match(
    stageCue({
      kind: "tilt",
      near: true,
      holding: true,
      working: true,
      pointer: false,
    }),
    /franja/i,
  );
});
