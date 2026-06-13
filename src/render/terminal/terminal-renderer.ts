/**
 * Terminal renderer (Story 1.8 — I2: picocolors + hand-rolled tables).
 *
 * Two render paths off the same Report JSON, selected by the format-agnostic
 * `classifyReport` branch:
 *   - showpiece — narrative bands (headline · overview · key findings) followed
 *     by the metrics table. Its input is a `ShowpieceReport` (narrative
 *     guaranteed), so a substrate report can never be rendered as the showpiece.
 *   - substrate — the metrics table preceded by a banner: a loud `⚠` degraded
 *     banner (fail-open, exit 9) or a neutral metrics-only note (`--no-ai`, exit
 *     0). No narrative bands — it cannot masquerade as the showpiece.
 *
 * Pure: a `Report` in, a string out. Color is via picocolors and is the only
 * TTY-sensitive surface — the report TEXT is identical headless vs TTY (AC3).
 * `render/` is under `no-console`; this module never writes — the CLI shell
 * writes the returned string to stdout.
 */

import pc from "picocolors";

import type { Report, ReportAnalysis } from "../../assemble/report-schema.js";
import { classifyReport, type ShowpieceReport, type SubstrateFraming } from "../render.port.js";

type Colors = ReturnType<typeof pc.createColors>;

export interface TerminalRenderOptions {
  /** Force color on/off. Omitted ⇒ picocolors auto-detect (`NO_COLOR` / non-TTY ⇒ off). */
  color?: boolean;
}

/** Exact banner copy (architecture: substrate render carries this verbatim). */
export const DEGRADED_BANNER = "⚠ Narrative unavailable — raw analysis below";
export const METRICS_ONLY_NOTE = "Metrics-only run — no AI narrative requested";

export function renderTerminal(report: Report, opts: TerminalRenderOptions = {}): string {
  const c = opts.color === undefined ? pc.createColors() : pc.createColors(opts.color);
  const route = classifyReport(report);
  return route.kind === "showpiece"
    ? renderShowpiece(route.report, c)
    : renderSubstrate(route.analysis, route.framing, c);
}

function renderShowpiece(report: ShowpieceReport, c: Colors): string {
  const { summary } = report.narrative;
  return [
    heading(c),
    "",
    c.bold(summary.headline),
    "",
    summary.overview,
    "",
    c.bold("Key findings"),
    ...summary.keyFindings.map((finding) => `  ${c.cyan("•")} ${finding}`),
    "",
    metricsTable(report.analysis, c),
  ].join("\n");
}

function renderSubstrate(analysis: ReportAnalysis, framing: SubstrateFraming, c: Colors): string {
  const banner =
    framing === "degraded" ? c.bold(c.yellow(DEGRADED_BANNER)) : c.dim(METRICS_ONLY_NOTE);
  return [heading(c), "", banner, "", metricsTable(analysis, c)].join("\n");
}

function heading(c: Colors): string {
  return c.bold("commit-sage");
}

/** Hand-rolled metrics table (id-ordered as the engine emitted them — deterministic). */
function metricsTable(analysis: ReportAnalysis, c: Colors): string {
  if (analysis.metrics.length === 0) {
    return c.dim("No metrics computed.");
  }
  const rows = analysis.metrics.map((metric) => ({
    title: metric.title,
    status: metric.status,
    detail: metric.status === "computed" ? formatValue(metric.value) : metric.reason ?? "",
  }));
  const titleW = maxWidth(rows.map((row) => row.title), "Metric".length);
  const statusW = maxWidth(rows.map((row) => row.status), "Status".length);

  const lines = [c.bold(`${pad("Metric", titleW)}  ${pad("Status", statusW)}  Detail`)];
  for (const row of rows) {
    const status =
      row.status === "computed"
        ? c.green(pad(row.status, statusW))
        : c.yellow(pad(row.status, statusW));
    lines.push(`${pad(row.title, titleW)}  ${status}  ${c.dim(row.detail)}`);
  }
  return lines.join("\n");
}

/** Compact, width-bounded rendering of a metric value (the value is arbitrary JSON). */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  const json = JSON.stringify(value);
  if (json === undefined) {
    return "";
  }
  return json.length > 60 ? `${json.slice(0, 59)}…` : json;
}

function maxWidth(values: string[], floor: number): number {
  return values.reduce((width, value) => Math.max(width, value.length), floor);
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}
