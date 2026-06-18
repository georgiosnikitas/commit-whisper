---
epic: 4
story: 6
title: HTML renderer inline-SVG visual rebuild (amends 4.2; records ADRs H1–H4)
baseline_commit: 567f5e3
---

# Story 4.6: HTML renderer inline-SVG visual rebuild (amends 4.2; records ADRs H1–H4)

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- This is a record-after-the-fact story: the rebuild shipped green (921 tests · typecheck · lint)
     during the Stories 4.1–4.2 implementation pass; this file documents it and ratifies the
     architecture ADRs (H1–H4, 2026-06-18). It amends Story 4.2 — it does not supersede its ACs
     except where ADR H4 explicitly relaxes 4.2 AC3 (see AC4 below). -->

## Story

As a user who shares a commit-whisper HTML report,
I want its charts to be deterministic, self-contained inline SVG with real axes, a consistent typeface, and calm, scannable stat cards,
so that the report looks identical on every machine, is byte-stable + Node-snapshot-testable, and reads cleanly without a charting runtime or a network.

## Acceptance Criteria

These four ACs mirror **architecture ADRs H1–H4** (`docs/planning-artifacts/architecture.md#ADRs — HTML Renderer Inline-SVG Rebuild (2026-06-18)`). They **amend Story 4.2**; AC4 is the one intentional **relaxation** of a prior AC (4.2 AC3).

1. **A pure inline-SVG chart engine with REAL axes replaces Chart.js (AC1 — ADR H1).** **Given** the HTML report, **when** charts render, **then** every chart is a deterministic `data → SVG string` transform from `src/render/html/svg.ts` (`svgLine` · `svgSparkline` · `svgBars` · `svgHBars` · `svgGauge` · `svgRadar` + the two new primitives in AC2) — **no Chart.js, no `<canvas>`, no animation, no clock/random** — drawing **real axes**: value gridlines + **nice-tick `1/2/5 × 10ⁿ`** labels (`niceStep`/`valueTicks`), ISO-key-prettified category/month x-labels (`tickLabel`: `2026-03 → Mar`, `…-W12 → W12`, path → basename), and radar component labels at each axis tip. Coordinates are finite-guarded (`safe`) and rounded (2 dp) so output is **byte-stable**; **zero new dependencies**.

2. **Two charts per group + two new SVG primitives; Group B is now a doughnut + gauge (AC2 — ADR H2).** **Given** a non-empty Metric Group, **when** its overview panel renders, **then** it carries a **primary + a shape-matched secondary** chart (`GROUP_CHARTS` in `charts.ts`) — A volume line + cadence bars · **B ownership doughnut + concentration gauge** · C category bars + adherence gauge · D merge line + direct-to-default gauge · E hotspots h-bars + churn-trend line · F component radar + hygiene gauge — using two engine additions: **`svgDonut`** (annular-sector `<path>` arcs + a `label · share%` legend) and **`svgRadialGauge`** (a full-ring `stroke-dasharray` arc + centre value text). Each sub-chart keeps its **own mandatory `<details>`/`<table>` data-table fallback** (still "never a chart alone"). **Deliberate divergence (recorded):** Group B is **no longer** the locked "Pareto bar + bus-factor marker"; the **bus-factor signal is promoted to a first-class stat card**, and the *TEMPLATE-HTML* re-spec of where the Group B marker lands is **owned by UX (Sally)**.

3. **The Inter web font is inlined as base64 woff2; still self-contained + under budget (AC3 — ADR H3).** **Given** the report, **when** it loads on any machine, **then** the **Inter latin subset (weights 400/600/700/800)** is inlined as base64 **woff2 `data:` URIs** in `src/render/html/inter-font.ts` (`INTER_FONT_CSS`), injected once into the document `<style>`, with the body `font-family` leading `"Inter"` over a system-stack fallback — a **consistent typographic identity host-to-host**. This **reverses** Story 4.1's "system-font-stack / lean" call and adds **~130 KB** (sample reports ~**210–225 KB**), still **comfortably under the Rail (a) ~1 MB budget** and **fully self-contained** (no `<link>`, no http(s), no `@import` — verified by tests). The cost is **isolated in one module** (revertible / flag-gateable).

