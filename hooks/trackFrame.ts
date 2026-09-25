import {
  assignHands,
  fuseHandedness,
  selectPersonHands,
  type HandTrackHint,
} from "./handAssignment.ts";
import { applyGrabLatch, type GrabThresholds } from "./grabLatch.ts";
import { grabClosure, handFist } from "./handCurl.ts";
import { pinToLiveWrist } from "./handMotion.ts";
import type { Handedness, Vec3 } from "./useHandTracking.ts";

/** How far a wrist may travel between inferences and still be the same hand. */
export const MATCH_RADIUS = 0.58;
/** Frames a slot must disagree with a confident label before we relabel it. */
const RELABEL_AFTER = 8;
const LONE_RELABEL_AFTER = 12;
/** Keep pose, pinch and carry through a blink or a brief occlusion. */
export const COAST_FOR_MS = 1400;
/** Remember the slot longer than the visual so re-entry does not swap sides. */
export const IDENTITY_MEMORY_MS = 2400;

const STILL_RATE = 7;
const MOVING_RATE = 72;
const MOVING_SPAN = 0.06;

export type TrackedDetection = {
  raw: Vec3[];
  wrist: Vec3;
  label: Handedness;
  labelScore?: number;
};

export type PersistedHand = {
  smoothed: Vec3[];
  velocity: Vec3;
  isGrabbing: boolean;
  pinchSmoothed: number;
  enterFrames: number;
  exitFrames: number;
  missed: number;
  missingForMs: number;
  identityConfidence: number;
  /** How long the fused label has disagreed with this slot. */
  disagree: number;
};

export type TrackedHandDraft = {
  handedness: Handedness;
  tracking: "live" | "coasting";
  landmarks: Vec3[];
  smoothedLandmarks: Vec3[];
  pinchDistance: number;
  isGrabbing: boolean;
  identityConfidence: number;
  missingForMs: number;
};

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function pinchDistance(landmarks: Vec3[]): number {
  const wrist = landmarks[0];
  const thumb = landmarks[4];
  const index = landmarks[8];
  const knuckle = landmarks[9];
  if (!wrist || !thumb || !index || !knuckle) return 1;
  const span = Math.max(
    Math.hypot(wrist.x - knuckle.x, wrist.y - knuckle.y, wrist.z - knuckle.z),
    1e-4,
  );
  return (
    Math.hypot(thumb.x - index.x, thumb.y - index.y, thumb.z - index.z) / span
  );
}

/**
 * Smooth a whole cloud at one rate measured at the wrist. Per-joint rates
 * tear fingers off the palm; per-frame blends change with refresh rate.
 */
export function smoothLandmarks(
  prev: Vec3[] | undefined,
  next: Vec3[],
  dt: number,
): Vec3[] {
  if (!prev || prev.length !== next.length) return next;
  const travelled = Math.hypot(next[0].x - prev[0].x, next[0].y - prev[0].y);
  const moving = Math.min(1, travelled / MOVING_SPAN);
  const rate = STILL_RATE + (MOVING_RATE - STILL_RATE) * moving;
  const t = 1 - Math.exp(-rate * Math.min(dt, 0.12));
  return next.map((point, i) => lerpVec(prev[i], point, t));
}

function wristStep(prev: Vec3 | undefined, next: Vec3): Vec3 {
  if (!prev) return { x: 0, y: 0, z: 0 };
  return {
    x: next.x - prev.x,
    y: next.y - prev.y,
    z: next.z - prev.z,
  };
}

function blendVelocity(prev: Vec3 | undefined, step: Vec3): Vec3 {
  if (!prev) return step;
  return {
    x: prev.x * 0.4 + step.x * 0.6,
    y: prev.y * 0.4 + step.y * 0.6,
    z: prev.z * 0.4 + step.z * 0.6,
  };
}

function drift(points: Vec3[], velocity: Vec3, amount: number): Vec3[] {
  return points.map((point) => ({
    x: point.x + velocity.x * amount,
    y: point.y + velocity.y * amount,
    z: point.z + velocity.z * amount,
  }));
}

function flipDrafts(
  drafts: TrackedHandDraft[],
  from: Handedness,
  to: Handedness,
) {
  for (const draft of drafts) {
    if (draft.handedness === from) draft.handedness = to;
    else if (draft.handedness === to) draft.handedness = from;
  }
}

/**
 * Continuity keeps a slot stable through a one-frame label flip. If the
 * skeleton and the classifier keep saying the other side, move the slot so
 * Left is actually the left hand.
 */
