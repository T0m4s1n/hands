/**
 * Predetermined scoop dump: the wrist tips, then beans fall into the bowl.
 *
 * Tracking only decides *when* the clip starts (scoop over the grinder).
 * The pour itself is authored — a webcam flick is too noisy to look like
 * coffee leaving a spoon.
 */

export const DUMP_DURATION = 1.62;
export const DUMP_RELEASE_AT = 0.38;
/** Stay over the mill a beat before the clip steals the hand. */
export const DUMP_DWELL = 0.72;

export type DumpPose = {
  /** Radians the blade tips down. */
  roll: number;
  /** Small yaw so the pour reads in the three-quarter view. */
  twist: number;
  /** Extra height while the wrist flicks. */
  lift: number;
};

export type FallingBean = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  settled: boolean;
};

export type DumpBowl = {
  x: number;
  y: number;
  z: number;
  radius: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function scatter(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function ease(t: number) {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

export function dumpAmount(elapsed: number, duration = DUMP_DURATION): number {
  return clamp01(elapsed / Math.max(duration, 1e-4));
}

export function dumpReleases(amount: number): boolean {
  return amount >= DUMP_RELEASE_AT;
}

/**
 * Wind-up, tip, hold. The scoop stays poured at the end so the last
 * beans are still leaving as the clip finishes.
 */
export function scoopDumpPose(amount: number): DumpPose {
  const a = clamp01(amount);
  const wind = ease(Math.min(1, a / 0.22));
  const pour = ease(clamp01((a - 0.18) / 0.32));
  return {
    roll: pour * 1.72,
    twist: wind * 0.28,
    lift: Math.sin(Math.min(1, a / 0.42) * Math.PI) * 0.32 + pour * 0.06,
  };
}

/** Blade of the yawed scoop, lowered as it tips. */
export function dumpMouth(
  origin: { x: number; y: number; z: number },
  pose: DumpPose,
): { x: number; y: number; z: number } {
  const reach = 0.44;
  return {
    x: origin.x + reach * Math.cos(pose.roll * 0.4),
    y: origin.y + pose.twist * 0.08,
    z: origin.z + pose.lift - Math.sin(pose.roll) * 0.36,
  };
}

export function spawnDumpBean(
  index: number,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
): FallingBean {
  const a = scatter(index + 3);
  const b = scatter(index + 41);
  const c = scatter(index + 73);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = Math.hypot(dx, dy) || 1;
  return {
    x: from.x + (a - 0.5) * 0.08,
    y: from.y + (b - 0.5) * 0.08,
    z: from.z + c * 0.04,
    vx: (dx / span) * (1.4 + a * 0.8) + (b - 0.5) * 0.45,
    vy: (dy / span) * (1.4 + b * 0.8) + (c - 0.5) * 0.45,
    vz: 0.55 + a * 1.1,
    spin: a * Math.PI * 2,
    settled: false,
  };
}

export function stepDumpBean(
  bean: FallingBean,
  dt: number,
  bowl: DumpBowl,
): FallingBean {
  if (bean.settled) return bean;
  const step = Math.min(dt, 0.05);
  bean.vz -= 13.5 * step;
  bean.x += bean.vx * step;
  bean.y += bean.vy * step;
  bean.z += bean.vz * step;
  bean.spin += 12 * step;

  if (bean.z <= bowl.z) {
    bean.z = bowl.z;
    if (bean.vz < 0) bean.vz *= -0.42;
    bean.vx *= 0.62;
    bean.vy *= 0.62;
    if (Math.abs(bean.vz) < 0.38 && Math.hypot(bean.vx, bean.vy) < 0.4) {
      bean.settled = true;
      bean.vz = 0;
      bean.vx = 0;
      bean.vy = 0;
    }
  }

  const ox = bean.x - bowl.x;
  const oy = bean.y - bowl.y;
  const reach = Math.hypot(ox, oy);
  if (reach > bowl.radius && reach > 1e-6) {
    const scale = bowl.radius / reach;
    bean.x = bowl.x + ox * scale;
    bean.y = bowl.y + oy * scale;
    bean.vx *= -0.22;
    bean.vy *= -0.22;
  }
  return bean;
}
