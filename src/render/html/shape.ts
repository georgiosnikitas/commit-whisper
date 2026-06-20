/**
 * Value-shape detection + series extraction for the inline-SVG charts (Story 4.2).
 *
 * The renderer receives arbitrary JSON metric values, so the right visual is
 * chosen by inspecting the value's STRUCTURE — deterministically and tolerantly
 * (an unexpected shape yields no visual + the table/stat, never a crash). Pure:
 * value in, classification/series out; key order follows the value's own
 * (byte-stable from `analysis`).
 */

/** The visual shape a metric value maps to (drives `metricVisual`). */
export type ValueShape = "timeseries" | "distribution" | "scalar-range" | "scalar" | "none";

/** A labelled numeric data point (mirrors `svg.Point`). */
export interface SeriesPoint {
  label: string;
  value: number;
}

/** Sub-object keys that hold a time-bucketed series (Group A/E). */
const TIME_BUCKET_KEYS = ["perDay", "perWeek", "perMonth", "perYear"] as const;
/** A date-bucket key: a year, year-month, year-month-day, or ISO week. */
const DATE_KEY = /^\d{4}(-(\d\d|W\d\d))?(-\d\d)?$/;
/** A 0–100 share/score field → a scalar-in-range (gauge) visual. */
const RANGE_FIELD = /(pct|share|score)$/i;
/** A string field to label an array element by (first match wins). */
const LABEL_FIELDS = ["path", "file", "directory", "area", "name", "id", "label", "key"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The first time-bucket sub-object found on `value`, or `undefined`. */
function timeBucket(value: Record<string, unknown>): Record<string, unknown> | undefined {
  for (const key of TIME_BUCKET_KEYS) {
    const sub = value[key];
    if (isObject(sub)) {
      return sub;
    }
  }
  return undefined;
}

/** True iff every own key is date-like and every value a finite number. */
function isDateKeyedNumbers(value: Record<string, unknown>): boolean {
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(([k, v]) => DATE_KEY.test(k) && typeof v === "number" && Number.isFinite(v))
  );
}

/** The numeric own-entries of an object, in key order. */
function numericEntries(value: Record<string, unknown>): SeriesPoint[] {
  return Object.entries(value)
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([label, v]) => ({ label, value: v as number }));
}

/** Preferred numeric field names when a series bucket is an object (first match wins). */
const BUCKET_FIELDS = ["churn", "value", "count", "total", "score"] as const;

/**
 * A single representative number for a series bucket: the number itself, or — when
 * the bucket is an object (e.g. a month → `{ additions, deletions, churn, … }`) — a
 * preferred numeric field (`BUCKET_FIELDS`), falling back to its first numeric field.
 */
function bucketNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (!isObject(value)) {
    return undefined;
  }
  const nums = numericEntries(value);
  for (const field of BUCKET_FIELDS) {
    const hit = nums.find((p) => p.label === field);
    if (hit !== undefined) {
      return hit.value;
    }
  }
  return nums[0]?.value;
}

/** A labelled series from an object's entries via `bucketNumber` (object-valued buckets included). */
function bucketEntries(value: Record<string, unknown>): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const [label, v] of Object.entries(value)) {
    const num = bucketNumber(v);
    if (num !== undefined) {
      out.push({ label, value: num });
    }
  }
  return out;
}

/**
 * The first nested object/array on `value` that yields a chartable series — for
 * metrics whose data sits one level down under a key (e.g. `byHour`/`byWeekday`,
 * `topDirectories`) rather than as direct numeric fields. Key order is the value's
 * own, so the result is byte-stable. Returns the series + whether it is date-keyed
 * (so the caller can pick timeseries vs. distribution).
 */
function nestedChartable(value: Record<string, unknown>): { series: SeriesPoint[]; timeseries: boolean } | undefined {
  for (const sub of Object.values(value)) {
    if (isObject(sub)) {
      if (isDateKeyedNumbers(sub)) {
        return { series: numericEntries(sub), timeseries: true };
      }
      const nums = numericEntries(sub);
      if (nums.length >= 2) {
        return { series: nums, timeseries: false };
      }
    } else if (Array.isArray(sub)) {
      const series = extractSeries(sub);
      if (series.length >= 2) {
        return { series, timeseries: false };
      }
    }
  }
  return undefined;
}

