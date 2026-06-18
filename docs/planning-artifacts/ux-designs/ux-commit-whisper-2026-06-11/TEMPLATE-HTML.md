---
title: commit-whisper TEMPLATE-HTML
status: draft
created: 2026-06-12
updated: 2026-06-18
---

commit-whisper TEMPLATE-HTML
=========================

The **composition** spec for the self-contained HTML report — the richest rendered
surface. EXPERIENCE.md and DESIGN.md give the rules and visual language; this document
specifies the *page structure*: band order, the per-group and per-metric layout, the
visual-by-shape model, and the accessibility/self-containment guarantees. Epic 4 (Rich
Rendered Reports) implements to this spec.

Wireframes are illustrative structure, not literal markup.

Sources
-------

- PRD FR-6 (charts per group), FR-7 (degrade per format), FR-8 (narrative + per-metric explanations), FR-12 (Report JSON), FR-13 (render formats).
- DESIGN.md — color tokens, IBM Plex type scale, spacing rhythm, component names (`report-surface`, `metric-card`, `chart-panel`), chart-per-group mapping.
- EXPERIENCE.md — Component Patterns (Metric section, Chart block, Coaching report), Accessibility Floor, HTML navigation.
- Architecture I1 + ADRs H1–H4 (2026-06-18) — a pure **inline-SVG** chart engine (NOT Chart.js) with real axes + mandatory accessible data-table fallback, typed template literals, self-contained inlining, and an inlined Inter web font.

Governing intent
----------------

Read like a good technical brief, **top-down: story first, evidence second.** A busy reader
gets the payoff in ten seconds (masthead + TL;DR); a curious reader scrolls into the
narrative; an analyst drills into the metric groups. The report is calm, data-dense, and
self-contained — never a flashy dashboard.

**Non-negotiable for implementers:** the AI narrative (Summary → Explanation → Coaching)
always renders **before** the metric groups. The band order below is the contract — never
hoist metrics or charts above the narrative.

Report JSON provenance (analysis vs narrative)
----------------------------------------------