4. **Stat-card model + always-open disclosure (AC4 — ADR H4; relaxes 4.2 AC3).** **Given** the metric cards, **when** the report renders, **then** each card is a clean **stat card** — title + health pill + headline stat in the `<summary>`, a **collapsible four-facet explanation** in the body — in a **responsive equal-height grid** (`repeat(auto-fit, minmax(260px, 1fr))`, `align-items: stretch`), **with NO embedded chart** (charts live **only** in the group-overview panel). **All cards render `<details open>` and stay expanded by default** (the reader may collapse any card manually), so the **no-JS and with-JS views are identical**; the inline disclosure script **no longer touches cards** — it **only tucks the chart data-table fallbacks** (`details.data-table → open = false`). This **intentionally relaxes Story 4.2 AC3** from "`ok` collapsed / `watch`·`risk` expanded" to **"expanded by default, manually collapsible."** The health band stays **shape-differentiated glyph + label (never color alone)**; `not_available` cards still render greyed with the "why."

**Invariants preserved (load-bearing — confirmed at a glance):** pure `Report → string` determinism (no clock/random/I/O; rounded coords → byte-stable, Node-snapshot-testable); **self-containment** (no `<link>`/`<script src>`/CDN/`@import`/network); **HTML-escape on every interpolated value** at the render boundary (OWASP A03 / stored-XSS — a 3-layer adversarial review found **0 security issues**, all spec claims **MET**); the **WCAG 2.2 AA floor** (`role="img"` + `aria-label` + a mandatory per-chart `<table>` fallback, shape+label health bands, semantic landmarks, single `h1`, skip link, reduced-motion, `color-scheme`); and the **narrative-first** band order. The hexagonal boundary, frozen `RunConfig`, and the showpiece-vs-substrate branch (C3 / I1) are untouched.

## Dev Notes

### What this story records (read first)

The HTML renderer's **visual layer** was rebuilt during the Stories 4.1–4.2 implementation pass and shipped green. The four decisions deviate from **architecture I1 as originally locked** and are now ratified as **ADRs H1–H4** in the dated-decision-pass family of `architecture.md`. Two **extend** I1 in its own spirit (the inline-SVG engine — pre-approved in the 4.2 *ADR deviation* note, 2026-06-14; the second per-group chart), one **reverses** a leanness call (the inlined Inter font), and one **relaxes** a 4.2 AC (the stat-card disclosure model). This story is the **implementation-artifact record** + the **stale-comment sweep** that makes the source match shipped reality. **No runtime behavior changed by this record-and-sweep step** — only comments and documentation.

### Stale-comment sweep (Task A — comments only, no behavior change)

The source carried comments that pre-dated the rebuild. Swept to match the shipped engine, citing ADR H1–H4 where natural:
- `src/render/html/charts.ts` — module header said the group renders a single **"FIXED-type"** chart and listed **"B Pareto hbars"**; rewritten to the **two-chart-per-group** plan (B = ownership doughnut + concentration gauge). `metricVisual`'s doc now notes it is **retained for tests** — the renderer no longer embeds per-card visuals (ADR H4).
- `src/render/html/html-renderer.ts` — the module header and the `STYLE` doc-comment claimed **"a system font stack (no web font — self-contained + lean)"**; updated to the **inlined Inter** font (ADR H3, still self-contained via `data:` URIs). The "Charts, per-metric visuals…" line updated to the **stat-card** model (ADR H4).
- `src/render/html/shape.ts` — header "for the per-metric visuals" → "for the inline-SVG charts" (shape detection now primarily drives the group-overview chart selection).
- `src/render/html/html-renderer.test.ts` — a stale inline comment "the script collapses ok cards" corrected (ADR H4: the script no longer collapses cards; it only tucks tables). **No assertion changed.**

