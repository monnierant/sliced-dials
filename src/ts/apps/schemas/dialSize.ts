// No Foundry, no DOM, no module state - kept apart from the schema so it can be
// checked on its own, like the geometry.

// Dials come in these sizes and no others. An arbitrary count would draw fine
// but reads badly at a glance: nobody eyeballs "5 of 7" on a pie.
export const SIZES = [4, 6, 8, 10, 12] as const;

/**
 * Shrinking a dial that already has slices would otherwise leave segments
 * placed beyond its edge - stored, undrawable, and still counted by `value`.
 * Returns the original array untouched when everything already fits, so a
 * caller can tell whether anything was lost.
 */
export function trimToSize<T>(slices: T[], size: number): T[] {
  return slices.length > size ? slices.slice(0, size) : slices;
}
