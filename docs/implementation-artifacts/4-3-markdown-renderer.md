---
epic: 4
story: 3
title: Markdown renderer
baseline_commit: cdddade
---

# Story 4.3: Markdown renderer

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a diff-able Markdown report,
so that I can commit it or post it in a PR/wiki.

## Acceptance Criteria

1. **Text-only visuals: tables, ASCII sparklines, and Mermaid — no binary images (AC1).** **Given** a Report JSON, **when** Markdown rendering runs, **then** it emits a single plain-text `.md` document whose every visual is text — **text tables / text-bars**, **ASCII sparklines** (`▁▂▄█▆▃`), and **Mermaid** diagrams (fenced ` ```mermaid ` blocks that render natively on GitHub/GitLab and show their source elsewhere) — with **no embedded or binary images** and **no network/asset dependency**, so the file reads and renders anywhere offline.

2. **Per-metric four-facet explanations as bold-label bullets, never wide tables (AC2).** **Given** a metric with a narrative explanation, **when** it renders, **then** its four facets render as **bold-label bullets** (`- **What it means** — …`) in the fixed order *Value · What it means · Strengths · Needs improvement · Suggestions* — **never a wide 2-column table** (which wraps badly in a narrow PR diff and defeats the format's whole reason to exist); a `not_available` metric still gets its `####` heading + bullets with the reason stated and the visual omitted; manager-facing content stays **team-level**, never per-developer ranking.

3. **Same facts as every format, diff-able, narrative-first, with the showpiece/substrate split (AC3).** **Given** the one Report JSON, **when** the document renders, **then** it presents the **same facts** as the other formats from the same `analysis` + `narrative` subtrees (joined by metric id), in the **narrative-first** spine (Summary → Explanation → Coaching → *then* Metrics, headings as the band order), reads cleanly in a `git diff` / narrow PR column (prose the spine, tables sparing, facets as bullets); the narrated **showpiece** requires the `narrative` subtree (Summary/Explanation/Coaching + per-metric facets render only when present), while a **substrate** render carries the `## Metrics` half in full from `analysis` with a **degraded** framing (a top-of-file banner blockquote + stub narrative headings, narration broke and *shouts*) distinct from an intentional **metrics-only** framing (no banner, a quiet footer note, calm by design) — neither can masquerade as the showpiece.

## Tasks / Subtasks

- [ ] **Task 1 — Markdown escaping helpers (AC1, AC3) [src/render/markdown/escape.ts] (new).**
  - [ ] `escapeCell(text): string` — for **structured/data** interpolations (metric titles, values, series labels = repo FILE PATHS, reasons, text-bar/Mermaid labels): collapse `\r\n`/tab runs to a single space + trim, then escape the structure-breaking + raw-HTML characters (`\` `` ` `` `*` `_` `|` `<` `>` `[` `]`) so a hostile file path or value can never break a table/diagram or inject raw HTML. Deterministic, pure.
  - [ ] `inlineProse(text): string` — for narrative text embedded in a **bullet/heading** (one line): collapse newlines/tabs to single spaces + trim (so one bullet stays one diff-able line). Does NOT emphasis-escape — narrative is meant to be Markdown prose (see the escaping-posture decision).

- [ ] **Task 2 — ASCII sparkline + text-bar primitives (AC1) [src/render/markdown/visuals.ts] (new).** Pure, deterministic text from a `SeriesPoint[]` (reuse `../html/shape.ts`):
  - [ ] `sparkline(series): string` — map values onto the eight block glyphs `▁▂▃▄▅▆▇█` by `(v−min)/(max−min)`; non-finite → guarded (treated as min); empty → `""`; all-equal/single point → a mid-level glyph per point (no divide-by-zero). The numeric value always also appears in prose (never glyph-only meaning — UX-DR14).
  - [ ] `textBars(series, opts?): string` — a **fenced** monospace text-bar block, one row per line `label  ████████░░  value` (bars from a fixed cell width, proportional to `v/max`, `max≤0`→all-empty), labels `escapeCell`'d + padded deterministically; the value printed numerically. The diff-able “small text-bar table”.

- [ ] **Task 3 — Mermaid group-overview + per-metric visual-by-shape (AC1, AC2) [src/render/markdown/visuals.ts].**
  - [ ] `mermaidLabel(text): string` — sanitize a label for a Mermaid token (collapse newlines, strip/replace `"` `[` `]` `,` that delimit `xychart` arrays, wrap in quotes when it has spaces). Numbers finite-guarded + rounded.
  - [ ] `mermaidXychart(series, title): string` — a ` ```mermaid ` ` xychart-beta` line/bar over a **timeseries** (x-axis sanitized labels, `bar`/`line` of rounded values). Empty → `""`.
  - [ ] `groupOverview(group, metrics): string` — pick the group's **representative chartable series** (first metric whose `detectShape` is `timeseries`|`distribution` — a lone scalar is NOT coerced into a degenerate chart, the 4.2 rule): a **timeseries** → `mermaidXychart` (Mermaid where it genuinely reads better — trends); a **distribution** → `textBars` (renders everywhere, diff-able — the “prefer text-bar where Mermaid is awkward” rule); none → a one-line `_No group-overview chart — see the metrics below._` note (never a chart alone — the group description caption is always present).
  - [ ] `metricVisualMarkdown(metric): { headingSuffix; body }` — by `detectShape`: **timeseries** → `` `<sparkline>` `` in the heading suffix; **distribution** → `textBars` block in the body; **scalar-range** → `**<value>/<max>**` heading suffix (`rangeField`); **scalar** → `**<number>**` heading suffix (the bold stat, no chart); **none / not_available** → no visual. Every non-scalar value still carries its numeric data via the Value bullet + the text-bar/sparkline.

- [ ] **Task 4 — The Markdown renderer (AC1, AC2, AC3) [src/render/markdown/markdown-renderer.ts] (new).** A pure `renderMarkdown(report): string` (typed template literals, no clock/I/O/random), routing the SAME two paths via `classifyReport`:
  - [ ] **Document spine:** `# commit-sage` title (repo/branch/provenance metadata deferred — not in Report JSON, see deferral) → confidence line → narrative bands → `## Metrics` (each group a `###` heading + one-line description + `groupOverview`, each metric a `####` heading carrying its health band glyph+label + visual + bullets).
  - [ ] **Showpiece** (`narrative` present): `## Summary` (blockquote headline + overview + key findings), `## Explanation` (paragraphs), `## Coaching` (intro → `###` themed chapters of numbered/bulleted prioritized steps → italic closing summary), then `## Metrics` with each computed metric's **four-facet bullets** from `narrative.explanations[id]` (joined by id). The confidence line carries the **word** `high|medium|low` (never a glyph — glyphs are reserved for health bands), with the low-confidence escalation named.
  - [ ] **Substrate** — `degraded`: a **banner blockquote as the first line of the file** (above the title) + the narrative headings kept as **stubs** (`## Summary` … `_Narrative unavailable — showing raw analysis._`), confidence shown as `—`, `## Metrics` in full from `analysis` with **no facet bullets**. `metrics-only`: **no banner**, **no stub headings** — just title + `## Metrics` (full) + one quiet footer note `_Narrative skipped (--no-ai) — run interactively or add a key for the full report._`. The degraded render shouts; the metrics-only render is calm — they must not read alike.
  - [ ] **Health band** per metric via the SHARED `classifyHealth` + `HEALTH_GLYPH`/`HEALTH_LABEL` (`../html/health.ts`) — shape glyph + word, never color (color never survives a diff). **Footer:** `---\nGenerated by commit-sage · schemaVersion 1.0.0` (provider/model/timestamp/tier/Buy-Me-a-Coffee deferred with the masthead provenance).
  - [ ] Reuse `classifyReport`/`ShowpieceReport`/`SubstrateFraming` (`../render.port.ts`) — same routing, no drift; the substrate input carries no `narrative` by type, so it can never render the four-facet bullets.

- [ ] **Task 5 — Tests (AC1, AC2, AC3).**
  - [ ] **`escape.test.ts`:** `escapeCell` neutralizes `|` `<` `` ` `` `*` `[` and collapses newlines (a hostile `<script>`/`a|b` file path cannot break a table or inject HTML); `inlineProse` collapses newlines but leaves emphasis intact.
  - [ ] **`visuals.test.ts`:** `sparkline` maps a rising series to ascending glyphs, empty → `""`, all-equal → a single mid glyph repeated (no `NaN`), one point safe; `textBars` emits one fenced row per point with escaped labels + the numeric value, `max≤0` safe; `mermaidXychart` emits a fenced `xychart-beta` with sanitized labels + rounded values, empty → `""`; `groupOverview` picks Mermaid for a timeseries group, text-bars for a distribution group, and a note (no chart, no crash) for an all-scalar group; `metricVisualMarkdown` picks sparkline/text-bars/`/max`/bold-stat/none by shape.
  - [ ] **`markdown-renderer.test.ts`:** a showpiece renders narrative-first (`## Summary` before `## Metrics`, indexOf order), the four facets as **bold-label bullets and NOT a `|`-table** (assert the facet labels appear as `- **…**` and the facet block contains no table pipe row), a Mermaid block + an ASCII sparkline + a text-bar are all present; a `not_available` metric keeps its heading + reason + `○ n/a` band with no visual; the health band shows **glyph + word** (not color); a **degraded** substrate has the top banner blockquote + stub narrative headings + `—` confidence + metrics-but-no-facets; a **metrics-only** substrate has NO banner, NO stub headings, the quiet footer note, and reads calm; the adversarial XSS/structure test — a metric value/label with `<script>`/`|`/`*` is escaped and breaks neither a table nor the document; determinism — two renders of the same Report are byte-identical.

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the pure `renderMarkdown(report): string`; the text-only visual system (ASCII sparklines, fenced text-bars, Mermaid `xychart-beta` group overviews) degrading the HTML visual-by-shape model; the four-facet **bullets-not-tables** per-metric explanations; the narrative-first spine; the showpiece / degraded-substrate / metrics-only-substrate split with the correct framing (banner+stubs vs quiet footer); the shared health-band glyph+word; the Markdown escaping helpers; all plain-text, offline, diff-able.

**Out of scope / deferred (do NOT build here):**
- **The CLI `--format markdown` dispatch + writing the `.md` file** — that is **Story 4.4** (multi-select output + file writing, default `./commit-sage-report.md`, `-`=stdout). 4.3 produces the pure string; the artifact is the returned string (the same render-port contract as `renderTerminal`/`renderHtml`). [Source: epics.md#Story 4.4]
- **Masthead/footer provenance + the cap line + the Free-tier Buy-Me-a-Coffee line** — the title metadata line (`<repo>` · `<branch>` · N commits · contributors · date), the `<tier> — 100 of N commits analyzed` cap line, the footer `<provider>/<model>` + `<timestamp>` + `v<version>`, and the BMaC link all need the Report-JSON **metadata subtree** (repo/branch/provider/timestamp/tier/version) that is **not yet in the schema** — deferred with the same masthead deferral carried by Stories 4.1 and 4.2. 4.3 renders `# commit-sage` + the schema-version footer; the provenance line is added when the schema gains the metadata. [Source: 4-1 / 4-2 deferrals]
- **HTML / JSON renderers + JSON output path** — Stories 4.1 (done) / 4.4. 4.3 is Markdown only. [Source: epics.md]
- **Exact per-group Mermaid forms for all six groups** (C `pie`, D `timeline`/`gitGraph`, F radar, the bus-factor marker on B) — 4.3 ships a **shape-driven** group overview (timeseries → `xychart-beta`, distribution → text-bars, the template's "Mermaid where it reads better, text-bar where awkward") which satisfies "text tables + sparklines + Mermaid" deterministically; the exact per-group diagram catalog is a later visual refinement behind the same `groupOverview`. [Source: TEMPLATE-MARKDOWN.md#Group-overview Mermaid mapping "prefer text-bar where awkward"]

### The authoritative composition spec (do not re-derive)

[Source: docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/TEMPLATE-MARKDOWN.md]

- **Governing constraints:** no binary/embedded images (text/ASCII/Mermaid only); **diff-able** (prose the spine, tables sparing, facets are **bullets not wide tables**); self-complete single file; **same facts** as every format from the one Report JSON (`analysis` → bands + visuals; `narrative` → Summary/Explanation/Coaching + `narrative.explanations[id]` four facets, joined by id); **all cards always shown** (the static-format degradation of HTML's progressive disclosure — a text doc cannot collapse, so calm is held by the narrative-first spine + prose-over-tables, not by hiding).
- **Skeleton:** `# commit-sage — <repo>` → confidence/cap line → `## Summary` (blockquote) → `## Explanation` → `## Coaching` (`###` themed chapters + italic closing) → `## Metrics` (`###` group + description + Mermaid/text-bar overview, `####` metric + band + inline visual + four-facet bullets) → footer.
- **Visual-by-shape (text degradation):** group overview → **Mermaid** (`xychart-beta`/`pie`/`timeline`) or text-bar; per-metric time-series → **ASCII sparkline** beside the heading; distribution → small **text-bar table**; scalar-in-range → sparkline + number or `7/10`; pure scalar → **bold stat** in the heading + Value bullet.
- **Facets — bullets, not tables (locked):** fixed order *Value · What it means · Strengths · Needs improvement · Suggestions*; **never a wide 2-column table** (the explicit implementer warning — it wraps in PR diffs and defeats the format). A `not_available` metric still gets the heading + bullets, reason under *What it means*, visual omitted.
- **Confidence is the WORD** (`high`/`medium`/`low`), never a glyph — the `●◐▲○` shapes are reserved for per-metric health bands so the two scales stay distinct; **color is never the signal** (it never survives a diff).
- **Showpiece vs substrate / degraded vs metrics-only:** the narrated showpiece is bound to `narrative` by construction; substrate renders the `## Metrics` half in full. **Degraded** = a banner blockquote as the **first line of the file** + narrative headings kept as **stubs** + facets absent + confidence `—` (it *broke* — shout); **metrics-only** = no banner, no stubs, a quiet footer note (it *chose* — calm). Don't let them read alike.

### Architecture decisions — reuse the shared render seams (read first)

- **Reuse `classifyReport` (`../render.port.ts`) — the SAME showpiece/substrate router as terminal + HTML.** Markdown adds no new routing; the substrate branch is typed without `narrative`, so the four-facet bullets are unreachable on the substrate path by construction (it can never masquerade as the showpiece). [Source: src/render/render.port.ts]
- **Reuse the render-owned `classifyHealth` + `HEALTH_GLYPH`/`HEALTH_LABEL` (`../html/health.ts`) and the value-shape `detectShape`/`extractSeries`/`rangeField`/`SeriesPoint` (`../html/shape.ts`).** These are render-shared domain logic (the §4.2 "single classifier, no drift across formats" principle is the whole reason Markdown must reuse — duplicating thresholds would create exactly the drift the decision forbids). They currently live under `render/html/`; importing them cross-format is correct (no cycle). A future refactor MAY hoist them to `render/` (shared), but that churns committed 4.2 files and is **deferred** — out of scope here. [Source: src/render/html/health.ts, src/render/html/shape.ts, prd.md#§4.2 decision-log (G)]
- **Provenance metadata is genuinely absent from the Report JSON** (`schemaVersion`, `degraded`, `analysis`, `narrative?` — no repo/branch/provider/timestamp/tier). The title + metadata line + footer provider/cap/BMaC therefore CANNOT be rendered faithfully and are deferred with the 4.1/4.2 masthead deferral — do not fabricate them. Render `# commit-sage` + the schema-version footer. [Source: src/assemble/report-schema.ts]

### Escaping posture (security — document + test)

- **Structured/data interpolations are fully escaped** via `escapeCell` — metric titles, values, **series labels (repo file paths)**, reasons, Mermaid/text-bar labels: newlines collapsed + `\` `` ` `` `*` `_` `|` `<` `>` `[` `]` escaped. This protects table/diagram structure AND neutralizes raw-HTML injection from repo-derived data into the shareable artifact (the 4.2 review's file-path-XSS concern, in the Markdown surface). An adversarial test asserts a `<script>` / `a|b` / `*x*` file path cannot break a table or inject HTML. [Source: securityRequirements, OWASP A03; 4.2 review]
- **Narrative prose renders as Markdown prose** (the format's contract — Summary/Explanation/Coaching + the four-facet text are *meant* to be readable Markdown). It is NOT emphasis-escaped; prose embedded in a bullet/heading has newlines collapsed (`inlineProse`) so one bullet stays one diff-able line. **Documented residual:** untrusted LLM prose relies on the grounding pass (3.4, already strips ungrounded/fabricated content) + the platform Markdown sanitizer (GitHub/GitLab strip `<script>`/`javascript:`/`onerror` in rendered MD) + the file being plain text the user reviews before sharing; the deterministic *data* path is fully escaped. This mirrors the terminal renderer (which passes narrative text straight through) and is the deliberate divergence from the HTML renderer (which escapes everything because a browser executes HTML immediately with no platform sanitizer). [Source: TEMPLATE-MARKDOWN.md#Governing constraints, src/render/terminal/terminal-renderer.ts]

### Determinism, purity & the render rules (unchanged)

- **Pure function of the Report JSON** — no clock/I/O/random/env; identical Report ⇒ byte-identical Markdown (sparkline/text-bar/Mermaid values rounded; key order from the byte-stable `analysis`). `render/` is `no-console` — the renderer never writes (the CLI shell writes the returned string in Story 4.4). [Source: architecture.md, eslint.config.js]
- **No new dependencies** — typed template literals + the shared shape/health modules only. [Source: architecture.md#I2 "Markdown via typed template literals"]
- **No-color-alone** — every health band is glyph **shape** + text **word**; confidence is the **word**; color is never emitted (it cannot survive a diff). [Source: epics.md#NFR-8, #UX-DR14, TEMPLATE-MARKDOWN.md]
- **Team-level only** — Group B / Group F / bus-factor content stays team-level, never per-developer ranking (the data already is — Markdown just renders it). [Source: epics.md#NFR-8]

### The exact contracts to build on (do NOT redefine)

- **`classifyReport` / `ShowpieceReport` / `RenderRoute` / `SubstrateFraming` (1.8):** the pure render-path router. [Source: src/render/render.port.ts]
- **`Report` / `ReportAnalysis` / `ReportNarrative` / `Metric` / `MetricExplanation` (1.7/3.2/3.5):** `metric = { id, group, title, status, value?, reason? }`; `narrative = { summary, explanation, coaching, explanations?, confidence? }`; `narrative.explanations[id] = { explanation, goodBehaviours, needsImprovement, suggestions }`; `confidence = { level, rationale, escalation? }`. [Source: src/assemble/report-schema.ts]
- **`detectShape` / `extractSeries` / `rangeField` / `SeriesPoint` (4.2):** value-shape detection + tolerant series extraction (bad shape ⇒ `[]`/`none`, never a crash). [Source: src/render/html/shape.ts]
- **`classifyHealth` / `HEALTH_GLYPH` / `HEALTH_LABEL` (4.2):** the render-owned band classifier + the shape glyphs `●◐▲○` + the words `ok/watch/risk/n/a`. [Source: src/render/html/health.ts]

### Previous-story intelligence

- **4.1/4.2 are the HTML expression of the same spine + visual-by-shape this format degrades to text.** Same narrative-first order, same `classifyReport` routing, same health bands, same shape detection — Markdown swaps SVG→sparkline/text-bar/Mermaid and escapes-for-Markdown instead of HTML. Reuse, don't re-derive. [Source: src/render/html/*]
- **The 4.2 "lone scalar ⇒ no degenerate chart" gate carries over:** `groupOverview` only charts a genuinely chartable (timeseries/distribution) representative series; a scalar-only group gets the note, not a 1-point diagram. [Source: 4-2 review]
- **Shape detection is tolerant (the 2.x "self-safe" lesson):** an unexpected value shape ⇒ no visual + the Value bullet, never a crash or `NaN` in a sparkline/bar/axis. [Source: 2.2 self-safe; 4.2 edge-case review]
- **Escaping discipline carries over (4.1/4.2):** the adversarial test must pass through the new text tables / Mermaid labels — escape series labels (file paths!) and any structured value. [Source: 4-1/4-2 reviews]

### References

- [Source: docs/planning-artifacts/epics.md#Story 4.3: Markdown renderer] (the ACs) · [Source: …#FR-7] (degrade visuals per format — Markdown) · [Source: …#FR-13] (render formats) · [Source: …#NFR-8] (team-level only) · [Source: …#UX-DR14] (accessibility floor / no-color-alone)
- [Source: docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/TEMPLATE-MARKDOWN.md] (the authoritative composition spec: skeleton, visual-by-shape, bullets-not-tables, confidence-is-a-word, degraded vs metrics-only)
- [Source: docs/planning-artifacts/architecture.md#I2] (Markdown via typed template literals; text tables + ASCII sparklines + Mermaid) · [Source: …#render is a pure function of JSON]
- [Source: src/render/render.port.ts] (classifyReport) · [Source: src/render/html/health.ts, src/render/html/shape.ts] (shared classifiers) · [Source: src/render/html/html-renderer.ts, src/render/terminal/terminal-renderer.ts] (the sibling renderers) · [Source: src/assemble/report-schema.ts] (`Report`/`Metric`)

## Dev Agent Record

### Completion Notes (Amelia)

Implemented as three new modules under `src/render/markdown/`, a pure `renderMarkdown(report): string` with zero new dependencies. 585 tests pass (+43 over 4.2); typecheck/lint/build all green; bundle 102.66 KB unchanged.

- **`escape.ts`** — two deliberate postures: `escapeCell` fully escapes STRUCTURED/data interpolations (titles, values, series labels = repo file paths, reasons, Mermaid/text-bar labels) — collapse whitespace, then `\` `` ` `` `*` `_` `|` `[` `]` backslash-escaped + `<`/`>` → entities (backslash first so later escapes aren't re-escaped); `inlineProse` only collapses newlines (one diff-able bullet line) and does NOT emphasis-escape narrative prose.
- **`visuals.ts`** — text-only visual primitives reusing `../html/shape.ts`: `sparkline` (8 block glyphs, span-0/empty/single-point/non-finite safe), `textBars` (fenced monospace `label ███░░ value`, escaped labels, `max≤0` safe), `mermaidLabel`/`mermaidXychart` (fenced `xychart-beta`, delimiter-sanitized labels, rounded values), `groupOverview` (timeseries → Mermaid, distribution → text-bars, all-scalar → a note — never a degenerate chart, the 4.2 gate), `metricVisualMarkdown` (by `detectShape`: sparkline / text-bar / `value/max` / bold stat / none).
- **`markdown-renderer.ts`** — routes via the shared `classifyReport`. Showpiece: `# commit-sage` → confidence (the WORD, never a glyph) → `## Summary` (blockquote) → `## Explanation` → `## Coaching` (`###` themed chapters + italic closing) → `## Metrics` (each group a `###` + description + overview, each metric a `####` + health band glyph+word + visual + bullets), four facets as **bold-label bullets, never a table**. Substrate: degraded = banner blockquote as the **first line of the file** + stub narrative headings + `—` confidence + no facets (shouts); metrics-only = no banner, no stubs, a quiet footer note (calm). Reuses `classifyHealth`/`HEALTH_GLYPH`/`HEALTH_LABEL`.

**Deferred (with the 4.1/4.2 masthead deferral):** the title metadata line (repo/branch/commits/date), the cap line, and the footer provider/model/timestamp/version/Buy-Me-a-Coffee — all need the Report-JSON **metadata subtree** not yet in the schema. The renderer emits `# commit-sage` + the schema-version footer; provenance is added when the schema gains the metadata. Also deferred: the CLI `--format markdown` dispatch + file writing (Story 4.4), and the exact per-group Mermaid catalog (C pie / D timeline / F radar) — 4.3 ships the shape-driven baseline.

### Review (3-layer adversarial) — UNANIMOUS clean, 0 patches

- **Acceptance Auditor — all 3 ACs MET, scope held, 0 must-fix.** Verified text-only visuals (sparkline/text-bar/Mermaid, no binary/data-URI/network) (AC1); four facets as bold-label bullets with NO facet table + not_available card with `○ n/a` band + reason + visual omitted (AC2); narrative-first spine via `classifyReport`, degraded (banner-first + stubs + `—` confidence + no facets) vs metrics-only (no banner, quiet footer) reading distinctly, confidence as the WORD, bands as shape glyph + word (AC3). Confirmed no new deps, no schema change, no out-of-scope work (no `--format` dispatch / HTML / JSON / provenance), pure + escaped + no-console, and correct reuse of the shared shape/health/route classifiers (no drift with HTML/Terminal).
- **Edge Case Hunter — 0 unhandled edge cases.** Walked escape (empty/whitespace/pipes/HTML/unicode), sparkline (empty/single/all-equal/all-zero/negative/NaN/Infinity, glyph-index bounds), textBars (`max≤0`, escaped labels, non-finite), Mermaid (delimiters/empty/non-finite), groupOverview/metricVisual (zero/all-na/lone-scalar/empty-series/null/array), and the renderer (schema-guaranteed `.min(1)` narrative arrays, empty facets → em-dash, missing explanation → Value-only, degraded vs metrics-only, zero metrics, single trailing newline). No `NaN`/`Infinity` can reach output; structure never breaks.
- **Blind Hunter — 0 defects (no Critical/High/Medium/Low).** Escaping applied at every data-path site; narrative-prose-unescaped is the documented design; determinism (rounded, no clock/random/Set/Map), math (span-0/single-point/`max≤0`/glyph-clamp), structure (fences/pipes/newlines), and lint/style (named exports, no-console, `.js` specifiers, `import type`, `String.raw`) all clean.

**Patches applied:** 0. **Tests added:** 0 (the 43 co-located tests already cover the boundaries the hunters enumerated). All gates green (585 tests).

### File List

- `src/render/markdown/escape.ts` (new) · `src/render/markdown/escape.test.ts` (new)
- `src/render/markdown/visuals.ts` (new) · `src/render/markdown/visuals.test.ts` (new)
- `src/render/markdown/markdown-renderer.ts` (new) · `src/render/markdown/markdown-renderer.test.ts` (new)
