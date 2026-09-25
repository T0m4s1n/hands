import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Handedness } from "../../hooks/useHandTracking.ts";
import {
  LOCK_GRACE_MS,
  MAX_FOLLOW,
  RELOCK_COOLDOWN_MS,
  emptyLock,
  followLocked,
  pickFreshLock,
  resolveLock,
  type LockHand,
} from "./menuLock.ts";

function pointing(
  side: Handedness,
  wrist: { x: number; y: number },
  extras?: Partial<LockHand>,
): LockHand {
  const landmarks = Array.from({ length: 21 }, () => ({
    x: wrist.x,
    y: wrist.y,
    z: 0,
  }));
  landmarks[0] = { x: wrist.x, y: wrist.y, z: 0 };
  landmarks[5] = { x: wrist.x + 0.04, y: wrist.y - 0.06, z: 0 };
  landmarks[8] = { x: wrist.x + 0.05, y: wrist.y - 0.22, z: 0 };
  landmarks[12] = { x: wrist.x + 0.02, y: wrist.y - 0.1, z: 0 };
  return {
    handedness: side,
    smoothedLandmarks: landmarks,
    cursor: { x: 0, y: 0, z: 0 },
    isGrabbing: false,
    ...extras,
  };
}

function curled(side: Handedness, wrist: { x: number; y: number }): LockHand {
  const landmarks = Array.from({ length: 21 }, () => ({
    x: wrist.x,
    y: wrist.y,
    z: 0,
  }));
  landmarks[0] = { x: wrist.x, y: wrist.y, z: 0 };
  landmarks[5] = { x: wrist.x + 0.03, y: wrist.y - 0.04, z: 0 };
  landmarks[8] = { x: wrist.x + 0.02, y: wrist.y - 0.05, z: 0 };
  landmarks[12] = { x: wrist.x + 0.015, y: wrist.y - 0.045, z: 0 };
  return {
    handedness: side,
    smoothedLandmarks: landmarks,
    cursor: { x: 0, y: 0, z: 0 },
    isGrabbing: false,
  };
}

