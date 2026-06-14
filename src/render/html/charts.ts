/**
 * Group-overview chart panels + per-metric visuals + the shared data-table
 * fallback (Story 4.2).
 *
 * Each group renders its FIXED-type inline-SVG overview chart (A line · B Pareto
 * hbars · C bars · D timeline line · E hotspots hbars · F radar), fed by a
 * representative series from the group's metrics, inside a `<figure>` with its
 * caption AND a mandatory `<details>`/`<table>` data fallback (the no-JS /
 * keyboard floor — never a chart alone). Each metric card gets a visual chosen by
 * its value shape, also with a fallback. Pure + escaped + deterministic.
 */

import type { MetricGroup } from "../../analyze/metric.js";
import type { ReportAnalysis } from "../../assemble/report-schema.js";
import { escapeHtml } from "./escape.js";
import { detectShape, extractSeries, rangeField, type SeriesPoint } from "./shape.js";
import { svgBars, svgGauge, svgHBars, svgLine, svgRadar, svgSparkline } from "./svg.js";

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

/** The first genuinely chartable series among a group's metrics, in catalog order. */
function representativeSeries(metrics: readonly Metric[]): { series: SeriesPoint[]; title: string } {
  for (const metric of metrics) {
    if (metric.status !== "computed") {
      continue;
    }
    const shape = detectShape(metric.value);
    if (shape !== "timeseries" && shape !== "distribution") {
      continue; // a lone scalar / range field is shown on its card, not as a degenerate overview chart
    }
    const series = extractSeries(metric.value);
    if (series.length > 0) {
      return { series, title: metric.title };
    }
  }
  return { series: [], title: "" };
}

/** Render the group's fixed-type SVG over a representative series. */
function groupChartSvg(group: MetricGroup, series: readonly SeriesPoint[], label: string): string {
  switch (group) {
    case "A":
    case "D":
      return svgLine(series, label);
    case "B":
    case "E":
      return svgHBars(series, label);
    case "C":
      return svgBars(series, label);
    case "F":
      return svgRadar(series, 100, label);
    default:
      return svgBars(series, label);
  }
}

/** The group-overview chart panel: caption + fixed-type SVG + mandatory data table. */
export function groupOverviewPanel(group: MetricGroup, metrics: readonly Metric[]): string {
  const description = GROUP_DESCRIPTION[group];
  const { series, title } = representativeSeries(metrics);
  if (series.length === 0) {
    const emptyLabel = `Group ${group} overview`;
    return `<figure class="chart-panel" aria-label="${escapeHtml(emptyLabel)}">
<figcaption>${escapeHtml(description)}</figcaption>
<p class="chart-empty">No chartable series for this group — see the metric cards below.</p>
</figure>`;
  }
  const label = `Group ${group} overview — ${title}`;
  return `<figure class="chart-panel" aria-label="${escapeHtml(label)}">
<figcaption>${escapeHtml(description)} <span class="chart-source">(${escapeHtml(title)})</span></figcaption>
${groupChartSvg(group, series, label)}
${dataTable(series, "Value", title)}
</figure>`;
}

/**
 * The per-metric visual, chosen by the value's shape: timeseries → line;
 * distribution → bars; scalar-in-range → sparkline + gauge + number; pure scalar →
 * bold stat (no chart); none / not_available → no visual. Every non-scalar visual
 * carries a data-table fallback.
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
