---
epic: 4
story: 1
title: Self-contained HTML report shell
baseline_commit: 82482ed
---

# Story 4.1: Self-contained HTML report shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a single-file HTML report with navigation,
so that I can open and share a complete report with no server.

## Acceptance Criteria

1. **One self-contained file, all assets inlined, ≤~1 MB (AC1).** **Given** a Report JSON, **when** `renderHtml(report)` runs, **then** it returns a **single, self-contained HTML document** (a complete `<!doctype html>` string) with **all** CSS inlined in a `<style>` and **no external references** — no `<link>` stylesheet, no `<script src>`, no remote font/CDN/`http(s)://` asset — so it opens in any browser with **no network**; the output stays within a **~1 MB** weight budget for a full Report (the renderer is a pure function of the Report JSON, no I/O).

2. **Narrative-first band order (AC2).** **Given** a narrated (showpiece) Report, **when** HTML renders, **then** the bands appear in this **exact order** — **masthead → Summary (TL;DR) → Explanation → Coaching → *then* the Metric Groups (A–F)** — story before evidence; the narrative bands (Summary/Explanation/Coaching) **always** render **before** the metric groups (never hoisted below). A substrate Report (no narrative — `--no-ai` or fail-open degraded) renders masthead → (degraded banner / metrics-only note) → Metric Groups, with the same metric-group structure.

3. **Table of contents, in-page anchors, browser-searchable (AC3).** **Given** the rendered report, **when** the reader navigates, **then** it provides a **table of contents** linking (via `#` fragments) to in-page anchors for **Summary, Explanation, Coaching, and each Metric Group A–F** (the narrative anchors present only when narrated); every section carries a stable `id`; and all content is **real, searchable HTML text** (browser find works — no canvas/image-only content in the shell).

4. **WCAG 2.2 AA + keyboard + reduced motion (AC4).** **Given** the rendered report, **then** it meets the accessibility floor: a single `<h1>` + correctly-nested headings, semantic landmarks (`<header>`/`<nav>`/`<main>`/`<footer>`), **AA-contrast** color tokens, a **skip-to-content** link and visible **`:focus-visible`** outlines for keyboard navigation, language (`<html lang>`) + `<meta charset>` + responsive `<meta viewport>`, a **`prefers-reduced-motion`** media query (no essential motion), and a `prefers-color-scheme` dark/light palette — all from inlined CSS (no JS required to read or navigate).

## Tasks / Subtasks

- [ ] **Task 1 — The pure HTML renderer (AC1, AC2, AC3, AC4) [src/render/html/html-renderer.ts] (new).**
  - [ ] `renderHtml(report: Report): string` — returns the full `<!doctype html>` document. Reuses `classifyReport` (the format-agnostic showpiece-vs-substrate router) so HTML routes the same two paths off the same Report JSON as the terminal.
  - [ ] **`escapeHtml(text): string`** — escape `& < > " '` on **every** interpolated value (narrative prose, metric titles, values, reasons, explanations). Security-critical (the narrative is LLM output and metric values carry repo-derived data — untrusted at the render boundary; OWASP A03 Injection / stored-XSS).
  - [ ] **Document skeleton:** `<html lang="en">`, `<head>` with `<meta charset="utf-8">` + `<meta name="viewport" content="width=device-width, initial-scale=1">` + `<title>` + the **inlined `<style>`**; `<body>` with a **skip link** → `<header>` (masthead) → narrative bands → `<nav>` TOC → `<main>` → `<footer>`.
  - [ ] **Showpiece bands (narrative present), in order:** masthead (`<header>`: product + the confidence band when `narrative.confidence` is set) → `#summary` (TL;DR: headline + overview + key findings) → `#explanation` (paragraphs) → `#coaching` (introduction → themed chapters of prioritized `<ol>` steps → closing summary) → `<main>` Metric Groups. The TOC `<nav>` lists Summary · Explanation · Coaching · A–F.
  - [ ] **Substrate bands (narrative absent):** masthead → a **degraded** banner (`framing === "degraded"`, loud) or a neutral **metrics-only** note (`"metrics-only"`) → `<main>` Metric Groups. The TOC lists only the Metric Groups (no narrative anchors).
  - [ ] **Metric Groups band:** partition `analysis.metrics` by `group` in stable A→F order; each non-empty group is a `<section id="group-x">` with an `<h2>` group title (`A Activity & Cadence`, `B Contribution & Ownership`, `C Commit Message Quality`, `D Branching & Merge Structure`, `E Churn & Hotspots`, `F Repository Health Signals`); each metric is an `<article>` card showing **title · status · value (or `not_available` reason)** drawn from `analysis`, plus its **four-facet explanation** (meaning · good behaviours · needs improvement · suggestions) drawn from `narrative.explanations[metric.id]` when present (joined by id). Render a metric value as escaped, compact text (the rich per-metric charts/sparklines + health-band glyph are **Story 4.2**).
  - [ ] **Inlined `<style>`** (a string constant): a `prefers-color-scheme` dark-first + light palette with **AA-contrast** tokens; `:focus-visible` outlines; a styled skip link; `:target` emphasis for anchor landing; `prefers-reduced-motion` reduce (no transitions/animations); a system font stack (no external font — keeps it self-contained + lean); a fluid, readable max-width column. No JS.

