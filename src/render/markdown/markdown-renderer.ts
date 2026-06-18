/**
 * Markdown renderer (Story 4.3 — FR-7, FR-13, I2).
 *
 * A pure `Report → string` renderer (typed template literals, no clock/I/O/random)
 * that returns a single self-contained, diff-able `.md` document. It routes the SAME
 * two paths off the SAME Report JSON as the terminal + HTML via `classifyReport`:
 *   - showpiece — the narrative-first spine (`# commit-whisper` → confidence → `## Summary`
 *     → `## Explanation` → `## Coaching` → `## Metrics`), each computed metric carrying
 *     its four-facet explanation as BOLD-LABEL BULLETS (never a wide table — that wraps
 *     in PR diffs and defeats the format).
 *   - substrate — the `## Metrics` half in full from `analysis`, framed either as a loud
 *     DEGRADED render (a banner blockquote as the first line of the file + stub narrative
 *     headings — narration broke, it shouts) or a calm METRICS-ONLY render (no banner, a
 *     quiet footer note — it chose to skip the narrative). Neither can masquerade as the
 *     showpiece (the substrate type carries no `narrative`).
 *
 * Every visual is text (ASCII sparklines, fenced text-bars, Mermaid) — no binary image,
 * no network. Health bands + value shapes reuse the render-shared classifiers
 * (`../html/health.ts`, `../html/shape.ts`) so Markdown never disagrees with HTML.
 *
 * Escaping (see the story decision): STRUCTURED/data interpolations (titles, values,
 * labels = repo file paths, reasons) go through `escapeCell`; narrative PROSE renders as
 * Markdown (newlines collapsed for one-line bullets via `inlineProse`). `render/` is
 * `no-console` — the renderer never writes; the CLI shell writes the returned string.
 */

import type { Report, ReportAnalysis, ReportNarrative, ReportProvenance } from "../../assemble/report-schema.js";
import type { MetricGroup } from "../../analyze/metric.js";
import { classifyReport, type ShowpieceReport, type SubstrateFraming } from "../render.port.js";
import { classifyHealth, HEALTH_GLYPH, HEALTH_LABEL } from "../html/health.js";
import { detectShape, extractSeries } from "../html/shape.js";
import { escapeCell, inlineProse } from "./escape.js";
import { groupOverview, metricVisualMarkdown } from "./visuals.js";

type Metric = ReportAnalysis["metrics"][number];
type Confidence = NonNullable<ReportNarrative["confidence"]>;
type MetricExplanations = NonNullable<ReportNarrative["explanations"]>;

/** The catalog Metric Groups in stable order, with display titles + one-line descriptions. */
const GROUPS: ReadonlyArray<{ id: MetricGroup; title: string; description: string }> = [
  { id: "A", title: "Activity & Cadence", description: "How the project moves over time." },
  { id: "B", title: "Contribution & Ownership", description: "How the work is distributed across the team." },
  { id: "C", title: "Commit Message Quality", description: "How clearly the history communicates intent." },
  { id: "D", title: "Branching & Merge Structure", description: "How branching and merging are structured." },
  { id: "E", title: "Churn & Hotspots", description: "Where change and instability concentrate." },
  { id: "F", title: "Repository Health Signals", description: "Overall repository health signals." },
];

/** The loud degraded banner — the first line of the file (above the title) so it leads every reader. */
export const MD_DEGRADED_BANNER =
  "> ⚠ **Narrative unavailable — showing raw analysis.** The AI narration step failed; your metrics below are intact. _Retry · check the provider · switch it in Settings._";
/** The quiet metrics-only footer note — calm by design, never an alarm. */
export const MD_METRICS_ONLY_NOTE = "_Narrative skipped (--no-ai) — run interactively or add a key for the full report._";

/** Render the full Markdown report document for a Report. */
export function renderMarkdown(report: Report): string {
  const route = classifyReport(report);
  const provenance = report.provenance;
  const body =
    route.kind === "showpiece"
      ? renderShowpiece(route.report, provenance)
      : renderSubstrate(route.analysis, route.framing, provenance);
  return `${body}\n`;
}

/** Join non-empty blocks with a blank line between them. */
function blocks(...parts: string[]): string {
  return parts.filter((part) => part !== "").join("\n\n");
}

/** The narrated showpiece: masthead → confidence → Summary → Explanation → Coaching → Metrics → footer. */
function renderShowpiece(report: ShowpieceReport, provenance: ReportProvenance | undefined): string {
  const { summary, explanation, coaching, explanations, confidence } = report.narrative;
  return blocks(
    masthead(provenance),
    confidence === undefined ? "" : confidenceBlock(confidence),
    summaryBand(summary),
    explanationBand(explanation),
    coachingBand(coaching),
    metricsSection(report.analysis, explanations),
    footer("showpiece", provenance),
  );
}

