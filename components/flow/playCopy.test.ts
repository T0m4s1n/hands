import assert from "node:assert/strict";
import test from "node:test";
import { RECIPES } from "../coffee/recipes.ts";
import {
  KIND_VERB,
  destinationOf,
  stagePrompt,
  stageSummary,
} from "./playCopy.ts";

test("a held tool far from the mark says to take it there", () => {
  const line = stagePrompt({
    kind: "place",
    sits: "grinder",
    near: false,
    holding: true,
    working: false,
    pointer: false,
  });
  assert.match(line, /llévalo/i);
  assert.match(line, /molino/);
});

test("a held place stage never still says pinch", () => {
  const line = stagePrompt({
    kind: "place",
    sits: "grinder",
    near: true,
    holding: true,
    working: false,
    pointer: false,
  });
  assert.match(line, /molino/);
  assert.doesNotMatch(line, /pelliz/i);
});

test("pointer prompts keep the mouse verb while naming the same destination", () => {
  const line = stagePrompt({
    kind: "tilt",
    sits: "mug",
    near: true,
    holding: true,
    working: false,
    pointer: true,
  });
  assert.match(line, /clic/);
  assert.match(line, /taza/);
  assert.match(line, /clic derecho/);
});

test("every recipe stage has a matching verb and destination", () => {
  for (const recipe of RECIPES) {
    for (const stage of recipe.stages) {
      assert.ok(KIND_VERB[stage.kind]);
      assert.ok(destinationOf(stage.sits).length > 3);
      const summary = stageSummary(stage.kind, stage.sits);
      assert.ok(summary.length > 8, `${recipe.id}/${stage.id} needs a summary`);
      const held = stagePrompt({
        kind: stage.kind,
        sits: stage.sits,
        near: true,
        holding: true,
        working: false,
        pointer: false,
      });
      assert.doesNotMatch(
        held,
        /círculo dorado|pellizca para tomarlo/i,
        `${recipe.id}/${stage.id} held prompt drifted`,
      );
    }
  }
});
