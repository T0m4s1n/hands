import type { Handedness, Vec3 } from "../../hooks/useHandTracking.ts";
import { menuAimPoint } from "../../hooks/screenAim.ts";

export type LockHand = {
  handedness: Handedness;
  smoothedLandmarks: Vec3[];
  cursor: Vec3;
  isGrabbing: boolean;
  /** Coasting ghosts must not steal a fresh claim. */
  tracking?: "live" | "coasting";
};

export type LockTip = { x: number; y: number };

export type LockState = {
  /** Sticky lock id. 0 = unlocked. A new claim never reuses the last id. */
  lockId: number;
  /** Monotonic counter so RecipeMenu can tell a new claim from a label flip. */
  nextId: number;
  /** First-claim side. A hint, never the identity. */
  side: Handedness | null;
  wrist: LockTip | null;
  tip: LockTip | null;
  tipAt: number;
  seenAt: number;
  relockAfter: number;
  grabbing: boolean;
  /** Wrist we are about to claim, while two hands argue. */
  pendingWrist: LockTip | null;
  pendingFrames: number;
};

export type LockView = {
  tip: LockTip | null;
  active: boolean;
  grabbing: boolean;
  side: Handedness | null;
  lockId: number;
};

/** Keep aiming at the last tip while MediaPipe drops a landmark. */
export const TIP_HOLD_MS = 220;
/** Keep the lock while the pointing hand blinks out of the frame. */
export const LOCK_GRACE_MS = 960;
/** After an unlock, ignore claims so a flicker cannot bounce sides. */
export const RELOCK_COOLDOWN_MS = 220;
/**
 * Furthest a wrist may jump in one sample and still be the same hand.
 * Two palms of one person sit ~0.25–0.40 apart, so this stays under a swap.
 */
export const MAX_FOLLOW = 0.34;
/** A resting / curled hand must not steal the carta pointer. */
export const MIN_POINT_SCORE = 2.35;
/** Two pointing hands must agree on a wrist this many samples. */
export const CLAIM_FRAMES = 3;

export function emptyLock(): LockState {
  return {
    lockId: 0,
    nextId: 0,
    side: null,
    wrist: null,
    tip: null,
    tipAt: 0,
    seenAt: 0,
    relockAfter: 0,
    grabbing: false,
    pendingWrist: null,
    pendingFrames: 0,
  };
}

function dist2(a: Vec3, b: Vec3) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function plane(a: LockTip, b: LockTip) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * How clearly this hand is pointing with the index — used only to pick the
 * first lock, never to steal mid-aim.
 */
export function indexPointScore(landmarks: Vec3[]): number {
  if (landmarks.length < 13) {
    // Pointer fallback (no landmarks): still selectable, just not preferred.
    return 0;
  }
  const wrist = landmarks[0];
  const mcp = landmarks[5];
  const tip = landmarks[8];
  const middle = landmarks[12];
  const tipReach = Math.sqrt(dist2(tip, wrist));
  const midReach = Math.sqrt(dist2(middle, wrist));
  const knuckle = Math.sqrt(dist2(mcp, wrist)) + 1e-5;
  return (tipReach / knuckle) * 2 + (tipReach - midReach);
}

export function indexTipOf(hand: LockHand): LockTip | null {
  return menuAimPoint(hand);
}

export function wristOf(hand: LockHand): LockTip {
  const bone = hand.smoothedLandmarks[0];
  if (bone && Number.isFinite(bone.x) && Number.isFinite(bone.y)) {
    return { x: bone.x, y: bone.y };
  }
  return indexTipOf(hand) ?? { x: 0.5, y: 0.5 };
}

function isPointerFallback(hand: LockHand): boolean {
  return hand.smoothedLandmarks.length < 13;
}

function pointScoreOf(hand: LockHand): number {
  return isPointerFallback(hand)
    ? 0
    : indexPointScore(hand.smoothedLandmarks);
}

function canClaim(hand: LockHand): boolean {
  if (hand.tracking === "coasting") return false;
  if (!indexTipOf(hand)) return false;
  return isPointerFallback(hand) || pointScoreOf(hand) >= MIN_POINT_SCORE;
}

function nearPending(
  hands: readonly LockHand[],
  pending: LockTip,
): LockHand | null {
  let best: LockHand | null = null;
  let bestTravel = Infinity;
  for (const hand of pointingHands(hands)) {
    const travel = plane(wristOf(hand), pending);
    if (travel > 0.14 || travel >= bestTravel) continue;
    bestTravel = travel;
    best = hand;
  }
  return best;
}

/** Candidate for a fresh lock: must actually be pointing, or be the mouse. */
export function pickFreshLock(hands: readonly LockHand[]): LockHand | null {
  let best: LockHand | null = null;
  let bestScore = -Infinity;
  for (const hand of hands) {
    if (!canClaim(hand)) continue;
    const score = isPointerFallback(hand) ? 0 : pointScoreOf(hand);
    if (score > bestScore) {
      bestScore = score;
      best = hand;
    }
  }
  return best;
}

/**
 * The locked hand is the wrist nearest the last locked wrist — not "Left"
 * or "Right". Those labels swap when MediaPipe flips chirality, and a
 * lookup by side then aims at the other person's (or the other) palm.
 */