- [ ] **Task 2 — Tests (AC1, AC2, AC3, AC4) [src/render/html/html-renderer.test.ts].**
  - [ ] **Self-containment (AC1):** the output is a single `<!doctype html>` string; contains **no** `<link `, no `<script`, no `src="http`, no `href="http`, no `@import url(http`/CDN — assert against a representative narrated Report; the byte length is **< 1 MB** (`Buffer.byteLength`).
  - [ ] **Band order (AC2):** `indexOf` proves masthead < `#summary` < `#explanation` < `#coaching` < first `#group-`; the narrative content appears before any metric group; a substrate Report has **no** `#summary`/`#explanation`/`#coaching` and renders the degraded banner or metrics-only note before the groups.
  - [ ] **TOC + anchors + searchable (AC3):** the TOC links `#summary`/`#explanation`/`#coaching`/`#group-a`..`#group-f`; each target `id` exists; metric titles / narrative text appear as plain searchable text (a known finding string is present, unescaped-readable); a substrate TOC omits the narrative anchors.
  - [ ] **a11y (AC4):** exactly one `<h1>`; `<html lang=`; `<meta charset`; `<meta name="viewport"`; the skip link (`href="#main"` → `id="main"`); a `prefers-reduced-motion` block; a `prefers-color-scheme` block; landmarks (`<header>`/`<nav>`/`<main>`/`<footer>`) present.
  - [ ] **Security / escaping (AC1 boundary):** a Report whose narrative/metric carries `<script>`/`"`/`&`/`<img onerror=...>` is **escaped** in the output (`&lt;script&gt;` etc.) — no raw injection survives; a round-trip proves the dangerous markup is inert.
  - [ ] **Metric grouping + four-facet join:** a metric's card shows its value (computed) or reason (not_available) and, when a matching `narrative.explanations[id]` exists, its four facets; a group with no metrics is omitted; group order is A→F.

## Dev Notes

### Review Findings

**Code review — 2026-06-14** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The Blind Hunter cleared the security surface 0-patch** — verifying EVERY interpolated value (narrative, metric title/value/reason/status, the four facets, confidence, the `data-status` attribute, the JSON value) is `escapeHtml`'d, `&`-first ordering correct, no raw injection path, single `<h1>`, well-formed, self-contained, pure. The Edge Case Hunter + the Acceptance Auditor **converged on one real issue** (the Auditor downgraded AC3 to PARTIAL for it). Triage: **1 patch (the dead-anchor AC3 fix) · 1 actioned test-rigor nit · ~3 dismissed.**

**Patch:**

- [x] [Review][Patch] **Dead TOC anchors — an AC3 violation** (Edge Case Hunter 2× Patch + Acceptance Auditor AC3 PARTIAL): the TOC listed all six groups A–F **unconditionally**, but `metricGroups` **omits** a group with no metrics — so a sparse analysis produced TOC links to `#group-c/d/e` with **no matching section** (a silently-broken in-page anchor; AC3 requires "in-page anchors for each Metric Group") [src/render/html/html-renderer.ts] — **Fixed:** a shared `presentGroups(analysis)` (the groups actually having a metric) now drives **both** the TOC links **and** the rendered sections, so they can **never** diverge — the TOC links exactly what is rendered. Added a regression test (no dead `#group-c/d/e` for a sparse fixture; every TOC group link has a matching section id) + a full-six-group test (all A–F linked when present). Updated the pre-existing TOC test that had encoded the buggy "all six" assertion.

