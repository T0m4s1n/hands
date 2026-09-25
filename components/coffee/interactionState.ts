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

export function canCommitRelease(
  reason: ReleaseReason,
  effort: number,
  minimumEffort: number,
): boolean {
  return reason === "opened" && effort > minimumEffort;
}
