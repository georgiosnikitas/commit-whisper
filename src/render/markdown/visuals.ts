/**
 * Text-only visual primitives for the Markdown report (Story 4.3 — FR-7, AC1).
 *
 * The text degradation of the HTML visual-by-shape model: ASCII sparklines, fenced
 * monospace text-bars, and Mermaid `xychart-beta` group overviews. Each is a pure,
 * deterministic `data → string` transform (rounded values, no clock/random), so the
 * report is byte-stable and diff-able. The numeric value is ALWAYS also present in
 * prose (never glyph-only meaning — UX-DR14). Reuses the render-shared value-shape
 * detection (`../html/shape.ts`) so Markdown never disagrees with HTML.
 */

import type { MetricGroup } from "../../analyze/metric.js";
import type { ReportAnalysis } from "../../assemble/report-schema.js";
import { detectShape, extractSeries, rangeField, type SeriesPoint } from "../html/shape.js";
import { escapeCell } from "./escape.js";

type Metric = ReportAnalysis["metrics"][number];

/** The eight block glyphs for an ASCII sparkline, low → high. */
const SPARK_GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;
/** The fixed monospace cell width of a text-bar. */
const BAR_WIDTH = 12;

/** A finite number, or 0 — guards every value against NaN/±Infinity. */
function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** Round to 2 decimals so emitted numbers are stable and compact. */
function round(n: number): number {
  return Math.round(safe(n) * 100) / 100;
}

/** The min/max of a series' values (finite-guarded); `[0, 0]` for an empty series. */
function extent(values: readonly number[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const raw of values) {
    const v = safe(raw);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return values.length === 0 ? [0, 0] : [min, max];
}

/** A note when a group has no genuinely chartable series (never a chart alone). */
export const GROUP_OVERVIEW_NONE = "_No group-overview chart — see the metrics below._";

/** The per-metric visual: a heading suffix (inline) and/or a body block (before the bullets). */
export interface MetricVisual {
  headingSuffix: string;
  body: string;
}

/**
 * An ASCII sparkline over the series values (`▁▂▄█▆▃`). Empty series ⇒ `""`; a flat
 * (all-equal) or single-point series ⇒ a mid-level glyph per point (no divide-by-zero).
 */
export function sparkline(series: readonly SeriesPoint[]): string {
  if (series.length === 0) {
    return "";
  }
  const values = series.map((p) => safe(p.value));
  const [min, max] = extent(values);
  const span = max - min;
  const midGlyph = SPARK_GLYPHS[Math.floor(SPARK_GLYPHS.length / 2)];
  if (span === 0) {
    return midGlyph.repeat(values.length);
  }
  const lastIndex = SPARK_GLYPHS.length - 1;
  return values
    .map((v) => {
      const t = (v - min) / span;
      const idx = Math.min(lastIndex, Math.max(0, Math.round(t * lastIndex)));
      return SPARK_GLYPHS[idx];
    })
    .join("");
}

/**
 * A fenced monospace text-bar block — one row per point `label  ████░░  value`, bars
 * proportional to `v/max` (`max ≤ 0` ⇒ all-empty), labels escaped + padded. Empty ⇒ `""`.
 */
export function textBars(series: readonly SeriesPoint[]): string {
  if (series.length === 0) {
    return "";
  }
  const [, max] = extent(series.map((p) => p.value));
  const top = max <= 0 ? 1 : max;
  const labels = series.map((p) => escapeCell(p.label));
  const labelWidth = labels.reduce((w, label) => Math.max(w, label.length), 0);
  const rows = series.map((point, i) => {
    const ratio = Math.max(0, safe(point.value)) / top;
    const filled = Math.min(BAR_WIDTH, Math.max(0, Math.round(ratio * BAR_WIDTH)));
    const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
    const label = labels[i].padEnd(labelWidth);
    return `${label}  ${bar}  ${round(point.value)}`;
  });
  return ["```", ...rows, "```"].join("\n");
}

/** Sanitize a Mermaid token (strip the chars that delimit `xychart` arrays / titles). */
export function mermaidLabel(text: string): string {
  const cleaned = text
    .replaceAll(/["[\],\r\n\t]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return cleaned === "" ? "-" : cleaned;
}

/** A fenced Mermaid `xychart-beta` bar chart over a timeseries. Empty series ⇒ `""`. */
export function mermaidXychart(series: readonly SeriesPoint[], title: string): string {
  if (series.length === 0) {
    return "";
  }
  const axis = series.map((p) => `"${mermaidLabel(p.label)}"`).join(", ");
  const values = series.map((p) => round(p.value)).join(", ");
  return [
    "```mermaid",
    "xychart-beta",
    `  title "${mermaidLabel(title)}"`,
    `  x-axis [${axis}]`,
    `  bar [${values}]`,
    "```",
  ].join("\n");
}

/** The first genuinely chartable (timeseries/distribution) series among a group's metrics. */
function representativeSeries(metrics: readonly Metric[]): { series: SeriesPoint[]; shape: "timeseries" | "distribution" } | undefined {
  for (const metric of metrics) {
    if (metric.status !== "computed") {
      continue;
    }
    const shape = detectShape(metric.value);
    if (shape !== "timeseries" && shape !== "distribution") {
      continue; // a lone scalar / range field is shown on its card, not as a degenerate overview
    }
    const series = extractSeries(metric.value);
    if (series.length > 0) {
      return { series, shape };
    }
  }
  return undefined;
}

/**
 * The group-overview visual: a Mermaid `xychart-beta` for every chartable group
 * (timeseries or distribution) so all group overviews are the same chart type, or a
 * note when no series is chartable.
 */
export function groupOverview(group: MetricGroup, metrics: readonly Metric[]): string {
  const rep = representativeSeries(metrics);
  if (rep === undefined) {
    return GROUP_OVERVIEW_NONE;
  }
  return mermaidXychart(rep.series, `Group ${group} overview`);
}

/** The bold-stat number for a `scalar`-shaped value (a bare number or a single numeric field). */
function scalarNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  const first = extractSeries(value)[0];
  return first?.value;
}

/**
 * The per-metric visual chosen by the value's shape: timeseries → a heading sparkline;
 * distribution → a text-bar body; scalar-in-range → a `value/max` bold stat; pure scalar
 * → a bold number; none / not_available → no visual. Numbers always reach the Value bullet too.
 */
export function metricVisualMarkdown(metric: Metric): MetricVisual {
  const none: MetricVisual = { headingSuffix: "", body: "" };
  if (metric.status === "not_available") {
    return none;
  }
  const shape = detectShape(metric.value);
  switch (shape) {
    case "timeseries": {
      const spark = sparkline(extractSeries(metric.value));
      return spark === "" ? none : { headingSuffix: `\`${spark}\``, body: "" };
    }
    case "distribution":
      return { headingSuffix: "", body: textBars(extractSeries(metric.value)) };
    case "scalar-range": {
      const range = rangeField(metric.value);
      return range === undefined ? none : { headingSuffix: `**${round(range.value)}/${round(range.max)}**`, body: "" };
    }
    case "scalar": {
      const n = scalarNumber(metric.value);
      return n === undefined ? none : { headingSuffix: `**${round(n)}**`, body: "" };
    }
    case "none":
    default:
      return none;
  }
}
