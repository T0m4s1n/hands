import assert from "node:assert/strict";
import test from "node:test";
import { cameraGateButtons } from "./gatePolicy.ts";

test("the mouse path stays available while the permission prompt hangs", () => {
  const hung = cameraGateButtons({
    asking: true,
    loading: false,
    waiting: false,
  });
  assert.equal(hung.showMouse, true);
  assert.equal(hung.showRetry, false);
});

test("a failed ask offers both the mouse and a camera retry", () => {
  const failed = cameraGateButtons({
    asking: false,
    loading: false,
    waiting: false,
  });
  assert.equal(failed.showMouse, true);
  assert.equal(failed.showRetry, true);
});

test("the model load hides the buttons so they cannot abort mid-start", () => {
  const loading = cameraGateButtons({
    asking: true,
    loading: true,
    waiting: false,
  });
  assert.equal(loading.showMouse, false);
  assert.equal(loading.showRetry, false);
});
