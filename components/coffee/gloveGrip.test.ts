import assert from "node:assert/strict";
import test from "node:test";
import { RECIPES, type PropKind } from "./recipes.ts";
import {
  composeFolds,
  emptyGloveHold,
  GRIPS,
  gripBlend,
  gripForTool,
  poseGloveFinger,
  seekHandle,
  thumbFollowsFingers,
  writeGloveHold,
} from "./gloveGrip.ts";

test("the thumb follows the other fingers, never its own noise", () => {
  assert.equal(thumbFollowsFingers(0, 0, 0, 0), 0);
  assert.ok(thumbFollowsFingers(1, 1, 1, 1) > 0.95);
  const half = thumbFollowsFingers(0.5, 0.5, 0.5, 0.5);
  assert.ok(half > 0.45 && half < 0.6);
});

test("every held tool has a designed grip", () => {
  const held = new Set<PropKind>();
  for (const recipe of RECIPES) {
    for (const stage of recipe.stages) held.add(stage.holds);
  }
  assert.ok(held.size >= 6);
  for (const tool of held) {
    assert.notEqual(gripForTool(tool), "free", tool);
  }
});

test("a live hand keeps its folds until it reaches a tool", () => {
  const live = [0.1, 0.2, 0.2, 0.2, 0.2];
  const open = composeFolds(live, GRIPS.free, 0);
  assert.ok(Math.abs(open[1] - 0.2) < 1e-6);
  const shaft = composeFolds(live, GRIPS.shaft, 1);
  assert.ok(shaft[2] > 0.8);
  assert.ok(shaft[0] >= thumbFollowsFingers(shaft[1], shaft[2], shaft[3], shaft[4]));
});

test("holding uses the full pose, reaching uses half of it", () => {
  assert.equal(gripBlend(false, false), 0);
  assert.ok(gripBlend(true, false) < 0.25);
  assert.equal(gripBlend(false, true), 1);
  assert.equal(seekHandle(true, false), 0);
  assert.equal(seekHandle(false, true), 1);
});

test("the thumb wraps across the palm instead of spinning on its rest", () => {
  const spec = { x: -0.2, y: 0.04, z: 0.03, spread: 0.82, thumb: true };
  const open = poseGloveFinger(spec, 0, 0, 0);
  const shut = poseGloveFinger(spec, 1, 1, 0);
  assert.ok(shut.position[0] > open.position[0]);
  assert.ok(Math.abs(shut.rotation[2]) < 1.2);
  assert.ok(shut.rotation[1] > open.rotation[1]);
});

test("writeGloveHold clears and publishes without allocating", () => {
  const hold = emptyGloveHold();
  writeGloveHold(hold, {
    handedness: "Right",
    tool: "crank",
    near: true,
    holding: true,
    gripX: 1,
    gripY: 2,
    gripZ: 0.5,
    dump: 0,
  });
  assert.equal(hold.tool, "crank");
  assert.equal(hold.handedness, "Right");
  writeGloveHold(hold, null);
  assert.equal(hold.holding, false);
  assert.equal(hold.tool, null);
});