Every figure on the page traces to the one canonical Report JSON, which carries two subtrees:
a deterministic **`analysis`** subtree (every metric's value and status — no AI) and an AI
**`narrative`** subtree (`summary`, `explanation`, `coaching`, and per-metric explanations
keyed by metric id). The narrative bands (②④⑤) render `narrative.summary` /
`narrative.explanation` / `narrative.coaching`; each metric card draws its **value and status
from `analysis`** and its **four-facet explanation from `narrative.explanations[<metricId>]`**,
joined by metric id. The deterministic trend-diff targets `analysis` only — the narrative
varies run to run, the analysis does not. When the `narrative` subtree is absent — a fail-open
degrade (something broke) or an intentional `--no-ai` metrics-only run (nothing broke) — the
page renders the `analysis` substrate only; see "Showpiece vs substrate" and "Degraded render"
below.

Self-containment & no-JS (hard guarantees)
------------------------------------------

- **Single file, no network.** All CSS, fonts, scripts, and chart code are inlined; opening
  the file in a browser requires no CDN, server, or companion assets.
- **No-JS degradation.** Charts are inline SVG (ADR H1), so they render with no JS at all; each
  group-overview chart still carries an accessible data table as its fallback. With JS the table
  is a collapsed disclosure beneath the chart; with JS disabled the **table renders open by
  default**, so screen-reader and no-JS readers never lose the data.
- **Color scheme without script.** Dark-first, honoring `prefers-color-scheme` via inlined
  CSS media queries (DESIGN.md ships both palettes). No manual toggle (a toggle would need
  JS and weaken the no-JS guarantee).
- **Reduced motion.** Charts are static inline SVG with no animation (ADR H1); nothing essential
  depends on motion. A `prefers-reduced-motion` query also disables UI transitions.

File-weight discipline (the cost of "both")
-------------------------------------------

Because the report inlines its charts and an Inter web font, weight is managed deliberately:

- **Charts live in the group overview only** (two per group — a primary + a secondary). Metric
  cards no longer embed a chart; each card shows a **headline stat** + its explanation, so the
  page is not 30 canvases (ADR H4).
- **Zero charting runtime.** Charts are pure inline SVG strings (ADR H1) — there is no Chart.js
  (or any) library to inline; each chart is just markup.
- A pure-scalar metric (e.g. bus factor, project age) renders as a **bold stat with no chart**,
  by design.
- **Inlined Inter font (~130 KB)** — the Inter latin subset (weights 400/600/700/800) ships as
  base64 woff2 `data:` URIs (ADR H3). This is the single largest payload; it is isolated in one
  module and is revertible to a system-font stack if the budget tightens.
- **Budget the self-contained file to ≤~1 MB**, flagging anything approaching 2 MB. The mandatory
  accessibility data-table fallback serializes each chart's series a second time as a table; with
  charts confined to the group overviews and the font as the main fixed cost, a full report
  sample lands ~210–225 KB — comfortably inside budget.

Progressive disclosure (calm at scale)
--------------------------------------

Every metric card is a native `<details>` disclosure. Per ADR H4, the default posture changed
from "collapse the healthy majority" to **all cards expanded by default**:

- **All cards render expanded by default** — the reader sees every card's headline stat and its
  four-facet explanation with no click. `risk` / `watch` cards still carry a coloured left edge
  so the eye is drawn to them.
- **The reader can collapse any card manually** (it is a `<details>`), per-card — useful for
  muting the healthy cards once they have been read.
- **No-JS degradation:** with JavaScript disabled nothing changes — every card is already
  `<details open>`. The only inline script tucks each chart's data-table behind its "Show data
  table" toggle; with JS off those tables render open too, so no data is ever lost.

This trades the earlier auto-collapse for predictability — nothing is hidden on load — while
keeping manual collapse for readers who want to quiet the healthy cards.

Page skeleton (seven bands)
---------------------------

```
① MASTHEAD        commit-whisper · <repo> · <branch> · <N> commits · <contributors>
                  Confidence: high   ·   <tier> (Free: "100 of N analyzed")
② TL;DR           AI Narrative — Summary. The ten-second story.
③ TOC             Summary · Explanation · Coaching · A B C D E F   (sticky on wide screens)
④ EXPLANATION     AI Narrative — plain-language interpretation.
⑤ COACHING        AI Narrative — intro → themed prioritized chapters → closing summary.
⑥ METRIC GROUPS   A–F: each = heading → two-chart group overview → stat cards (one per metric).
⑦ FOOTER          Generated by commit-whisper vX · schemaVersion 1.0.0 ·
                  provider/model · timestamp · Buy Me a Coffee (Free tier only).
```

**Band order is deliberate: narrative (②④⑤) precedes metrics (⑥)** — story before evidence.
Every band has a stable `id` anchor; the TOC and browser search jump to them.

### ① Masthead

```
  commit-whisper · payments-api
  main · 1,204 commits · 87 contributors · analyzed 2026-06-12

  [ Confidence: high ]      Free tier · 100 of 1,204 commits analyzed
```

- Confidence pill: `Confidence: high` / `medium` / `low` — **the word is the signal**, always
  shown and never carried by color alone. It deliberately does **not** use the health-band
  shapes, so the `●◐▲○` vocabulary stays reserved for metric health and the two scales never
  visually rhyme. On `low`, the pill links to the Coaching/Explanation note naming the
  escalation (which provider/config to change).
- The Free-tier cap line appears only on Free runs and states `100 of N`.

### ⑥ Metric group — the repeating unit

Each group: a heading (with a `Group X` kicker) + one-line description, a **two-chart group
overview** (a primary chart + a secondary gauge/doughnut/series, ADR H2), then one **stat card
per metric** in a responsive, equal-height grid. The cards no longer embed a chart — the visuals
live in the overview; each card carries a headline stat + its four-facet explanation.

```
  ══ B · Contribution & Ownership ════════════════════════════════
  How the work is distributed across the team.

  ┌─ chart-panel · group overview (two charts) ──────────────┐
  │  Ownership spread by area     Contribution concentration  │
  │  [ doughnut + legend ]        [ radial gauge · 41% ]       │
  │  ▸ Show data table            ▸ Show data table           │
  └────────────────────────────────────────────────────────────┘

  ┌─ cards · responsive grid, equal height, expanded by default ─┐
  │ ┌ metric-card ───────────────┐ ┌ metric-card ────────────┐  │
  │ │ Contribution concentration │ │ Bus factor              │  │
  │ │                 ● ok   41% │ │              ● ok    3  │  │
  │ │ What it means   …          │ │ What it means   …       │  │
  │ │ Strengths       …          │ │ Strengths       …       │  │
  │ │ Needs improvement …        │ │ Needs improvement …     │  │
  │ │ Suggestions     …          │ │ Suggestions     …       │  │
  │ └────────────────────────────┘ └─────────────────────────┘  │
  └────────────────────────────────────────────────────────────┘

  (Card summary = title · health band · headline stat; the four facets sit in the
   body, expanded by default; the reader can collapse any card. Bus factor is a
   stat card with a health band — the old Pareto bus-factor marker, promoted.)


  … one card per metric in the group …
```

**Group overview — two charts per group (ADR H2).** Each group renders a **primary** chart plus a
**secondary** chart (a radial gauge for a 0–100 share/score, a doughnut for a composition, or a
second series), chosen from the group's metrics by value-shape:

| Group | Primary chart | Secondary chart |
| --- | --- | --- |
| A — Activity & Cadence | Commit-volume line | Weekly-cadence bars |
| B — Contribution & Ownership | Ownership **doughnut** (by area) | Contribution-concentration gauge |
| C — Commit Message Quality | Message-category bars | Conventional-Commits adherence gauge |
| D — Branching & Merge Structure | Merge-cadence line | Direct-to-default gauge |
| E — Code Churn & Hotspots | Hotspots horizontal bars | Churn-trend line |
| F — Repository Health Signals | Component-score radar | Overall hygiene-score gauge |

**Group B's bus-factor signal moved (resolving the open question).** The locked spec drew a
*bus-factor marker* on the Pareto bar; Group B's primary is now an ownership **doughnut**, which
has no bar to mark. The bus-factor signal is therefore promoted to a **first-class stat card**
(`Bus factor · ● ok · 3`) with its own shape-differentiated health band — clearer than a chart
annotation, and consistent with Group F's `Knowledge-concentration risk` gauge. No signal is
lost; it simply reads as a card, not an overlay.

### Metric card headline — by shape

Charts live in the **group overview**, not in the cards (ADR H4). Each card instead shows a single
**headline stat** derived from the metric's value, so the eye gets the number first and the
explanation on read:

| Metric shape | Card headline | Examples |
| --- | --- | --- |
| Scalar within a healthy range | the number, with `%` for a share/score | adherence 82%, hygiene 81%, direct-to-default 34% |
| Pure scalar | the bold number | bus factor 3, active days 214 |
| Single-field object | the primary field (`total` / `score` / `busFactor` / count) | commit volume 765 |
| Distribution / time-series | **no headline stat** — the data is in the group overview chart | message categories, ownership spread, churn trend |

A metric with no clean scalar simply shows title + health band + its four-facet explanation; its
shape is carried by the group overview chart above the cards.

### Metric card — uniform skeleton

- **Always the same four facets, in the same order:** *What it means · Strengths · Needs
  improvement · Suggestions* (FR-8). The reader learns the shape once and skims every card.
- A status dot whose **shape carries the signal — not color**: `●` ok, `◐` watch, `▲` risk,
  greyed `○` n/a — always with its text label alongside. The band is **derived at render**
  from the metric's status/value against the thresholds owned by PRD §4.2 (the metric
  catalog); it is not stored in the Report JSON.
