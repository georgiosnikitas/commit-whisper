/**
 * Group-overview chart panels + the shared data-table fallback (Story 4.2;
 * inline-SVG rebuild — ADR H1/H2/H4, 2026-06-18).
 *
 * Each group renders TWO inline-SVG overview charts bound to specific metrics by
 * id (`CHART_PLAN`), matched to the design sample
 * (docs/sample/commit-whisper-sample-report.html): A volume line + cadence bars ·
 * B contributor doughnut + top-author gauge · C subject-length bars + adherence
 * gauge · D commit-type bars + direct-to-default gauge · E hotspot h-bars +
 * churn-trend line · F hygiene radar + overall-score gauge — inside a `<figure>`
 * caption, each sub-chart paired with a mandatory `<details>`/`<table>` data
 * fallback (the no-JS / keyboard floor — never a chart alone). Binding by id (plus
 * a per-metric data extractor) keeps the panel stable regardless of the order or
 * shape of other metrics. `metricVisual` (value-shape → visual) is still exported
 * for tests but is NO LONGER wired into the cards: per ADR H4 charts live only in
 * this group panel and metric cards are chart-free stat cards. Pure + escaped +
 * deterministic.
 */

import type { MetricGroup } from "../../analyze/metric.js";
import type { ReportAnalysis } from "../../assemble/report-schema.js";
import { escapeHtml } from "./escape.js";
import { detectShape, extractSeries, rangeField, type SeriesPoint } from "./shape.js";
import { svgBars, svgDonut, svgGauge, svgHBars, svgLine, svgRadar, svgRadialGauge, svgSparkline } from "./svg.js";

type Metric = ReportAnalysis["metrics"][number];

/** One-line group descriptions for the chart caption (never a chart alone). */
const GROUP_DESCRIPTION: Record<MetricGroup, string> = {
  A: "How activity and cadence move over time.",
  B: "How the work is distributed across the team.",
  C: "How clearly the history communicates intent.",
  D: "How branching and merging are structured.",
  E: "Where change and instability concentrate.",
  F: "Overall repository health signals.",
};

/** An escaped data table from a labelled series (the accessible chart fallback). */
export function dataTable(series: readonly SeriesPoint[], valueHeader: string, caption: string): string {
  const rows = series
    .map((p) => `<tr><th scope="row">${escapeHtml(p.label)}</th><td>${escapeHtml(formatNumber(p.value))}</td></tr>`)
    .join("\n");
  return `<details class="data-table" open>
<summary>Show data table</summary>
<table>
<caption>${escapeHtml(caption)}</caption>
<thead><tr><th scope="col">Item</th><th scope="col">${escapeHtml(valueHeader)}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</details>`;
}

/** Compact, locale-independent number text. */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** The chart kinds an overview sub-panel can render. */
type SubKind = "line" | "bars" | "hbars" | "radar" | "donut" | "gauge";
/** A 0..max value for a radial gauge, or undefined when its field is absent. */
type GaugeValue = { value: number; max: number } | undefined;

/**
 * One sub-chart in a group's overview, bound to a specific metric by id so the
 * panel always renders the SAME chart as the design sample regardless of the
 * order or shape of other metrics. Series charts supply `series`; gauges `gauge`.
 */
interface ChartSpec {
  title: string;
  sourceId: string;
  kind: SubKind;
  series?: (value: unknown) => SeriesPoint[];
  gauge?: (value: unknown) => GaugeValue;
}

/** The value as a plain record, or an empty record for non-objects. */
function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A labelled series from an object of `key -> number` (the value's own key order). */
function objectSeries(value: unknown): SeriesPoint[] {
  return Object.entries(asRecord(value))
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([label, v]) => ({ label, value: v as number }));
}

/** The named numeric fields (in order, skipping absent ones) as a labelled series. */
function pickFields(value: unknown, fields: readonly (readonly string[])[]): SeriesPoint[] {
  const obj = asRecord(value);
  const out: SeriesPoint[] = [];
  for (const pair of fields) {
    const key = pair[0];
    if (typeof key !== "string") {
      continue;
    }
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out.push({ label: pair[1] ?? key, value: v });
    }
  }
  return out;
}

/** A 0..100 gauge value from a named percentage/score field. */
function pctField(value: unknown, key: string): GaugeValue {
  const v = asRecord(value)[key];
  return typeof v === "number" && Number.isFinite(v) ? { value: v, max: 100 } : undefined;
}

/** The trailing path segment (file/dir name) for a hotspot label. */
function baseName(path: string): string {
  const parts = path.split("/").filter((p) => p !== "");
  return parts.at(-1) ?? path;
}

