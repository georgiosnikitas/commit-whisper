---
title: commit-whisper DESIGN
status: draft
created: 2026-06-11
updated: 2026-06-18
---

name: commit-whisper
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

commit-whisper DESIGN

Terminal-first git-history analysis that explains and coaches from a repository's own commit history.

| Field | Value |
| --- | --- |
| Name | commit-whisper |
| Tagline | "I know what you did last commit." |
| Primary surface | Terminal |
| Canonical artifact | Report JSON (also selectable as a fourth output format) |
| Rendered outputs | HTML (self-contained), Markdown, Terminal — all derived from Report JSON |
| HTML report | Auto-opens in a browser when HTML output is selected; `--no-open` suppresses it |
| Design posture | Calm, analytical, evidence-first; team-level health, never per-developer ranking |

Brand & Style
-------------

commit-whisper is a terminal-native analyst that turns long git history into a narrated, coaching report. It should feel like a knowledgeable peer who has read the entire history and wants to help — calm under pressure, precise about evidence, encouraging rather than judgmental, and never theatrical. Its tagline, *"I know what you did last commit,"* is knowing and a little playful, but the product is always grounded in the repository's own data. The interface is not trying to entertain; it is trying to explain.

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

> **Implemented (ADR H3):** the self-contained HTML report inlines **Inter** (latin subset, base64 woff2 `data:` URIs) as its shipped typeface so the single file needs no web-font network fetch. IBM Plex remains the aspirational brand face in the token table above, pending a decision to inline Plex; reconcile the token if Inter becomes the canonical choice.

Layout & Spacing
----------------

The terminal experience is one-column and line-oriented. It should prioritize clarity over density: phase lines, succinct status blocks, then a compact summary of what happened and where the outputs were saved. Terminal output can also render the full report as compact textual summaries and sparklines, not only progress.

The HTML report should be optimized for a single reading column with occasional data panels. On wide screens, it can expand charts and side metadata, but the main narrative should stay readable at a comfortable measure. HTML is a self-contained single file: it opens in a browser with no external network, CDN, or companion asset files.

Each rendered output suits its medium: HTML carries full charts; Markdown uses text tables, sparklines, and Mermaid diagrams with no embedded binary images so it stays diff-able in a pull request; terminal uses compact textual summaries and sparklines. Report JSON, when selected, is written verbatim as the canonical artifact — it is data, not a styled surface, so it carries no design treatment of its own.

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
- **Menu / launchpad** — The zero-arg discovery surface, shown only when `commit-whisper` is run with no arguments in an interactive terminal. A calm, line-oriented list led by **Analyze this repository** (the cwd default), then **Analyze a remote repository**, **Settings**, **Doctor**, and **Help**. License actions are state-dependent — **Activate** (the only in-app key entry), **Buy / Restore** (a browser hand-off), and the optional **Buy Me a Coffee** link appear when unlicensed, while **Deactivate** appears when licensed — and **Quit** (Esc) exits cleanly and prints a flags cheatsheet. It is self-teaching (each interactive run echoes the equivalent command) and reads as a quiet index of what the tool can do — never a flashy dashboard or a mandatory wizard. (Full screen-by-screen composition: MENUS.md.)
- **Header readiness line** — A persistent, dim two-line header opening **every** interactive screen: the product line, then a readiness line mirroring the user's state — `<tier> · AI: <provider (model) | ⚠ not configured> · cwd: <path> (<branch>)` — so they always know who they are, whether they can run, and what "this repo" means without opening Doctor. The tagline shows in full on the bare launchpad and is dropped in argument-mode runs. (Composition: MENUS.md.)
- **Settings** — A guided configuration surface reached from the menu. It sets **non-secret** AI plumbing (provider, model, base URL) and everyday defaults (default output format, timezone, max-commits), writing them to the config home (`~/.commit-whisper`) so they are remembered. It is the writable counterpart to the read-only Doctor view, and it is the calm way out of the first-run “no AI provider” state — especially by picking the zero-cost local Ollama. It **never** collects a secret: a cloud provider’s key stays an environment variable, named but never entered here. Same line-oriented posture — no dashboard.
- **Doctor view** — A read-only diagnostic reachable from the menu: current license tier; the configured LLM provider/model **and whether it is actually reachable** — the doctor *probes* (pings the Ollama endpoint, or runs a low-cost auth check for a cloud provider), so **configured** and **reachable** are reported as distinct states (Ollama can be set but not running); and which required environment variables are set vs missing (set/missing only — secret values are never shown). It is the calm answer to "where do I stand?" and the primary guide out of the first-run state where no AI provider is configured yet. Same line-oriented posture as the rest of the terminal — no gauges, no dashboard.
- **No-AI interstitial** — Choosing an Analyze action with no provider configured never disables the row or throws a raw error; it routes to a calm teaching screen that names the env-only path (e.g. `OPENAI_API_KEY`), points to Settings, and leads with the zero-cost local Ollama option, then drops back to the menu. Discovery is preserved; the dead-end always has a door. (Composition: MENUS.md.)
- **Phase log** — A short, structured sequence of retrieve / analyze / narrate / render messages. It is the user's proof that the run is alive.
- **Run summary block** — A compact terminal block with repo name, branch scope, output path(s), confidence level, and the top-line outcome.
- **Report surface** — The full rendered report (HTML, Markdown, or terminal). In its **showpiece** form it carries the AI Narrative (Summary, Explanation, Coaching), per-metric explanations, and charts where the medium allows — the narrated hero is the product. When the `narrative` subtree is absent (a fail-open degrade or an intentional `--no-ai` metrics-only run) the same surface renders as a plainer **substrate**: the health-band cards, the group and per-metric visuals, and the metric data all stay, but the narrative bands and the hero insight do not — so the substrate can never masquerade as the showpiece.
- **Metric card** — A consistent panel for a Metric: title, a **headline stat**, and a grounded four-facet explanation (what it means, good behaviours, what needs improvement, suggestions). A `not_available` Metric still shows a card explaining why. A status band carries the health signal by **shape, not color** — `●` ok, `◐` watch, `▲` risk, and a greyed `○` for `n/a` — always paired with its text label. In the **HTML** report the visuals live in the two-chart group overview (ADR H2/H4) and each card shows a headline stat; **Markdown / Terminal** keep the right-sized per-metric visual (sparkline / stat — see the table below). Disclosure (HTML): every card is a `<details>` rendered **expanded by default** and the reader may collapse any card manually (`risk` / `watch` carry a coloured left edge). See TEMPLATE-HTML.md.
- **Chart panel** — A data-dense, labeled panel paired with its Metric Group's explanation; a chart never stands alone without text.
- **Coaching chapter** — The structured improvement report: an introduction, themed chapters of prioritized steps, and a closing summary of top priorities.
- **Confidence indicator** — Surfaces the run's self-assessed confidence as a **word** (`high` / `medium` / `low`), always shown and never carried by color or shape alone; when low, it names the concrete escalation (which provider/config to change). It deliberately does **not** use the status-band shapes — `●◐▲○` stays reserved for per-metric health, so the two scales never visually rhyme.
- **Degrade banner** — The one deliberately loud element. It appears only when a run **fails open** (narration, grounding, or the provider failed *after* the metrics were computed): `⚠ Narrative unavailable — showing raw analysis`, set in the `warning` / `danger` register so it reads as a wound against the calm body, plus one actionable line (retry · check the provider · switch it in Settings). It sits at the very top of the rendered report, above the masthead, and is the first thing a reader meets. It is shown **only** in the degraded render — an intentional `--no-ai` metrics-only run is a clean success and carries no banner, only a quiet nudge — so the banner always means *something broke*, never *the narrative was skipped on purpose*.
- **Support link** — The voluntary Buy Me a Coffee link, shown only when unlicensed and hidden once a license is active. It must be visible but never noisy, and it is distinct from **Buy / Restore license** (the browser hand-off to buy or recover a purchase) and from **Activate license** (the only in-app license-key entry).

