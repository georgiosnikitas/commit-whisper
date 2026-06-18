/**
 * Generic structured-value humanizer (shared by the terminal + Markdown renderers).
 *
 * A few metric values are nested beyond a single labelled series — a time bucket of
 * `{additions, deletions, churn}` objects (`e-churn-over-time`), or an object of
 * `{strengths, weaknesses}` score lists (`f-strengths-weaknesses`). These have no
 * flat `SeriesPoint[]`, so the renderers used to fall back to a truncated raw-JSON
 * blob. This turns any such value into a small, deterministic label/value TREE the
 * renderers format in their own bullet style — readable, never a JSON dump.
 *
 * Pure: a value in, a tree out (key order follows the value's own, byte-stable from
 * `analysis`). The renderers escape/colour the leaf text themselves.
 */

/** A label/value node: a leaf scalar, or a branch of labelled child nodes. */
export type ValueTree = { kind: "scalar"; text: string } | { kind: "branch"; entries: ValueEntry[] };

/** One labelled entry under a branch. */
export interface ValueEntry {
  label: string;
  child: ValueTree;
}

/** String fields that name an array element / record entry (first match wins). */
const LABEL_FIELDS = ["path", "file", "directory", "area", "name", "id", "label", "key"] as const;
/** Preferred numeric field to surface when a sub-object holds several (else first numeric in key order). */
const PRIMARY_NUMERIC_FIELDS = ["churn", "total", "value", "count", "sum", "score", "commitCount"] as const;
/** Cap on a rendered string leaf (the tree is a compact summary, not a transcript). */
const MAX_STRING = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Compact text for a scalar leaf (numbers rounded to 2 dp; strings truncated; raw, unescaped). */
export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING - 1)}…` : value;
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "0";
  }
  return "";
}

/** The first string label field on a record, or `undefined`. */
function labelField(record: Record<string, unknown>): { key: string; value: string } | undefined {
  for (const key of LABEL_FIELDS) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate !== "") {
      return { key, value: candidate };
    }
  }
  return undefined;
}

/** A representative numeric field (priority list first, else first numeric in key order). */
function primaryNumeric(record: Record<string, unknown>): number | undefined {
  for (const key of PRIMARY_NUMERIC_FIELDS) {
    const candidate = record[key];
    if (isFiniteNumber(candidate)) {
      return candidate;
    }
  }
  for (const candidate of Object.values(record)) {
    if (isFiniteNumber(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/** One array element as a labelled entry — flattened to `label: number` when it is a single-numeric named record. */
function arrayEntry(element: unknown, index: number): ValueEntry {
  if (isRecord(element)) {
    const label = labelField(element);
    const numerics = Object.entries(element).filter(([, v]) => isFiniteNumber(v));
    if (label !== undefined && numerics.length === 1) {
      return { label: label.value, child: { kind: "scalar", text: formatScalar(numerics[0][1]) } };
    }
    if (label !== undefined) {
      const rest: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(element)) {
        if (k !== label.key) {
          rest[k] = v;
        }
      }
      return { label: label.value, child: recordTree(rest) };
    }
  }
  return { label: String(index + 1), child: buildValueTree(element) };
}

/** A record as a branch — collapsing a uniform record-of-objects to `key: <primary numeric>` lines. */
function recordTree(record: Record<string, unknown>): ValueTree {
  const entries = Object.entries(record);
  const everyHasPrimary =
    entries.length > 0 && entries.every(([, v]) => isRecord(v) && primaryNumeric(v) !== undefined);
  if (everyHasPrimary) {
    return {
      kind: "branch",
      entries: entries.map(([key, v]) => ({
        label: key,
        child: { kind: "scalar", text: formatScalar(primaryNumeric(v as Record<string, unknown>)) } as const,
      })),
    };
  }
  return { kind: "branch", entries: entries.map(([key, v]) => ({ label: key, child: buildValueTree(v) })) };
}

/** Turn an arbitrary metric value into a compact label/value tree. */
export function buildValueTree(value: unknown): ValueTree {
  if (Array.isArray(value)) {
    return { kind: "branch", entries: value.map((element, i) => arrayEntry(element, i)) };
  }
  if (isRecord(value)) {
    return recordTree(value);
  }
  return { kind: "scalar", text: formatScalar(value) };
}