/** Top-N `{ path, <field> }` rows → a labelled series keyed by `field`. */
function rowsSeries(value: unknown, key: string, field: string, limit: number): SeriesPoint[] {
  const rows = asRecord(value)[key];
  if (!Array.isArray(rows)) {
    return [];
  }
  const out: SeriesPoint[] = [];
  for (const row of rows.slice(0, limit)) {
    const obj = asRecord(row);
    const v = obj[field];
    if (typeof v === "number" && Number.isFinite(v) && typeof obj.path === "string") {
      out.push({ label: baseName(obj.path), value: v });
    }
  }
  return out;
}

/** Active-vs-inactive split for the contributor doughnut. */
function contributorSplit(value: unknown): SeriesPoint[] {
  const obj = asRecord(value);
  const active = typeof obj.active === "number" ? obj.active : 0;
  const total = typeof obj.total === "number" ? obj.total : active;
  return [
    { label: "active", value: active },
    { label: "inactive", value: Math.max(0, total - active) },
  ];
}

/** Hygiene component sub-scores (strengths then weaknesses) for the radar. */
function hygieneDimensions(value: unknown): SeriesPoint[] {
  const obj = asRecord(value);
  const out: SeriesPoint[] = [];
  for (const key of ["strengths", "weaknesses"] as const) {
    const arr = obj[key];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (const entry of arr) {
      const dim = asRecord(entry);
      if (typeof dim.name === "string" && typeof dim.subScore === "number" && Number.isFinite(dim.subScore)) {
        out.push({ label: dim.name, value: dim.subScore });
      }
    }
  }
  return out;
}

/** Churn-per-month series from `perMonth: { "YYYY-MM": { churn } }`. */
function churnByMonth(value: unknown): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const [label, bucket] of Object.entries(asRecord(asRecord(value).perMonth))) {
    const churn = asRecord(bucket).churn;
    if (typeof churn === "number" && Number.isFinite(churn)) {
      out.push({ label, value: churn });
    }
  }
  return out;
}

/** Subject-length percentile profile (Min · Median · Mean · p90 · Max). */
function subjectLengthSeries(value: unknown): SeriesPoint[] {
  return pickFields(asRecord(value).subjectLength, [
    ["min", "Min"],
    ["median", "Median"],
    ["mean", "Mean"],
    ["p90", "p90"],
    ["max", "Max"],
  ]);
}

/**
 * The per-group overview chart plan — two charts per group, each bound to a
 * specific metric by id and matched to the design sample
 * (docs/sample/commit-whisper-sample-report.html): A monthly-volume line +
 * weekly-cadence bars · B contributor doughnut + top-author gauge · C
 * subject-length bars + Conventional-Commits gauge · D commit-type bars +
 * direct-to-default gauge · E hotspot h-bars + churn-trend line · F hygiene
 * radar + overall-score gauge.
 */
const CHART_PLAN: Record<MetricGroup, readonly ChartSpec[]> = {
  A: [
    { title: "Commit volume over time", sourceId: "a-commit-volume", kind: "line", series: (v) => objectSeries(asRecord(v).perMonth) },
    { title: "Commit frequency / cadence", sourceId: "a-commit-volume", kind: "bars", series: (v) => objectSeries(asRecord(v).perWeek) },
  ],
  B: [
    { title: "Contributor count", sourceId: "b-contributor-count", kind: "donut", series: contributorSplit },
    { title: "Contribution distribution", sourceId: "b-contribution-distribution", kind: "gauge", gauge: (v) => pctField(v, "topCommitSharePct") },
  ],
  C: [
    { title: "Message length distribution", sourceId: "c-message-length-distribution", kind: "bars", series: subjectLengthSeries },
    { title: "Conventional Commits adherence", sourceId: "c-conventional-commits", kind: "gauge", gauge: (v) => pctField(v, "adherenceSharePct") },
  ],
  D: [
    { title: "Branch/merge topology summary", sourceId: "d-topology-summary", kind: "bars", series: (v) => pickFields(v, [["regularCommitCount", "Regular"], ["mergeCommitCount", "Merges"], ["rootCommitCount", "Root"]]) },
    { title: "Direct-to-default-branch rate", sourceId: "d-direct-to-default", kind: "gauge", gauge: (v) => pctField(v, "directToDefaultSharePct") },
  ],
  E: [
    { title: "Most-changed files / directories", sourceId: "e-most-changed", kind: "hbars", series: (v) => rowsSeries(v, "topFiles", "touchCount", 8) },
    { title: "Churn rate over time", sourceId: "e-churn-over-time", kind: "line", series: churnByMonth },
  ],
  F: [
    { title: "Hygiene strengths & weaknesses", sourceId: "f-strengths-weaknesses", kind: "radar", series: hygieneDimensions },
    { title: "Overall hygiene score", sourceId: "f-hygiene-score", kind: "gauge", gauge: (v) => pctField(v, "score") },
  ],
};

