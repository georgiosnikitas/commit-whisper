---
epic: 4
story: 2
title: Per-group charts with accessible data-table fallback
baseline_commit: c9ec248
---

# Story 4.2: Per-group charts with accessible data-table fallback

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a chart for each metric group with an accessible fallback,
so that the data is legible visually and to assistive tech.

## Acceptance Criteria

1. **A fixed-type group-overview chart per group, never alone, with a mandatory data-table fallback (AC1).** **Given** the HTML report, **when** charts render, **then** each non-empty Metric Group carries a **group-overview chart of its fixed type** (A line · B Pareto bar + bus-factor marker · C stacked bar · D merge timeline + density · E hotspots bar + churn trend · F radar + gauge), rendered as **deterministic inline SVG** (no canvas, no animation — see the ADR deviation note), **accompanied by a mandatory accessible data-table fallback** (a `<details>`/`<table>`) that **also serves as the no-JS degradation path**, and **never stands alone** — each chart carries its group label + the group's one-line description.

2. **A right-sized per-metric visual by shape, each with a fallback + a derived health band (AC2).** **Given** an individual metric card, **when** it renders, **then** it carries a **per-metric visual chosen by the metric's value shape** — time-series → small SVG line; distribution → small SVG bar; scalar-in-range → SVG sparkline/mini-gauge + the number; pure scalar → **bold stat, no chart** — using **inline SVG/CSS** (not a canvas), **each with an accessible data-table/text fallback**, **and** a **derived health band** (`ok`/`watch`/`risk`, or `na`) **classified at render** from catalog-owned thresholds (not stored in the Report JSON), shown by **shape-differentiated glyph + label** (`●` ok · `◐` watch · `▲` risk · `○` n/a) — **never color alone**; a `not_available` metric still renders a card (greyed, visual omitted, the "why" shown), band `○ n/a`.

3. **Progressive disclosure that stays calm at scale and degrades with no JS (AC3).** **Given** the report's many metric cards, **when** it loads with JavaScript enabled, **then** `watch`/`risk` cards are **expanded** and `ok` cards **collapse** to a one-line summary the reader can expand (so calm survives ~30 metrics), **and** with **JavaScript disabled all cards render expanded** (and every data-table fallback open) — nothing is ever hidden behind a control that can't be operated; the report remains a **single self-contained file** (all SVG/CSS/JS inlined, no network) within the **~1 MB** weight budget.

## Tasks / Subtasks

- [ ] **Task 1 — Inline-SVG chart primitives (AC1, AC2) [src/render/html/svg.ts] (new).** Pure functions returning deterministic SVG strings, each `role="img"` + `aria-label` (the screen-reader text; the `<table>` is the data fallback):
  - [ ] `svgLine(series, opts)` — a polyline over `{label, value}[]` (time-series / churn trend); `svgBars(series, opts)` — vertical bars (distribution / stacked); `svgHBars(series, opts)` — horizontal bars (hotspots / Pareto); `svgSparkline(series)` — a tiny inline line (scalar-in-range trend); `svgGauge(value, max)` — a mini arc/bar gauge (scalar-in-range); `svgRadar(points)` — Group F component radar.
  - [ ] All **deterministic** (fixed viewBox, integer/rounded coords, no animation, no randomness, no clock); color via `currentColor`/CSS classes (theme-aware, AA); a degenerate/empty series returns a minimal empty SVG (the table still carries the data). Numbers escaped where they could be text.

