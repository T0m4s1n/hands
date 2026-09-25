import assert from "node:assert/strict";
import test from "node:test";
import { RECIPES } from "./recipes.ts";
import {
  crankGrabReach,
  overStation,
  stageStation,
  stationOf,
  stationQuality,
} from "./station.ts";

test("the mill body is enough to grab the crank", () => {
  assert.equal(crankGrabReach(1.6, 0.4), 0);
  assert.ok(crankGrabReach(0.2, 2.4) < 0.3);
  assert.ok(crankGrabReach(2.2, 2.2) > 1);
});

test("landing in the grinder bowl is a complete dose, not a bullseye hunt", () => {
  const grinder = stationOf("grinder");
  assert.equal(stationQuality(0, grinder), 1);
  assert.equal(stationQuality(0.7, grinder), 1);
  assert.ok(stationQuality(grinder.well + 0.05, grinder) >= 0.8);
  assert.equal(stationQuality(grinder.mouth + 0.2, grinder), 0);
  assert.equal(overStation(1.1, grinder), true);
  assert.equal(overStation(2.4, grinder), false);
});

test("a cup anywhere on the saucer is served", () => {
  const saucer = stationOf("saucer");
  assert.equal(stationQuality(0.4, saucer), 1);
  assert.ok(overStation(1.0, saucer));
  assert.equal(overStation(2.0, saucer), false);
});

test("pouring needs the mouth of the cup, not a tiny centre dot", () => {
  const pour = stageStation("tilt", "mug");
  assert.ok(overStation(0.9, pour), "a jug roughly over the cup still pours");
  assert.equal(overStation(1.8, pour), false);
});

test("locking the portafilter uses the machine body, not a painted ring", () => {
  const machine = stationOf("machine");
  assert.ok(overStation(1.0, machine));
  assert.equal(stationQuality(0.5, machine), 1);
});

test("every stage has a station that can actually be reached", () => {
  for (const recipe of RECIPES) {
    for (const stage of recipe.stages) {
      const station = stageStation(stage.kind, stage.sits);
      assert.ok(station.well > 0.3, `${recipe.id}/${stage.id} well too tight`);
      assert.ok(
        station.mouth > station.well,
        `${recipe.id}/${stage.id} mouth must include the well`,
      );
    }
  }
});