/** One titled sub-chart cell (chart + its mandatory data-table fallback). */
function subFigure(title: string, svg: string, table: string): string {
  return `<div class="chart-sub">
<h4>${escapeHtml(title)}</h4>
${svg}
${table}
</div>`;
}

/** Render one bound sub-chart (+ its data-table fallback), or undefined when its source metric is absent or empty. */
function renderChartSpec(group: MetricGroup, spec: ChartSpec, byId: ReadonlyMap<string, Metric>): string | undefined {
  const metric = byId.get(spec.sourceId);
  if (metric?.status !== "computed") {
    return undefined;
  }
  const label = `Group ${group} \u2014 ${spec.title}`;
  if (spec.kind === "gauge") {
    const range = spec.gauge?.(metric.value);
    if (range === undefined) {
      return undefined;
    }
    const table = dataTable([{ label: spec.title, value: range.value }], "Value", spec.title);
    return subFigure(spec.title, svgRadialGauge(range.value, range.max, label), table);
  }
  const series = spec.series?.(metric.value) ?? [];
  if (series.length === 0) {
    return undefined;
  }
  let svg: string;
  switch (spec.kind) {
    case "line":
      svg = svgLine(series, label);
      break;
    case "bars":
      svg = svgBars(series, label);
      break;
    case "hbars":
      svg = svgHBars(series, label);
      break;
    case "radar":
      svg = svgRadar(series, 100, label);
      break;
    default:
      svg = svgDonut(series, label);
  }
  return subFigure(spec.title, svg, dataTable(series, "Value", spec.title));
}

/**
 * The group-overview panel: the group description + a grid of the group's two
 * charts (bound to specific metrics by id per `CHART_PLAN`, matched to the design
 * sample), each with its mandatory data-table fallback (never a chart alone). A
 * chart slot is omitted only when its source metric is unavailable; an empty group
 * renders a caption + note. (HTML-only — markdown/terminal group overviews are
 * unaffected.)
 */
export function groupOverviewPanel(group: MetricGroup, metrics: readonly Metric[]): string {
  const description = GROUP_DESCRIPTION[group];
  const label = `Group ${group} overview`;
  const byId = new Map<string, Metric>(metrics.map((m) => [m.id, m]));
  const subs = CHART_PLAN[group]
    .map((spec) => renderChartSpec(group, spec, byId))
    .filter((html): html is string => html !== undefined);
  if (subs.length === 0) {
    return `<figure class="chart-panel" aria-label="${escapeHtml(label)}">
<figcaption>${escapeHtml(description)}</figcaption>
<p class="chart-empty">No chartable series for this group — see the metric cards below.</p>
</figure>`;
  }
  const gridClass = subs.length > 1 ? "chart-cells two" : "chart-cells";
  return `<figure class="chart-panel" aria-label="${escapeHtml(label)}">
<figcaption>${escapeHtml(description)}</figcaption>
<div class="${gridClass}">
${subs.join("\n")}
</div>
</figure>`;
}

/**
 * The per-metric visual, chosen by the value's shape: timeseries → line;
 * distribution → bars; scalar-in-range → sparkline + gauge + number; pure scalar →
 * bold stat (no chart); none / not_available → no visual. Every non-scalar visual
 * carries a data-table fallback. Retained for tests — per ADR H4 the renderer no
 * longer embeds per-card visuals (charts live only in the group-overview panel).
 */
export function metricVisual(metric: Metric): string {
  if (metric.status === "not_available") {
    return "";
  }
  const label = `${metric.title} visual`;
  const shape = detectShape(metric.value);
  switch (shape) {
    case "timeseries": {
      const series = extractSeries(metric.value);
      return `<div class="metric-visual">${svgLine(series, label)}\n${dataTable(series, "Value", metric.title)}</div>`;
    }
    case "distribution": {
      const series = extractSeries(metric.value);
      return `<div class="metric-visual">${svgBars(series, label)}\n${dataTable(series, "Value", metric.title)}</div>`;
    }
    case "scalar-range": {
      const range = rangeField(metric.value);
      const series = extractSeries(metric.value);
      const gauge = range === undefined ? "" : svgGauge(range.value, range.max, label);
      const spark = series.length > 1 ? svgSparkline(series, label) : "";
      const number = range === undefined ? "" : `<span class="metric-number">${escapeHtml(formatNumber(range.value))}</span>`;
      return `<div class="metric-visual metric-visual-range">${gauge}${spark}${number}\n${dataTable(series, "Value", metric.title)}</div>`;
    }
    case "scalar":
    case "none":
    default:
      return ""; // a pure scalar / unshaped value is shown as the bold stat by the card
  }
}
