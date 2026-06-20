/**
 * Self-contained HTML report shell (Story 4.1 — I1, FR-13).
 *
 * A pure `Report → string` renderer (typed template literals, zero deps) that
 * returns a single self-contained `<!doctype html>` document: all CSS inlined, the
 * Inter web font inlined as base64 woff2 `data:` URIs (ADR H3), NO external
 * `<link>`/`<script src>`/CDN/remote font — so it opens in any browser with no
 * network. It routes the SAME two paths off the SAME
 * Report JSON as the terminal via `classifyReport`:
 *   - showpiece — the narrative-first bands (masthead → Summary → Explanation →
 *     Coaching) BEFORE the metric groups (story before evidence — the template's
 *     non-negotiable), with a table of contents + in-page anchors.
 *   - substrate — masthead → a loud degraded banner or a neutral metrics-only
 *     note → the metric groups (no narrative bands).
 *
 * The group-overview charts, data-table fallbacks, stat cards, and health-band
 * glyphs are Story 4.2 (inline-SVG rebuild — ADR H1–H4); 4.1 is the navigable,
 * accessible, narrative-first TEXT shell. Per ADR H4 charts live ONLY in the
 * group-overview panel — metric cards carry no embedded chart.
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

import type { Report, ReportAnalysis, ReportNarrative, ReportProvenance } from "../../assemble/report-schema.js";
import type { MetricGroup } from "../../analyze/metric.js";
import { classifyReport, type ShowpieceReport, type SubstrateFraming } from "../render.port.js";
import { escapeHtml } from "./escape.js";
import { groupOverviewPanel, metricVisual } from "./charts.js";
import { classifyHealth, HEALTH_GLYPH, HEALTH_LABEL } from "./health.js";
import { rangeField } from "./shape.js";
import { INTER_FONT_CSS } from "./inter-font.js";

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
export const HTML_DEGRADED_BANNER = "⚠ AI Narrative unavailable — showing raw analysis";
/** Neutral note for an intentional metrics-only (`--no-ai`) substrate render. */
export const HTML_METRICS_ONLY_NOTE = "Metrics-only run — no AI narrative requested";

/** Render the full self-contained HTML document for a Report. */
export function renderHtml(report: Report): string {
  const route = classifyReport(report);
  const provenance = report.provenance;
  const body =
    route.kind === "showpiece"
      ? renderShowpiece(route.report, provenance)
      : renderSubstrate(route.analysis, route.framing, provenance);
  return document(body, provenance);
}

/** Wrap the body bands in the document skeleton (head + inlined style + landmarks). */
function document(body: string, provenance: ReportProvenance | undefined): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>commit-whisper report</title>
<style>${INTER_FONT_CSS}${STYLE}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${body}
${footer(provenance)}
<script>${DISCLOSURE_SCRIPT}</script>
</body>
</html>`;
}

/** The narrated showpiece: masthead → Summary → TOC → Explanation → Coaching → groups. */
function renderShowpiece(report: ShowpieceReport, provenance: ReportProvenance | undefined): string {
  const { summary, explanation, coaching, explanations, confidence } = report.narrative;
  return [
    masthead(confidence, provenance),
    summaryBand(summary),
    toc(true, report.analysis),
    explanationBand(explanation),
    coachingBand(coaching),
    metricGroups(report.analysis, explanations),
  ].join("\n");
}

/** The substrate: masthead → banner/note → metric groups (no narrative bands). */
function renderSubstrate(analysis: ReportAnalysis, framing: SubstrateFraming, provenance: ReportProvenance | undefined): string {
  return [masthead(undefined, provenance), substrateBanner(framing), toc(false, analysis), metricGroups(analysis, undefined)].join("\n");
}

/**
 * The masthead (TEMPLATE-HTML band ①): the wordmark + tagline, then the FR-17
 * provenance chip row (name · branch · N commits · C contributors · analyzed
 * <date>) and the Free-tier cap line, then the confidence band (showpiece only).
 * Every chip renders ONLY when its fact is present — no empty chips, no dangling
 * separators — and the masthead renders cleanly with `provenance` entirely absent.
 */
function masthead(confidence: Confidence | undefined, provenance: ReportProvenance | undefined): string {
  const parts = [
    "<h1>commit-whisper</h1>",
    `<p class="tagline">Deterministic git-history analysis with a grounded AI narrative.</p>`,
    provenanceChips(provenance),
    capLine(provenance),
    confidence === undefined ? "" : confidenceBand(confidence),
  ].filter((part) => part !== "");
  return `<header class="masthead">
