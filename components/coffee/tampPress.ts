/**
 * Authored tamp: lift, slam, twist, recover.
 *
 * Tracking only decides *when* a press starts (tamper over the basket).
 * The strike itself is a clip — a webcam Y-stroke is too noisy to look
 * like a barista packing a puck, and a 4px dip is what made "Prensa"
 * feel anticlimactic.
 */

export const TAMP_DURATION = 0.84;
export const TAMP_HIT_AT = 0.4;
/** A beat over the basket before the first strike steals the hand. */
export const TAMP_DWELL_S = 0.14;
/** Rest between strikes so three hits read as three, not a blur. */
export const TAMP_GAP_S = 0.18;

export type TampPose = {
  /** Extra height. Positive is up; negative drives the head into the puck. */
  lift: number;
  pitch: number;
  twist: number;
  /** How packed the grounds look, 0..1. */
  squash: number;
  /** Dust burst, 0..1. */
  dust: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function ease(t: number) {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

export function tampAmount(elapsed: number, duration = TAMP_DURATION): number {
  return clamp01(elapsed / Math.max(duration, 1e-4));
}

/** True the frame the head meets the puck. */
export function tampHits(prev: number, next: number, at = TAMP_HIT_AT): boolean {
  return prev < at && next >= at;
}

/** Once the first strike has started, finish the set even if tracking dies. */
export function tampSetOpen(
  tamping: boolean,
  amount: number,
  goal: number,
): boolean {
  return tamping || (amount > 0 && amount < goal);
}

/**
 * Only the tamp stage owns this lock. Grind stores radians in `amount`;
 * treating 0..3 as "a tamp set" froze the mill after the first twitch.
 */
export function tampBusyOnStage(
  kind: string,
  tamping: boolean,
  amount: number,
  goal: number,
): boolean {
  return kind === "tamp" && tampSetOpen(tamping, amount, goal);
}

/**
 * One strike. The last hit of a set (strike >= 2) winds higher and hits
 * harder, so the third press is the one that lands.
 */
export function tampPose(amount: number, strike = 0): TampPose {
  const a = clamp01(amount);
  const finale = strike >= 2 ? 1.18 : 1;
  const wind = ease(Math.min(1, a / 0.28));
  const slam = ease(clamp01((a - 0.26) / 0.14));
  const press = ease(clamp01((a - 0.4) / 0.2));
  const recover = ease(clamp01((a - 0.7) / 0.3));
  const way = strike % 2 === 0 ? 1 : -1;

  return {
    lift: wind * 0.58 * finale - slam * 0.86 * finale + recover * 0.4,
    pitch: 0.1 + slam * 0.22 - recover * 0.14,
    twist: press * 0.72 * way * (1 - recover * 0.35),
    squash: slam * (1 - recover * 0.4),
    dust: slam * (1 - recover),
  };
}