- **Disclosure:** every card is a `<details>` rendered **expanded by default** (ADR H4); the
  reader may collapse any card manually. `risk` / `watch` cards carry a coloured left edge to
  draw the eye. With JS off nothing changes — all cards are already open.
- A **`not_available`** metric still renders a card — greyed (`○ n/a`), with no headline stat and
  the "why" shown as the reason + in *What it means* (FR-8 covers the full catalog, no silent gaps).
- Manager-facing framing stays **team-level**, never per-developer ranking (Group F especially).

### ⑤ Coaching report

Rendered as a structured report, not a flat list: an **introduction**, one or more **themed
chapters** of prioritized steps, and a **closing summary** of top priorities (FR-8). Each
chapter heading gets an anchor so the TOC can reach it.

### ⑦ Footer

`Generated by commit-whisper v<version> · schemaVersion 1.0.0 · <provider>/<model> ·
<timestamp>`. The **Buy Me a Coffee** link appears **only on the Free tier**, visible but
unobtrusive.

Showpiece vs substrate (the hero requires the narrative subtree)
----------------------------------------------------------------

The full narrated report is the **showpiece**, and it is bound to the `narrative` subtree **by
construction**: bands ② TL;DR, ④ Explanation, ⑤ Coaching, the per-metric four-facet
explanations, and the ten-second hero story render *only* when `narrative` is present. Strip the
narrative and what remains is the **substrate** — a plainer, honest, functional layout that
**cannot masquerade as the showpiece**:

- **Still renders (from `analysis`):** the masthead ①, the TOC ③ (its narrative anchors
  dropped), and every metric group ⑥ — group overview charts, per-metric visuals, the metric
  values, and the shape-derived health bands (`●◐▲○`). The evidence layer stays fully intact.
- **Does not render (needs `narrative`):** the TL;DR Summary ②, Explanation ④, Coaching ⑤, the
  per-metric four-facet explanations, and the hero insight. Their absence is shown, never
  papered over.

The substrate is reached two ways — a **fail-open degrade** (something broke) or an intentional
**`--no-ai` metrics-only** run (nothing broke). Same layout, opposite framing (below). In
neither case may the page restyle itself to imitate the narrated hero: the showpiece is earned
by having a narrative, not faked by a richer-looking substrate.

Degraded render (narrative unavailable)
---------------------------------------

When narration, grounding, or the provider fails *after* the metrics are computed, the report
**fails open** to the substrate — but it must arrive **visibly wounded**, never as a clean
success. A prominent degrade banner sits at the very top of the page, above even the masthead:

