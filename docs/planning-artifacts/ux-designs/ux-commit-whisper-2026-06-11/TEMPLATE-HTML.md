---
title: commit-whisper TEMPLATE-HTML
status: draft
created: 2026-06-12
updated: 2026-06-13
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
- Architecture I1 — Chart.js 4.5.1 (animations off) + mandatory accessible data-table fallback, typed template literals, self-contained inlining.

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
- **No-JS degradation.** Every chart (group-level and per-metric) has an accessible data
  table as its fallback. With JS enabled the table is a collapsed disclosure beneath the
  chart; with JS disabled the canvas is absent and the **table renders open by default**, so
  no data is ever lost.
- **Color scheme without script.** Dark-first, honoring `prefers-color-scheme` via inlined
  CSS media queries (DESIGN.md ships both palettes). No manual toggle (a toggle would need
  JS and weaken the no-JS guarantee).
- **Reduced motion.** Chart animations are disabled (architecture I1); nothing essential
  depends on motion.

File-weight discipline (the cost of "both")
-------------------------------------------

Because the report carries a group-overview chart **and** per-metric visuals, weight is
managed deliberately:

- **Right-size every per-metric visual by shape** (see table below) — most metrics get a
  lightweight inline **sparkline or bold stat**, not a full canvas. Only genuinely
  distributional/time-series metrics get a full chart.
- **One charting runtime, inlined once**, shared by every chart instance — never duplicated
  per chart.
- A pure-scalar metric (e.g. bus factor, project age) renders as a **bold number with no
  chart at all**, by design.
- **Budget the self-contained file to ≤~1 MB**, flagging anything approaching 2 MB. The
  mandatory accessibility data-table fallback effectively **doubles the data payload** (every
  chart's series is serialized a second time as a table), so the shape-based right-sizing
  above plus a hard cap on live canvas instances (group overviews and genuinely
  distributional/time-series metrics only — everything else is inline SVG/stat) are what keep
  the file lean.

Progressive disclosure (calm at scale)
--------------------------------------

Thirty per-metric cards plus six group charts is calm in *palette* but not automatically calm
in *volume*. Progressive disclosure keeps attention on what matters:

- **`risk` and `watch` cards are expanded by default** — the reader sees the full four-facet
  explanation for everything that needs attention, with no click.
- **`ok` cards collapse to a one-line summary** (title · status · value · its visual) and
  expand on demand, so the healthy majority stays present but quiet.
- **No-JS degradation:** with JavaScript disabled, *every* card renders fully expanded
  (collapsing needs JS), so nothing is ever hidden behind a control that can't be operated.

This protects the "calm" promise at ~30 metrics and focuses the eye on the few cards that
carry the story's tension.

Page skeleton (seven bands)
---------------------------

```
① MASTHEAD        commit-whisper · <repo> · <branch> · <N> commits · <contributors>
                  Confidence: high   ·   <tier> (Free: "100 of N analyzed")
② TL;DR           AI Narrative — Summary. The ten-second story.
③ TOC             Summary · Explanation · Coaching · A B C D E F   (sticky on wide screens)
④ EXPLANATION     AI Narrative — plain-language interpretation.
⑤ COACHING        AI Narrative — intro → themed prioritized chapters → closing summary.
⑥ METRIC GROUPS   A–F: each = heading → group overview chart → per-metric cards.
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

Each group: a heading + one-line description, the **group overview chart** (its locked
signature type), then one **metric card per metric**, each card carrying its own
right-sized visual.

```
  ══ B · Contribution & Ownership ════════════════════════════════
  How the work is distributed across the team.

  ┌─ chart-panel · group overview ───────────────────────────┐
  │   [ Pareto bar + bus-factor marker ]                      │
  │   ▸ Show data table                                       │
  └────────────────────────────────────────────────────────────┘

  ┌─ metric-card ────────────────────────────────────────────┐
  │  Contribution distribution                         ● ok   │
  │  ┌ visual ─────────────┐                                  │
  │  │ [ bar / histogram ] │   top 3 authors = 68% of commits │
  │  └─────────────────────┘                                  │
  │  What it means      Commits cluster on a few authors…     │
  │  Strengths          Clear primary maintainers…            │
  │  Needs improvement  Review load is concentrated…          │
  │  Suggestions        Rotate review duty; pair on…          │
  │  ▸ Show data table                                        │
  └────────────────────────────────────────────────────────────┘

  ┌─ metric-card ────────────────────────────────────────────┐
  │  Bus factor                                        ▲ risk │
  │  ◼ 2          (pure scalar — bold stat, no chart)         │
  │  What it means      Two people hold most knowledge…       │
  │  Strengths          —                                     │
  │  Needs improvement  Knowledge concentration is a risk…    │
  │  Suggestions        Document the auth module; pair…       │
  └────────────────────────────────────────────────────────────┘

  … one card per metric in the group …
```

**Group overview charts** keep their locked DESIGN.md signatures:

| Group | Overview chart |
| --- | --- |
| A — Activity & Cadence | Multi-series line (commits & churn over time) |
| B — Contribution & Ownership | Pareto bar + bus-factor marker |
| C — Commit Message Quality | Stacked bar of message-quality categories |
| D — Branching & Merge Structure | Branch/merge timeline + merge-density bars |
| E — Code Churn & Hotspots | Horizontal bar (hotspots) + churn trend line |
| F — Repository Health Signals | Radar of component scores + overall-score gauge |

### Per-metric visual — by shape

Every metric card gets a visual *sized to the metric's shape*, so the report is rich without
30 heavy canvases:

| Metric shape | Per-metric visual | Examples |
| --- | --- | --- |
| Time-series | small line / area chart | commit volume over time, churn over time |
| Distribution | small bar / histogram | commit-size distribution, message-length distribution, contribution share |
| Scalar within a healthy range | sparkline or mini-gauge + the number | hygiene score, Conventional-Commits %, add/delete ratio |
| Pure scalar | bold stat, **no chart** | bus factor, project age, contributor count |

### Metric card — uniform skeleton

- **Always the same four facets, in the same order:** *What it means · Strengths · Needs
  improvement · Suggestions* (FR-8). The reader learns the shape once and skims every card.
- A status dot whose **shape carries the signal — not color**: `●` ok, `◐` watch, `▲` risk,
  greyed `○` n/a — always with its text label alongside. The band is **derived at render**
  from the metric's status/value against the thresholds owned by PRD §4.2 (the metric
  catalog); it is not stored in the Report JSON.
- **Default disclosure by status:** `risk` and `watch` cards render expanded; `ok` cards
  collapse to a one-line summary the reader can expand (with JS off, all cards are expanded).
- A **`not_available`** metric still renders a card — greyed, with its visual omitted and
  only the "why" shown in *What it means* (FR-8 covers the full catalog, no silent gaps).
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

1. **Per-metric visuals are NEW and revise FR-6.** FR-6 locks *one chart per group* (six
   charts). This template keeps those six **group overview charts** *and adds* a right-sized
   per-metric visual to every metric card (~24–30 additional visuals, mostly lightweight
   sparklines/stats). → John (FR-6, FR-13), Winston (architecture I1 — Chart.js inlining,
   self-contained file-weight), DESIGN.md (extend the chart-mapping table with the
   per-metric visual-by-shape model).
2. **File-weight risk on the self-contained guarantee.** "Both" (group + per-metric) is the
   heaviest option for a single inlined file; the shape-based right-sizing is the mitigation,
   but Winston should confirm it against the self-contained/offline NFR and the SEA-binary
   asset story. → Winston.
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