HTML chart mapping (implemented — ADR H1/H2): each Metric Group carries a **two-chart group overview** — a primary chart plus a secondary gauge/doughnut/series — rendered as deterministic **inline SVG** (not Chart.js). The per-metric charts were consolidated into these overviews (ADR H4); cards show a headline stat.

| Group | Primary chart | Secondary chart |
| --- | --- | --- |
| A — Activity & Cadence | Commit-volume line | Weekly-cadence bars |
| B — Contribution & Ownership | Ownership **doughnut** (by area) | Contribution-concentration gauge |
| C — Commit Message Quality | Message-category bars | Conventional-Commits adherence gauge |
| D — Branching & Merge Structure | Merge-cadence line | Direct-to-default gauge |
| E — Code Churn & Hotspots | Hotspots horizontal bars | Churn-trend line |
| F — Repository Health Signals | Component-score radar | Overall hygiene-score gauge |

(Group B's bus-factor signal moved from a Pareto overlay to a first-class **stat card** with a health band — see TEMPLATE-HTML.md.)

Per-metric shape model — in **HTML** these visuals were folded into the group-overview charts (ADR H4) and the card shows a headline stat; the shape model below now primarily drives the **Markdown / Terminal** degradation (and the HTML card's headline figure):

| Metric shape | Rich visual (Markdown/Terminal) | Markdown / Terminal degradation |
| --- | --- | --- |
| Time-series | Small line / area chart | ASCII sparkline (`▁▂▄█▆▃`) |
| Distribution | Small bar / histogram | Small text-bar table (`████ 68%`) |
| Scalar within a healthy range | Sparkline or mini-gauge + the number | Sparkline + number, or `7/10` |
| Pure scalar | Bold stat, no chart | The bold number |

Do's and Don'ts
---------------

| Do | Don't |
| --- | --- |
| Treat the terminal as the control surface | Hide progress behind a spinner with no context |
| Render HTML, Markdown, and terminal from one canonical Report JSON | Build a standalone web app, hosted dashboard, or central portal |
| Auto-open the HTML report when HTML output is selected, and honor `--no-open` | Force a browser open when the user chose Markdown or terminal output, or ignore `--no-open` |
| Frame manager-facing output as team-level health | Rank, score, or surveil individual developers |
| Keep charts and coaching evidence-backed and text-friendly | Use color or animation as the only signal, or assert facts the Metrics don't support |
| Make support links optional and unobtrusive | Nag free users or gate core reading behind donation prompts |
| Keep a fail-open degrade visibly wounded (banner) and the substrate plainer than the narrated hero | Let the substrate masquerade as the showpiece, or hide that the narrative is missing |
| Favor calm, supportive, exact language | Use hype, blame, judgment, or gamification |

This design spine is terminal-first: Report JSON is canonical, and HTML, Markdown, and terminal are equal rendered outputs derived from it.
