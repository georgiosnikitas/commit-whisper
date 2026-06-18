/**
 * Terminal renderer (Story 1.8 — I2: picocolors + hand-rolled tables).
 *
 * Two render paths off the same Report JSON, selected by the format-agnostic
 * `classifyReport` branch:
 *   - showpiece — the three labeled narrative parts in order (Summary ·
 *     Explanation · Coaching) followed by the metrics table. Its input is a
 *     `ShowpieceReport` (narrative guaranteed), so a substrate report can never
 *     be rendered as the showpiece.
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

import type { Report, ReportAnalysis, ReportNarrative, ReportProvenance } from "../../assemble/report-schema.js";
import type { MetricGroup } from "../../analyze/metric.js";
import type { Confidence } from "../../narrate/narrate.port.js";
import { classifyReport, type ShowpieceReport, type SubstrateFraming } from "../render.port.js";
import { classifyHealth, HEALTH_GLYPH, HEALTH_LABEL, type HealthBand } from "../html/health.js";
import { extractSeries } from "../html/shape.js";

type Colors = ReturnType<typeof pc.createColors>;
type Metric = ReportAnalysis["metrics"][number];
type MetricExplanations = NonNullable<ReportNarrative["explanations"]>;

/** The catalog Metric Groups in stable order, with display titles + one-line descriptions (shared copy with Markdown/HTML). */
const GROUPS: ReadonlyArray<{ id: MetricGroup; title: string; description: string }> = [
  { id: "A", title: "Activity & Cadence", description: "How the project moves over time." },
  { id: "B", title: "Contribution & Ownership", description: "How the work is distributed across the team." },
  { id: "C", title: "Commit Message Quality", description: "How clearly the history communicates intent." },
  { id: "D", title: "Branching & Merge Structure", description: "How branching and merging are structured." },
  { id: "E", title: "Churn & Hotspots", description: "Where change and instability concentrate." },
  { id: "F", title: "Repository Health Signals", description: "Overall repository health signals." },
];

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
    ? renderShowpiece(route.report, report.provenance, c)
    : renderSubstrate(route.analysis, route.framing, report.provenance, c);
}

function renderShowpiece(report: ShowpieceReport, provenance: ReportProvenance | undefined, c: Colors): string {
  const { summary, explanation, coaching, confidence } = report.narrative;
  return [
    masthead(provenance, c),
    ...confidenceBand(confidence, c),
    "",
    c.bold("Summary"),
    c.bold(summary.headline),
    "",
    summary.overview,
    "",
    c.bold("Key findings"),
    ...summary.keyFindings.map((finding) => `  ${c.cyan("•")} ${finding}`),
    "",
    c.bold("Explanation"),
    ...explanation.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    c.bold("Coaching"),
    coaching.introduction,
    "",
    ...coaching.chapters.flatMap((chapter) => [
      c.bold(chapter.theme),
      ...chapter.steps.map((step, i) => {
        const marker = c.cyan(`${i + 1}.`);
        return `  ${marker} ${step}`;
      }),
      "",
    ]),
    coaching.closingSummary,
    "",
    metricsSection(report.analysis, report.narrative.explanations, c),
  ].join("\n");
}

function renderSubstrate(
  analysis: ReportAnalysis,
  framing: SubstrateFraming,
  provenance: ReportProvenance | undefined,
  c: Colors,
): string {
  const banner =
    framing === "degraded" ? c.bold(c.yellow(DEGRADED_BANNER)) : c.dim(METRICS_ONLY_NOTE);
  return [masthead(provenance, c), "", banner, "", metricsSection(analysis, undefined, c)].join("\n");
}

/**
 * The masthead: the wordmark, then the FR-17 provenance chip line (repo · branch
 * · N commits · C contributors · analyzed date) and the Free-tier cap line — the
 * same provenance the Markdown/HTML renderers carry. Each line renders only when
 * its facts are present, so a Report with no provenance shows just the wordmark.
 */
