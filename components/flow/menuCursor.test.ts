import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { menuAimPoint } from "../../hooks/screenAim.ts";

describe("recipe menu aim (PROTECTED)", () => {
  it("aims from the index landmark when the camera is tracking", () => {
    const tip = { x: 0.22, y: 0.41, z: 0 };
    const aimed = menuAimPoint({
      smoothedLandmarks: Array.from({ length: 21 }, (_, i) =>
        i === 8 ? tip : { x: 0.5, y: 0.5, z: 0 },
      ),
      cursor: { x: 0, y: 0, z: 0 },
    });
    assert.ok(aimed);
    assert.equal(aimed.x, 0.22);
    assert.equal(aimed.y, 0.41);
  });

  it("still aims with the mouse fallback (no landmarks)", () => {
    const aimed = menuAimPoint({
      smoothedLandmarks: [],
      cursor: { x: 0, y: 0, z: 1.2 },
    });
    assert.ok(aimed, "mouse must produce an aim point");
    assert.ok(aimed.x > 0.4 && aimed.x < 0.6);
    assert.ok(aimed.y > 0.4 && aimed.y < 0.6);
  });
});