/** The substrate: a degraded render (banner + stub headings) or a calm metrics-only render. */
function renderSubstrate(analysis: ReportAnalysis, framing: SubstrateFraming, provenance: ReportProvenance | undefined): string {
  if (framing === "degraded") {
    return blocks(
      MD_DEGRADED_BANNER,
      masthead(provenance),
      "**Confidence:** —  _(no narrative to assess)_",
      stubBand("Summary", "Narrative unavailable — showing raw analysis."),
      stubBand("Explanation", "Narrative unavailable."),
      stubBand("Coaching", "Narrative unavailable."),
      metricsSection(analysis, undefined),
      footer("degraded", provenance),
    );
  }
  return blocks(masthead(provenance), metricsSection(analysis, undefined), footer("metrics-only", provenance));
}

/** The masthead: the wordmark title (+ repo name), the FR-17 provenance chip line, and the Free-tier cap line. */
function masthead(provenance: ReportProvenance | undefined): string {
  return blocks(title(provenance), provenanceChips(provenance), capLine(provenance));
}

/** The title — `# commit-whisper` plus the repo name when present (mirrors the HTML masthead wordmark). */
function title(provenance: ReportProvenance | undefined): string {
  const name = provenance?.repo?.name;
  return name === undefined ? "# commit-whisper" : `# commit-whisper — ${escapeCell(name)}`;
}