function masthead(provenance: ReportProvenance | undefined, c: Colors): string {
  const lines = [c.bold("commit-whisper")];
  const chips = provenanceChips(provenance);
  if (chips !== "") {
    lines.push(c.dim(chips));
  }
  const cap = capLine(provenance);
  if (cap !== "") {
    lines.push(c.dim(cap));
  }
  return lines.join("\n");
}

/** The FR-17 provenance chip line: the present facts joined by ` · ` (or "" when none are present). */
function provenanceChips(provenance: ReportProvenance | undefined): string {
  const repo = provenance?.repo;
  const scale = provenance?.scale;
  const chips: string[] = [];
  if (repo?.name !== undefined) {
    chips.push(repo.name);
  }
  if (repo?.branch !== undefined) {
    chips.push(repo.branch);
  }
  const commits = scale?.totalCommits ?? scale?.analyzedCommits;
  if (commits !== undefined) {
    chips.push(`${formatCount(commits)} ${commits === 1 ? "commit" : "commits"}`);
  }
  if (scale?.contributors !== undefined) {
    chips.push(`${formatCount(scale.contributors)} ${scale.contributors === 1 ? "contributor" : "contributors"}`);
  }
  const generatedAt = provenance?.run?.generatedAt;
  if (generatedAt !== undefined) {
    chips.push(`analyzed ${isoDate(generatedAt)}`);
  }
  return chips.join(" · ");
}

/** The Free-tier cap line: `Free · X of N commits analyzed` (degrading to `X commits analyzed`); paid tier ⇒ "". */
function capLine(provenance: ReportProvenance | undefined): string {
  if (provenance?.entitlement?.tier !== "free") {
    return "";
  }
  const analyzed = provenance.scale?.analyzedCommits;
  if (analyzed === undefined) {
    return "";
  }
  const total = provenance.scale?.totalCommits;
  const detail =
    total === undefined
      ? `${formatCount(analyzed)} commits analyzed`
      : `${formatCount(analyzed)} of ${formatCount(total)} commits analyzed`;
  return `Free · ${detail}`;
}

/** Deterministic thousands-grouping (locale-INDEPENDENT — the renderer must be pure; never `toLocaleString`). */
function formatCount(n: number): string {
  if (!Number.isFinite(n)) {
    return "0";
  }
  const negative = n < 0;
  const digits = Math.abs(Math.trunc(n)).toString();
  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      grouped += ",";
    }
    grouped += digits[i];
  }
  return negative ? `-${grouped}` : grouped;
}

/** The date component (`YYYY-MM-DD`) of an ISO-8601 timestamp, for the "analyzed <date>" chip. */
function isoDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * The confidence band (Story 3.5 — UX-DR9): a labeled, color-coded line surfacing
 * the run's self-assessed confidence, with the low-confidence escalation on its
 * own line. Absent confidence ⇒ no band (back-compat). Color is the only
 * TTY-sensitive surface; the text is identical headless vs TTY.
 */
function confidenceBand(confidence: Confidence | undefined, c: Colors): string[] {
  if (confidence === undefined) {
    return [];
  }
  const paintByLevel = { high: c.green, medium: c.yellow, low: c.red } as const;
  const paint = paintByLevel[confidence.level];
  const label = `Confidence: ${paint(c.bold(confidence.level.toUpperCase()))}`;
  const lines = ["", `${label} — ${c.dim(confidence.rationale)}`];
  if (confidence.escalation !== undefined) {
    lines.push(c.bold(c.red(`⚠ ${confidence.escalation}`)));
  }
  return lines;
}

/**
 * The Metrics section: A→F groups present in the analysis, each with its title +
 * description, and every metric carrying its health band, value, and — when a
 * narrative explanation exists — its four-facet bullets. This is the SAME content
 * the Markdown/HTML renderers carry, so the terminal no longer diverges (it omits
 * only the format-specific visuals/charts).
 */
