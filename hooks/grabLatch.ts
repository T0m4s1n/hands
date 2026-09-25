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
const GRAB_ENTER_FRAMES = 2;
const GRAB_EXIT_FRAMES = 5;

/**
 * Grab latch with smoothed pinch + multi-frame enter/exit.
 * Single-frame tip noise used to flip isGrabbing and drop cups mid-carry.
 */
export function applyGrabLatch(
  prev: GrabLatchState,
  rawPinch: number,
  thresholds: GrabThresholds,
): GrabLatchState {
  const pinchSmoothed =
    prev.pinchSmoothed <= 0
      ? rawPinch
      : prev.pinchSmoothed + (rawPinch - prev.pinchSmoothed) * PINCH_SMOOTH;

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
    return {
      isGrabbing: true,
      pinchSmoothed,
      enterFrames: 0,
      exitFrames: 0,
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
