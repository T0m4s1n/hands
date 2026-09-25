"use client";

import { useCallback, useRef, useState } from "react";
import { playSfx } from "@/lib/audio";

/** How long the hole takes to close — outside in. */
export const IRIS_OUT_MS = 880;
/** How long the hole takes to open on the next scene — inside out. */
export const IRIS_IN_MS = 1040;
/** A beat of black between the close and the open, so the swap is not a blink. */
const HOLD_MS = 120;

export function IrisWipe({ closed }: { closed: boolean }) {
  return (
    <div
      className={`iris-wipe ${closed ? "iris-wipe-shut" : ""}`}
      aria-hidden
    />
  );
}

export function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Runs an iris-out (the hole pinches in from the edges), swaps the scene,
 * then iris-in (the hole opens from the centre). Every section of the
 * start — sync, menu, briefing, countdown, results — arrives the same way.
 *
 * IMPORTANT: `busy` clears as soon as the new scene is showing and the iris
 * starts opening. Holding busy through the whole open animation used to lock
 * the recipe menu — picks set `pickedRef` then called `go`, which no-op'd,
 * and the carta could never select again.
 */
export function useIris() {
  const [closed, setClosed] = useState(false);
  const busyRef = useRef(false);

  const go = useCallback(async (swap: () => void) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setClosed(true);
    playSfx("whoosh");
    await wait(IRIS_OUT_MS);
    swap();
    await wait(HOLD_MS);
    setClosed(false);
    // Unlock for the next transition while the iris finishes opening.
    busyRef.current = false;
    await wait(IRIS_IN_MS);
    return true;
  }, []);

  return { closed, go };
}
