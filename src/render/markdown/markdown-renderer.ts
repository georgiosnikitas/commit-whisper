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

import type { Report, ReportAnalysis, ReportNarrative } from "../../assemble/report-schema.js";
import type { MetricGroup } from "../../analyze/metric.js";
import { classifyReport, type ShowpieceReport, type SubstrateFraming } from "../render.port.js";
import { classifyHealth, HEALTH_GLYPH, HEALTH_LABEL } from "../html/health.js";
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
  const body =
    route.kind === "showpiece"
      ? renderShowpiece(route.report)
      : renderSubstrate(route.analysis, route.framing);
  return `${body}\n`;
}

/** Join non-empty blocks with a blank line between them. */
function blocks(...parts: string[]): string {
  return parts.filter((part) => part !== "").join("\n\n");
}

/** The narrated showpiece: title → confidence → Summary → Explanation → Coaching → Metrics → footer. */
function renderShowpiece(report: ShowpieceReport): string {
  const { summary, explanation, coaching, explanations, confidence } = report.narrative;
  return blocks(
    title(),
    confidence === undefined ? "" : confidenceBlock(confidence),
    summaryBand(summary),
    explanationBand(explanation),
    coachingBand(coaching),
    metricsSection(report.analysis, explanations),
    footer("showpiece"),
  );
}

/** The substrate: a degraded render (banner + stub headings) or a calm metrics-only render. */
function renderSubstrate(analysis: ReportAnalysis, framing: SubstrateFraming): string {
  if (framing === "degraded") {
    return blocks(
      MD_DEGRADED_BANNER,
      title(),
      "**Confidence:** —  _(no narrative to assess)_",
      stubBand("Summary", "Narrative unavailable — showing raw analysis."),
      stubBand("Explanation", "Narrative unavailable."),
      stubBand("Coaching", "Narrative unavailable."),
      metricsSection(analysis, undefined),
      footer("degraded"),
    );
  }
  return blocks(title(), metricsSection(analysis, undefined), footer("metrics-only"));
}

function title(): string {
  return "# commit-whisper";
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
  return [value, ...facetBullets(explanation)].join("\n");
}

function valueBullet(metric: Metric): string {
  if (metric.status !== "computed") {
    const reason = metric.reason === undefined ? "" : ` — ${escapeCell(metric.reason)}`;
    return `- **Value** — _not available${reason}_`;
  }
  return `- **Value** — ${escapeCell(formatValue(metric.value))}`;
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

/** The footer; the metrics-only render appends its quiet note. */
function footer(kind: "showpiece" | "degraded" | "metrics-only"): string {
  const base = "---\nGenerated by commit-whisper · schemaVersion 1.0.0";
  return kind === "metrics-only" ? `${base}\n\n${MD_METRICS_ONLY_NOTE}` : base;
}