- [ ] **Task 2 — Value-shape detection + series extraction (AC2) [src/render/html/shape.ts] (new).**
  - [ ] `detectShape(value): "timeseries" | "distribution" | "scalar-range" | "scalar" | "none"` — heuristic over the JSON value: an object of numbers keyed by **date-like** keys (`/^\d{4}(-\d\d)?/`, or a `perDay`/`perWeek`/`perMonth` sub-object) → timeseries; an object/array of numbers (non-date) → distribution; a bare number with a known 0–100 range (a `*Pct`/`*Share`/score field) → scalar-range; a bare number → scalar; otherwise none.
  - [ ] `extractSeries(value): { label: string; value: number }[]` — pull a labelled numeric series from the value (flatten a `perMonth`-style sub-object; map an array of `{path/file, …}` to bars); deterministic key order (the value's own key order, which is byte-stable from `analysis`). Pure; tolerant (no extractable series ⇒ `[]`, so the card shows the bold stat / table only).

- [ ] **Task 3 — Health-band classification (AC2) [src/render/html/health.ts] (new).**
  - [ ] `type HealthBand = "ok" | "watch" | "risk" | "na"`; `classifyHealth(metric): HealthBand` — `not_available` ⇒ `na`; else a **documented threshold registry** keyed by metric id (domain knowledge per the §4.2 decision-log — e.g. `b-bus-factor` busFactor `1⇒risk / 2⇒watch / ≥3⇒ok`; `d-direct-to-default` high share ⇒ risk; `c-conventional-commits` high adherence ⇒ ok; `f-hygiene-score` by band) reading the metric's own value; a computed metric with **no** registered threshold defaults to `ok` (an honest "no concern flagged", never a fabricated alarm). `HEALTH_GLYPH`/`HEALTH_LABEL` maps (`●`/`◐`/`▲`/`○` + `ok`/`watch`/`risk`/`n/a`). **No color alone** — the glyph shape + the text label both carry the signal (NFR-8 / UX-DR14).
  - [ ] The registry is **render-layer-owned** (the decision-log: "derive in renderer from §4.2-owned thresholds — not a Report-JSON field"), documented, and tunable; `analysis` stays byte-stable (bands are presentational, never written back).

- [ ] **Task 4 — Group-overview chart panels + per-metric visuals (AC1, AC2) [src/render/html/charts.ts] (new).**
  - [ ] `groupOverviewPanel(group, metrics): string` — a `<figure class="chart-panel">` with a `<figcaption>` (the group's one-line description) + the group's **fixed-type** SVG (chosen by group id, fed by the group's representative metric series) + a **mandatory** `<details class="data-table"><summary>Show data table</summary><table>…</table></details>` fallback (the no-JS path; default `open`, collapsed by the disclosure script). Never the chart alone — caption + table always present.
  - [ ] `metricVisual(metric): string` — by `detectShape`: timeseries→`svgLine`, distribution→`svgBars`/`svgHBars`, scalar-range→`svgSparkline`+`svgGauge`+the number, scalar→a bold `<p class="stat">` (no SVG), none/`not_available`→no visual; **always** a `<details>` data-table/text fallback for any non-scalar visual. Pure; escaped.
  - [ ] A small `dataTable(series, headers)` helper (escaped `<table>` with a `<caption>`), shared by group + metric fallbacks.

- [ ] **Task 5 — Wire visuals, health bands, progressive disclosure into the renderer (AC1, AC2, AC3) [src/render/html/html-renderer.ts].**
  - [ ] In each group `<section>`: render `groupOverviewPanel(group, metrics)` before the metric cards.
  - [ ] In each metric card: add the **health band** (`<span class="health health-{band}">{glyph} {label}</span>`) by the title, and the `metricVisual(metric)`; a `not_available` card is greyed (a class) with no visual.
  - [ ] **Progressive disclosure:** render each metric card as `<details class="metric-card" data-status="…" open>` with the title/band/value in `<summary>` and the facets/visual/table in the body; `ok` cards default `open` too (so **no-JS = all expanded**), and a tiny inlined **disclosure script** collapses `ok` cards + the data-table `<details>` **on load** (so **with-JS** = `ok` collapsed, tables tucked). The script is the report's only JS, inlined; absent it, every `<details open>` stays open (the no-JS guarantee).
  - [ ] Add the SVG/health/disclosure CSS to the inlined `<style>` (chart-panel, metric visual sizing, `.health-*` glyph colors **with** the text label, `details>summary` affordance) — AA-contrast, reduced-motion-safe.

- [ ] **Task 6 — Tests (AC1, AC2, AC3).**
  - [ ] **`svg.test.ts`:** each primitive returns deterministic SVG (`<svg`, a `role="img"`+`aria-label`, byte-identical across two calls); an empty/degenerate series returns a minimal valid SVG (no crash, no `NaN` in coords).
  - [ ] **`shape.test.ts`:** `detectShape` classifies a `perMonth` object → timeseries, a `{a:1,b:2}` non-date object → distribution, a `*SharePct` 0–100 number → scalar-range, a bare count → scalar, a string → none; `extractSeries` flattens a `perMonth` sub-object in key order and returns `[]` for an unextractable value.
  - [ ] **`health.test.ts`:** `not_available` → `na` (`○`/`n/a`); `b-bus-factor` busFactor 1→risk, 2→watch, 5→ok; an unregistered computed metric → `ok`; the glyph+label maps are shape-differentiated (no two bands share a glyph); the band is determined without reference to color.
  - [ ] **`charts.test.ts`:** `groupOverviewPanel` emits a `<figure>` + `<figcaption>` + an `<svg>` + a `<details>`/`<table>` fallback (never the chart alone); `metricVisual` picks the right shape (a timeseries metric → `svgLine` markup; a pure scalar → a `.stat`, no `<svg>`; a `not_available` → no visual); every non-scalar visual carries a data-table.
  - [ ] **`html-renderer.test.ts` (integration + the 4.1 updates):** a group section now contains its overview chart-panel before the cards; a metric card carries its health band (glyph + label both present), its visual, and the disclosure `<details>`; `ok` cards render `open` (no-JS expanded) + the page contains the disclosure script; **update the 4.1 self-containment assertion** from "no `<script>`" to "no **external** `<script src>`/`http(s)` ref" (an inline disclosure script is still self-contained); the byte budget stays **< 1 MB**; the adversarial-XSS escaping still holds through the new visuals/tables; substrate (no narrative) still renders the group charts + bands (the analysis-only page).

## Dev Notes

### ADR deviation — inline-SVG group charts instead of Chart.js (read first, user-approved)

The architecture (I1) names **Chart.js 4.5.1 (canvas, animations off)** for the group charts. **This story deliberately renders the group-overview + per-metric charts as deterministic inline SVG instead** (user decision, 2026-06-14). Rationale:
- **Determinism + testability.** Inline SVG is a pure `data → string` transform — **snapshot-testable and byte-stable** in Node with no browser/DOM, whereas a Chart.js canvas renders only in a browser (untestable here) and is non-deterministic to assert.
- **Self-containment + weight.** No ~210 KB runtime to inline; the report stays far under the ~1 MB budget with zero new dependencies (the architecture's own Rail (a)/(b) push *toward* inline SVG for everything except a few canvases — this takes that to its conclusion).
- **No-JS by construction.** Inline SVG + `<details>` data tables need **no script to display** — the accessible/keyboard floor (the architecture's Rail (c) "the a11y fallback is the no-JS path") is satisfied natively; the only JS is the optional progressive-disclosure collapse.
- **Same accessible contract.** Every chart still has its **mandatory data-table fallback**, label, and explanation — the WCAG floor and "never a chart alone" are unchanged. The deviation is purely *how the pixels are drawn* (SVG vs canvas), not *what data/accessibility* the report carries.

This is an intentional, documented divergence from architecture I1's charting-library choice; everything else in I1 (animations off, mandatory data-table fallback, typed template literals, self-containment, ≤1 MB, Rail (b) "small visuals as inline SVG/CSS") is honored or strengthened. Flag it in Completion Notes for the architecture record.

### The authoritative chart + card spec (do not re-derive)

[Source: docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/TEMPLATE-HTML.md#Group overview charts / Per-metric visual — by shape / Metric card — uniform skeleton]

- **Group overview charts (locked signatures):** A multi-series line (commits & churn) · B Pareto bar + bus-factor marker · C stacked bar (message-quality categories) · D branch/merge timeline + merge-density bars · E horizontal hotspots bar + churn trend line · F radar of component scores + overall gauge.
- **Per-metric visual by shape:** time-series → small line/area · distribution → small bar/histogram · scalar-in-range → sparkline / mini-gauge + number · pure scalar → **bold stat, no chart**.
- **Health band:** a status glyph whose **shape carries the signal, not color** — `●` ok · `◐` watch · `▲` risk · greyed `○` n/a — **always with its text label**, derived at render from §4.2 thresholds, **not stored in the Report JSON**.
- **Progressive disclosure:** `risk`/`watch` expanded, `ok` collapsed to a one-line summary; **with JS off, all cards expanded** (and the data-table fallback open). A `not_available` metric still renders a (greyed) card with only the "why".
- **Never a chart alone:** every chart (group + per-metric) is paired with its label + explanation + an accessible data-table fallback.

### Architecture decision — `<details>` as the no-JS disclosure primitive, JS only collapses (read first)

- **`<details open>` is the no-JS = open default.** Native HTML `<details>`/`<summary>` is keyboard-operable disclosure that needs **no JS**. Rendering every data-table fallback and metric card as `<details open>` means **with JS off, everything is open** (the AC3 + Rail (c) no-JS guarantee) — no data ever hidden behind an inoperable control.
- **A tiny inlined script collapses on load** — it removes `open` from `ok` cards and from the data-table disclosures, giving the **calm with-JS** progressive view (`ok` collapsed, tables tucked behind "Show data table"). This is the report's **only** JS, inlined (still self-contained — no external `src`); blocking it leaves the no-JS open state. So 4.1's "no `<script>`" assertion becomes "no **external** script" (an inline self-contained script is fine; self-containment forbids *network*, not inline JS). [Source: TEMPLATE-HTML.md#Progressive disclosure / Self-containment & no-JS]
- **Health bands are render-owned domain knowledge.** Per the PRD decision-log, the bands derive at render from §4.2-owned thresholds **in the renderer**, never a Report-JSON field — so `analysis` stays byte-stable and the classifier is the single consumer (no drift across formats). A documented threshold registry (keyed by metric id) is the home; unregistered computed metrics default to `ok` (honest, not a fabricated alarm). [Source: prd.md#§4.2 decision-log (G), epics.md#FR-6]
- **Pure inline SVG, deterministic.** Each chart is a pure function of the metric series → an SVG string (fixed viewBox, rounded coords, `currentColor`/CSS-class color, no animation/clock/random), so the report is byte-stable for identical input and the snapshot tests are stable — the same determinism posture as every other render surface. [Source: architecture.md#render is a pure function of JSON]

### Scope discipline — what this story does and does NOT include

**In scope:** the 6 fixed-type group-overview charts (inline SVG) + mandatory data-table fallbacks; the per-metric visual-by-shape system (SVG line/bar/sparkline/gauge / bold stat) + fallbacks; the health-band classifier (threshold registry → glyph+label, no-color-alone); progressive disclosure via `<details>` + a tiny inline collapse script; the supporting SVG/health/disclosure CSS; all inlined, self-contained, ≤1 MB.

**Out of scope / deferred (do NOT build here):**
- **Chart.js / canvas rendering** — replaced by inline SVG (the ADR above). No `chart.js` dependency. [Source: this story's ADR]
- **The CLI `--format html` dispatch + writing the file** — still **Story 4.4** (multi-select output + file writing). 4.2 extends the pure `renderHtml` string; the artifact is the returned string. [Source: epics.md#Story 4.4]
- **Markdown / JSON renderers** — **Stories 4.3 / 4.4** (Markdown has its OWN visual degradation: ASCII sparklines + Mermaid + text tables, FR-7 — not this SVG system). 4.2 is HTML only. [Source: epics.md#Story 4.3/4.4]
- **Masthead/footer provenance + the Free-tier Buy-Me-a-Coffee link + the Free cap line** — needs the Report-JSON metadata subtree (repo/branch/provider/timestamp/tier) not yet in the schema; deferred with 4.1's masthead deferral. [Source: 4-1 story deferral]
- **Exhaustive per-metric thresholds for all 32 metrics** — 4.2 ships a **defensible baseline** registry (the metrics with clear domain semantics) + the `ok`/`na` default; tuning the full threshold table from real runs is a later refinement behind the same `classifyHealth`. [Source: prd.md#§4.2 decision-log (G) "domain knowledge"]
- **Real-browser / pixel / visual-regression testing of the SVG** — 4.2 asserts the SVG **markup/structure** (deterministic strings) + the accessible fallbacks; pixel snapshots need a browser harness (a later QA/e2e concern). [Source: architecture.md (pure-string render)]

### The exact contracts to build on (do NOT redefine)

- **`renderHtml(report): string` + `escapeHtml` + `presentGroups` + `GROUPS` (4.1):** extend the renderer; the seven-band narrative-first structure, `classifyReport` routing, TOC/anchors, a11y floor, and escaping are unchanged. Every new interpolated value (series labels, numbers, table cells) is `escapeHtml`'d. [Source: src/render/html/html-renderer.ts]
- **`Report`/`ReportAnalysis`/`Metric` (1.7):** `metric = { id, group, title, status, value?, reason? }`; `value` is JSON (`number | string | bool | null | array | object`). The chart/shape/health functions read `value`/`status`; they add no schema field. [Source: src/assemble/report-schema.ts]
- **`narrative.explanations[id]` (3.2) + `confidence` (3.5):** the four facets already render on the card (4.1); 4.2 adds the visual + band + disclosure around them. Unchanged. [Source: src/render/html/html-renderer.ts]
- **The metric group catalog + the metrics feeding each group chart** — Group A `a-commit-volume` (`{perMonth}`) etc.; the chart picks a representative series from the group's metrics, tolerant of shape. [Source: src/analyze/groups/*.ts, prd.md#§4.2]

### Determinism, security & purity (the render rules — unchanged)

- **Pure function of the Report JSON** — no clock/I/O/random/env; identical Report ⇒ byte-identical HTML (SVG coords rounded, key order from the byte-stable `analysis`); `render/` stays `no-console`. [Source: architecture.md, eslint.config.js]
- **Escape every interpolated value** — series labels, numeric strings, table cells, `aria-label`s — the 4.1 security boundary extends to the new surfaces (a malicious file path in a hotspots bar must not inject). [Source: securityRequirements, OWASP A03]
- **No-color-alone** — every health band is glyph **shape** + text **label**, never color as the sole signal (NFR-8, UX-DR14). [Source: epics.md#NFR-8, #UX-DR14]
- **No new dependencies** — inline SVG + typed template literals only. [Source: this story's ADR]

### Previous-story intelligence

- **4.1 is the shell this fills in.** The metric card (title · status · value/reason · four facets) gets the visual + band + disclosure; the group section gets the overview chart-panel before its cards. No upstream change; `analysis` byte-stable. [Source: 4-1 story, src/render/html/html-renderer.ts]
- **`<details>` defaults to open = the no-JS lever** (above) — the cleanest way to satisfy "no-JS all expanded" + "with-JS ok collapsed" without a heavy framework. The 4.1 "no `<script>`" test must relax to "no external script". [Source: 4-1 test, TEMPLATE-HTML.md]
- **Escaping discipline carries over (4.1):** the adversarial-XSS test must still pass through the new tables/SVG `aria-label`s — escape series labels (file paths!) and any text in an SVG/attribute. [Source: 4-1 review]
- **Shape detection must be tolerant** (the 2.x "self-safe" lesson): an unexpected value shape ⇒ no visual + the table/stat, never a crash or `NaN` coordinate. [Source: 2.2 self-safe reductions]

### Project Structure Notes

- New: `src/render/html/{svg,shape,health,charts}.ts` (+ their `.test.ts`). Modified: `src/render/html/html-renderer.ts` (+ `.test.ts`). **No** engine/model/metric/narrate/assemble/schema change; `analysis` + the terminal renderer + `classifyReport` are untouched. [Source: architecture.md#Complete Project Directory Structure]
- `render/html/svg.ts` is the architecture's named home for the per-metric visuals (I1 references `render/html/sparkline.ts`); this story creates the SVG/chart/shape/health modules there. **No new dependencies.** [Source: architecture.md#I1, #Per-metric visuals]

### References

- [Source: docs/planning-artifacts/epics.md#Story 4.2: Per-group charts with accessible data-table fallback] (the ACs) · [Source: …#FR-6] (chart-per-group + per-metric visual + health band) · [Source: …#FR-7] (degrade per format) · [Source: …#NFR-8] (no per-developer ranking) · [Source: …#UX-DR6/7/14] (metric card, chart block, accessibility floor)
- [Source: docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/TEMPLATE-HTML.md] (group chart signatures, visual-by-shape, metric-card skeleton, progressive disclosure, self-containment & no-JS) · [Source: …/DESIGN.md] (chart-panel/metric-card surfaces, palette)
- [Source: docs/planning-artifacts/architecture.md#I1 — HTML Charting & Templating] (animations off, mandatory data-table fallback, inline self-containment, ≤1 MB, Rail (a/b/c)) \u2014 **deviation:** inline SVG instead of Chart.js (this story's ADR) · [Source: prd.md#§4.2 decision-log (G)] (health bands render-owned from §4.2 thresholds)
- [Source: src/render/html/html-renderer.ts] (the 4.1 shell to extend) · [Source: src/assemble/report-schema.ts] (`Report`/`Metric`)

## Dev Agent Record

### Completion Notes (Amelia)

Implemented as five new render modules + a renderer wiring, **inline-SVG (no Chart.js)** per the user-approved ADR. 542 tests pass (+43 over 4.1's 499); typecheck/lint/build all green; bundle 102.66 KB; zero new dependencies.

- **`src/render/html/svg.ts`** — pure deterministic SVG primitives: `svgLine` · `svgBars` · `svgHBars` · `svgSparkline` · `svgGauge` · `svgRadar` (radar falls back to bars for <3 axes). Fixed `viewBox` (100×40), coords rounded to 2 dp via `r()`, every value through `safe()` (non-finite → 0), `currentColor`/CSS-class color, `role="img"`+escaped `aria-label`, empty series → minimal valid empty SVG. No clock/random/animation.
- **`src/render/html/shape.ts`** — `detectShape(value) → "timeseries"|"distribution"|"scalar-range"|"scalar"|"none"` and `extractSeries`/`rangeField`. Tolerant: an unexpected shape yields `[]`/`"none"` (the card shows the bold stat/table), never a crash or `NaN`. Key order from the value's own (byte-stable from `analysis`).
- **`src/render/html/health.ts`** — render-owned `classifyHealth(metric) → "ok"|"watch"|"risk"|"na"` from a documented threshold REGISTRY (7-metric defensible baseline; unregistered computed → `ok`, honest no-alarm). `HEALTH_GLYPH` (`●◐▲○`, shape-differentiated) + `HEALTH_LABEL` (`ok`/`watch`/`risk`/`n/a`) — **never color alone**. Bands are presentational; `analysis` stays byte-stable (no schema field).
- **`src/render/html/charts.ts`** — `groupOverviewPanel(group, metrics)` (fixed-type SVG by group: A/D line · B/E hbars · C bars · F radar) + `metricVisual(metric)` (by shape) + shared `dataTable()`. Every chart paired with caption + a **mandatory `<details class="data-table" open>`/`<table>` fallback** (the no-JS path). A group with no genuinely chartable (timeseries/distribution) series renders caption + "no chartable series" note — never a degenerate 1-point chart.
- **`src/render/html/escape.ts`** — `escapeHtml` extracted to its own module (re-exported from the renderer for back-compat).
- **`html-renderer.ts`** — each group section renders its overview panel before the cards; each card is `<details class="metric-card" data-status data-health open>` with title · health band in `<summary>` and visual · value/reason · four facets · table in the body. A tiny inlined `DISCLOSURE_SCRIPT` (the report's ONLY JS, self-contained) collapses `ok` cards + data-tables on load; with JS off everything stays `open` (the AC3 no-JS floor). 4.1's self-containment test relaxed from "no `<script>`" to "no **external** `<script src>`/http".

**ADR note for the architecture record:** group + per-metric charts render as deterministic inline SVG instead of architecture I1's Chart.js/canvas (user decision 2026-06-14) — for determinism/testability, self-containment/weight, and a native no-JS floor. Everything else in I1 honored (animations off, mandatory data-table fallback, typed template literals, self-containment, ≤1 MB).

### Review (3-layer adversarial)

- **Acceptance Auditor — all 3 ACs MET, scope held, 0 must-fix.** Verified fixed-type chart-per-group + mandatory table (AC1), visual-by-shape + render-owned health band glyph+label no-color-alone + greyed n/a card (AC2), `<details open>` no-JS floor + single inline disclosure script + <1 MB (AC3). Confirmed: no new deps, no schema change, no out-of-scope work (no `--format` dispatch / Markdown / JSON / masthead / exhaustive thresholds), every interpolation escaped, XSS test holds.
- **Edge Case Hunter — 0 unhandled edge cases.** Validated empty/single-point/all-equal/all-zero/negative/NaN/Infinity series, gauge clamping (value>max, <0, max≤0), radar <3 axes, missing/non-numeric health fields, exact thresholds, empty groups, malicious-label escaping, the disclosure script's no-JS/with-JS paths. Suggested optional boundary tests → **actioned**.
- **Blind Hunter — 0 Critical/High; 1 Medium + 1 Low.**
  - **[Medium] PATCHED:** `group.id`/`g.id` interpolated unescaped in the TOC link + group `<h2>` text, while the adjacent same-provenance `group.title` was escaped. `MetricGroup` is a fixed `"A".."F"` enum so not exploitable, but escaped both for boundary-escaping consistency.
  - **[Low] DISMISSED (with context the diff-only hunter lacked):** the `f-bus-factor-risk` registry entry sharing `b-bus-factor`'s `busFactor` threshold is **correct** — `f-bus-factor-risk` is a real Group F roll-up (Story 2.5) whose value carries a numeric `busFactor` field, so `higherBetter("busFactor", 3, 2)` reads it correctly. Added a lock-in test.

**Patches applied:** 1 (escape `group.id` in two text positions). **Tests added:** 3 (exact threshold boundaries; `f-bus-factor-risk` band; empty-series timeseries → valid empty chart, no `NaN`). **Dismissed:** 1 (`f-bus-factor-risk` — real metric). Re-ran all gates green (542 tests).

### File List

- `src/render/html/svg.ts` (new) · `src/render/html/svg.test.ts` (new)
- `src/render/html/shape.ts` (new) · `src/render/html/shape.test.ts` (new)
- `src/render/html/health.ts` (new) · `src/render/html/health.test.ts` (new)
- `src/render/html/charts.ts` (new) · `src/render/html/charts.test.ts` (new)
- `src/render/html/escape.ts` (new)
- `src/render/html/html-renderer.ts` (modified) · `src/render/html/html-renderer.test.ts` (modified)
