import assert from "node:assert/strict";
import test from "node:test";
import type { StageKind } from "../coffee/recipes.ts";
import { pointerStagePrompt } from "./pointerPrompt.ts";

test("every gameplay gesture has mouse-specific guidance", () => {
  const kinds: StageKind[] = [
    "place",
    "crank",
    "hold",
    "tamp",
    "shake",
    "tilt",
  ];
  for (const kind of kinds) {
    const prompt = pointerStagePrompt(kind);
    assert.match(prompt, /clic/);
    assert.doesNotMatch(prompt, /pelliz/i);
  }
});

test("pour guidance explains how the mouse tips the wrist", () => {
  assert.match(pointerStagePrompt("tilt"), /clic derecho/i);
});