${parts.join("\n")}
</header>`;
}

/** The FR-17 masthead chip row — the present provenance facts, each `escapeHtml`'d. */
function provenanceChips(provenance: ReportProvenance | undefined): string {
  const repo = provenance?.repo;
  const scale = provenance?.scale;
  const chips: string[] = [];
  if (repo?.name !== undefined) {
    chips.push(provChip(repo.name));
  }
  if (repo?.branch !== undefined) {
    chips.push(provChip(repo.branch));
  }
  const commits = scale?.totalCommits ?? scale?.analyzedCommits;
  if (commits !== undefined) {
    chips.push(provChip(`${formatCount(commits)} ${commits === 1 ? "commit" : "commits"}`));
  }
  if (scale?.contributors !== undefined) {
    chips.push(provChip(`${formatCount(scale.contributors)} ${scale.contributors === 1 ? "contributor" : "contributors"}`));
  }
  const generatedAt = provenance?.run?.generatedAt;
  if (generatedAt !== undefined) {
    chips.push(provChip(`analyzed ${isoDate(generatedAt)}`));
  }
  if (chips.length === 0) {
    return "";
  }
  return `<p class="prov-chips">${chips.join('<span class="prov-sep" aria-hidden="true">·</span>')}</p>`;
}

/** One masthead provenance chip (every interpolated value is escaped). */
function provChip(text: string): string {
  return `<span class="prov-chip">${escapeHtml(text)}</span>`;
}

/**
 * The Free-tier cap line (TEMPLATE-HTML band ①). Renders ONLY on the Free tier:
 * "Free · X of N commits analyzed", degrading to "Free · X commits analyzed" when
 * the total reachable count is absent. A paid tier (no cap) renders nothing.
 */
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
  const label = `Free · ${detail}`;
  return `<p class="cap-line">${escapeHtml(label)}</p>`;
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
<h2 id="summary-h"><span class="kicker">TL;DR</span> Summary</h2>
<p class="headline">${escapeHtml(summary.headline)}</p>
<p>${escapeHtml(summary.overview)}</p>
${findings === "" ? "" : `<ul class="key-findings">\n${findings}\n</ul>`}
</section>`;
}

function explanationBand(explanation: ShowpieceReport["narrative"]["explanation"]): string {
  const paragraphs = explanation.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
  return `<section id="explanation" class="band" aria-labelledby="explanation-h">
<h2 id="explanation-h"><span class="kicker">What the metrics show</span> Explanation</h2>
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
<h2 id="coaching-h"><span class="kicker">Improvement plan</span> Coaching</h2>
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
<h2 id="group-${group.id.toLowerCase()}-h"><span class="kicker">Group ${escapeHtml(group.id)}</span> ${escapeHtml(group.title)}</h2>
${groupOverviewPanel(group.id, metrics)}
<div class="cards">
${cards}
</div>
</section>`;
  });
  return `<main id="main" class="metric-groups">
${sections.join("\n")}
</main>`;
}

/**
 * One metric card. A `<details>` so the reader can collapse it; the `<summary>`
 * carries title · health band · headline stat, the body carries the per-metric
 * visual (sparkline / bars / gauge, by value shape) plus the four-facet
 * explanation. Rendered `open` by default and STAYS open — all cards are expanded
 * by default; the disclosure script only tucks the chart data-table fallbacks,
 * never the cards.
 */
