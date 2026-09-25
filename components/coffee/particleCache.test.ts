import assert from "node:assert/strict";
import test from "node:test";
import { particleCache } from "./particleCache.ts";

test("particle cache rebuilds when the next prop has more cargo", () => {
  const scoop = particleCache<number>(null, 12, (index) => index);
  const filter = particleCache(scoop, 22, (index) => index);
  assert.equal(filter.length, 22);
  assert.equal(filter[21], 21);
});

test("particle cache reuses data while count is unchanged", () => {
  const first = particleCache<object>(null, 14, () => ({}));
  assert.equal(particleCache(first, 14, () => ({})), first);
});

test("particle cache never leaves undefined entries", () => {
  const grown = particleCache(
    particleCache<number>(null, 8, (index) => index),
    20,
    (index) => index * 2,
  );
  assert.equal(grown.every((entry) => entry !== undefined), true);
});