### Deferred / next-step owners (unchanged by this record)

- **Masthead/footer provenance chips (PM — John).** The repo · branch · provider · timestamp · tier chips + the Free-tier cap line need the Report-JSON **metadata subtree** not yet in the schema. H3's typographic upgrade makes the masthead more prominent → raises this priority. [Source: 4.1 deferral, ADR H2/H3 open questions]
- **Group B divergence + two-chart-per-group ratification (UX — Sally).** Update *TEMPLATE-HTML* to ratify the **primary + secondary** model and re-specify where the **bus-factor marker** lives now that B is a doughnut + concentration gauge. [Source: ADR H2 open question]
- **Markdown / JSON renderer parity.** This SVG/stat-card system is **HTML-only**; the Markdown renderer keeps its own degradation (ASCII sparklines + Mermaid + text tables, FR-7) and the JSON output is unaffected. No SVG/stat-card port is in scope. [Source: Stories 4.3/4.4]
- **Optional font-gating flag (architecture — weight watch).** H3 is the "revisit candidate on weight grounds." Keep the one-module isolation so a `--no-font` / config gate stays cheap; re-confirm the ~1 MB budget against large real-world reports. [Source: ADR H3 status]

### Determinism, security & purity (the render rules — unchanged)

- **Pure function of the Report JSON** — no clock/I/O/random/env; identical Report ⇒ byte-identical HTML (SVG coords rounded, key order byte-stable from `analysis`); `render/` stays `no-console`. [Source: architecture.md]
- **Escape every interpolated value** — series labels (file paths!), numbers, table cells, `aria-label`s, donut legend text — the 4.1/4.2 security boundary extends to the two new primitives. [Source: securityRequirements, OWASP A03]
- **No-color-alone** — every health band is glyph **shape** + text **label**. [Source: NFR-8 / UX-DR14]
- **No new dependencies** — inline SVG + typed template literals + the base64 font module only. [Source: ADR H1/H3]

### References