**Actioned (Blind Hunter test-rigor nit):**

- [x] The security test now also **positively** asserts the malicious metric *value* is rendered **escaped** (`&lt;/style&gt;&lt;script&gt;1&lt;/script&gt;`), not merely that the raw form is absent — so a silently-dropped value cannot pass the test.

**Dismissed:**
- **Edge Case Hunter — empty `explanation.paragraphs` / `coaching.chapters` / `chapter.steps` → headless band / empty `<ol>`** (3× Consider): those arrays are `.min(1)` **schema-guaranteed** (the strict `NarrativeSchema` read-back boundary) AND the generation pipeline always populates them; per the implementation-discipline rule ("don't add error handling for scenarios that can't happen; validate at boundaries"), the schema IS that boundary. Adding renderer guards would defend already-validated input. (Distinct from the dead-anchor, which is wrong for any sparse — and legitimately occurring — metric set.)
- **Edge Case Hunter — very long metric value blowing the byte budget**: the budget test uses a representative Report; a pathological 10 KB value is not the realistic catalog, and 4.2's chart weight is the real budget driver the assertion guards.

### The authoritative page skeleton (do not re-derive)

The UX HTML template fixes the structure exactly. [Source: docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/TEMPLATE-HTML.md#Page skeleton (seven bands)]

```
① MASTHEAD        commit-sage · (confidence)
② TL;DR           narrative.summary  (the ten-second story)
③ TOC             Summary · Explanation · Coaching · A B C D E F
④ EXPLANATION     narrative.explanation
⑤ COACHING        narrative.coaching (intro → themed prioritized chapters → closing)
⑥ METRIC GROUPS   A–F: heading → per-metric cards (value+status from analysis; four-facet
                  explanation from narrative.explanations[id])
⑦ FOOTER          Generated by commit-sage · schemaVersion 1.0.0
```

**Non-negotiable (template):** *"the AI narrative (Summary → Explanation → Coaching) always renders before the metric groups … never hoist metrics or charts above the narrative."* That is AC2, verbatim.

### Architecture decision — typed template literals, pure `Report → string`, inlined + escaped (read first)

- **Typed template literals, zero deps.** The architecture pins: *"Templating: typed template literals — pure TS functions `Report → string`, zero deps, fully typed off the Report JSON. Matches 'render is a pure function of JSON.'"* So `renderHtml` is a pure function composing escaped strings — **no template engine, no new dependency** (the `eta` file-template alternative was explicitly declined). [Source: architecture.md#I1 — Templating]
- **Self-containment by construction.** *"chart library JS + data are inlined into the single HTML file; it renders in-browser with no CDN or network."* 4.1 has **no charts yet** (those are 4.2), so self-containment here means: **all CSS inlined in `<style>`, a system font stack (no web font), no `<link>`/`<script src>`/remote asset.** The ≤~1 MB budget is comfortably met by a text-only shell; 4.2's inlined Chart.js runtime is the weight driver the budget actually guards (4.1 establishes the budget assertion). [Source: architecture.md#I1 — Self-containment, #Rail (a)]
- **Showpiece-vs-substrate reuse (1.8).** `classifyReport` already routes a `Report` to `showpiece` (narrative guaranteed — `ShowpieceReport`) or `substrate` (`metrics-only` | `degraded`). HTML reuses it verbatim — the **same** two paths off the **same** Report JSON as the terminal, so the narrative-first bands render only when narrated and the substrate renders the analysis-only page with the right framing. No new routing. [Source: src/render/render.port.ts, terminal-renderer.ts]
- **Escaping is the security boundary.** The narrative is **LLM output** and metric values carry **repo-derived data** — both untrusted at the render boundary. **Every** interpolated value is `escapeHtml`'d (`& < > " '`) so a commit message / model output containing `<script>` or an attribute-breaking `"` cannot inject markup (OWASP A03; stored-XSS into a shareable artifact is the real risk). The renderer never emits raw interpolated text. [Source: OWASP Top 10 A03, securityRequirements]
- **Health bands + charts are Story 4.2 — 4.1 is the readable shell.** The per-metric **visuals** (line/bar/sparkline/mini-gauge), the **six group-overview Chart.js canvases**, the **data-table fallbacks**, and the **shape-differentiated health-band glyph** (`●`/`◐`/`▲`/`○`) are all **4.2**. 4.1 delivers the navigable, accessible, narrative-first **text** shell into which 4.2 slots the visuals. A metric card in 4.1 shows title · status · value/reason · four-facet explanation. [Source: epics.md#Story 4.2]

### Scope discipline — what this story does and does NOT include

**In scope:** the pure `renderHtml(report): string` — the self-contained `<!doctype html>` document with the seven-band narrative-first structure, the TOC + in-page anchors, the metric-group sections (text cards joining `analysis` value/status + `narrative.explanations[id]` four facets), inlined AA-contrast/reduced-motion/`prefers-color-scheme` CSS, semantic landmarks, skip link, and HTML escaping.

**Out of scope / deferred (do NOT build here):**
- **All charts + per-metric visuals + data-table fallbacks + health-band glyphs** — **Story 4.2** (Chart.js group overviews, per-metric sparklines/mini-gauges, the mandatory accessible data-table fallback, the `●`/`◐`/`▲`/`○` health bands from catalog-owned thresholds). 4.1 is the chart-free shell. [Source: epics.md#Story 4.2]
- **Progressive disclosure (collapse `ok` cards, expand `risk`/`watch`)** — needs JS + the health band (4.2); 4.1 renders every card fully (the no-JS-equivalent baseline the template guarantees). [Source: TEMPLATE-HTML.md#Progressive disclosure]
- **CLI `--format html` dispatch + writing the file to `outputPath`** — a separate **render-output-dispatch** concern (multi-format selection + a new impure file-writing adapter + `outputPath` resolution `./commit-sage-report.html`). 4.1 builds the pure renderer (the artifact = the returned string, per the render-port `JSON → string` contract, exactly like `renderTerminal`); the shell wiring lands in a dedicated output story (or Epic 6 operational). The renderer is independently complete + testable. [Source: src/render/terminal/terminal-renderer.ts (pure, shell writes), src/config/run-config.ts (`outputFormats`/`outputPath` unconsumed)]
- **Markdown / JSON renderers** — later Epic 4 stories (TEMPLATE-MARKDOWN). 4.1 is HTML only. [Source: epics.md#Epic 4]
- **Report-JSON provenance metadata** (repo · branch · N commits · contributors · provider/model · timestamp · tier for the full masthead/footer + the Free-tier Buy-Me-a-Coffee link) — the Report JSON currently carries only `{schemaVersion, degraded, analysis, narrative}` (no repo/provider/timestamp/entitlement). The full masthead/footer detail needs a deliberate **Report-JSON metadata** addition; 4.1 renders the masthead from what the Report cleanly carries (product + `narrative.confidence`) and the footer as product + `schemaVersion`. Adding the provenance subtree is a separate schema story. [Source: src/assemble/report-schema.ts, TEMPLATE-HTML.md#① MASTHEAD / ⑦ FOOTER]
- **IBM Plex web font inlining** — DESIGN names IBM Plex, but inlining a font is ~100 KB+ of base64; 4.1 uses a **system font stack** (genuinely self-contained, lean, AA-legible). Optional font inlining is a later polish behind the budget. [Source: DESIGN.md type scale, architecture.md#Rail (a) weight budget]

### The exact contracts to build on (do NOT redefine)

- **`Report` / `ReportNarrative` / `ReportAnalysis` (1.7/3.x):** `{ schemaVersion, degraded, analysis: { metrics: Metric[] }, narrative?: { summary, explanation, coaching, explanations?, confidence? } }`. The metric envelope is `{ id, group: "A".."F", title, status: "computed"|"not_available", value?, reason? }`; the four-facet explanation is `{ explanation, goodBehaviours[], needsImprovement[], suggestions[] }`; confidence is `{ level, rationale, escalation? }`. [Source: src/assemble/report-schema.ts]
- **`classifyReport(report): RenderRoute` (1.8):** `showpiece` (narrows to `ShowpieceReport`, narrative guaranteed) | `substrate` (`{ analysis, framing: "metrics-only"|"degraded" }`). Reuse it. [Source: src/render/render.port.ts]
- **The terminal renderer's posture (1.8):** pure `Report → string`, `render/` is under `no-console` (the renderer never writes — the shell writes the returned string). HTML mirrors this exactly. The banner copy constants live in the terminal module; HTML defines its own visual banner (a different surface) but the same `framing` semantics. [Source: src/render/terminal/terminal-renderer.ts]
- **Metric group titles (catalog):** A Activity & Cadence · B Contribution & Ownership · C Commit Message Quality · D Branching & Merge Structure · E Churn & Hotspots · F Repository Health Signals. [Source: prd.md#§4.2 catalog, epics.md#Epic 2 stories]

### Determinism, security & purity (the render rules)

- **Pure function of the Report JSON** — no clock, no I/O, no randomness, no env; the same Report always renders byte-identical HTML (so a snapshot/weight test is stable, and a future trend-diff of the *analysis* is unaffected — HTML is a view). `render/` stays `no-console`. [Source: architecture.md#render is a pure function of JSON, eslint.config.js]
- **Escape everything interpolated** (the security rule above) — `escapeHtml` on all narrative/metric text; never interpolate a raw value into markup or an attribute. [Source: securityRequirements, OWASP A03]
- **No new dependencies** — typed template literals only (the architecture's explicit choice). [Source: architecture.md#I1 — Templating]

### Previous-story intelligence

- **The Report JSON already carries everything 4.1 renders** (1.7 analysis + 3.1–3.5 narrative/explanations/confidence). 4.1 is a **view** — it adds no schema field and changes no upstream stage; `analysis` stays byte-stable. [Source: src/assemble/report-schema.ts]
- **`classifyReport` is the de-drift seam (1.8):** "the classifier is the single consumer (no drift across HTML / Markdown / Terminal)." HTML must route through it, not re-derive showpiece-vs-substrate. [Source: architecture.md, src/render/render.port.ts]
- **`no-console` + pure-string render (1.8 lesson):** the renderer returns a string; it never writes to stdout/files. Keep the file-writing out (the shell's job — deferred dispatch story). [Source: src/render/terminal/terminal-renderer.ts]
- **Escaping discipline is new here:** the terminal renderer didn't need HTML escaping (ANSI text); HTML is the first surface where untrusted narrative/metric text becomes **markup** — the escape helper is the one genuinely new security primitive. Test it adversarially (a `<script>` in a metric value). [Source: securityRequirements]

### Project Structure Notes

- New: `src/render/html/html-renderer.ts` (+ `html-renderer.test.ts`). **No** change to engine/model/metric/select/config/narrate/assemble; the `analysis` subtree, the Report schema, the terminal renderer, and `classifyReport` are untouched. [Source: architecture.md#Complete Project Directory Structure]
- `src/render/html/` is the architecture's named home for HTML charting & templating (I1); 4.1 creates it with the shell, 4.2 adds the chart modules (`render/html/sparkline.ts` etc.). [Source: architecture.md#I1, #Per-metric visuals (`render/html/sparkline.ts`)]

### References

- [Source: docs/planning-artifacts/epics.md#Story 4.1: Self-contained HTML report shell] (the ACs)
- [Source: docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/TEMPLATE-HTML.md] (the seven-band skeleton; narrative-first non-negotiable; self-containment & no-JS guarantees; file-weight discipline) · [Source: …/EXPERIENCE.md] (HTML navigation, Accessibility Floor) · [Source: …/DESIGN.md] (palette/type — system-font substitute for 4.1)
- [Source: docs/planning-artifacts/architecture.md#I1 — HTML Charting & Templating] (typed template literals, pure `Report → string`, inlined self-containment, ≤~1 MB budget) · [Source: …#Canonical Report JSON] (the subtrees HTML renders)
- [Source: docs/planning-artifacts/prds/prd-commit-sage-2026-06-06/prd.md#FR-13] (render formats; degrade per format) · [Source: …#FR-12] (Report JSON the single source)
- [Source: src/render/render.port.ts] (`classifyReport`) · [Source: src/render/terminal/terminal-renderer.ts] (the pure-render posture to mirror) · [Source: src/assemble/report-schema.ts] (`Report`/`ReportNarrative`/`ReportAnalysis`)

### Completion Notes

- **All four ACs satisfied.** AC1: `renderHtml(report): string` returns a **single self-contained `<!doctype html>` document** — all CSS inlined in `<style>`, a system font stack, **no** `<link>`/`<script>`/`http(s)://`/`@import`/remote font — within the **< 1 MB** budget (tested via `Buffer.byteLength`); a pure function (no I/O). AC2: the showpiece bands render **masthead → Summary → Explanation → Coaching → metric groups** in that exact order (tested via `indexOf`), narrative always before metrics; the substrate omits the narrative bands. AC3: a TOC links the narrative anchors + **exactly the rendered** Metric Groups (the dead-anchor patch), every target `id` exists, and all content is real searchable text. AC4: a single `<h1>`, semantic landmarks (`<header>`/`<nav>`/`<main>`/`<footer>`), AA-contrast GitHub-Primer tokens (~13:1 fg/bg), a skip link + `:focus-visible`, `lang`/`charset`/`viewport`, and `prefers-reduced-motion` + `prefers-color-scheme` blocks — all from inlined CSS, no JS.
- **Typed template literals, zero deps** (the architecture's explicit choice over `eta`). `escapeHtml` (`& < > " '`, `&`-first) on **every** interpolated value — the one new security primitive (the narrative is LLM output, metric values carry repo data; untrusted at the render boundary — OWASP A03). The Blind Hunter verified no raw-interpolation path, including attributes and the embedded JSON value.
- **Reuses `classifyReport`** (the de-drift seam) — the same showpiece/substrate routing off the same Report JSON as the terminal; HTML adds no schema field and changes no upstream stage (`analysis` stays byte-stable). HTML is a pure view.
- **The chart-free shell.** The six group-overview Chart.js canvases, per-metric sparklines/mini-gauges, the mandatory accessible data-table fallbacks, the `●`/`◐`/`▲`/`○` health-band glyphs, and progressive disclosure are **Story 4.2** — 4.1 delivers the navigable, accessible, narrative-first **text** shell (metric card = title · status · value/reason · four-facet explanation joined by id).
- **499 tests** (+23); typecheck / lint / build clean. The renderer is independently complete + comprehensively tested (well-formedness, self-containment, escaping incl. adversarial XSS, byte budget, band order, TOC consistency, substrate path, a11y).
- **New module flagged:** `src/render/html/html-renderer.ts` — the architecture's named home for HTML templating (I1); 4.2 adds the chart modules (`render/html/sparkline.ts` etc.). **No** engine/model/metric/select/config/narrate/assemble change; the terminal renderer and `classifyReport` are untouched. **No new dependencies.**
- **Deferred (explicit):** the CLI `--format html` dispatch + writing the file to `outputPath` (a separate render-output-dispatch concern — multi-format selection + a new impure file-writing adapter; the pure renderer IS the artifact per the render-port `JSON → string` contract, exactly like `renderTerminal`); the Markdown/JSON renderers (later Epic 4); and the masthead/footer provenance metadata (repo/branch/commits/provider/timestamp/tier — not in the Report JSON; a deliberate schema addition).

### File List

**Added (source):**
- `src/render/html/html-renderer.ts` — the pure `renderHtml` (self-contained document, seven-band narrative-first structure, TOC + anchors, metric-group text cards, `escapeHtml`, inlined AA/reduced-motion/color-scheme CSS, `presentGroups` TOC↔section consistency)

**Added (tests, co-located):**
- `src/render/html/html-renderer.test.ts` — escaping (incl. adversarial XSS), self-containment + byte budget, band order, TOC/anchors/no-dead-anchors/searchable, a11y floor, metric grouping + four-facet join, substrate (degraded + metrics-only)

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — epic-4 → in-progress; 4-1 → in-progress → done
- `docs/implementation-artifacts/4-1-self-contained-html-report-shell.md` — this story (record filled, status → done)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 4.1 drafted via create-story (ultimate context engine). Status → in-progress. |
| 2026-06-14 | Story 4.1 implemented (TDD): the pure `renderHtml` self-contained HTML shell — typed template literals, the seven-band narrative-first structure (masthead → Summary → Explanation → Coaching → metric groups), a TOC + in-page anchors, metric-group text cards joining `analysis` value/status + `narrative.explanations[id]` four facets, inlined AA-contrast/reduced-motion/`prefers-color-scheme` CSS, semantic landmarks + skip link, and `escapeHtml` on every interpolated value. Reuses `classifyReport`. 44 files / 497 tests green. Status → review. |
| 2026-06-14 | Code review (3 parallel layers) → Blind Hunter 0-patch (security surface verified) + Acceptance Auditor AC1/AC2/AC4 MET. 1 patch (Edge Case Hunter + Auditor AC3 PARTIAL): dead TOC anchors — a shared `presentGroups` now drives both the TOC links and the rendered sections (no dead anchors); +2 regression tests; +1 positive-escaping assertion. 3 empty-narrative-array Considers dismissed (`.min(1)` schema-guaranteed). 499 tests green; typecheck/lint/build clean. Status → done. |