export function followLocked(
  hands: readonly LockHand[],
  lock: LockState,
): LockHand | null {
  if (!lock.wrist && !lock.side) return null;

  let best: LockHand | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const hand of hands) {
    if (!indexTipOf(hand)) continue;
    const wrist = wristOf(hand);
    const travel = lock.wrist ? plane(wrist, lock.wrist) : 0;
    if (lock.wrist && travel > MAX_FOLLOW) continue;
    const sideTax =
      lock.side && hand.handedness !== lock.side ? 0.035 : 0;
    const tipTax =
      lock.tip && indexTipOf(hand)
        ? plane(indexTipOf(hand)!, lock.tip) * 0.15
        : 0;
    const cost = travel + sideTax + tipTax;
    if (cost < bestCost) {
      bestCost = cost;
      best = hand;
    }
  }

  return best;
}

function unlock(lock: LockState, now: number): LockView {
  lock.lockId = 0;
  lock.side = null;
  lock.wrist = null;
  lock.tip = null;
  lock.grabbing = false;
  lock.pendingWrist = null;
  lock.pendingFrames = 0;
  lock.relockAfter = now + RELOCK_COOLDOWN_MS;
  return { tip: null, active: false, grabbing: false, side: null, lockId: 0 };
}

function pointingHands(hands: readonly LockHand[]): LockHand[] {
  return hands.filter(canClaim);
}

function hold(
  lock: LockState,
  grabbing: boolean,
  active: boolean,
): LockView {
  return {
    tip: active ? lock.tip : null,
    active,
    grabbing,
    side: lock.side,
    lockId: lock.lockId,
  };
}

/**
 * Stick to one index fingertip by wrist continuity.
 *
 * Cases this covers:
 * - Two hands in frame → lock the clearer pointer, ignore the other.
 * - Left/Right labels swap → still follow the same wrist.
 * - Locked hand flickers a few frames → hold last tip, stay active.
 * - Locked hand leaves → grace, then unlock (other hand may claim after cooldown).
 * - Tip landmark missing while wrist remains → hold last tip briefly.
 * - Bad / empty landmarks with a live world cursor (mouse) → still claim.
 */
export function resolveLock(
  hands: readonly LockHand[],
  lock: LockState,
  now: number,
): LockView {
  // --- already locked: stay on that wrist only ---
  if (lock.lockId !== 0) {
    const owned = followLocked(hands, lock);
    const tip = owned ? indexTipOf(owned) : null;

    if (owned && tip) {
      lock.tip = tip;
      lock.wrist = wristOf(owned);
      lock.tipAt = now;
      lock.seenAt = now;
      lock.grabbing = owned.isGrabbing;
      // Keep the original side. Updating it on a chirality flip would
      // look like a new lock to the carta and reset the hold charge.
      if (!lock.side) lock.side = owned.handedness;
      return {
        tip,
        active: true,
        grabbing: lock.grabbing,
        side: lock.side,
        lockId: lock.lockId,
      };
    }

    if (owned) {
      lock.wrist = wristOf(owned);
      lock.seenAt = now;
      lock.grabbing = owned.isGrabbing;
      const holding = Boolean(lock.tip && now - lock.tipAt <= TIP_HOLD_MS);
      return hold(lock, lock.grabbing, holding);
    }

    if (lock.tip && now - lock.seenAt <= LOCK_GRACE_MS) {
      return hold(lock, false, true);
    }

    return unlock(lock, now);
  }

  // --- unlocked: claim at most one hand ---
  if (now < lock.relockAfter) {
    return { tip: null, active: false, grabbing: false, side: null, lockId: 0 };
  }

  const claim = pickFreshLock(hands);
  if (!claim) {
    lock.pendingWrist = null;
    lock.pendingFrames = 0;
    return { tip: null, active: false, grabbing: false, side: null, lockId: 0 };
  }

  const tip = indexTipOf(claim);
  if (!tip) {
    return { tip: null, active: false, grabbing: false, side: null, lockId: 0 };
  }

  const rivals = pointingHands(hands);
  let winner = claim;
  if (rivals.length > 1) {
    const stuck = lock.pendingWrist
      ? nearPending(hands, lock.pendingWrist)
      : null;
    if (stuck) {
      lock.pendingFrames += 1;
      winner = stuck;
    } else {
      lock.pendingWrist = wristOf(claim);
      lock.pendingFrames = 1;
      winner = claim;
    }
    if (lock.pendingFrames < CLAIM_FRAMES) {
      return {
        tip: indexTipOf(winner),
        active: false,
        grabbing: false,
        side: null,
        lockId: 0,
      };
    }
  }

  const won = indexTipOf(winner);
  if (!won) {
    return { tip: null, active: false, grabbing: false, side: null, lockId: 0 };
  }

  lock.pendingWrist = null;
  lock.pendingFrames = 0;
  lock.nextId += 1;
  lock.lockId = lock.nextId;
  lock.side = winner.handedness;
  lock.tip = won;
  lock.wrist = wristOf(winner);
  lock.tipAt = now;
  lock.seenAt = now;
  lock.grabbing = winner.isGrabbing;
  return {
    tip: won,
    active: true,
    grabbing: winner.isGrabbing,
    side: winner.handedness,
    lockId: lock.lockId,
  };
}