- [Source: docs/planning-artifacts/architecture.md#ADRs — HTML Renderer Inline-SVG Rebuild (2026-06-18)] (ADRs H1–H4 — the canonical decisions) · [Source: …#I1 — HTML Charting & Templating] (the superseded Chart.js lock + Rails (a)/(b)/(c))
- [Source: docs/planning-artifacts/ux-designs/ux-commit-whisper-2026-06-11/TEMPLATE-HTML.md] (group-chart signatures, visual-by-shape, metric-card skeleton — pending the ADR H2 two-chart-per-group reconciliation) · [Source: …/DESIGN.md] (chart-panel / stat-card surfaces, palette)
- [Source: docs/implementation-artifacts/4-2-per-group-charts-with-data-table-fallback.md] (the parent story this amends) · [Source: docs/sample/commit-whisper-sample-report.html] (the regenerated showcase artifact)

## Dev Agent Record

### Completion Notes (Amelia)

Recorded the inline-SVG visual rebuild and swept the now-stale source comments. **No runtime behavior changed in this step** — the rebuild itself shipped earlier in the 4.1–4.2 pass and is green; this record + sweep keeps the source, the architecture record, and the UX specs aligned.

- **`src/render/html/svg.ts`** — the inline-SVG chart engine: `svgLine` · `svgSparkline` · `svgBars` · `svgHBars` · `svgGauge` · `svgRadar` plus the **two new primitives** `svgDonut` (annular-sector `<path>` arcs + `label · share%` legend) and `svgRadialGauge` (full-ring `stroke-dasharray` arc + centre value text). **Real axes** via `niceStep`/`valueTicks` (nice-tick `1/2/5 × 10ⁿ`) + `tickLabel` (ISO-key prettifier) + radar component labels. `safe()` finite-guards and `r()` rounds every coordinate; `esc()` escapes all SVG text/attrs; `role="img"` + escaped `aria-label` on every chart. Deterministic, no clock/random/animation. (ADR H1, H2)
- **`src/render/html/charts.ts`** — `GROUP_CHARTS` declares the **two-chart-per-group** plan; `groupOverviewPanel` renders the primary + secondary sub-charts (shape-matched: line/bars/hbars/radar/donut/gauge), each with its mandatory `dataTable()` fallback; empty groups render a caption + "no chartable series" note (never a degenerate 1-point chart). `metricVisual` is **retained for tests** but **not wired into the cards** (ADR H4).
- **`src/render/html/inter-font.ts`** (new) — the generated **base64 woff2 Inter latin subset** (weights 400/600/700/800) as `INTER_FONT_CSS` `@font-face` `data:` URIs; injected once into `<style>`. Content is machine-generated — not hand-edited. (ADR H3)
- **`src/render/html/html-renderer.ts`** — metric cards are **stat cards** (`metricCard` + `metricStat`: title + health pill + headline stat in `<summary>`, four-facet explanation in the body, **no embedded chart**), in a responsive equal-height grid; the `<style>` inlines `INTER_FONT_CSS`; the `DISCLOSURE_SCRIPT` (the report's only JS, self-contained) **only tucks `details.data-table`** — all cards stay `<details open>` (ADR H4).
- **Comment sweep** across `charts.ts`, `html-renderer.ts`, `shape.ts`, and the stale test comment in `html-renderer.test.ts` (Task A above).

**Adversarial review (3-layer):** **0 security issues**; all spec claims **MET**; empty/degenerate/`NaN`/`Infinity`/all-equal/all-zero/negative series and gauge/donut/radar boundary cases verified non-crashing with no `NaN` coordinates and a valid fallback table. Self-containment (no `<link>`/`<script src>`/http/`@import`) and the ≤1 MB budget hold with the inlined font.

**Pre-existing code-smells left untouched (out of scope):** SonarLint flags on `metricStat` (cognitive complexity), the `STYLE` template (`String.raw`), and `renderSubChart`'s nested ternary pre-date this step and are **not** lint/typecheck/test gate failures; the comment-only sweep did not introduce them and does not address them.

### File List

**Rebuilt / new source (the shipped engine + font):**
- `src/render/html/svg.ts` (rebuilt — real axes, nice-ticks, `tickLabel`, `svgDonut`, `svgRadialGauge`)
- `src/render/html/charts.ts` (rebuilt — `GROUP_CHARTS` two-chart-per-group plan; `metricVisual` test-retained; comment sweep)
- `src/render/html/html-renderer.ts` (rebuilt — stat cards, `metricStat`, inlined Inter, disclosure script tucks tables only; comment sweep)
- `src/render/html/inter-font.ts` (new — generated base64 Inter font module; do not hand-edit)
- `src/render/html/shape.ts` (comment sweep only)

**Co-located tests:**
- `src/render/html/svg.test.ts`
- `src/render/html/charts.test.ts`
- `src/render/html/html-renderer.test.ts` (incl. stale-comment fix)

**Docs / artifacts:**
- `docs/planning-artifacts/architecture.md` (ADRs H1–H4 — 2026-06-18 decision pass)
- `docs/planning-artifacts/ux-designs/ux-commit-whisper-2026-06-11/TEMPLATE-HTML.md` (UX spec update)
- `docs/planning-artifacts/ux-designs/ux-commit-whisper-2026-06-11/DESIGN.md` (UX spec update)
- `docs/sample/commit-whisper-sample-report.html` (regenerated showcase sample)
- `docs/implementation-artifacts/4-6-html-renderer-inline-svg-visual-rebuild.md` (this record)

## Change Log

| Date       | Version | Description                                                                                                                                                                  | Author          |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-06-18 | 1.0     | Recorded the HTML-renderer inline-SVG visual rebuild as Story 4.6 (amends 4.2; ratifies ADRs H1–H4). Swept stale source comments in `svg`/`charts`/`html-renderer`/`shape` + the one stale test comment to match shipped reality. No runtime behavior change. Gates green. | Amelia (Dev) |