function metricCard(metric: Metric, explanations: MetricExplanations | undefined): string {
  const band = classifyHealth(metric);
  const bandHtml = `<span class="health health-${band}"><span class="health-glyph" aria-hidden="true">${HEALTH_GLYPH[band]}</span> ${escapeHtml(HEALTH_LABEL[band])}</span>`;
  const stat = metricStat(metric);
  const statHtml = stat === "" ? "" : `<span class="metric-stat">${escapeHtml(stat)}</span>`;
  const explanation = explanations?.[metric.id];
  const facets = explanation === undefined ? "" : fourFacets(explanation);
  const reason = metric.status === "computed" ? "" : `<p class="why">${escapeHtml(metric.reason ?? "Not available.")}</p>`;
  const visual = metricVisual(metric);
  return `<details class="metric-card" data-status="${escapeHtml(metric.status)}" data-health="${band}" open>
<summary><h3 class="metric-title">${escapeHtml(metric.title)}</h3> ${bandHtml}${statHtml}</summary>
<div class="metric-body">
${reason}
${visual}
${facets}
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

/** A single headline figure for the card stat, or "" when the value has no clean scalar. */
function metricStat(metric: Metric): string {
  if (metric.status !== "computed") {
    return "";
  }
  const value = metric.value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? fmtStat(value) : "";
  }
  if (typeof value === "string") {
    return value;
  }
  const range = rangeField(value);
  if (range !== undefined) {
    return `${fmtStat(range.value)}${range.max === 100 ? "%" : ""}`;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return objectStat(value as Record<string, unknown>);
  }
  return "";
}

/** Pick a headline scalar from an object metric value (a known key, else a lone number). */
function objectStat(value: Record<string, unknown>): string {
  const nums = Object.entries(value).filter((e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1]));
  for (const key of ["total", "count", "score", "busFactor", "value"]) {
    const hit = nums.find(([k]) => k === key);
    if (hit !== undefined) {
      return fmtStat(hit[1]);
    }
  }
  return nums.length === 1 ? fmtStat(nums[0][1]) : "";
}

/** Compact integer/2-dp number text for the card stat. */
function fmtStat(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * The footer (TEMPLATE-HTML band ⑦): "Generated by commit-whisper vX ·
 * schemaVersion 1.0.0 · <provider>/<model> · <timestamp>" — each FR-17 provenance
 * fact appended ONLY when present, every interpolated value `escapeHtml`'d. With
 * `provenance` absent it degrades to the original "Generated by commit-whisper ·
 * schemaVersion 1.0.0" (back-compat — today's Reports still render cleanly).
 */
function footer(provenance: ReportProvenance | undefined): string {
  const version = provenance?.run?.toolVersion;
  const parts = [version === undefined ? "Generated by commit-whisper" : `Generated by commit-whisper v${escapeHtml(version)}`, "schemaVersion 1.0.0"];
  const ai = provenance?.ai;
  if (ai !== undefined) {
    parts.push(`${escapeHtml(ai.provider)}/${escapeHtml(ai.model)}`);
  }
  const generatedAt = provenance?.run?.generatedAt;
  if (generatedAt !== undefined) {
    parts.push(escapeHtml(generatedAt));
  }
  return `<footer class="footer">
<p>${parts.join(" · ")}</p>
</footer>`;
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
 * The inlined stylesheet: a dark-first / light `prefers-color-scheme` palette with
 * AA-contrast tokens, an inlined Inter web font with a system-stack fallback (ADR
 * H3 — still self-contained: the font ships as base64 `data:` URIs, not a remote
 * link), `:focus-visible` outlines + a skip link for keyboard nav, `:target`
 * emphasis for anchor landing, and a `prefers-reduced-motion` block. No JS.
 */
const STYLE = String.raw`
:root {
  color-scheme: dark light;
  --bg: #0a0e14; --surface: #11161f; --surface-2: #161c28;
  --border: #232b3a; --border-soft: #1c2430;
  --fg: #e8eef6; --fg-soft: #cdd7e4; --muted: #93a1b5; --faint: #5d6b80;
  --accent: #58a6ff; --accent-2: #7c5cff;
  --ok: #3fb950; --watch: #e3b341; --risk: #ff6b6b;
  --shadow: 0 14px 40px -20px rgba(0,0,0,0.7);
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #ffffff; --surface: #f6f8fa; --surface-2: #eef1f5;
    --border: #d0d7de; --border-soft: #e4e8ec;
    --fg: #1f2328; --fg-soft: #2c333d; --muted: #57606a; --faint: #8b949e;
    --accent: #0969da; --accent-2: #8250df;
    --ok: #1a7f37; --watch: #9a6700; --risk: #cf222e;
    --shadow: 0 14px 40px -22px rgba(140,150,170,0.5);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 0 1.25rem 4rem;
  background:
    radial-gradient(1100px 520px at 85% -8%, rgba(124,92,255,0.13), transparent 60%),
    radial-gradient(900px 460px at -5% 2%, rgba(88,166,255,0.11), transparent 55%),
    var(--bg);
  color: var(--fg);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
main, header, nav, section, footer { max-width: 66rem; margin-inline: auto; }
h1 { font-size: 2rem; margin: 1.5rem 0 0.25rem; letter-spacing: -0.02em; }
h2 { font-size: 1.5rem; margin: 2.25rem 0 1rem; letter-spacing: -0.01em; }
h3 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; }
h4 { font-size: 0.8rem; margin: 0.75rem 0 0.25rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
a:focus-visible, :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
.skip-link {
  position: absolute; left: -9999px; top: 0;
  background: var(--surface); color: var(--fg); padding: 0.5rem 1rem; z-index: 50; border-radius: 0 0 8px 0;
}
.skip-link:focus { left: 0; }
.band > h2, .metric-group > h2 { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.kicker { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); background: rgba(88,166,255,0.12); padding: 0.22rem 0.55rem; border-radius: 6px; }
.masthead {
  position: relative; margin-top: 2.5rem; padding: 2.4rem 2.5rem; overflow: hidden;
  border: 1px solid var(--border); border-radius: 22px;
  background: linear-gradient(135deg, rgba(88,166,255,0.10), rgba(124,92,255,0.06)), var(--surface);
  box-shadow: var(--shadow);
}
.masthead::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(600px 200px at 90% -40%, rgba(124,92,255,0.22), transparent 70%);
}
.masthead h1 { margin: 0; font-size: 1.95rem; position: relative; display: flex; align-items: center; gap: 0.75rem; }
.masthead h1::before {
  content: "\25D1"; display: inline-grid; place-items: center;
  width: 2.7rem; height: 2.7rem; font-size: 1.45rem; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border-radius: 0.72rem; box-shadow: 0 10px 26px -8px rgba(124,92,255,0.75);
}
.masthead .tagline { color: var(--muted); margin: 0.4rem 0 0; position: relative; max-width: 46rem; }
.prov-chips { position: relative; margin: 0.85rem 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; color: var(--fg-soft); font-size: 0.92rem; }
.prov-chip { white-space: nowrap; }
.prov-sep { color: var(--faint); }
.cap-line { position: relative; margin: 0.7rem 0 0; color: var(--muted); font-size: 0.9rem; }
.confidence {
  position: relative; margin: 1.5rem 0 0; padding: 0.85rem 1.1rem;
  border: 1px solid rgba(63,185,80,0.4); border-left: 4px solid var(--ok); border-radius: 12px;
  background: linear-gradient(90deg, rgba(63,185,80,0.12), transparent);
}
.confidence-high { border-color: rgba(63,185,80,0.4); border-left-color: var(--ok); }
.confidence-medium { border-color: rgba(227,179,65,0.4); border-left-color: var(--watch); background: linear-gradient(90deg, rgba(227,179,65,0.12), transparent); }
.confidence-low { border-color: rgba(255,107,107,0.4); border-left-color: var(--risk); background: linear-gradient(90deg, rgba(255,107,107,0.12), transparent); }
.confidence p { margin: 0; }
.confidence-label, .confidence strong { text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
.confidence-high .confidence-label, .confidence-high strong { color: var(--ok); }
.confidence-medium .confidence-label, .confidence-medium strong { color: var(--watch); }
.confidence-low .confidence-label, .confidence-low strong { color: var(--risk); }
.confidence-escalation { color: var(--risk); font-weight: 600; }
.banner { max-width: 66rem; margin: 1.25rem auto; border-radius: 12px; padding: 0.85rem 1.1rem; }
.banner-degraded { border: 1px solid rgba(255,107,107,0.4); color: var(--risk); font-weight: 600; background: linear-gradient(90deg, rgba(255,107,107,0.12), transparent); }
.banner-metrics-only { border: 1px solid var(--border); color: var(--muted); background: var(--surface); }
.toc {
  position: sticky; top: 0; z-index: 20; margin: 1.5rem auto 0; padding: 0.6rem 0;
  background: color-mix(in srgb, var(--bg) 78%, transparent); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-soft);
}
.toc h2 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--faint); margin: 0 0 0.45rem; }
.toc h2::before { content: none; }
.toc ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.toc a { display: inline-block; padding: 0.32rem 0.8rem; border-radius: 999px; font-size: 0.85rem; color: var(--muted); border: 1px solid transparent; }
.toc a:hover { color: var(--fg); background: var(--surface-2); border-color: var(--border); text-decoration: none; }
.band, .metric-group { scroll-margin-top: 4rem; }
.band { margin: 2.5rem auto; }
:target { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 8px; }
.headline { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.01em; }
.lead, .explanation p, .coaching-intro, .coaching-closing { color: var(--fg-soft); }
.key-findings { list-style: none; padding: 0; margin: 1.2rem 0 0; display: grid; gap: 0.6rem; }
.key-findings li { position: relative; padding: 0.8rem 1rem 0.8rem 2.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
.key-findings li::before { content: "\203A"; position: absolute; left: 1rem; top: 0.7rem; color: var(--accent); font-weight: 800; font-size: 1.1rem; }
.chapter { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--accent-2); border-radius: 14px; padding: 1.1rem 1.35rem; margin: 1rem 0; }
.chapter h3 { margin: 0 0 0.6rem; }
.chapter ol { margin: 0; padding-left: 1.2rem; display: grid; gap: 0.5rem; color: var(--fg-soft); }
.coaching-closing { margin-top: 1rem; padding: 1rem 1.2rem; border: 1px solid rgba(124,92,255,0.35); border-radius: 12px; background: linear-gradient(90deg, rgba(124,92,255,0.10), transparent); }
.metric-group .chart-panel + .metric-card { margin-top: 1.2rem; }
.cards { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1.2rem; align-items: stretch; }
@media (min-width: 720px) { .cards { grid-template-columns: repeat(2, 1fr); } }
.cards > .metric-card { margin: 0; }
.metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 0.7rem 1.1rem; margin: 0.85rem 0; transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease; }
.metric-card:hover { transform: translateY(-2px); border-color: #2f3a4d; box-shadow: var(--shadow); }
.metric-card > summary { cursor: pointer; list-style-position: inside; display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
.metric-card[data-health="risk"] { border-left: 4px solid var(--risk); }
.metric-card[data-health="watch"] { border-left: 4px solid var(--watch); }
.metric-card[data-health="ok"] { border-left: 4px solid var(--ok); }
.metric-card[data-status="not_available"] { opacity: 0.72; border-left: 4px solid var(--faint); }
.metric-title { display: inline; font-size: 1.05rem; margin: 0; font-weight: 600; }
.metric-stat { margin-left: auto; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; color: var(--fg); }
.why { color: var(--muted); margin: 0.4rem 0 0; }
.metric-body { margin-top: 0.5rem; }
.metric-status { color: var(--muted); font-size: 0.85rem; margin: 0.25rem 0; }
.metric-value code { background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 6px; padding: 0.15rem 0.45rem; }
.metric-card code { word-break: break-word; }
.facets { margin-top: 0.6rem; }
.facet-meaning { color: var(--fg-soft); }
.facets ul { margin: 0.25rem 0 0.5rem; }
.health { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 999px; white-space: nowrap; }
.health-glyph { font-size: 0.95rem; }
.health-ok { color: var(--ok); background: rgba(63,185,80,0.13); }
.health-watch { color: var(--watch); background: rgba(227,179,65,0.14); }
.health-risk { color: var(--risk); background: rgba(255,107,107,0.14); }
.health-na { color: var(--faint); background: rgba(93,107,128,0.14); }
.chart-panel { margin: 1rem 0; background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 88%, var(--accent) 4%), var(--surface)); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.25rem; box-shadow: 0 10px 30px -18px rgba(0,0,0,0.5); }
.chart-panel figcaption { color: var(--muted); font-size: 0.9rem; margin-bottom: 0.75rem; }
.chart-source { font-style: italic; }
.chart-empty { color: var(--muted); }
.chart-svg { width: 100%; height: auto; color: var(--accent); display: block; }
.chart-svg.chart-sparkline { height: 2.25rem; width: 8rem; }
.chart-svg.chart-gauge { height: 0.9rem; width: 12rem; max-width: 60%; }
.chart-svg.chart-radar { max-width: 30rem; margin-inline: auto; }
.metric-visual .chart-svg { max-width: 38rem; }
.chart-svg text { font-family: inherit; }
.chart-svg .chart-tick, .chart-svg .chart-label { fill: var(--muted); font-size: 11px; }
.chart-svg .radar-label { fill: var(--muted); font-size: 10px; }
.chart-svg .chart-grid { stroke: var(--border); stroke-width: 1; opacity: 0.55; }
.chart-svg .chart-axis { stroke: var(--border); stroke-width: 1; }
.chart-svg .chart-dot { fill: var(--accent); stroke: var(--surface); stroke-width: 1; }
.chart-svg .grad-area-top { stop-color: var(--accent); stop-opacity: 0.38; }
.chart-svg .grad-area-bottom { stop-color: var(--accent); stop-opacity: 0; }
.chart-svg .grad-fill-1 { stop-color: var(--accent); }
.chart-svg .grad-fill-2 { stop-color: var(--accent-2); }
.chart-svg .bar { fill: var(--accent); }
.chart-svg .gauge-track { fill: var(--border); }
.chart-svg .gauge-fill { fill: var(--accent); }
.chart-svg .radar-grid { fill: none; stroke: var(--border); stroke-width: 0.5; opacity: 0.7; }
.chart-svg .radar-axis { stroke: var(--border); stroke-width: 0.4; opacity: 0.7; }
.chart-svg .radar-area { fill: var(--accent); fill-opacity: 0.45; stroke: var(--accent); stroke-width: 1; stroke-linejoin: round; }
.chart-svg .radar-dot { fill: var(--accent); stroke: var(--surface); stroke-width: 0.6; }
.chart-svg.chart-radialgauge { max-width: 12rem; margin-inline: auto; }
.chart-svg.chart-donut { max-width: 30rem; }
.chart-svg .gauge-ring-track { stroke: var(--border); }
.chart-svg .gauge-value { fill: var(--fg); font-weight: 700; font-size: 40px; }
.chart-svg .donut-label { fill: var(--fg-soft); font-size: 13px; }
.chart-svg .slice-0 { fill: #58a6ff; stroke: #58a6ff; }
.chart-svg .slice-1 { fill: #7c5cff; stroke: #7c5cff; }
.chart-svg .slice-2 { fill: #3fb950; stroke: #3fb950; }
.chart-svg .slice-3 { fill: #e3b341; stroke: #e3b341; }
.chart-svg .slice-4 { fill: #2dd4bf; stroke: #2dd4bf; }
.chart-svg .slice-5 { fill: #f472b6; stroke: #f472b6; }
.chart-svg .donut-seg { stroke: var(--surface); stroke-width: 1.5; }
.chart-cells { display: grid; gap: 1.2rem; margin-top: 0.25rem; }
.chart-sub { min-width: 0; }
.chart-sub h4 { margin: 0 0 0.4rem; font-size: 0.9rem; color: var(--fg); text-transform: none; letter-spacing: 0; }
@media (min-width: 720px) { .chart-cells.two { grid-template-columns: 1.5fr 1fr; align-items: center; } }
.metric-visual { margin: 0.5rem 0; }
.metric-visual-range { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.metric-number { font-size: 1.4rem; font-weight: 700; }
.data-table { margin: 0.5rem 0; }
.data-table summary { cursor: pointer; color: var(--muted); font-size: 0.85rem; }
.data-table table { border-collapse: collapse; width: 100%; font-size: 0.85rem; margin-top: 0.5rem; }
.data-table th, .data-table td { border: 1px solid var(--border); padding: 0.25rem 0.5rem; text-align: left; }
.data-table caption { text-align: left; color: var(--muted); padding-bottom: 0.25rem; }
.footer { color: var(--faint); border-top: 1px solid var(--border-soft); margin-top: 3rem; padding-top: 1.2rem; font-size: 0.85rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
}
`;

/**
 * The report's ONLY script (inlined — no external `src`, still self-contained).
 * Cards are ALL rendered `<details open>` and stay open by default — the reader
 * can collapse any card manually. The script only tucks the chart data-table
 * fallbacks behind their "Show data table" toggle (the no-JS path keeps them
 * open). With JS OFF nothing collapses and all data stays visible.
 */
const DISCLOSURE_SCRIPT = `
document.querySelectorAll('details.data-table').forEach(function(d){d.open=false;});
`;
