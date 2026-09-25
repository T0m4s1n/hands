"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  type Handedness,
  type TrackedHand,
} from "@/hooks/useHandTracking";
import { menuAimPoint } from "@/hooks/screenAim";
import {
  emptyLock,
  pickFreshLock,
  resolveLock,
  type LockHand,
} from "./menuLock";
import { emptyCursorSmooth, stepMenuCursor } from "./menuSmooth";

export type HandCursor = {
  /** Index fingertip on the screen, 0..1. */
  x: number;
  y: number;
  grabbing: boolean;
  /** True when the locked index tip is live (or briefly held through a flicker). */
  active: boolean;
  /** Side of the first claim. Stable even if MediaPipe flips the label. */
  handedness: Handedness | null;
  /** 0 while unlocked. Changes only when a new hand claims the pointer. */
  lockId: number;
  count: number;
};

const EMPTY: HandCursor = {
  x: 0.5,
  y: 0.5,
  grabbing: false,
  active: false,
  handedness: null,
  lockId: 0,
  count: 0,
};

export { menuAimPoint };

export function pickPointingHand(hands: TrackedHand[]): TrackedHand | null {
  return pickFreshLock(hands) as TrackedHand | null;
}

export function screenFromIndexTip(
  hand: TrackedHand,
): { x: number; y: number } | null {
  return menuAimPoint(hand);
}

/**
 * Index-tip cursor with a sticky one-wrist lock. No React state — `onFrame`
 * + `cursorRef` only, so the menu never re-renders on tracking samples.
 */
export function useHandCursor(
  handsRef: RefObject<TrackedHand[]>,
  onFrame?: (cursor: HandCursor) => void,
) {
  const cursorRef = useRef<HandCursor>(EMPTY);
  const smoothRef = useRef(emptyCursorSmooth());
  const timeRef = useRef(0);
  const lockRef = useRef(emptyLock());
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
      const last = timeRef.current;
      const dt = last > 0 ? Math.min(0.08, (now - last) / 1000) : 1 / 60;
      timeRef.current = now;
      const hands = (handsRef.current ?? []) as LockHand[];
      const resolved = resolveLock(hands, lockRef.current, now);
      const smooth = smoothRef.current;

      if (resolved.tip) {
        stepMenuCursor(smooth, resolved.tip, dt);
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
        lockId: resolved.lockId,
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
