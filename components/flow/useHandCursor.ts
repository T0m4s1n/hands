"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  type Handedness,
  type TrackedHand,
  type Vec3,
} from "@/hooks/useHandTracking";
import { menuAimPoint } from "@/hooks/screenAim";

export type HandCursor = {
  /** Index fingertip on the screen, 0..1. */
  x: number;
  y: number;
  grabbing: boolean;
  /** True when the locked index tip is live (or briefly held through a flicker). */
  active: boolean;
  /** The hand we are stuck to. Null only while unlocked. */
  handedness: Handedness | null;
  count: number;
};

const EMPTY: HandCursor = {
  x: 0.5,
  y: 0.5,
  grabbing: false,
  active: false,
  handedness: null,
  count: 0,
};

/** Keep aiming at the last tip while MediaPipe drops a frame. */
const TIP_HOLD_MS = 140;
/** Keep the lock while the whole hand blinks out of the frame. */
const LOCK_GRACE_MS = 320;
/** After grace, stay unlocked this long before another hand can claim. */
const RELOCK_COOLDOWN_MS = 80;

function dist2(a: Vec3, b: Vec3) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * How clearly this hand is pointing with the index — used only to pick the
 * first lock, never to steal mid-aim.
 */
function indexPointScore(landmarks: Vec3[]): number {
  if (landmarks.length < 13) {
    // Pointer fallback (no landmarks): still selectable, just not preferred.
    return 0;
  }
  const wrist = landmarks[0];
  const mcp = landmarks[5];
  const tip = landmarks[8];
  const middle = landmarks[12];
  const tipReach = Math.sqrt(dist2(tip, wrist));
  const midReach = Math.sqrt(dist2(middle, wrist));
  const knuckle = Math.sqrt(dist2(mcp, wrist)) + 1e-5;
  return (tipReach / knuckle) * 2 + (tipReach - midReach);
}

function indexTipOf(hand: TrackedHand): { x: number; y: number } | null {
  return menuAimPoint(hand);
}

export { menuAimPoint };

function handBySide(
  hands: TrackedHand[],
  side: Handedness,
): TrackedHand | undefined {
  return hands.find((hand) => hand.handedness === side);
}

/** Candidate for a fresh lock: valid index tip required. */
function pickFreshLock(hands: TrackedHand[]): TrackedHand | null {
  let best: TrackedHand | null = null;
  let bestScore = -Infinity;
  for (const hand of hands) {
    if (!indexTipOf(hand)) continue;
    const score = indexPointScore(hand.smoothedLandmarks);
    if (score > bestScore) {
      bestScore = score;
      best = hand;
    }
  }
  return best;
}

type LockState = {
  /** Which hand owns the pointer. Null = free to claim. */
  side: Handedness | null;
  /** Last good index-tip sample. */
  tip: { x: number; y: number } | null;
  /** Wall clock of the last frame that had a live tip. */
  tipAt: number;
  /** Wall clock of the last frame that still saw the locked hand. */
  seenAt: number;
  /** After an unlock, ignore claims until this time. */
  relockAfter: number;
  grabbing: boolean;
};

/**
 * Stick to one index fingertip.
 *
 * Cases this covers:
 * - Two hands in frame → lock the clearer pointer, ignore the other.
 * - Locked hand flickers a few frames → hold last tip, stay active.
 * - Locked hand leaves → grace, then unlock (other hand may claim after cooldown).
 * - Tip landmark missing while hand remains → hold last tip briefly.
 * - Bad / empty landmarks with a live world cursor (mouse) → still claim.
 * - Hand comes back same side inside grace → resume without re-picking.
 */
