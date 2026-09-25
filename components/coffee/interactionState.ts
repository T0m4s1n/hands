export type ReleaseReason = "none" | "opened" | "tracking-lost";

/**
 * A coasting hand is still driving the object. Only a missing holder is a
 * tracking loss — otherwise a blink would drop every cup mid-carry.
 */
export function holderIsDriving(
  holder?: { tracking?: "live" | "coasting" } | null,
): boolean {
  return Boolean(holder);
}

/**
 * Tracking loss is not a player choice. It must stop the interaction and put
 * the prop down safely, but it must never submit/score the attempt.
 */
export function releaseReason(
  hasHolder: boolean,
  holderIsLive: boolean,
  holderIsGrabbing: boolean,
): ReleaseReason {
  if (!hasHolder) return "none";
  if (!holderIsLive) return "tracking-lost";
  return holderIsGrabbing ? "none" : "opened";
}

/** A blink mid-circle must not drop the pestle. */
export const CRANK_LOST_S = 1.15;
/** Side-on fist reads open. Wait before treating that as a let-go. */
export const CRANK_OPEN_S = 0.45;

/**
 * Keep the mill grabbed through a circle. Recognition dies on the edge-on
 * frames; dropping the handle there is what made "Muele" stop.
 */
export function crankShouldHold(
  holderPresent: boolean,
  grabbing: boolean,
  lostS: number,
  openS: number,
): boolean {
  if (holderPresent && grabbing) return true;
  if (holderPresent && openS < CRANK_OPEN_S) return true;
  if (!holderPresent && lostS < CRANK_LOST_S) return true;
  return false;
}

export function canCommitRelease(
  reason: ReleaseReason,
  effort: number,
  minimumEffort: number,
): boolean {
  return reason === "opened" && effort > minimumEffort;
}
