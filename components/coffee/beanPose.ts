/**
 * Where a roasted bean sits in a bowl.
 *
 * Rest poses must not depend on time. A leftover `jump * clock` term made
 * every heap slowly orbit the instant tracking noise kept shake above zero.
 */

export const BEAN_REST = 0.12;

function scatter(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function beanJump(raw: number): number {
  const clamped = Math.min(1, Math.max(0, raw));
  if (clamped < BEAN_REST) return 0;
  return (clamped - BEAN_REST) / (1 - BEAN_REST);
}

export function beanLocalPose(
  index: number,
  radius: number,
  heap: boolean,
  jump: number,
  time: number,
): { x: number; y: number; z: number } {
  const a = scatter(index + 1);
  const b = scatter(index + 91);
  const r = Math.sqrt(a) * radius * (heap ? 0.92 : 1);
  const angle = b * Math.PI * 2;
  const rim = r / Math.max(radius, 1e-4);
  const bowl = heap ? (1 - rim * rim) * radius * 0.55 : (a + b) * 0.02;
  const work = Math.min(1, Math.max(0, jump));
  const wobble = work * Math.sin(time * 16 + index * 1.7);
  return {
    x: Math.cos(angle) * r + wobble * 0.03 * radius,
    y: Math.sin(angle) * r + wobble * 0.025 * radius,
    z: bowl + Math.abs(wobble) * 0.1,
  };
}
