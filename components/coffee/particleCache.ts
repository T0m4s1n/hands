/** Rebuilds per-particle data whenever an effect changes instance count. */
export function particleCache<T>(
  cached: T[] | null,
  count: number,
  create: (index: number) => T,
): T[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (cached && cached.length === safeCount) return cached;
  return Array.from({ length: safeCount }, (_, index) => create(index));
}