```
  ┌───────────────────────────────────────────────────┐
  │ ⚠  Narrative unavailable — showing raw analysis           │
  │    The AI narration step failed; your metrics are intact. │
  │    → retry · check the provider · switch it in Settings    │
  └───────────────────────────────────────────────────┘

  commit-whisper · payments-api                 (masthead — no Confidence pill)
  main · 1,204 commits · 87 contributors · analyzed 2026-06-12

  Summary       — narrative unavailable —    (narrative bands greyed / omitted)
  Explanation   — narrative unavailable —
  Coaching      — narrative unavailable —

  ══ A · Activity & Cadence ════  … every metric group renders in full …
```

- The **banner** uses the `warning` / `danger` register (DESIGN.md) and deliberately breaks the
  report's calm. It carries one actionable line and is the first thing both a sighted reader and
  a screen reader meet.
- The **narrative bands ②④⑤ are omitted or rendered as greyed placeholders** that name the gap
  (`— narrative unavailable —`), and the per-metric **four-facet explanations are absent**: each
  card keeps its value, visual, and health band, but the explanation body is gone. The page must
  read as *something is missing*.
- The **Confidence pill is dropped** — there is no narrative to be confident about. The masthead,
  the group TOC anchors, and all of band ⑥ render normally from `analysis`.
- The run exits on a **distinct degraded exit code (see architecture exit-code enum)** so a
  watching script can tell a wounded run from a clean one.

**Degraded vs metrics-only — do not blur them.** A degraded render *broke* → loud banner, greyed
narrative bands, wounded, distinct exit code. An intentional **`--no-ai` metrics-only** render
*did not break* → the **same substrate, no banner**: just a single quiet footer nudge —
`Narrative skipped (--no-ai) · run interactively or add a key for the full report` — and a clean
exit `0`. Identical skeleton, opposite register: one is an alarm, the other a footnote.

Navigation & accessibility
--------------------------

- Sticky TOC (wide screens) + in-page anchors for Summary, Explanation, Coaching (and each
  chapter), and each Metric Group; works with native browser search (FR-13, EXPERIENCE).
- WCAG 2.2 AA contrast and full keyboard navigation; headings and anchors keyboard-reachable.
- Every chart (group + per-metric) is paired with text and a data-table fallback; charts
  never stand alone. Screen-reader users get the table; low-vision users get the narrative.
- Copyable paths/links are plain text, never hover-only.
- Single reading column for the narrative at a comfortable measure; charts and side metadata
  may widen on large screens (DESIGN.md layout).

Open deltas (flagged for PRD / architecture reconciliation)
-----------------------------------------------------------

1. **Charts revise FR-6 — now TWO per group, none per card (ADR H2/H4).** FR-6 locks *one chart
   per group* (six charts). This template now renders **two charts per group** (a primary + a
   secondary gauge/doughnut/series) — twelve overview charts — and **no per-metric charts** (each
   card is a stat + explanation). → John (FR-6, FR-13), Winston (ADR H1–H4 recorded), DESIGN.md
   (update the chart-mapping table to the primary/secondary model + the Group B doughnut).
2. **File-weight: the inlined Inter font is now the main cost (ADR H3).** With charts confined to
   the group overviews and zero charting runtime, the ~130 KB inlined font is the largest fixed
   payload (sample ~210–225 KB, under the ~1 MB budget). Confirm against the self-contained/offline
   NFR and the SEA-binary asset story; the font is isolated and revertible/flag-gateable. Note the
   implemented font is **Inter**, not DESIGN.md's IBM Plex — reconcile in DESIGN.md. → Winston, Sally.
3. **Status dots / health bands** are **shape-differentiated** (`●` ok / `◐` watch / `▲` risk
   / greyed `○` n/a, never color alone) and are a *derived presentational layer* over the
   `analysis` subtree's per-metric envelope `{id,group,title,status,value?,reason?}`: the band
   is computed in the renderer from the metric's status/value against the thresholds owned by
   PRD §4.2, not stored in the Report JSON. (The four-facet explanation it sits beside comes
   from `narrative.explanations[<metricId>]`, joined by id.) → Winston (render/health-band.ts;
   envelope unchanged).
4. **Degraded / substrate render is NEW** — the UX face of the locked fail-open + metrics-only
   decision. The full showpiece requires the `narrative` subtree; when it is absent the page
   renders the `analysis` substrate (a loud banner for a fail-open degrade, a quiet nudge for an
   intentional `--no-ai` run). The **distinct degraded exit code** is owned by the architecture
   exit-code enum, not invented here. → Winston (fail-open render path + degraded exit code),
   John (PRD FR-11 fail-open / metrics-only-for-CI).