/**
 * Array-valued own fields → a labelled series of their LENGTHS — the chartable
 * read of values that compare collections rather than carry numbers (e.g. Active
 * vs. dormant periods → `activePeriods`/`dormantPeriods`). A pure-count fallback,
 * tried only after numeric extraction (so row/series data always wins).
 */
function collectionCounts(value: Record<string, unknown>): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const [label, v] of Object.entries(value)) {
    if (Array.isArray(v)) {
      out.push({ label, value: v.length });
    }
  }
  return out;
}

/** A 0–100 share/score field on `value` → `{ value, max: 100 }` for a gauge. */
export function rangeField(value: unknown): { value: number; max: number } | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  for (const [k, v] of Object.entries(value)) {
    if (RANGE_FIELD.test(k) && typeof v === "number" && Number.isFinite(v)) {
      return { value: v, max: 100 };
    }
  }
  return undefined;
}

/** Classify a metric value into the visual shape it maps to. */
export function detectShape(value: unknown): ValueShape {
  if (typeof value === "number") {
    return Number.isFinite(value) ? "scalar" : "none";
  }
  if (Array.isArray(value)) {
    return extractSeries(value).length > 0 ? "distribution" : "none";
  }
  if (!isObject(value)) {
    return "none";
  }
  if (timeBucket(value) !== undefined || isDateKeyedNumbers(value)) {
    return "timeseries";
  }
  if (rangeField(value) !== undefined) {
    return "scalar-range";
  }
  const nums = numericEntries(value);
  if (nums.length >= 2) {
    return "distribution";
  }
  const nested = nestedChartable(value);
  if (nested !== undefined) {
    return nested.timeseries ? "timeseries" : "distribution";
  }
  if (collectionCounts(value).length >= 2) {
    return "distribution";
  }
  if (nums.length === 1) {
    return "scalar";
  }
  return "none";
}

/** The numeric field of an array element, labelled by a string field or its index. */
function pointFromElement(element: unknown, index: number): SeriesPoint | undefined {
  if (typeof element === "number" && Number.isFinite(element)) {
    return { label: String(index + 1), value: element };
  }
  if (!isObject(element)) {
    return undefined;
  }
  const nums = numericEntries(element);
  const first = nums[0];
  if (first === undefined) {
    return undefined;
  }
  let label = String(index + 1);
  for (const fieldName of LABEL_FIELDS) {
    const candidate = element[fieldName];
    if (typeof candidate === "string" && candidate !== "") {
      label = candidate;
      break;
    }
  }
  return { label, value: first.value };
}

/**
 * Pull a labelled numeric series from a metric value for the VALUE display
 * (data tables / value-tree decision) — strict: only direct numeric fields of the
 * value (or a time bucket of numbers). Object-valued buckets / nested maps yield
 * `[]` here so the value renders as its full labelled tree, not a lossy one-number
 * series. The richer chart-oriented extraction lives in `chartSeries`.
 */
export function extractSeries(value: unknown): SeriesPoint[] {
  if (Array.isArray(value)) {
    return value.map((el, i) => pointFromElement(el, i)).filter((p): p is SeriesPoint => p !== undefined);
  }
  if (!isObject(value)) {
    return [];
  }
  const bucket = timeBucket(value);
  if (bucket !== undefined) {
    return numericEntries(bucket);
  }
  if (isDateKeyedNumbers(value)) {
    return numericEntries(value);
  }
  return numericEntries(value);
}

/**
 * Pull a labelled numeric series for a CHART/sparkline — the same as
 * `extractSeries` but reaching one level deeper so single-shape-but-nested values
 * still chart: a time bucket of objects collapses to a representative field per
 * bucket (`bucketEntries`, e.g. month → `churn`), and a value whose only series
 * sits under a key (`byHour`, `topDirectories`) is found via `nestedChartable`.
 * Deterministic; `[]` when nothing is chartable.
 */
export function chartSeries(value: unknown): SeriesPoint[] {
  if (Array.isArray(value)) {
    return extractSeries(value);
  }
  if (!isObject(value)) {
    return [];
  }
  const bucket = timeBucket(value);
  if (bucket !== undefined) {
    return bucketEntries(bucket);
  }
  if (isDateKeyedNumbers(value)) {
    return numericEntries(value);
  }
  const direct = numericEntries(value);
  if (direct.length >= 2) {
    return direct;
  }
  const nested = nestedChartable(value);
  if (nested !== undefined) {
    return nested.series;
  }
  const collections = collectionCounts(value);
  if (collections.length >= 2) {
    return collections;
  }
  return direct;
}