function metricsSection(analysis: ReportAnalysis, explanations: MetricExplanations | undefined, c: Colors): string {
  if (analysis.metrics.length === 0) {
    return c.dim("No metrics computed.");
  }
  const present = GROUPS.filter((group) => analysis.metrics.some((metric) => metric.group === group.id));
  const sections = present.map((group) => {
    const metrics = analysis.metrics.filter((metric) => metric.group === group.id);
    const cards = metrics.map((metric) => metricCard(metric, explanations, c)).join("\n\n");
    return [c.bold(`${group.id} · ${group.title}`), c.dim(group.description), "", cards].join("\n");
  });
  return [c.bold("Metrics"), "", sections.join("\n\n")].join("\n");
}

/** One metric: a title + health-band heading, the Value bullet, and the four-facet bullets when present. */
function metricCard(metric: Metric, explanations: MetricExplanations | undefined, c: Colors): string {
  const band = classifyHealth(metric);
  const heading = `${c.bold(metric.title)}  ${healthTag(band, c)}`;
  const lines = [heading, valueBullet(metric, c)];
  const explanation = explanations?.[metric.id];
  if (explanation !== undefined) {
    lines.push(...facetBullets(explanation, c));
  }
  return lines.join("\n");
}

/** The color-coded health glyph + word (shape carries the signal; color is the only TTY-sensitive surface). */
function healthTag(band: HealthBand, c: Colors): string {
  const paintByBand = { ok: c.green, watch: c.yellow, risk: c.red, na: c.dim } as const;
  return paintByBand[band](`${HEALTH_GLYPH[band]} ${HEALTH_LABEL[band]}`);
}

/** The Value bullet — the computed value, or a not-available note carrying the reason. */
function valueBullet(metric: Metric, c: Colors): string {
  const label = `  ${c.cyan("•")} ${c.bold("Value")}`;
  if (metric.status !== "computed") {
    const reason = metric.reason === undefined ? "" : ` — ${metric.reason}`;
    const note = `not available${reason}`;
    return `${label} — ${c.dim(note)}`;
  }
  const value = metric.value;
  // Scalars stay inline; structured multi-field values become a compact labeled
  // list (the same series the Markdown/HTML renderers chart) rather than a raw
  // JSON array dump.
  if (value === null || typeof value !== "object") {
    return `${label} — ${formatValue(value)}`;
  }
  const series = extractSeries(value);
  if (series.length === 0) {
    return `${label} — ${formatValue(value)}`;
  }
  if (series.length === 1) {
    return `${label} — ${formatNumber(series[0].value)}`;
  }
  const rows = series.map((point) => `    ${c.dim("-")} ${point.label}: ${formatNumber(point.value)}`);
  return [label, ...rows].join("\n");
}

/** A finite number rounded to 2 decimals (locale-independent, byte-stable). */
function formatNumber(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0";
}

/** The four facets as labeled bullets in the fixed order (mirrors the Markdown/HTML facet order). */
function facetBullets(explanation: MetricExplanations[string], c: Colors): string[] {
  return [
    `  ${c.cyan("•")} ${c.bold("What it means")} — ${explanation.explanation}`,
    ...arrayFacet("Strengths", explanation.goodBehaviours, c),
    ...arrayFacet("Needs improvement", explanation.needsImprovement, c),
    ...arrayFacet("Suggestions", explanation.suggestions, c),
  ];
}

/** A list facet: an em-dash "none" when empty, else one indented sub-bullet per item. */
function arrayFacet(label: string, items: readonly string[], c: Colors): string[] {
  if (items.length === 0) {
    return [`  ${c.cyan("•")} ${c.bold(label)} — —`];
  }
  return [`  ${c.cyan("•")} ${c.bold(label)}`, ...items.map((item) => `    ${c.dim("-")} ${item}`)];
}

/** Compact, width-bounded rendering of a scalar / un-series-able metric value. */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.length > 60 ? `${value.slice(0, 59)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const json = JSON.stringify(value);
  if (json === undefined) {
    return "";
  }
  return json.length > 60 ? `${json.slice(0, 59)}…` : json;
}
