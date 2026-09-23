import assert from "node:assert/strict";
import {
  approach,
  ease,
  pulse,
  setSpring,
  spring,
  stepSpring,
} from "./anim.ts";

const run = (
  target: number,
  stiffness: number,
  bounce: number,
  seconds: number,
  dt = 1 / 60,
) => {
  const s = spring(0);
  let peak = 0;
  for (let t = 0; t < seconds; t += dt) {
    stepSpring(s, target, stiffness, dt, bounce);
    peak = Math.max(peak, s.value);
  }
  return { final: s.value, peak };
};

// 1. A spring arrives where it was sent.
{
  const { final } = run(1, 120, 0, 2);
  assert.ok(Math.abs(final - 1) < 0.01, `settled at ${final}`);
  console.log("ok  a spring settles on its target");
}

// 2. With no bounce it does not overshoot; with bounce it does.
{
  const dead = run(1, 120, 0, 2);
  const bouncy = run(1, 120, 0.6, 2);
  assert.ok(dead.peak <= 1.002, `dead spring peaked at ${dead.peak}`);
  assert.ok(bouncy.peak > 1.05, `bouncy spring peaked at ${bouncy.peak}`);
  assert.ok(Math.abs(bouncy.final - 1) < 0.02, "and still settles");
  console.log("ok  bounce overshoots and damping does not");
}

// 3. A long frame does not fling it. This is the one that matters: a tab
//    coming back from the background hands the loop a whole second at once.
{
  const s = spring(0);
  stepSpring(s, 1, 400, 1.0, 0.5);
  assert.ok(Number.isFinite(s.value), "still a number");
  assert.ok(
    s.value > 0.5 && s.value < 1.6,
    `a one-second frame left it at ${s.value}`,
  );
  console.log("ok  a stalled frame cannot fling a spring off the table");
}

// 4. Stiffer springs arrive sooner.
{
  const slow = run(1, 40, 0, 0.25).final;
  const fast = run(1, 400, 0, 0.25).final;
  assert.ok(fast > slow, `${fast} should be further along than ${slow}`);
  console.log("ok  stiffness decides how eagerly it chases");
}

// 5. Setting a spring cuts rather than moves: no leftover momentum.
{
  const s = spring(0);
  stepSpring(s, 10, 200, 0.1);
  assert.ok(s.velocity > 0, "it was moving");
  setSpring(s, 3);
  assert.equal(s.value, 3);
  assert.equal(s.velocity, 0);
  console.log("ok  setting a spring drops its momentum");
}

// 6. Approach is frame-rate independent: the same elapsed time gets to the
//    same place whether it arrived in one frame or thirty.
{
  const once = approach(0, 1, 6, 0.5);
  let many = 0;
  for (let i = 0; i < 30; i++) many = approach(many, 1, 6, 0.5 / 30);
  assert.ok(Math.abs(once - many) < 1e-6, `${once} vs ${many}`);
  console.log("ok  approach does not depend on the frame rate");
}

// 7. Easing and the one-shot pulse stay in their lanes.
{
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(ease(-5), 0, "clamped below");
  assert.equal(ease(5), 1, "clamped above");
  assert.ok(ease(0.5) === 0.5);

  assert.equal(pulse(-0.1), 0, "nothing before it happened");
  assert.equal(pulse(99), 0, "nothing long after");
  assert.ok(pulse(0.2) > 0.5, "loud in the middle");
  for (let t = 0; t <= 0.5; t += 0.01) {
    assert.ok(pulse(t) <= 1, `pulse stayed within 1 at ${t}`);
  }
  console.log("ok  easing and pulses stay between 0 and 1");
}
