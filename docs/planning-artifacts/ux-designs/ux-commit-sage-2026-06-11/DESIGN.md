---
title: commit-sage DESIGN
status: draft
created: 2026-06-11
updated: 2026-06-11
---

name: commit-sage
description: Terminal-first git-history analysis that renders a canonical JSON into HTML, Markdown, and terminal reports.
colors:
  surface-base: '#0B0D10'
  surface-raised: '#12161C'
  surface-overlay: '#171C24'
  surface-muted: '#1C222C'
  ink-primary: '#F4F1E8'
  ink-secondary: '#B8B1A6'
  ink-disabled: '#756F66'
  accent: '#D4A24C'
  accent-soft: '#8B6A2A'
  border-hairline: '#232A35'
  success: '#6DBA84'
  warning: '#D4A24C'
  danger: '#E36B5D'
  surface-base-light: '#F5F1E8'
  surface-raised-light: '#FFFFFF'
  surface-overlay-light: '#F1ECE2'
  surface-muted-light: '#E8E2D8'
  ink-primary-light: '#15181D'
  ink-secondary-light: '#665F56'
  ink-disabled-light: '#9B948B'
  accent-light: '#8A6423'
  accent-soft-light: '#A98242'
  border-hairline-light: '#D9D1C5'
typography:
  display:
    fontFamily: 'IBM Plex Sans'
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: -0.02em
  body:
    fontFamily: 'IBM Plex Sans'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.55'
    letterSpacing: 0em
  mono:
    fontFamily: 'IBM Plex Mono'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  meta:
    fontFamily: 'IBM Plex Mono'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.04em
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
components:
  terminal-shell:
    background: '{colors.surface-base}'
    foreground: '{colors.ink-primary}'
    border: '{colors.border-hairline}'
    radius: '{rounded.md}'
  report-surface:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    border: '{colors.border-hairline}'
    radius: '{rounded.lg}'
  metric-card:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-primary}'
    border: '{colors.border-hairline}'
    radius: '{rounded.md}'
  chart-panel:
    background: '{colors.surface-muted}'
    foreground: '{colors.ink-primary}'
    border: '{colors.border-hairline}'
    radius: '{rounded.md}'
  command-chip:
    background: '{colors.surface-muted}'
    foreground: '{colors.accent}'
    border: '{colors.border-hairline}'
    radius: '{rounded.full}'
  status-pill:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-secondary}'
    border: '{colors.border-hairline}'
    radius: '{rounded.full}'
---

commit-sage DESIGN

Terminal-first git-history analysis that explains and coaches from a repository's own commit history.

| Field | Value |
| --- | --- |
| Name | commit-sage |
| Tagline | "I know what you did last commit." |
| Primary surface | Terminal |
| Canonical artifact | Report JSON |
| Rendered outputs | HTML (self-contained), Markdown, Terminal — all derived from Report JSON |
| HTML report | Opened in a browser when HTML output is selected |
| Design posture | Calm, analytical, evidence-first; team-level health, never per-developer ranking |

Brand & Style
-------------

commit-sage is a terminal-native analyst that turns long git history into a narrated, coaching report. It should feel like a knowledgeable peer who has read the entire history and wants to help — calm under pressure, precise about evidence, encouraging rather than judgmental, and never theatrical. Its tagline, *"I know what you did last commit,"* is knowing and a little playful, but the product is always grounded in the repository's own data. The interface is not trying to entertain; it is trying to explain.

The product is terminal-first. Report JSON is the canonical artifact, and HTML, Markdown, and terminal are the rendered outputs generated from it — they never disagree because they derive from the same JSON. The HTML report is the richest visual surface and can open in a browser when HTML output is selected; it is not a standalone web app, and there is no hosted dashboard or central portal.

Manager-facing output is framed as team-level health, risk, and improvement — never per-developer ranking or surveillance. This is a load-bearing constraint, not a stylistic preference.

The visual language is dark-first and high-contrast by default. Use warm neutral surfaces, restrained amber for emphasis, and very little chrome. The rendered report should feel like a good technical brief: readable, data-dense, and easy to scan.

Colors
------

The palette is intentionally quiet so the metrics and narrative remain the focus.

- **Surface Base (`#0B0D10`)** is the terminal canvas and primary dark-mode background. It should feel like a stable command-line workspace rather than a flashy dashboard.
- **Surface Raised (`#12161C`)** and **Surface Overlay (`#171C24`)** create subtle layering for report sections, cards, and code-like blocks.
- **Ink Primary (`#F4F1E8`)** is the default text color in dark mode. It is slightly warm to reduce the harshness of pure white on black.
- **Ink Secondary (`#B8B1A6`)** supports labels, metadata, and secondary narrative.
- **Accent (`#D4A24C`)** is reserved for highlighted metrics, active state, and actionable emphasis. It should never become decoration.
- **Success (`#6DBA84`)**, **Warning (`#D4A24C`)**, and **Danger (`#E36B5D`)** are status colors used sparingly for confidence, caution, and failure states.
- **Light-mode tokens** exist so the browser companion report can remain readable in environments that prefer light UIs, but the dark palette is the default posture.