/** The FR-17 provenance chip line: the present facts (repo · branch · N commits · C contributors · analyzed date), each escaped. */
function provenanceChips(provenance: ReportProvenance | undefined): string {
  const repo = provenance?.repo;
  const scale = provenance?.scale;
  const chips: string[] = [];
  if (repo?.name !== undefined) {
    chips.push(escapeCell(repo.name));
  }
  if (repo?.branch !== undefined) {
    chips.push(escapeCell(repo.branch));
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
  return chips.length === 0 ? "" : `_${chips.join(" · ")}_`;
}

/** The Free-tier cap line: `Free · X of N commits analyzed` (degrading to `X commits analyzed`); a paid tier renders nothing. */
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

/** The confidence line — the WORD (high/medium/low), never a glyph; escalation on its own line. */
function confidenceBlock(confidence: Confidence): string {
  const head = `**Confidence:** ${confidence.level} — ${inlineProse(confidence.rationale)}`;
  if (confidence.escalation === undefined) {
    return head;
  }
  return `${head}\n\n> ⚠ ${inlineProse(confidence.escalation)}`;
}

function summaryBand(summary: ShowpieceReport["narrative"]["summary"]): string {
  const findings = summary.keyFindings.map((finding) => `- ${inlineProse(finding)}`).join("\n");
  const body = findings === "" ? summary.overview : `${summary.overview}\n\n${findings}`;
  return `## Summary\n\n> ${inlineProse(summary.headline)}\n\n${body}`;
}

function explanationBand(explanation: ShowpieceReport["narrative"]["explanation"]): string {
  return `## Explanation\n\n${explanation.paragraphs.join("\n\n")}`;
}

function coachingBand(coaching: ShowpieceReport["narrative"]["coaching"]): string {
  const chapters = coaching.chapters
    .map((chapter, i) => {
      const steps = chapter.steps.map((step) => `- ${inlineProse(step)}`).join("\n");
      return `### ${i + 1}. ${inlineProse(chapter.theme)}\n\n${steps}`;
    })
    .join("\n\n");
  return `## Coaching\n\n${coaching.introduction}\n\n${chapters}\n\n_${inlineProse(coaching.closingSummary)}_`;
}

/** A stub narrative heading for the degraded render — its absence/emptiness is conspicuous in a diff. */
function stubBand(name: string, note: string): string {
  return `## ${name}\n\n_${note}_`;
}

/** The `## Metrics` section: A→F groups present in the analysis, each with its overview + cards. */
function metricsSection(analysis: ReportAnalysis, explanations: MetricExplanations | undefined): string {
  const present = GROUPS.filter((group) => analysis.metrics.some((metric) => metric.group === group.id));
  if (present.length === 0) {
    return "## Metrics\n\n_No metrics computed._";
  }
  const sections = present.map((group) => {
    const metrics = analysis.metrics.filter((metric) => metric.group === group.id);
    const cards = metrics.map((metric) => metricCard(metric, explanations)).join("\n\n");
    const overview = groupOverview(group.id, metrics);
    return `### ${group.id} · ${escapeCell(group.title)}\n\n${group.description}\n\n${overview}\n\n${cards}`;
  });
  return `## Metrics\n\n${sections.join("\n\n")}`;
}

/** One metric: a `####` heading (title · band glyph+word · inline visual) + optional body + bullets. */
function metricCard(metric: Metric, explanations: MetricExplanations | undefined): string {
  const band = classifyHealth(metric);
  const visual = metricVisualMarkdown(metric);
  const suffix = visual.headingSuffix === "" ? "" : `  ${visual.headingSuffix}`;
  const heading = `#### ${escapeCell(metric.title)}  ${HEALTH_GLYPH[band]} ${HEALTH_LABEL[band]}${suffix}`;
  const body = visual.body === "" ? "" : `\n\n${visual.body}`;
  return `${heading}${body}\n\n${metricBullets(metric, explanations)}`;
}

/** The Value bullet (always) + the four-facet bullets (when a narrative explanation exists). */
function metricBullets(metric: Metric, explanations: MetricExplanations | undefined): string {
  const value = valueBullet(metric);
  const explanation = explanations?.[metric.id];
  if (explanation === undefined) {
    return value;
  }
  // A table-valued bullet is a multi-line block; separate it from the facet list with a
  // blank line so the table closes cleanly. Inline values stay tight one-per-line.
  const separator = value.includes("\n") ? "\n\n" : "\n";
  return [value, facetBullets(explanation).join("\n")].join(separator);
}

function valueBullet(metric: Metric): string {
  if (metric.status !== "computed") {
    const reason = metric.reason === undefined ? "" : ` — ${escapeCell(metric.reason)}`;
    return `- **Value** — _not available${reason}_`;
  }
  const value = metric.value;
  // Scalars (and rare un-series-able shapes) stay inline; structured multi-field
  // values become a compact 2-column table (the data-table the HTML report shows)
  // rather than a raw JSON blob.
  if (value === null || typeof value !== "object") {
    return `- **Value** — ${escapeCell(formatValue(value))}`;
  }
  const series = extractSeries(value);
  if (series.length === 0) {
    return `- **Value** — ${escapeCell(formatValue(value))}`;
  }
  if (series.length === 1) {
    return `- **Value** — ${escapeCell(formatNumber(series[0].value))}`;
  }
  return valueTable(value);
}

/** A finite number rounded to 2 decimals for table cells (locale-independent, byte-stable). */
function formatNumber(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0";
}

/** The structured value as a 2-column Markdown table; the label column header follows the value shape. */
function valueTable(value: object): string {
  const shape = detectShape(value);
  const labelHeader = shape === "timeseries" ? "Period" : shape === "distribution" ? "Item" : "Field";
  const rows = extractSeries(value).map((point) => `| ${escapeCell(point.label)} | ${escapeCell(formatNumber(point.value))} |`);
  return [`- **Value**`, "", `| ${labelHeader} | Value |`, "| --- | --- |", ...rows].join("\n");
}

/** The four facets as bold-label bullets in the fixed order — NEVER a wide table (the locked rule). */
function facetBullets(explanation: MetricExplanations[string]): string[] {
  return [
    `- **What it means** — ${inlineProse(explanation.explanation)}`,
    ...arrayFacet("Strengths", explanation.goodBehaviours),
    ...arrayFacet("Needs improvement", explanation.needsImprovement),
    ...arrayFacet("Suggestions", explanation.suggestions),
  ];
}

/** A facet whose value is a list: an em-dash "none" when empty, else nested one-per-line bullets. */
function arrayFacet(label: string, items: readonly string[]): string[] {
  if (items.length === 0) {
    return [`- **${label}** — —`];
  }
  return [`- **${label}**`, ...items.map((item) => `  - ${inlineProse(item)}`)];
}

/** Compact text of a metric value (arbitrary JSON); the caller `escapeCell`s the result. */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

/** The footer; appends the FR-17 provenance facts (version · provider/model · timestamp) and the metrics-only note. */
function footer(kind: "showpiece" | "degraded" | "metrics-only", provenance: ReportProvenance | undefined): string {
  const version = provenance?.run?.toolVersion;
  const parts = [
    version === undefined ? "Generated by commit-whisper" : `Generated by commit-whisper v${escapeCell(version)}`,
    "schemaVersion 1.0.0",
  ];
  const ai = provenance?.ai;
  if (ai !== undefined) {
    parts.push(`${escapeCell(ai.provider)}/${escapeCell(ai.model)}`);
  }
  const generatedAt = provenance?.run?.generatedAt;
  if (generatedAt !== undefined) {
    parts.push(escapeCell(generatedAt));
  }
  const base = `---\n${parts.join(" · ")}`;
  return kind === "metrics-only" ? `${base}\n\n${MD_METRICS_ONLY_NOTE}` : base;
}
