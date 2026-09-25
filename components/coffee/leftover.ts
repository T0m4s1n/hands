import type { Vessel } from "./liquid.ts";
import type { Stage } from "./recipes.ts";

/**
 * Pour-over station: grounds live in the dripper cone, coffee fills the
 * glass underneath. Stacking the dosing bowl on the carafe read as a
 * frying pan left on the glass — the bowl dumps and leaves, the bed stays.
 */

export const DRIPPER = {
  heap: [0, 0, 1.0] as const,
  radius: 0.26,
  count: 20,
  /** Where the kettle stream lands — the bed, not the carafe floor. */
  bed: 1.14,
} as const;

export function usesDripper(stage: Stage): boolean {
  return stage.sits === "brewer";
}

/**
 * The franja has to sit in the glass body. The full carafe depth hid the
 * coffee up inside the cone.
 */
export function dripperVessel(base: Vessel): Vessel {
  return { ...base, depth: Math.min(base.depth, 0.76) };
}

/**
 * Espresso group: the portafilter locks *under* the group, the cup sits in
 * front and fills. Parking the pan on the machine was the same mistake as
 * stacking the dosing bowl on the carafe.
 */
export const GROUP = {
  /** Mug toward the camera, clear of the machine body. */
  cup: [0, -0.9] as const,
  /** Seated portafilter, under the group, handle out. */
  lock: [0, -0.1, 1.06] as const,
  /** Twin streams from the group heads, relative to the stage target. */
  spouts: [
    [-0.22, -0.18, 1.16],
    [0.22, -0.18, 1.16],
  ] as const,
} as const;

export function usesGroup(stage: Stage): boolean {
  return stage.kind === "hold" && stage.sits === "machine";
}

export function brewAt(
  stage: Stage,
): readonly [number, number] {
  if (usesGroup(stage) && stage.vessel) {
    return [
      stage.target[0] + GROUP.cup[0],
      stage.target[1] + GROUP.cup[1],
    ];
  }
  return stage.target;
}