Avoid: rainbow charts, neon highlights, decorative gradients, and color as the only carrier of meaning.

Typography
----------

Typography should communicate hierarchy fast.

- **Display** is used for report titles, narrative section headers, and key flow climaxes. It should be strong but not dramatic.
- **Body** is the default prose voice for explanation and coaching.
- **Mono** is used for command examples, paths, flags, metrics, and terminal output so code-like information is visually distinct.
- **Meta** is for timestamps, provenance, confidence labels, and artifact paths.

The browser companion report should mix prose and mono rhythmically: section headers in `display`, narrative in `body`, metric values and file paths in `mono`, and supporting labels in `meta`.

Layout & Spacing
----------------

The terminal experience is one-column and line-oriented. It should prioritize clarity over density: phase lines, succinct status blocks, then a compact summary of what happened and where the outputs were saved. Terminal output can also render the full report as compact textual summaries and sparklines, not only progress.

The HTML report should be optimized for a single reading column with occasional data panels. On wide screens, it can expand charts and side metadata, but the main narrative should stay readable at a comfortable measure. HTML is a self-contained single file: it opens in a browser with no external network, CDN, or companion asset files.

Each rendered output suits its medium: HTML carries full charts; Markdown uses text tables, sparklines, and Mermaid diagrams with no embedded binary images so it stays diff-able in a pull request; terminal uses compact textual summaries and sparklines.

Spacing follows a deliberate rhythm: 4 / 8 / 12 / 16 / 24 / 32 px. Use the larger steps to separate major sections like Summary, Explanation, and Coaching. Use the smaller steps inside metric rows and chart legends.

Elevation & Depth
-----------------

Depth should come from tonal contrast, not heavy shadow. The terminal shell uses clear borders and panel boundaries; the browser report uses softly layered surfaces and minimal shadow.

Avoid dramatic drop shadows, floating cards that compete with the content, and UI chrome that makes the product feel like a social dashboard.

Shapes
------

Corners should be softly technical rather than playful.

- `rounded/sm` for chips, inline indicators, and small terminal badges.
- `rounded/md` for metric cards, progress blocks, and callouts.
- `rounded/lg` for the browser report sections and larger panels.

No pill-heavy aesthetic. The product should read as a tool, not a lifestyle app.

Components
----------

- **Terminal shell** — The live run surface. Shows command invocation, phase progress, warnings, and the final summary. The terminal shell should support copyable paths and commands.
- **Phase log** — A short, structured sequence of retrieve / analyze / narrate / render messages. It is the user's proof that the run is alive.
- **Run summary block** — A compact terminal block with repo name, branch scope, output path(s), confidence level, and the top-line outcome.
- **Report surface** — The full rendered report (HTML, Markdown, or terminal). It contains the AI Narrative (Summary, Explanation, Coaching), per-metric explanations, and charts where the medium allows.
- **Metric card** — A consistent panel for a Metric: title, value(s), and a grounded four-facet explanation (what it means, good behaviours, what needs improvement, suggestions). A `not_available` Metric still shows a card explaining why.
- **Chart panel** — A data-dense, labeled panel paired with its Metric Group's explanation; a chart never stands alone without text.
- **Coaching chapter** — The structured improvement report: an introduction, themed chapters of prioritized steps, and a closing summary of top priorities.
- **Confidence indicator** — Surfaces the run's self-assessed confidence (`high` / `medium` / `low`); when low, it names the concrete escalation (which provider/config to change).
- **Support link** — The voluntary Buy Me a Coffee link in the free tier. It must be visible but never noisy.

HTML chart mapping is fixed per Metric Group:

| Group | Chart |
| --- | --- |
| A — Activity & Cadence | Multi-series line chart (commits and churn over time) |
| B — Contribution & Ownership | Pareto bar chart with a bus-factor marker |
| C — Commit Message Quality | Stacked bar chart of message-quality categories |
| D — Branching & Merge Structure | Branch/merge timeline with merge-density bars |
| E — Code Churn & Hotspots | Horizontal bar chart for hotspots plus a churn trend line |
| F — Repository Health Signals | Radar chart for component scores plus an overall-score gauge |

Do's and Don'ts
---------------

| Do | Don't |
| --- | --- |
| Treat the terminal as the control surface | Hide progress behind a spinner with no context |
| Render HTML, Markdown, and terminal from one canonical Report JSON | Build a standalone web app, hosted dashboard, or central portal |
| Open the HTML report in a browser only when HTML output is selected | Force a browser open when the user chose Markdown or terminal output |
| Frame manager-facing output as team-level health | Rank, score, or surveil individual developers |
| Keep charts and coaching evidence-backed and text-friendly | Use color or animation as the only signal, or assert facts the Metrics don't support |
| Make support links optional and unobtrusive | Nag free users or gate core reading behind donation prompts |
| Favor calm, supportive, exact language | Use hype, blame, judgment, or gamification |

This design spine is terminal-first: Report JSON is canonical, and HTML, Markdown, and terminal are equal rendered outputs derived from it.
