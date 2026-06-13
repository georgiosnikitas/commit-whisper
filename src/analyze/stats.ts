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

/**
 * Gini coefficient of inequality over non-negative values: `0` = perfectly even,
 * approaching `1` = fully concentrated in one holder. `null` for an empty array;
 * `0` when the total is zero (no inequality to measure). Deterministic — sorts a
 * copy, so the caller's array is untouched and the result is order-independent.
 */
export function gini(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    return 0;
  }
  // weighted sum with 1-based rank: G = (2·Σ i·x_i)/(n·Σx_i) − (n+1)/n
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    weighted += (i + 1) * sorted[i];
  }
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

/** Round to `digits` decimal places (stable serialization for non-integers). */
export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
