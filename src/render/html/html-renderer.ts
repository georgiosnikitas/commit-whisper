/**
 * Self-contained HTML report shell (Story 4.1 — I1, FR-13).
 *
 * A pure `Report → string` renderer (typed template literals, zero deps) that
 * returns a single self-contained `<!doctype html>` document: all CSS inlined, a
 * system font stack, NO external `<link>`/`<script src>`/CDN/remote font — so it
 * opens in any browser with no network. It routes the SAME two paths off the SAME
 * Report JSON as the terminal via `classifyReport`:
 *   - showpiece — the narrative-first bands (masthead → Summary → Explanation →
 *     Coaching) BEFORE the metric groups (story before evidence — the template's
 *     non-negotiable), with a table of contents + in-page anchors.
 *   - substrate — masthead → a loud degraded banner or a neutral metrics-only
 *     note → the metric groups (no narrative bands).
 *
 * Charts, per-metric visuals, data-table fallbacks, and the health-band glyphs
 * are Story 4.2 — 4.1 is the navigable, accessible, narrative-first TEXT shell.
 *
 * Security: the narrative is LLM output and metric values carry repo-derived data
 * — untrusted at the render boundary — so EVERY interpolated value is
 * `escapeHtml`'d. The renderer never emits a raw interpolated value into markup
 * or an attribute (OWASP A03 / stored-XSS into a shareable artifact).
 *
 * Pure: a `Report` in, a string out — no clock, no I/O, no env; `render/` is
 * under `no-console`, so the renderer never writes (the CLI shell writes the
 * returned string to the output file in a later dispatch story).
 */

import type { Report, ReportAnalysis, ReportNarrative } from "../../assemble/report-schema.js";
import type { MetricGroup } from "../../analyze/metric.js";
import { classifyReport, type ShowpieceReport, type SubstrateFraming } from "../render.port.js";
import { escapeHtml } from "./escape.js";
import { groupOverviewPanel, metricVisual } from "./charts.js";
import { classifyHealth, HEALTH_GLYPH, HEALTH_LABEL } from "./health.js";

export { escapeHtml };

type Metric = ReportAnalysis["metrics"][number];
type Confidence = NonNullable<ReportNarrative["confidence"]>;
type MetricExplanations = NonNullable<ReportNarrative["explanations"]>;

/** The catalog Metric Groups in stable output order, with their display titles. */
const GROUPS: ReadonlyArray<{ id: MetricGroup; title: string }> = [
  { id: "A", title: "Activity & Cadence" },
  { id: "B", title: "Contribution & Ownership" },
  { id: "C", title: "Commit Message Quality" },
  { id: "D", title: "Branching & Merge Structure" },
  { id: "E", title: "Churn & Hotspots" },
  { id: "F", title: "Repository Health Signals" },
];

/** Loud banner for a fail-open degraded substrate render (narrative attempted, lost). */
export const HTML_DEGRADED_BANNER = "⚠ Narrative unavailable — showing raw analysis";
/** Neutral note for an intentional metrics-only (`--no-ai`) substrate render. */
export const HTML_METRICS_ONLY_NOTE = "Metrics-only run — no AI narrative requested";

/** Render the full self-contained HTML document for a Report. */
export function renderHtml(report: Report): string {
  const route = classifyReport(report);
  const body =
    route.kind === "showpiece"
      ? renderShowpiece(route.report)
      : renderSubstrate(route.analysis, route.framing);
  return document(body);
}

