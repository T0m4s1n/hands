export const COUNTDOWN_BEATS = ["3", "2", "1", "¡YA!"] as const;
export const NUMBER_BEAT_MS = 720;
export const GO_BEAT_MS = 520;

export function countdownBeatDuration(index: number): number {
  return index === COUNTDOWN_BEATS.length - 1 ? GO_BEAT_MS : NUMBER_BEAT_MS;
}

export function countdownBeatSound(
  index: number,
): "tick" | "go" | null {
  if (index < 0 || index >= COUNTDOWN_BEATS.length) return null;
  return index === COUNTDOWN_BEATS.length - 1 ? "go" : "tick";
}
