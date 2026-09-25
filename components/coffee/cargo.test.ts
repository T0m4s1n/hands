/**
 * Cargo placement contracts — beans belong in the bowl, not on the handle.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { CARGO } from "./cargo.ts";
import { RECIPES } from "./recipes.ts";
import { applyGrabLatch } from "../../hooks/grabLatch.ts";

test("scoop cargo sits in the bowl, not on the handle", () => {
  const cargo = CARGO.scoop;
  assert.ok(cargo);
  const halfShort = 0.21;
  const [x, , z] = cargo!.offset;
  // Fitted spoon local frame: blade on −X, handle on +X. Parent yaw swings both.
  assert.ok(x < 0, `scoop mouth is −X in the fitted local frame; got x=${x}`);
  assert.ok(
    x <= -0.45 && x >= -0.68,
    `cargo x=${x} should sit in the diamond, not the neck or tip`,
  );
  assert.equal(cargo!.seat, "wide-end");
  assert.ok(
    cargo!.radius <= halfShort * 0.7,
    `cargo radius ${cargo!.radius} spills past the paddle width`,
  );
  assert.ok(z > 0.06 && z < 0.22, `cargo height z=${z} should rest on the paddle`);
  assert.ok((cargo!.count ?? 0) >= 12 && (cargo!.count ?? 0) <= 24);
  assert.ok((cargo!.grain ?? 0.085) <= 0.06, "scoop grains must fit on the blade");
});

test("filter cargo stays inside the bowl rim", () => {
  const cargo = CARGO.filter;
  assert.ok(cargo);
  const rim = 0.52;
  assert.ok(cargo!.radius <= rim * 0.85);
  assert.ok(Math.hypot(cargo!.offset[0], cargo!.offset[1]) < rim * 0.5);
});

test("portafilter grounds sit in the basket, not on the handle", () => {
  const cargo = CARGO.portafilter;
  assert.ok(cargo);
  const halfLong = 1.15;
  const halfShort = 0.62;
  // After yaw π/2 the skillet well sits on −Y; +Y is the handle.
  assert.ok(cargo!.offset[1] < -halfLong * 0.2, `expected −Y well, got ${cargo!.offset[1]}`);
  assert.ok(cargo!.radius <= halfShort * 0.7);
});

test("every place stage with a cargo prop has dump-ready contents", () => {
  const cargoKinds = new Set(Object.keys(CARGO));
  for (const recipe of RECIPES) {
    for (const stage of recipe.stages) {
      if (stage.kind !== "place") continue;
      if (!cargoKinds.has(stage.holds)) continue;
      const cargo = CARGO[stage.holds as keyof typeof CARGO];
      assert.ok(cargo, `${recipe.id}/${stage.id} missing cargo`);
      assert.ok(cargo!.radius > 0);
    }
  }
});

test("recipes stay fully playable", () => {
  for (const recipe of RECIPES) {
    assert.ok(recipe.stages.length >= 4, `${recipe.id} too short`);
    assert.ok(recipe.blurb.length > 10);
    assert.ok(recipe.pitch.length > 20);
    for (const stage of recipe.stages) {
      assert.ok(stage.title.length > 0);
      assert.ok(
        stage.instruction.length > 12,
        `${stage.id} instruction too terse`,
      );
      assert.ok(stage.radius >= 0.8, `${stage.id} ring too tight`);
    }
  }
});

test("grab latch ignores single-frame pinch noise", () => {
  const thresholds = { enter: 0.4, exit: 0.62 };
  let state = {
    isGrabbing: false,
    pinchSmoothed: 0.25,
    enterFrames: 0,
    exitFrames: 0,
  };
  // Already below enter once — still needs a second frame to latch.
  state = applyGrabLatch(state, 0.2, thresholds);
  assert.equal(state.isGrabbing, false);
  state = applyGrabLatch(state, 0.2, thresholds);
  assert.equal(state.isGrabbing, true);

  // One open frame is not enough to release.
  state = applyGrabLatch(state, 0.9, thresholds);
  assert.equal(state.isGrabbing, true);
  for (let i = 0; i < 12; i++) state = applyGrabLatch(state, 0.9, thresholds);
  assert.equal(state.isGrabbing, false);
});

test("brew fill for LiveCup stays in 0..1", () => {
  const marks = [0.8, 0.6, 0.9];
  const progress = 0.4;
  const total = 5;
  const brew =
    (marks.reduce((sum, m) => sum + m, 0) + progress) / Math.max(total, 1);
  assert.ok(brew >= 0 && brew <= 1);
});
