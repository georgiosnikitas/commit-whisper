/**
 * Group-overview chart panels + the shared data-table fallback (Story 4.2;
 * inline-SVG rebuild — ADR H1/H2/H4, 2026-06-18).
 *
 * Each group renders TWO inline-SVG overview charts — a primary + a shape-matched
 * secondary (`GROUP_CHARTS`): A volume line + cadence bars · B ownership doughnut
 * + concentration gauge · C category bars + adherence gauge · D merge line +
 * direct-to-default gauge · E hotspots h-bars + churn-trend line · F component
 * radar + hygiene gauge — inside a `<figure>` caption, each sub-chart paired with
 * a mandatory `<details>`/`<table>` data fallback (the no-JS / keyboard floor —
 * never a chart alone). `metricVisual` (value-shape → visual) is still exported
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

/** A chartable value shape the overview plan can request. */
type SeriesShape = "timeseries" | "distribution";
/** The chart kinds an overview sub-panel can render. */
type SubKind = "line" | "bars" | "hbars" | "radar" | "donut" | "gauge";
/** One sub-chart in a group's overview: a chart kind fed by the Nth metric of a shape. */
interface SubSpec {
  kind: SubKind;
  pick: SeriesShape | "range";
  index: number;
}

/**
 * The per-group overview chart plan — a primary chart + a secondary (a radial
 * gauge for a 0–100 share/score, or a second series). Mirrors the showcase: A
 * volume line + cadence bars · B ownership doughnut + concentration gauge · C
 * category bars + adherence gauge · D merge line + direct-to-default gauge · E
 * hotspots bars + churn-trend line · F component radar + hygiene gauge.
 */
const GROUP_CHARTS: Record<MetricGroup, readonly SubSpec[]> = {
  A: [{ kind: "line", pick: "timeseries", index: 0 }, { kind: "bars", pick: "timeseries", index: 1 }],
  B: [{ kind: "donut", pick: "distribution", index: 0 }, { kind: "gauge", pick: "range", index: 0 }],
  C: [{ kind: "bars", pick: "distribution", index: 0 }, { kind: "gauge", pick: "range", index: 0 }],
  D: [{ kind: "line", pick: "timeseries", index: 0 }, { kind: "gauge", pick: "range", index: 0 }],
  E: [{ kind: "hbars", pick: "distribution", index: 0 }, { kind: "line", pick: "timeseries", index: 0 }],
  F: [{ kind: "radar", pick: "distribution", index: 0 }, { kind: "gauge", pick: "range", index: 0 }],
};

/** Computed metrics in the group whose value has the given chartable shape. */
function metricsOfShape(metrics: readonly Metric[], shape: SeriesShape): Metric[] {
  return metrics.filter((m) => m.status === "computed" && detectShape(m.value) === shape && extractSeries(m.value).length > 0);
}

/** Computed metrics in the group that carry a 0..max range field (gauge candidates). */
function rangeMetrics(metrics: readonly Metric[]): Metric[] {
  return metrics.filter((m) => m.status === "computed" && rangeField(m.value) !== undefined);
}

/** One titled sub-chart cell (chart + its mandatory data-table fallback). */
function subFigure(title: string, svg: string, table: string): string {
  return `<div class="chart-sub">
<h4>${escapeHtml(title)}</h4>
${svg}
${table}
</div>`;
}

/** Render the inline-SVG chart for one sub-spec, or undefined when its metric is absent. */
function renderSubChart(group: MetricGroup, spec: SubSpec, metrics: readonly Metric[]): string | undefined {
  const pool = spec.pick === "range" ? rangeMetrics(metrics) : metricsOfShape(metrics, spec.pick);
  const metric = pool[spec.index];
  if (metric === undefined) {
    return undefined;
  }
  const label = `Group ${group} \u2014 ${metric.title}`;
  if (spec.kind === "gauge") {
    const range = rangeField(metric.value);
    if (range === undefined) {
      return undefined;
    }
    const table = dataTable([{ label: metric.title, value: range.value }], "Value", metric.title);
    return subFigure(metric.title, svgRadialGauge(range.value, range.max, label), table);
  }
  const series = extractSeries(metric.value);
  const svg =
    spec.kind === "line"
      ? svgLine(series, label)
      : spec.kind === "bars"
        ? svgBars(series, label)
        : spec.kind === "hbars"
          ? svgHBars(series, label)
          : spec.kind === "radar"
            ? svgRadar(series, 100, label)
            : svgDonut(series, label);
  return subFigure(metric.title, svg, dataTable(series, "Value", metric.title));
}

/**
 * The group-overview panel: the group description + a grid of up to two charts
 * (primary + secondary), each with its mandatory data-table fallback (never a
 * chart alone). Empty groups render a caption + note instead.
 */
export function groupOverviewPanel(group: MetricGroup, metrics: readonly Metric[]): string {
  const description = GROUP_DESCRIPTION[group];
  const label = `Group ${group} overview`;
  const subs = GROUP_CHARTS[group]
    .map((spec) => renderSubChart(group, spec, metrics))
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
