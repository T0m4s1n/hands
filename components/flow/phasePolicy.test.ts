import assert from "node:assert/strict";
import test from "node:test";
import {
  ambienceForPhase,
  musicForPhase,
  musicTheme,
  phasePolicy,
  type AppPhase,
} from "./phasePolicy.ts";

test("only play accepts gameplay input and guides", () => {
  const phases: AppPhase[] = [
    "sync",
    "menu",
    "brief",
    "count",
    "play",
    "results",
  ];

  for (const phase of phases) {
    assert.equal(phasePolicy(phase).acceptGameplayInput, phase === "play");
    assert.equal(phasePolicy(phase).showGameplayGuides, phase === "play");
  }
});

test("countdown sits on the live cafe, not a dummy table", () => {
  assert.equal(phasePolicy("count").showHands, true);
  assert.equal(phasePolicy("count").acceptGameplayInput, false);
});

test("each phase has its own music bed and a quieter room than play", () => {
  assert.equal(musicForPhase("menu"), "menu");
  assert.equal(musicForPhase("play"), "play");
  assert.equal(musicForPhase("results"), "results");
  assert.ok(ambienceForPhase("play") > ambienceForPhase("menu"));
  assert.ok(ambienceForPhase("menu") > ambienceForPhase("count"));
  assert.notEqual(musicTheme("menu").key, musicTheme("play").key);
  assert.notEqual(musicTheme("play").key, musicTheme("results").key);
  assert.notEqual(musicTheme("menu").bpm, musicTheme("play").bpm);
  assert.notEqual(musicTheme("play").groove, musicTheme("results").groove);
});

test("hands stay mounted but are visually suppressed behind teaching overlays", () => {
  assert.equal(phasePolicy("sync").showHands, true);
  assert.equal(phasePolicy("menu").showHands, false);
  assert.equal(phasePolicy("play").showHands, true);
  assert.equal(phasePolicy("brief").showHands, false);
  assert.equal(phasePolicy("count").showHands, true);
  assert.equal(phasePolicy("results").showHands, false);
});
