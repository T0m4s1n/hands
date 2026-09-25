import assert from "node:assert/strict";
import { test } from "node:test";
import { RECIPES } from "./recipes.ts";
import {
  DRIPPER,
  GROUP,
  brewAt,
  dripperPark,
  dripperSeatZ,
  dripperVessel,
  usesDripper,
  usesGroup,
} from "./leftover.ts";

test("the dripper bed sits in the cone, above the glass", () => {
  assert.ok(DRIPPER.heap[2] > 0.85, "grounds belong in the dripper, not the carafe");
  assert.ok(DRIPPER.bed > DRIPPER.heap[2], "the pour lands on the bed");
  assert.ok(DRIPPER.radius < 0.4, "the heap must fit inside the cone");
});

test("the filter bowl parks on the cone, not through the carafe", () => {
  const tinto = RECIPES.find((recipe) => recipe.id === "tinto");
  const place = tinto!.stages.find((stage) => stage.id === "filter")!;
  assert.ok(DRIPPER.seat > 0.9, "must clear the glass body");
  assert.ok(DRIPPER.seat < DRIPPER.bed + 0.08, "must sit in the cone, not hover");
  assert.equal(dripperSeatZ(place, 0.2, 1.2, 0.12), DRIPPER.seat);
  assert.equal(dripperSeatZ(place, 2.4, 1.2, 0.12), 0.12, "away from the glass it is on the table");
  const parked = dripperPark(place, [0, 0.1]);
  assert.ok(parked[0] < 0, "the bowl sits left of the glass origin");
  assert.ok(parked[0] > -0.5, "still over the cone, not beside it");
});

test("coffee fills the glass body under the dripper", () => {
  const vessel = dripperVessel({ radius: 0.31, floor: 0.09, depth: 1.18 });
  assert.ok(vessel.depth <= 0.8);
  assert.ok(vessel.floor + vessel.depth < DRIPPER.heap[2]);
});

test("tinto doses the dripper, then pours through it — no bowl left on the glass", () => {
  const tinto = RECIPES.find((recipe) => recipe.id === "tinto");
  assert.ok(tinto);
  const place = tinto!.stages.find((stage) => stage.id === "filter");
  const pour = tinto!.stages.find((stage) => stage.id === "pour");
  assert.ok(place && pour);
  assert.equal(place!.holds, "filter");
  assert.equal(place!.sits, "brewer");
  assert.equal(pour!.sits, "brewer");
  assert.deepEqual(place!.target, pour!.target);
  assert.equal(usesDripper(place!), true);
  assert.equal(usesDripper(pour!), true);
});

test("espresso locks under the group and fills the cup in front", () => {
  const espresso = RECIPES.find((recipe) => recipe.id === "espresso");
  assert.ok(espresso);
  const extract = espresso!.stages.find((stage) => stage.id === "extract");
  assert.ok(extract);
  assert.equal(usesGroup(extract!), true);
  assert.equal(extract!.vessel, "mug");
  const cup = brewAt(extract!);
  assert.ok(cup[1] < extract!.target[1], "the cup sits toward the camera");
  assert.ok(GROUP.lock[2] > 0.8, "the portafilter seats under the group, not on the table");
  assert.ok(GROUP.spouts[0][2] > GROUP.lock[2], "espresso falls from the group into the cup");
  const cap = RECIPES.find((recipe) => recipe.id === "capuchino")!.stages.find(
    (stage) => stage.id === "extract",
  );
  assert.equal(usesGroup(cap!), true);
});
