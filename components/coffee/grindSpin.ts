/**
 * Authored grind: grabbing the mill starts a mock attempt.
 *
 * Same shape as tamp. Tracking only decides *when* the clip starts.
 * The pestle then orbits on a clock, the HUD counts vueltas, and the
 * designed mark is awarded when the clip finishes — never on the
 * first frame, and never from a webcam circle.
 */

/** Long enough to read as work; short enough not to stall the brew. */
export const GRIND_DURATION = 2.6;
/** Designed mark — the clip is the attempt, not the wrist path. */
export const GRIND_MARK = 0.92;
/** Always show at least this much travel so a short goal still turns. */
export const GRIND_TRAVEL_MIN = Math.PI * 2.4;

export type GrindPose = {
  lean: number;
  roll: number;
  bob: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** 0..1 through the clip. */
export function grindProgress(
  elapsed: number,
  duration = GRIND_DURATION,
): number {
  return clamp01(elapsed / Math.max(duration, 1e-4));
}

/** Radians the HUD should show: fills during the clip, not at the start. */
export function grindAmount(progress: number, goal: number): number {
  return clamp01(progress) * Math.max(goal, 0);
}

/** Where the pestle sits on the mortar at this beat. */
export function grindAngle(
  from: number,
  progress: number,
  goal: number,
): number {
  const travel = Math.max(goal, GRIND_TRAVEL_MIN);
  return from + travel * clamp01(progress);
}

export function grindBusyOnStage(
  kind: string,
  grinding: boolean,
): boolean {
  return kind === "crank" && grinding;
}

/** Lean into the bowl and bob so a turning pestle reads as work. */
export function grindPose(angle: number, work: number): GrindPose {
  const w = Math.min(1, Math.max(0, work));
  return {
    lean: 0.58 + w * 0.22,
    roll: Math.sin(angle * 2) * (0.1 + w * 0.16),
    bob: Math.sin(angle * 3) * (0.035 + w * 0.045),
  };
}
