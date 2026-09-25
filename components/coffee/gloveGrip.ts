/**
 * Designed glove grips.
 *
 * Tracking still says *whether* a hand is closed. *How* it holds each tool
 * is a predetermined pose — a webcam thumb is too noisy to wrap a pestle,
 * and a generic fist does not look like it is on a spoon handle.
 */

import type { Handedness } from "@/hooks/useHandTracking";
import type { PropKind } from "./recipes";

export type GripId =
  | "free"
  | "shaft"
  | "spoon"
  | "bowl"
  | "pot"
  | "carton"
  | "cup"
  | "pan"
  | "mallet";

export type GloveGrip = {
  /** thumb, index, middle, ring, pinky — 0 open, 1 shut */
  folds: readonly [number, number, number, number, number];
  /** How far the thumb swings across the palm to meet the fingers. */
  oppose: number;
  /** Extra inward tuck so the mitt hugs a handle instead of hovering. */
  squeeze: number;
};

export type GloveHold = {
  handedness: Handedness | null;
  tool: PropKind | null;
  near: boolean;
  holding: boolean;
  gripX: number;
  gripY: number;
  gripZ: number;
  /** 0..1 predetermined dump: wrist tips the scoop. */
  dump: number;
};

export type FingerSpec = {
  x: number;
  y: number;
  z: number;
  spread: number;
  thumb: boolean;
};

export type FingerPose = {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  mid: readonly [number, number, number];
  tip: readonly [number, number, number];
};

export const GRIPS: Record<GripId, GloveGrip> = {
  free: { folds: [0, 0, 0, 0, 0], oppose: 0, squeeze: 0 },
  /** Pestle / crank: wrap a vertical shaft, thumb opposing. */
  shaft: { folds: [0.8, 0.84, 0.9, 0.88, 0.8], oppose: 1, squeeze: 0.38 },
  /** Spoon handle: pinch, index a little more open so the shaft reads. */
  spoon: { folds: [0.72, 0.64, 0.8, 0.78, 0.7], oppose: 0.88, squeeze: 0.24 },
  /** Bowl / filter: cradle the rim. */
  bowl: { folds: [0.42, 0.5, 0.54, 0.5, 0.44], oppose: 0.42, squeeze: 0.16 },
  /** Kettle body. */
  pot: { folds: [0.7, 0.74, 0.8, 0.76, 0.64], oppose: 0.78, squeeze: 0.28 },
  /** Milk carton / jug. */
  carton: { folds: [0.72, 0.76, 0.82, 0.78, 0.66], oppose: 0.82, squeeze: 0.3 },
  /** Cup or mug: C-shape around the body. */
  cup: { folds: [0.6, 0.66, 0.7, 0.66, 0.54], oppose: 0.72, squeeze: 0.2 },
  /** Portafilter handle. */
  pan: { folds: [0.74, 0.72, 0.86, 0.84, 0.76], oppose: 0.9, squeeze: 0.3 },
  /** Tamper: tight fist on the mallet neck. */
  mallet: { folds: [0.82, 0.88, 0.92, 0.9, 0.84], oppose: 0.7, squeeze: 0.42 },
};

const TOOL_GRIP: Partial<Record<PropKind, GripId>> = {
  scoop: "spoon",
  crank: "shaft",
  filter: "bowl",
  kettle: "pot",
  jug: "carton",
  cup: "cup",
  mug: "cup",
  portafilter: "pan",
  tamper: "mallet",
};

export function emptyGloveHold(): GloveHold {
  return {
    handedness: null,
    tool: null,
    near: false,
    holding: false,
    gripX: 0,
    gripY: 0,
    gripZ: 0,
    dump: 0,
  };
}

export function writeGloveHold(
  hold: GloveHold | null | undefined,
  next: GloveHold | null,
) {
  if (!hold) return;
  if (!next) {
    hold.handedness = null;
    hold.tool = null;
    hold.near = false;
    hold.holding = false;
    hold.dump = 0;
    return;
  }
  hold.handedness = next.handedness;
  hold.tool = next.tool;
  hold.near = next.near;
  hold.holding = next.holding;
  hold.gripX = next.gripX;
  hold.gripY = next.gripY;
  hold.gripZ = next.gripZ;
  hold.dump = next.dump;
}

export function gripForTool(tool: PropKind | null | undefined): GripId {
  if (!tool) return "free";
  return TOOL_GRIP[tool] ?? "free";
}

/** Holding uses the designed pose. Near only hints — stealing the mitt felt broken. */
export function gripBlend(near: boolean, holding: boolean): number {
  if (holding) return 1;
  if (near) return 0.16;
  return 0;
}

/** Sit on the handle only while carrying. Near must not magnetize the glove. */
export function seekHandle(_near: boolean, holding: boolean): number {
  return holding ? 1 : 0;
}

/**
 * Thumb is driven by the other four fingers. MediaPipe's thumb hops on its
 * own and that is what made the mitt look broken.
 */
export function thumbFollowsFingers(
  index: number,
  middle: number,
  ring: number,
  pinky: number,
): number {
  const shut = (index + middle + ring + pinky) / 4;
  return Math.min(1, Math.max(0, shut * 1.06));
}

export function composeFolds(
  live: readonly number[],
  grip: GloveGrip,
  amount: number,
): number[] {
  const t = Math.min(1, Math.max(0, amount));
  const next = [0, 0, 0, 0, 0];
  for (let i = 1; i < 5; i++) {
    const a = live[i] ?? 0;
    next[i] = a + ((grip.folds[i] ?? 0) - a) * t;
  }
  next[0] = Math.max(
    thumbFollowsFingers(next[1], next[2], next[3], next[4]),
    grip.folds[0] * t,
  );
  return next;
}

export function mixGripScalar(live: number, designed: number, amount: number) {
  const t = Math.min(1, Math.max(0, amount));
  return live + (designed - live) * t;
}

/**
 * Local joint pose for one designed finger. Thumb opposition is a wrap
 * across the palm, never a spin around its own rest spread.
 */
export function poseGloveFinger(
  spec: FingerSpec,
  curl: number,
  oppose: number,
  squeeze: number,
): FingerPose {
  const c = Math.min(1, Math.max(0, curl));
  const o = Math.min(1, Math.max(0, oppose));
  const q = Math.min(1, Math.max(0, squeeze));
  if (spec.thumb) {
    return {
      position: [
        spec.x + c * (0.06 + 0.1 * o),
        spec.y - c * 0.05,
        spec.z + c * (0.05 + 0.04 * o),
      ],
      rotation: [
        0.22 + c * 0.95,
        c * (0.28 + 0.62 * o),
        spec.spread * (1 - c * 0.58) + c * o * 0.4,
      ],
      mid: [c * 1.05, 0, c * 0.18 * o],
      tip: [c * 0.75, 0, 0],
    };
  }
  const tuck = 1 - c * 0.32 - q * 0.28;
  return {
    position: [
      spec.x * tuck,
      spec.y - c * 0.1,
      spec.z + c * 0.08 + q * 0.04,
    ],
    rotation: [0.06 + c * 1.52, 0, spec.spread * (1 - c * 0.86)],
    mid: [c * 1.52, 0, 0],
    tip: [c * 1.12, 0, 0],
  };
}
