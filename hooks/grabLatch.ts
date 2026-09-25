/**
 * Grab latch with smoothed pinch — pure logic, no React / MediaPipe.
 */

export type GrabThresholds = {
  enter: number;
  exit: number;
};

export type GrabLatchState = {
  isGrabbing: boolean;
  pinchSmoothed: number;
  enterFrames: number;
  exitFrames: number;
};

const PINCH_SMOOTH = 0.45;
/** Opening should land in a beat, not after a held-shut delay. */
const PINCH_OPEN_SMOOTH = 0.72;
const GRAB_ENTER_FRAMES = 2;
/** Two noisy frames are ignored. Twelve made a real open hand stay shut. */
export const GRAB_EXIT_FRAMES = 5;

/**
 * Grab latch with smoothed pinch + multi-frame enter/exit.
 * Single-frame tip noise used to flip isGrabbing and drop cups mid-carry.
 * Opening is trusted faster than closing, and a flicker in the
 * hysteresis band does not restart the let-go.
 */
export function applyGrabLatch(
  prev: GrabLatchState,
  rawPinch: number,
  thresholds: GrabThresholds,
): GrabLatchState {
  const toward = rawPinch - prev.pinchSmoothed;
  const mix =
    prev.pinchSmoothed <= 0
      ? 1
      : toward > 0
        ? PINCH_OPEN_SMOOTH
        : PINCH_SMOOTH;
  const pinchSmoothed =
    prev.pinchSmoothed <= 0
      ? rawPinch
      : prev.pinchSmoothed + toward * mix;

  if (prev.isGrabbing) {
    if (pinchSmoothed >= thresholds.exit) {
      const exitFrames = prev.exitFrames + 1;
      if (exitFrames >= GRAB_EXIT_FRAMES) {
        return {
          isGrabbing: false,
          pinchSmoothed,
          enterFrames: 0,
          exitFrames: 0,
        };
      }
      return {
        isGrabbing: true,
        pinchSmoothed,
        enterFrames: 0,
        exitFrames,
      };
    }
    // Only a real re-close cancels the let-go. Hovering in the band
    // used to reset the counter every other frame.
    if (pinchSmoothed < thresholds.enter) {
      return {
        isGrabbing: true,
        pinchSmoothed,
        enterFrames: 0,
        exitFrames: 0,
      };
    }
    return {
      isGrabbing: true,
      pinchSmoothed,
      enterFrames: 0,
      exitFrames: Math.max(0, prev.exitFrames - 1),
    };
  }

  if (pinchSmoothed < thresholds.enter) {
    const enterFrames = prev.enterFrames + 1;
    if (enterFrames >= GRAB_ENTER_FRAMES) {
      return {
        isGrabbing: true,
        pinchSmoothed,
        enterFrames: 0,
        exitFrames: 0,
      };
    }
    return {
      isGrabbing: false,
      pinchSmoothed,
      enterFrames,
      exitFrames: 0,
    };
  }

  return {
    isGrabbing: false,
    pinchSmoothed,
    enterFrames: 0,
    exitFrames: 0,
  };
}
