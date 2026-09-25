import assert from "node:assert/strict";
import {
  angleDelta,
  newStroke,
  crankHandIsLive,
  driveCrank,
  newTurn,
  palmAngle,
  pourFlow,
  updateStroke,
  updateTurn,
  TILT_START,
  TILT_FULL,
  type Point,
} from "./gestures.ts";
import { RECIPES, bandScore, grade, placeScore, stars } from "./recipes.ts";

const p = (x: number, y: number): Point => ({ x, y, z: 0 });
const near = (a: number, b: number, slack = 1e-6) =>
  assert.ok(Math.abs(a - b) <= slack, `${a} is not within ${slack} of ${b}`);

// 1. Crossing the seam at PI goes the short way round, not all the way back.
{
  // Crossing forwards past PI lands just the other side of it, not 6 back.
  near(angleDelta(3.0, -3.0), 0.283185307, 1e-6);
  near(angleDelta(-3.0, 3.0), -0.283185307, 1e-6);
  near(angleDelta(0, 1), 1);
  console.log("ok  angle differences take the short way round");
}

// 2. Cranking adds up whichever way the handle goes.
{
  const turn = newTurn(0);
  updateTurn(turn, 0.5);
  updateTurn(turn, 0.1); // back the other way still grinds
  updateTurn(turn, 0.4);
  near(turn.turned, 0.5 + 0.4 + 0.3, 1e-9);
  console.log("ok  a crank counts turning in both directions");
}

// 3. A tracker jump is not a turn: the handle stays put.
{
  const turn = newTurn(0);
  const added = updateTurn(turn, 2.4);
  assert.equal(added, 0);
  assert.equal(turn.turned, 0);
  assert.equal(turn.angle, 0, "a teleport must not take the pestle with it");
  console.log("ok  a jump across the circle is ignored");
}

// 3b. Re-entering the frame on the far side does not swing the mill.
{
  const turn = newTurn(0.4);
  assert.equal(driveCrank(turn, 0.4 + Math.PI, 1 / 60), 0);
  assert.equal(turn.angle, 0.4);
  assert.equal(crankHandIsLive({ tracking: "coasting" }), false);
  assert.equal(crankHandIsLive({ tracking: "live" }), true);
  assert.equal(crankHandIsLive(undefined), false);
  const slow = newTurn(0);
  const moved = driveCrank(slow, 0.5, 1 / 60);
  assert.ok(moved > 0 && moved < 0.5, "accepted motion is rate-limited");
  assert.ok(slow.angle < 0.5);
  console.log("ok  a re-entered hand does not teleport the mill");
}

// 4. The palm angle runs from the wrist to the middle knuckle.
{
  near(palmAngle([p(0, 0), ...Array(8).fill(p(0, 0)), p(0, 1)]), Math.PI / 2);
  near(palmAngle([p(0, 0), ...Array(8).fill(p(0, 0)), p(1, 0)]), 0);
  assert.equal(palmAngle([]), 0, "a hand with no landmarks does not throw");
  console.log("ok  the palm angle follows the wrist-to-knuckle line");
}

// 5. Held level it pours nothing, and past full tilt it cannot pour faster.
{
  assert.equal(pourFlow(0), 0);
  assert.equal(pourFlow(TILT_START), 0);
  assert.equal(pourFlow(TILT_FULL), 1);
  assert.equal(pourFlow(-TILT_FULL), 1, "tipping either way pours");
  assert.equal(pourFlow(TILT_FULL * 3), 1);
  near(pourFlow((TILT_START + TILT_FULL) / 2), 0.5, 1e-9);
  console.log("ok  pouring starts at a tilt and tops out");
}

// 6. Shaking: each turnaround is one stroke.
{
  const shake = newStroke(0);
  assert.equal(updateStroke(shake, 0.05, 0.1), 0, "a twitch is not a stroke");
  assert.equal(updateStroke(shake, 0.2, 0.1), 1);
  assert.equal(updateStroke(shake, 0.3, 0.1), 0, "still going the same way");
  assert.equal(updateStroke(shake, 0.25, 0.1), 0, "not back far enough yet");
  assert.equal(updateStroke(shake, 0.15, 0.1), -1);
  assert.equal(updateStroke(shake, 0.0, 0.1), 0);
  assert.equal(updateStroke(shake, 0.12, 0.1), 1);
  assert.equal(shake.count, 3);
  console.log("ok  shaking counts one stroke per turnaround");
}

