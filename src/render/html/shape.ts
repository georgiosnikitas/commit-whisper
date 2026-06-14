/**
 * Value-shape detection + series extraction for the per-metric visuals (Story 4.2).
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

/** Pull a labelled numeric series from a metric value (deterministic; `[]` if none). */
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
