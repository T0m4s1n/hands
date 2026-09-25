import assert from "node:assert/strict";
import test from "node:test";
import { detectSize, lightingFilter, meanLuma } from "./handFrame.ts";

test("a dark frame asks for a real lift, a bright one barely changes", () => {
  assert.match(lightingFilter(40), /brightness/);
  assert.doesNotMatch(lightingFilter(140), /brightness/);
});

test("mean luma ignores the alpha channel", () => {
  const pixels = Uint8ClampedArray.from([10, 10, 10, 255, 200, 200, 200, 255]);
  const mean = meanLuma(pixels, 1);
  assert.ok(mean > 90 && mean < 120);
});

test("detectSize never upscales and keeps the aspect", () => {
  assert.deepEqual(detectSize(640, 480), { width: 640, height: 480 });
  const sized = detectSize(1920, 1080);
  assert.equal(sized.width, 640);
  assert.equal(sized.height, 360);
});