function relabelIfStuck(
  persist: Map<Handedness, PersistedHand>,
  drafts: TrackedHandDraft[],
  seen: Set<Handedness>,
) {
  const left = persist.get("Left");
  const right = persist.get("Right");
  if (
    left &&
    right &&
    seen.has("Left") &&
    seen.has("Right") &&
    left.disagree >= RELABEL_AFTER &&
    right.disagree >= RELABEL_AFTER
  ) {
    persist.set("Left", { ...right, disagree: 0 });
    persist.set("Right", { ...left, disagree: 0 });
    flipDrafts(drafts, "Left", "Right");
    return;
  }

  const lone = seen.size === 1 ? [...seen][0] : null;
  if (!lone) return;
  const record = persist.get(lone);
  const other: Handedness = lone === "Left" ? "Right" : "Left";
  if (!record || persist.has(other) || record.disagree < LONE_RELABEL_AFTER) {
    return;
  }
  persist.delete(lone);
  persist.set(other, { ...record, disagree: 0 });
  seen.delete(lone);
  seen.add(other);
  flipDrafts(drafts, lone, other);
}

/**
 * One inference → assigned, smoothed, latched hands.
 *
 * Coasting hands stay in the published list so the glove and the game keep
 * the same object. Identity stays in `persist` longer than that list so a
 * returning wrist rematches its slot instead of flipping Left/Right.
 */
export function trackFrame(
  persist: Map<Handedness, PersistedHand>,
  detections: readonly TrackedDetection[],
  detectionDt: number,
  thresholds: GrabThresholds,
): TrackedHandDraft[] {
  const dt = Math.min(0.12, Math.max(1 / 90, detectionDt));
  const memory = new Map<Handedness, HandTrackHint>();
  for (const [handedness, persisted] of persist) {
    memory.set(handedness, {
      wrist: persisted.smoothed[0],
      velocity: persisted.velocity,
      missed: persisted.missed,
    });
  }

  const labeled = detections.map((detection) => {
    const fused = fuseHandedness(
      detection.label,
      detection.labelScore ?? 0.5,
      detection.raw,
    );
    return {
      ...detection,
      label: fused.label,
      labelScore: fused.score,
      landmarks: detection.raw,
    };
  });
  const focused = selectPersonHands(labeled, memory);
  const claimed = assignHands(focused, memory, MATCH_RADIUS);
  const seen = new Set<Handedness>();
  const next: TrackedHandDraft[] = [];

  claimed.forEach((detection, handedness) => {
    seen.add(handedness);
    const prev = persist.get(handedness);
    const shaped = smoothLandmarks(prev?.smoothed, detection.raw, dt);
    const smoothed = pinToLiveWrist(shaped, detection.raw[0] ?? detection.wrist);
    const latch = applyGrabLatch(
      prev ?? {
        isGrabbing: false,
        pinchSmoothed: 0,
        enterFrames: 0,
        exitFrames: 0,
      },
      grabClosure(pinchDistance(smoothed), handFist(smoothed)),
      thresholds,
    );
    const agree = detection.label === handedness ? 1 : 0;
    const identityConfidence = Math.min(
      1,
      Math.max(
        0.08,
        (prev?.identityConfidence ?? 0.4) * 0.78 +
          (agree * (detection.labelScore ?? 0.55) + (1 - agree) * 0.12) * 0.22,
      ),
    );

    const disagree =
      detection.label !== handedness && (detection.labelScore ?? 0) > 0.66
        ? (prev?.disagree ?? 0) + 1
        : 0;

    persist.set(handedness, {
      smoothed,
      velocity: blendVelocity(prev?.velocity, wristStep(prev?.smoothed[0], smoothed[0])),
      isGrabbing: latch.isGrabbing,
      pinchSmoothed: latch.pinchSmoothed,
      enterFrames: latch.enterFrames,
      exitFrames: latch.exitFrames,
      missed: 0,
      missingForMs: 0,
      identityConfidence,
      disagree,
    });

    next.push({
      handedness,
      tracking: "live",
      landmarks: detection.raw,
      smoothedLandmarks: smoothed,
      pinchDistance: latch.pinchSmoothed,
      isGrabbing: latch.isGrabbing,
      identityConfidence,
      missingForMs: 0,
    });
  });

  relabelIfStuck(persist, next, seen);

  const elapsedMs = dt * 1000;
  for (const [handedness, persisted] of persist) {
    if (seen.has(handedness)) continue;
    persisted.missed += 1;
    persisted.missingForMs += elapsedMs;
    persisted.velocity = {
      x: persisted.velocity.x * 0.76,
      y: persisted.velocity.y * 0.76,
      z: persisted.velocity.z * 0.76,
    };
    persisted.identityConfidence *= 0.97;
    if (persisted.missingForMs >= IDENTITY_MEMORY_MS) {
      persist.delete(handedness);
      continue;
    }
    if (persisted.missingForMs >= COAST_FOR_MS) continue;

    const drifted = drift(persisted.smoothed, persisted.velocity, 0.45);
    persisted.smoothed = drifted;
    next.push({
      handedness,
      tracking: "coasting",
      landmarks: drifted,
      smoothedLandmarks: drifted,
      pinchDistance: persisted.pinchSmoothed,
      isGrabbing: persisted.isGrabbing,
      identityConfidence: persisted.identityConfidence,
      missingForMs: persisted.missingForMs,
    });
  }

  return next;
}
