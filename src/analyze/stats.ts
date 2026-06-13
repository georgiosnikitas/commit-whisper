/**
 * Pure statistical helpers for the metrics engine (Story 1.5).
 *
 * All operate on a numeric array and are deterministic (they sort a copy; the
 * caller's array is untouched). Empty input yields `null` so callers can emit a
 * `not_available` envelope rather than `NaN`.
 */

/** Arithmetic mean, or `null` for an empty array. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Linear-interpolated percentile (0..100), or `null` for an empty array. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return sorted[0];
  }
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

/** Median (50th percentile), or `null` for an empty array. */
export function median(values: readonly number[]): number | null {
  return percentile(values, 50);
}

/** Round to `digits` decimal places (stable serialization for non-integers). */
export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