function resolveLock(hands: TrackedHand[], lock: LockState, now: number): {
  tip: { x: number; y: number } | null;
  active: boolean;
  grabbing: boolean;
  side: Handedness | null;
} {
  const usable = hands.filter((hand) => indexTipOf(hand));

  // --- already locked: stay on that hand's index only ---
  if (lock.side) {
    const owned = handBySide(hands, lock.side);
    const tip = owned ? indexTipOf(owned) : null;

    if (tip) {
      lock.tip = tip;
      lock.tipAt = now;
      lock.seenAt = now;
      lock.grabbing = owned?.isGrabbing ?? false;
      return {
        tip,
        active: true,
        grabbing: lock.grabbing,
        side: lock.side,
      };
    }

    if (owned) {
      // Hand is there but tip landmark glitched — hold last tip a beat.
      lock.seenAt = now;
      lock.grabbing = owned.isGrabbing;
      const holding = lock.tip && now - lock.tipAt <= TIP_HOLD_MS;
      return {
        tip: holding ? lock.tip : null,
        active: Boolean(holding),
        grabbing: lock.grabbing,
        side: lock.side,
      };
    }

    // Whole hand gone. Grace keeps the reticle alive; then we unlock.
    if (lock.tip && now - lock.seenAt <= LOCK_GRACE_MS) {
      return {
        tip: lock.tip,
        active: true,
        grabbing: false,
        side: lock.side,
      };
    }

    lock.side = null;
    lock.tip = null;
    lock.grabbing = false;
    lock.relockAfter = now + RELOCK_COOLDOWN_MS;
    return { tip: null, active: false, grabbing: false, side: null };
  }

  // --- unlocked: claim at most one hand ---
  if (now < lock.relockAfter || usable.length === 0) {
    return { tip: null, active: false, grabbing: false, side: null };
  }

  const claim = pickFreshLock(usable);
  if (!claim) {
    return { tip: null, active: false, grabbing: false, side: null };
  }

  const tip = indexTipOf(claim)!;
  lock.side = claim.handedness;
  lock.tip = tip;
  lock.tipAt = now;
  lock.seenAt = now;
  lock.grabbing = claim.isGrabbing;
  return {
    tip,
    active: true,
    grabbing: claim.isGrabbing,
    side: claim.handedness,
  };
}

export function pickPointingHand(hands: TrackedHand[]): TrackedHand | null {
  return pickFreshLock(hands);
}

export function screenFromIndexTip(
  hand: TrackedHand,
): { x: number; y: number } | null {
  return indexTipOf(hand);
}

/**
 * Index-tip cursor with a sticky one-hand lock. No React state — `onFrame`
 * + `cursorRef` only, so the menu never re-renders on tracking samples.
 */
export function useHandCursor(
  handsRef: RefObject<TrackedHand[]>,
  onFrame?: (cursor: HandCursor) => void,
) {
  const cursorRef = useRef<HandCursor>(EMPTY);
  const smoothRef = useRef({ x: 0.5, y: 0.5, seeded: false });
  const lockRef = useRef<LockState>({
    side: null,
    tip: null,
    tipAt: 0,
    seenAt: 0,
    relockAfter: 0,
    grabbing: false,
  });
  const onFrameRef = useRef(onFrame);
  // In an effect, not during render. The frame loop below closes over this
  // ref, and writing a ref the loop reads while React is still rendering is
  // exactly the tangle the compiler refuses to let through.
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const hands = handsRef.current ?? [];
      const resolved = resolveLock(hands, lockRef.current, now);
      const smooth = smoothRef.current;

      if (resolved.tip) {
        const rate = smooth.seeded ? 0.72 : 1;
        smooth.x += (resolved.tip.x - smooth.x) * rate;
        smooth.y += (resolved.tip.y - smooth.y) * rate;
        smooth.seeded = true;
      } else if (!resolved.active) {
        // Drop smoothing seed so the next claim snaps on, not eases from afar.
        smooth.seeded = false;
      }

      const next: HandCursor = {
        x: smooth.x,
        y: smooth.y,
        grabbing: resolved.grabbing,
        active: resolved.active,
        handedness: resolved.side,
        count: hands.length,
      };
      cursorRef.current = next;
      onFrameRef.current?.(next);

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [handsRef]);

  return cursorRef;
}