// 7. A hand held still is never shaking, however long you wait.
{
  const shake = newStroke(0);
  for (let i = 0; i < 200; i++) {
    updateStroke(shake, Math.sin(i) * 0.03, 0.1);
  }
  assert.equal(shake.count, 0);
  console.log("ok  jitter below the amplitude counts for nothing");
}

// 8. Drifting steadily one way is one stroke, not a shake.
{
  const shake = newStroke(0);
  for (const value of [0.2, 0.4, 0.6, 0.8, 1.0]) {
    updateStroke(shake, value, 0.1);
  }
  assert.equal(shake.count, 1);
  console.log("ok  a one-way drift is a single stroke");
}

// 9. Pressing counts only the strokes going down, so lifting between presses
//    does not score twice.
{
  const press = newStroke(0);
  let presses = 0;
  for (const value of [-0.4, 0, -0.4, 0, -0.4]) {
    if (updateStroke(press, value, 0.2) < 0) presses += 1;
  }
  assert.equal(presses, 3);
  assert.equal(press.count, 5, "every turnaround is still a stroke");
  console.log("ok  presses count downward strokes only");
}

// 10. Marks: inside the window is full, and it fades rather than falls off.
{
  assert.equal(bandScore(0.6, [0.5, 0.7]), 1);
  assert.equal(bandScore(0.5, [0.5, 0.7]), 1, "the edge still counts");
  near(bandScore(0.79, [0.5, 0.7]), 0.5, 0.01);
  assert.equal(bandScore(5, [0.5, 0.7]), 0, "wildly off scores nothing");
  assert.ok(bandScore(0.45, [0.5, 0.7]) > 0, "just short still scores");

  assert.equal(placeScore(0, 1), 1);
  assert.equal(placeScore(1, 1), 0);
  assert.equal(placeScore(0.25, 1), 1, "the well is full marks, not a bullseye");
  assert.ok(placeScore(0.85, 1) >= 0.8, "the rim still makes the coffee");

  assert.equal(grade(1), "Excelente");
  assert.equal(grade(0), "Para tirar");
  assert.equal(stars(1), 5);
  assert.equal(stars(0.9), 5);
  assert.equal(stars(0.75), 4);
  assert.equal(stars(0.6), 3);
  assert.equal(stars(0.4), 2);
  assert.equal(stars(0.2), 1);
  assert.equal(stars(0), 0);
  console.log("ok  marks fade away from the target rather than snapping");
}

// 11. Every recipe is playable: five stages, and anything scored on an amount
//     has a window that actually contains the goal it asks for.
{
  assert.equal(RECIPES.length, 3);
  const ids = new Set(RECIPES.map((recipe) => recipe.id));
  assert.equal(ids.size, 3, "recipe ids are unique");

  for (const recipe of RECIPES) {
    assert.ok(recipe.pitch.length > 20, `${recipe.id} has a menu pitch`);
    assert.equal(recipe.stages.length, 5, `${recipe.id} has five stages`);
    for (const stage of recipe.stages) {
      assert.ok(stage.radius > 0, `${recipe.id}/${stage.id} has a target ring`);
      assert.ok(
        stage.instruction.length > 0,
        `${recipe.id}/${stage.id} tells you what to do`,
      );
      if (stage.kind === "place") continue;
      assert.ok(stage.band, `${recipe.id}/${stage.id} is scored on an amount`);
      const [low, high] = stage.band!;
      assert.ok(low < high, `${recipe.id}/${stage.id} has a real window`);
      assert.ok(
        stage.goal >= low && stage.goal <= high,
        `${recipe.id}/${stage.id} can score full marks by doing what it asks`,
      );
      if (stage.kind === "hold" || stage.kind === "tilt") {
        assert.ok(
          stage.rate && stage.rate > 0,
          `${recipe.id}/${stage.id} fills at some speed`,
        );
        assert.ok(high <= 1, `${recipe.id}/${stage.id} cannot ask to overflow`);
      }
    }
  }
  console.log("ok  all three recipes are playable and winnable");
}
