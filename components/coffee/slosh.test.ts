import assert from "node:assert/strict";
import {
  agitation,
  calmSlosh,
  createSlosh,
  sampleSlosh,
  splash,
  stepSlosh,
} from "./slosh.ts";

const settled = (size = 16) => createSlosh(size);
const run = (state: ReturnType<typeof settled>, frames: number, dt = 1 / 60) => {
  for (let i = 0; i < frames; i++) stepSlosh(state, dt);
};

// 1. Still water stays still. Nothing should start moving on its own.
{
  const s = settled();
  run(s, 200);
  assert.equal(agitation(s), 0);
  console.log("ok  an undisturbed surface never starts moving by itself");
}

// 2. A splash dents the surface where it lands, not somewhere else.
{
  const s = settled();
  splash(s, 0, 0, 1);
  assert.ok(sampleSlosh(s, 0, 0) < -0.4, "a dip under the stream");
  assert.ok(Math.abs(sampleSlosh(s, 0.95, 0.95)) < 0.05, "the far rim is calm");
  console.log("ok  a splash lands where the stream hits");
}

// 3. The dent travels outward: the rim only learns about it later.
{
  const s = settled();
  splash(s, 0, 0, 1);
  const rimAtOnce = Math.abs(sampleSlosh(s, 0.9, 0));
  run(s, 20);
  const rimLater = Math.abs(sampleSlosh(s, 0.9, 0));
  assert.ok(rimLater > rimAtOnce, `${rimLater} should beat ${rimAtOnce}`);
  console.log("ok  the ripple travels out rather than appearing everywhere");
}

// 4. And it settles. A cup that rings forever is not a cup.
{
  const s = settled();
  splash(s, 0, 0, 1);
  const loud = agitation(s);
  run(s, 600);
  const quiet = agitation(s);
  assert.ok(quiet < loud * 0.05, `${quiet} should be well under ${loud}`);
  console.log("ok  the surface goes still again on its own");
}

// 5. It stays a number. An explicit solver is one long frame from exploding,
//    and a NaN here spreads to every vertex of the mesh.
{
  const s = settled();
  for (let i = 0; i < 400; i++) {
    splash(s, Math.sin(i) * 0.9, Math.cos(i * 1.7) * 0.9, 1.5);
    // Absurd frame times, the kind a backgrounded tab hands back.
    stepSlosh(s, i % 7 === 0 ? 1.5 : 1 / 60, 5, 0.02);
  }
  for (let i = 0; i < s.now.length; i++) {
    assert.ok(Number.isFinite(s.now[i]), `cell ${i} is ${s.now[i]}`);
  }
  console.log("ok  hammering it with long frames never produces a NaN");
}

// 6. Sampling is smooth between cells and clamped at the edges.
{
  const s = settled(8);
  splash(s, 0, 0, 1, 3);
  const middle = sampleSlosh(s, 0, 0);
  const nudged = sampleSlosh(s, 0.02, 0);
  assert.ok(Math.abs(middle - nudged) < 0.1, "no steps between cells");
  assert.ok(Number.isFinite(sampleSlosh(s, -9, 9)), "off the grid still reads");
  console.log("ok  the surface reads smoothly and never off the end");
}

// 7. Calming it puts everything back to flat, including the history.
{
  const s = settled();
  splash(s, 0.3, -0.2, 2);
  run(s, 5);
  calmSlosh(s);
  assert.equal(agitation(s), 0);
  run(s, 30);
  assert.equal(agitation(s), 0, "and it stays flat afterwards");
  console.log("ok  calming a surface really does clear it");
}

// 8. Two splashes are louder than one: the ripples add up rather than
//    replacing each other.
{
  const one = settled();
  splash(one, 0, 0, 1);
  const two = settled();
  splash(two, 0, 0, 1);
  splash(two, 0.4, 0.4, 1);
  assert.ok(agitation(two) > agitation(one));
  console.log("ok  a second splash adds to the first");
}
