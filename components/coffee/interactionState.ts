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

/** A blink mid-carry must not drop the cup. */
export const CARRY_LOST_S = 0.4;
/** A blink mid-circle must not drop the pestle. */
export const CRANK_LOST_S = 0.65;
/**
 * Side-on fist still flickers open. The grab latch already waits a few
 * frames; this is only a thin extra beat. 0.45s plus a long latch is
 * what made the handle feel glued on.
 */
export const CRANK_OPEN_S = 0.18;

/**
 * Keep the mill through an edge-on blink. An open hand that has left
 * the mill is a let-go — the player walked away.
 */
export function crankShouldHold(
  holderPresent: boolean,
  grabbing: boolean,
  lostS: number,
  openS: number,
  away = false,
): boolean {
  if (!grabbing && away) return false;
  if (holderPresent && grabbing) return true;
  if (holderPresent && openS < CRANK_OPEN_S) return true;
  if (!holderPresent && lostS < CRANK_LOST_S) return true;
  return false;
}

/** Keep a carried cup through a blink. Opening the hand still lets go. */
export function carryShouldHold(
  holderPresent: boolean,
  lostS: number,
): boolean {
  return !holderPresent && lostS < CARRY_LOST_S;
}

export function canCommitRelease(
  reason: ReleaseReason,
  effort: number,
  minimumEffort: number,
): boolean {
  return reason === "opened" && effort > minimumEffort;
}