describe("menu lock (PROTECTED)", () => {
  it("locks the clearer pointer and ignores the other hand", () => {
    const lock = emptyLock();
    const left = curled("Left", { x: 0.25, y: 0.55 });
    const right = pointing("Right", { x: 0.62, y: 0.48 });
    const first = resolveLock([left, right], lock, 1000);
    assert.equal(first.active, true);
    assert.equal(first.side, "Right");
    assert.equal(first.lockId, 1);

    const later = resolveLock(
      [pointing("Left", { x: 0.25, y: 0.4 }), right],
      lock,
      1080,
    );
    assert.equal(later.lockId, 1);
    assert.equal(later.side, "Right");
    assert.ok(Math.abs(later.tip!.x - (0.62 + 0.05)) < 0.02);
  });

  it("keeps the same lock when Left/Right labels swap", () => {
    const lock = emptyLock();
    const right = pointing("Right", { x: 0.64, y: 0.5 });
    const left = curled("Left", { x: 0.28, y: 0.52 });
    resolveLock([left, right], lock, 1000);

    const swapped = resolveLock(
      [
        pointing("Left", { x: 0.64, y: 0.5 }),
        curled("Right", { x: 0.28, y: 0.52 }),
      ],
      lock,
      1030,
    );

    assert.equal(swapped.lockId, 1);
    assert.equal(swapped.side, "Right");
    assert.ok(swapped.tip);
    assert.ok(Math.abs(swapped.tip.x - (0.64 + 0.05)) < 0.02);
  });

  it("does not follow a label swap across MAX_FOLLOW", () => {
    const lock = emptyLock();
    resolveLock(
      [
        pointing("Right", { x: 0.7, y: 0.5 }),
        curled("Left", { x: 0.2, y: 0.5 }),
      ],
      lock,
      1000,
    );

    const followed = followLocked(
      [
        pointing("Right", { x: 0.2, y: 0.5 }),
        curled("Left", { x: 0.7, y: 0.5 }),
      ],
      lock,
    );
    assert.ok(followed);
    assert.ok(Math.abs(wristGap(followed, 0.7)) < MAX_FOLLOW);
  });

  it("holds the tip through a short dropout instead of handing off", () => {
    const lock = emptyLock();
    resolveLock([pointing("Right", { x: 0.6, y: 0.45 })], lock, 1000);
    const gap = resolveLock([], lock, 1000 + LOCK_GRACE_MS - 40);
    assert.equal(gap.active, true);
    assert.equal(gap.lockId, 1);
    assert.ok(gap.tip);
  });

  it("unlocks after grace, then the other hand may claim", () => {
    const lock = emptyLock();
    resolveLock([pointing("Right", { x: 0.66, y: 0.4 })], lock, 1000);
    const gone = resolveLock([], lock, 1000 + LOCK_GRACE_MS + 1);
    assert.equal(gone.active, false);
    assert.equal(gone.lockId, 0);

    const tooSoon = resolveLock(
      [pointing("Left", { x: 0.3, y: 0.5 })],
      lock,
      1000 + LOCK_GRACE_MS + 1,
    );
    assert.equal(tooSoon.active, false);

    const next = resolveLock(
      [pointing("Left", { x: 0.3, y: 0.5 })],
      lock,
      1000 + LOCK_GRACE_MS + RELOCK_COOLDOWN_MS + 2,
    );
    assert.equal(next.active, true);
    assert.equal(next.side, "Left");
    assert.equal(next.lockId, 2);
  });

  it("a pair of curled hands does not claim the carta", () => {
    const lock = emptyLock();
    const view = resolveLock(
      [
        curled("Left", { x: 0.3, y: 0.5 }),
        curled("Right", { x: 0.68, y: 0.5 }),
      ],
      lock,
      400,
    );
    assert.equal(view.lockId, 0);
    assert.equal(view.active, false);
  });

  it("fresh lock prefers the extended index", () => {
    const pick = pickFreshLock([
      curled("Left", { x: 0.3, y: 0.5 }),
      pointing("Right", { x: 0.68, y: 0.48 }),
    ]);
    assert.ok(pick);
    assert.equal(pick.handedness, "Right");
  });

  it("two pointing hands do not jump the tip before a claim", () => {
    const lock = emptyLock();
    const left = pointing("Left", { x: 0.28, y: 0.5 });
    const right = pointing("Right", { x: 0.7, y: 0.5 });

    const first = resolveLock([left, right], lock, 1000);
    assert.equal(first.lockId, 0);
    assert.equal(first.active, false);

    const flipped = resolveLock([right, left], lock, 1016);
    assert.equal(flipped.lockId, 0);
    assert.equal(flipped.active, false);

    const claimed = resolveLock([right, left], lock, 1032);
    assert.equal(claimed.active, true);
    assert.equal(claimed.lockId, 1);
    assert.equal(claimed.side, "Left");
    assert.ok(claimed.tip);
    assert.ok(Math.abs(claimed.tip.x - (0.28 + 0.05)) < 0.03);
  });

  it("a coasting ghost cannot steal a fresh claim", () => {
    const lock = emptyLock();
    const ghost = pointing("Left", { x: 0.3, y: 0.5 }, { tracking: "coasting" });
    const live = pointing("Right", { x: 0.66, y: 0.48 });
    const view = resolveLock([ghost, live], lock, 400);
    assert.equal(view.side, "Right");
    assert.equal(view.lockId, 1);
  });

  it("mouse fallback (no landmarks) can still claim", () => {
    const lock = emptyLock();
    const mouse: LockHand = {
      handedness: "Right",
      smoothedLandmarks: [],
      cursor: { x: 0, y: 0, z: 1.2 },
      isGrabbing: false,
    };
    const view = resolveLock([mouse], lock, 500);
    assert.equal(view.active, true);
    assert.ok(view.tip);
    assert.ok(view.tip.x > 0.4 && view.tip.x < 0.6);
  });
});

function wristGap(hand: LockHand, x: number) {
  return Math.abs(hand.smoothedLandmarks[0].x - x);
}