/** Wrap the body bands in the document skeleton (head + inlined style + landmarks). */
function document(body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>commit-whisper report</title>
<style>${STYLE}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${body}
${footer()}
<script>${DISCLOSURE_SCRIPT}</script>
</body>
</html>`;
}

/** The narrated showpiece: masthead → Summary → TOC → Explanation → Coaching → groups. */
function renderShowpiece(report: ShowpieceReport): string {
  const { summary, explanation, coaching, explanations, confidence } = report.narrative;
  return [
    masthead(confidence),
    summaryBand(summary),
    toc(true, report.analysis),
    explanationBand(explanation),
    coachingBand(coaching),
    metricGroups(report.analysis, explanations),
  ].join("\n");
}

/** The substrate: masthead → banner/note → metric groups (no narrative bands). */
function renderSubstrate(analysis: ReportAnalysis, framing: SubstrateFraming): string {
  return [masthead(undefined), substrateBanner(framing), toc(false, analysis), metricGroups(analysis, undefined)].join("\n");
}

function masthead(confidence: Confidence | undefined): string {
  const band = confidence === undefined ? "" : confidenceBand(confidence);
  return `<header class="masthead">
<h1>commit-whisper</h1>
<p class="tagline">Deterministic git-history analysis with a grounded AI narrative.</p>
${band}
</header>`;
}

/** The confidence self-assessment band (Story 3.5), surfaced prominently. */
function confidenceBand(confidence: Confidence): string {
  const level = escapeHtml(confidence.level);
  const escalation =
    confidence.escalation === undefined
      ? ""
      : `<p class="confidence-escalation" role="alert">⚠ ${escapeHtml(confidence.escalation)}</p>`;
  return `<div class="confidence confidence-${level}">
<p><span class="confidence-label">Confidence:</span> <strong>${level.toUpperCase()}</strong> — ${escapeHtml(confidence.rationale)}</p>
${escalation}
</div>`;
}

function substrateBanner(framing: SubstrateFraming): string {
  return framing === "degraded"
    ? `<p class="banner banner-degraded" role="alert">${escapeHtml(HTML_DEGRADED_BANNER)}</p>`
    : `<p class="banner banner-metrics-only">${escapeHtml(HTML_METRICS_ONLY_NOTE)}</p>`;
}

/** The Metric Groups actually present in the analysis, in stable A→F order. */
function presentGroups(analysis: ReportAnalysis): ReadonlyArray<{ id: MetricGroup; title: string }> {
  return GROUPS.filter((group) => analysis.metrics.some((metric) => metric.group === group.id));
}

/**
 * The table of contents — narrative anchors only when narrated; and ONLY the
 * Metric Groups actually rendered (a group with no metrics is omitted from both
 * the sections and the TOC, so the TOC never links a dead anchor).
 */
function toc(narrated: boolean, analysis: ReportAnalysis): string {
  const narrativeLinks = narrated
    ? [
        '<li><a href="#summary">Summary</a></li>',
        '<li><a href="#explanation">Explanation</a></li>',
        '<li><a href="#coaching">Coaching</a></li>',
      ].join("\n")
    : "";
  const groupLinks = presentGroups(analysis)
    .map((g) => `<li><a href="#group-${g.id.toLowerCase()}">${escapeHtml(g.id)} — ${escapeHtml(g.title)}</a></li>`)
    .join("\n");
  return `<nav class="toc" aria-label="Table of contents">
<h2>Contents</h2>
<ul>
${narrativeLinks}
${groupLinks}
</ul>
</nav>`;
}

function summaryBand(summary: ShowpieceReport["narrative"]["summary"]): string {
  const findings = summary.keyFindings
    .map((finding) => `<li>${escapeHtml(finding)}</li>`)
    .join("\n");
  return `<section id="summary" class="band" aria-labelledby="summary-h">
<h2 id="summary-h">Summary</h2>
<p class="headline">${escapeHtml(summary.headline)}</p>
<p>${escapeHtml(summary.overview)}</p>
${findings === "" ? "" : `<ul class="key-findings">\n${findings}\n</ul>`}
</section>`;
}

function explanationBand(explanation: ShowpieceReport["narrative"]["explanation"]): string {
  const paragraphs = explanation.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
  return `<section id="explanation" class="band" aria-labelledby="explanation-h">
<h2 id="explanation-h">Explanation</h2>
${paragraphs}
</section>`;
}

function coachingBand(coaching: ShowpieceReport["narrative"]["coaching"]): string {
  const chapters = coaching.chapters
    .map((chapter) => {
      const steps = chapter.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("\n");
      return `<article class="chapter">
<h3>${escapeHtml(chapter.theme)}</h3>
<ol>
${steps}
</ol>
</article>`;
    })
    .join("\n");
  return `<section id="coaching" class="band" aria-labelledby="coaching-h">
<h2 id="coaching-h">Coaching</h2>
<p class="coaching-intro">${escapeHtml(coaching.introduction)}</p>
${chapters}
<p class="coaching-closing">${escapeHtml(coaching.closingSummary)}</p>
</section>`;
}

/** The metric-groups band: A→F sections, each with its overview chart + cards (omit empty groups). */
function metricGroups(analysis: ReportAnalysis, explanations: MetricExplanations | undefined): string {
  const sections = presentGroups(analysis).map((group) => {
    const metrics = analysis.metrics.filter((metric) => metric.group === group.id);
    const cards = metrics.map((metric) => metricCard(metric, explanations)).join("\n");
    return `<section id="group-${group.id.toLowerCase()}" class="metric-group" aria-labelledby="group-${group.id.toLowerCase()}-h">
<h2 id="group-${group.id.toLowerCase()}-h">${escapeHtml(group.id)} — ${escapeHtml(group.title)}</h2>
${groupOverviewPanel(group.id, metrics)}
${cards}
</section>`;
  });
  return `<main id="main" class="metric-groups">
${sections.join("\n")}
</main>`;
}

/**
 * One metric card. A `<details>` so it can collapse (progressive disclosure); the
 * `<summary>` carries title · health band · value, the body carries the visual +
 * four facets + the data-table fallback. Rendered `open` by default (no-JS = all
 * expanded); the disclosure script collapses `ok` cards when JS is on.
 */
function metricCard(metric: Metric, explanations: MetricExplanations | undefined): string {
  const band = classifyHealth(metric);
  const bandHtml = `<span class="health health-${band}"><span class="health-glyph" aria-hidden="true">${HEALTH_GLYPH[band]}</span> ${escapeHtml(HEALTH_LABEL[band])}</span>`;
  const detail =
    metric.status === "computed"
      ? `<p class="metric-value"><code>${escapeHtml(formatValue(metric.value))}</code></p>`
      : `<p class="metric-reason">${escapeHtml(metric.reason ?? "Not available.")}</p>`;
  const explanation = explanations?.[metric.id];
  return `<details class="metric-card" data-status="${escapeHtml(metric.status)}" data-health="${band}" open>
<summary><h3 class="metric-title">${escapeHtml(metric.title)}</h3> ${bandHtml}</summary>
<div class="metric-body">
${metricVisual(metric)}
${detail}
${explanation === undefined ? "" : fourFacets(explanation)}
</div>
</details>`;
}

/** The four-facet Metric Explanation (Story 3.2), joined to its metric by id. */
function fourFacets(explanation: MetricExplanations[string]): string {
  const list = (items: readonly string[]): string => {
    if (items.length === 0) {
      return "<p>None.</p>";
    }
    const entries = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
    return `<ul>\n${entries}\n</ul>`;
  };
  return `<div class="facets">
<p class="facet-meaning">${escapeHtml(explanation.explanation)}</p>
<h4>Good behaviours</h4>
${list(explanation.goodBehaviours)}
<h4>Needs improvement</h4>
${list(explanation.needsImprovement)}
<h4>Suggestions</h4>
${list(explanation.suggestions)}
</div>`;
}

/** Compact, escaped-text rendering of a metric value (the rich visuals are Story 4.2). */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  const json = JSON.stringify(value);
  return json ?? "";
}

function footer(): string {
  return `<footer class="footer">
<p>Generated by commit-whisper · schemaVersion 1.0.0</p>
</footer>`;
}

/**
 * The inlined stylesheet: a dark-first / light `prefers-color-scheme` palette with
 * AA-contrast tokens, a system font stack (no web font — self-contained + lean),
 * `:focus-visible` outlines + a skip link for keyboard nav, `:target` emphasis for
 * anchor landing, and a `prefers-reduced-motion` block. No JS.
 */
const STYLE = `
:root {
  color-scheme: dark light;
  --bg: #0d1117; --surface: #161b22; --border: #30363d;
  --fg: #e6edf3; --muted: #9babb6;
  --accent: #58a6ff; --ok: #3fb950; --watch: #d29922; --risk: #f85149;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #ffffff; --surface: #f6f8fa; --border: #d0d7de;
    --fg: #1f2328; --muted: #57606a;
    --accent: #0969da; --ok: #1a7f37; --watch: #9a6700; --risk: #cf222e;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0 1rem 4rem;
  background: var(--bg); color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
}
main, header, nav, section, footer { max-width: 64rem; margin-inline: auto; }
h1 { font-size: 2rem; margin: 1.5rem 0 0.25rem; }
h2 { font-size: 1.4rem; margin: 2rem 0 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
h3 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; }
h4 { font-size: 0.95rem; margin: 0.75rem 0 0.25rem; color: var(--muted); }
a { color: var(--accent); }
a:focus-visible, :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.skip-link {
  position: absolute; left: -9999px; top: 0;
  background: var(--surface); color: var(--fg); padding: 0.5rem 1rem; z-index: 10;
}
.skip-link:focus { left: 0; }
.masthead .tagline { color: var(--muted); margin-top: 0; }
.confidence { border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 1rem; margin: 1rem 0; }
.confidence-high { border-left: 4px solid var(--ok); }
.confidence-medium { border-left: 4px solid var(--watch); }
.confidence-low { border-left: 4px solid var(--risk); }
.confidence-escalation { color: var(--risk); font-weight: 600; }
.banner { border-radius: 6px; padding: 0.75rem 1rem; margin: 1rem 0; }
.banner-degraded { border: 1px solid var(--risk); color: var(--risk); font-weight: 600; }
.banner-metrics-only { border: 1px solid var(--border); color: var(--muted); }
.toc { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 1.25rem; margin: 1.5rem auto; }
.toc ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; }
.band, .metric-group { scroll-margin-top: 1rem; }
:target { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.headline { font-size: 1.2rem; font-weight: 600; }
.metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 1rem; margin: 0.75rem 0; }
.metric-card > summary { cursor: pointer; list-style-position: inside; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.metric-card[data-health="risk"] { border-left: 4px solid var(--risk); }
.metric-card[data-health="watch"] { border-left: 4px solid var(--watch); }
.metric-card[data-status="not_available"] { opacity: 0.7; }
.metric-title { display: inline; font-size: 1.05rem; margin: 0; font-weight: 600; }
.metric-body { margin-top: 0.5rem; }
.metric-status { color: var(--muted); font-size: 0.85rem; margin: 0.25rem 0; }
.metric-card code { word-break: break-word; }
.facets ul { margin: 0.25rem 0 0.5rem; }
.health { font-size: 0.85rem; font-weight: 600; white-space: nowrap; }
.health-glyph { font-size: 1rem; }
.health-ok { color: var(--ok); }
.health-watch { color: var(--watch); }
.health-risk { color: var(--risk); }
.health-na { color: var(--muted); }
.chart-panel { margin: 1rem 0; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 0.75rem 1rem; }
.chart-panel figcaption { color: var(--muted); font-size: 0.9rem; margin-bottom: 0.5rem; }
.chart-source { font-style: italic; }
.chart-empty { color: var(--muted); }
.chart-svg { width: 100%; height: 6rem; color: var(--accent); display: block; }
.chart-svg.chart-sparkline { height: 2rem; }
.chart-svg .bar { fill: var(--accent); }
.chart-svg .gauge-track { fill: var(--border); }
.chart-svg .gauge-fill { fill: var(--accent); }
.chart-svg .radar-area { fill: var(--accent); fill-opacity: 0.3; stroke: var(--accent); stroke-width: 1; }
.metric-visual { margin: 0.5rem 0; }
.metric-visual-range { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.metric-number { font-size: 1.4rem; font-weight: 700; }
.data-table { margin: 0.5rem 0; }
.data-table summary { cursor: pointer; color: var(--muted); font-size: 0.85rem; }
.data-table table { border-collapse: collapse; width: 100%; font-size: 0.85rem; margin-top: 0.5rem; }
.data-table th, .data-table td { border: 1px solid var(--border); padding: 0.25rem 0.5rem; text-align: left; }
.data-table caption { text-align: left; color: var(--muted); padding-bottom: 0.25rem; }
.footer { color: var(--muted); border-top: 1px solid var(--border); margin-top: 3rem; padding-top: 1rem; font-size: 0.85rem; }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
}
`;

/**
 * The report's ONLY script (inlined — no external `src`, still self-contained).
 * It only COLLAPSES on load: `ok` cards and the data-table disclosures, giving the
 * calm with-JS progressive view. Everything is rendered `<details open>`, so with
 * JS OFF nothing collapses and all data stays visible (the no-JS / keyboard floor).
 */
const DISCLOSURE_SCRIPT = `
document.querySelectorAll('details.metric-card[data-health="ok"]').forEach(function(d){d.open=false;});
document.querySelectorAll('details.data-table').forEach(function(d){d.open=false;});
`;
