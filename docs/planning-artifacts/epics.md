---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-06-12'
inputDocuments:
  - docs/planning-artifacts/prds/prd-commit-sage-2026-06-06/prd.md
  - docs/planning-artifacts/architecture.md
  - docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/EXPERIENCE.md
  - docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/DESIGN.md
---

# commit-sage - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for commit-sage, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

- **FR-1 — Target a local or remote repository:** Point commit-sage at a **local filesystem path or a remote HTTPS URL** (GitHub/GitLab/Bitbucket) — both first-class; interactive mode defaults the target to the **current directory** when it's a git repo. Retrieve the full history across all branches reachable by default (scopable to a single named branch). **Commit-selection inputs** narrow which commits feed the Analysis, all optional: **author filter**, **max-commits** limit, **no-merges** (changes Group A–F values). **Dates** (start/end) optional — empty = unbounded (all history), no auto-shrink. **Timezone** explicit input, default **UTC**, governing date bounds + time-bucketed metrics. Reads per commit: hash, author + committer identity, author + commit timestamps, message, parent hashes, changed-file metadata. Strictly read-only.
- **FR-2 — Authenticate to private repositories:** A PAT is needed **only for a private *remote*** — a local path or public remote needs none, and its absence is never an error for those. When needed, supplied via environment variable **only** (never CLI arg, never config file, never prompted or persisted). Insufficient-scope tokens produce a clear, actionable error naming the missing permission. Tokens never appear in Report JSON, logs, or rendered output.
- **FR-3 — Handle retrieval limits and failures gracefully:** Distinguish network / auth / "repo not found" errors. No retry on transient or rate-limit errors — report clearly (provider + reset guidance where available) and exit without a partial Report. A repo larger than the Free-tier cap is retrieved only to the capped most-recent commit count, and the report states it was capped.
- **FR-4 — Compute the metrics catalog:** Compute the Metrics in Groups A–F deterministically and without AI. Every metric is either computed and present in Report JSON or explicitly `not_available` with a reason — never silently omitted. Identical input history ⇒ identical values. No network beyond §4.1 retrieval; no repo mutation.
- **FR-5 — Group and describe metrics for human consumption:** Report JSON represents Groups and their Metrics as a stable structure with stable keys; each Group has a title + short description; each Metric has a title + one-line description of what it represents.
- **FR-6 — Render group charts and a per-metric visual for every metric:** HTML presents the fixed chart-per-group mapping (A line, B Pareto+bus-factor, C stacked bar, D merge timeline, E hotspots bar + churn trend, F radar + gauge) **plus a right-sized per-metric visual on every metric** (time-series→line, distribution→bar, scalar-in-range→sparkline/gauge, pure-scalar→bold stat), rendered from the Report JSON without re-analysis. Each metric carries a derived **health band** (`ok`/`watch`/`risk`/`n/a`) shown by **glyph + label, never color alone**, classified at render from §4.2 catalog-owned thresholds. HTML is a self-contained single file (assets inlined; no CDN/network) within a ~1 MB weight budget.
- **FR-7 — Degrade visuals appropriately per output format:** Markdown uses no binary images — text tables, ASCII sparklines, and Mermaid diagrams (diff-able, PR-reviewable). Terminal uses compact textual summaries / sparklines. No rendered output depends on a network or server.
- **FR-8 — Generate the AI Narrative and a per-metric explanation:** Produce the repo-level Narrative (Summary, Explanation, Coaching-as-structured-report) plus a four-facet Metric Explanation for every metric (meaning, good behaviours, needs improvement, suggestions). Covers the full catalog including `not_available`; each explanation anchored in its own metric with optional grounded cross-references; Coaching consolidates + prioritizes the per-metric suggestions into one ranked plan; plain language throughout.
- **FR-9 — Ground every factual claim in the metrics:** Every factual statement in the Narrative and Metric Explanations traces to specific Metric(s) in Report JSON. Enforced by prompt constraints **plus** a post-generation verification pass; unsupported claims are removed or rewritten; insufficient data is stated, never fabricated.
- **FR-10 — Self-assess confidence and escalate:** Each run yields a `high` / `medium` / `low` confidence rating computed from verification pass rate, share of `not_available` metrics, and provider/runtime signals. Low confidence explicitly recommends re-running with a stronger provider and names which config to change; never silently degrades into confident-sounding output.
- **FR-11 — Support multiple BYOK LLM providers; AI-first with fail-open:** The narrated **report** (the shareable showpiece) requires a reachable LLM — no AI, no showpiece, by construction; the interactive default is **AI-first**. But the deterministic `analysis` is never held hostage: on narration/grounding/provider failure the run **fails open**, rendering the analysis substrate with a loud degraded banner (exit 9) rather than producing nothing. An explicit **`--no-ai` / metrics-only** mode (no LLM call, clean substrate, exit 0) is the **default in headless/CI** — never the interactive default, never the Free-tier identity. A `aiMode` of `required`/`auto`/`off` governs this (forced `--ai` / interactive default / `--no-ai`). Closed provider enum: `ollama`, `openai`, `gemini`, `anthropic`, `openai-compatible`. Key from the provider's **native** env var only (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` — `GEMINI_API_KEY` alias; Ollama needs none); base URL required for `{ollama, openai-compatible}`. Reachability **preflight** (gated by `aiMode`) before retrieve. Free tier keeps the narrative via local Ollama at zero cost. Only Metrics/derived summaries sent — never tokens, never raw diffs.
- **FR-12 — Compute the canonical Report JSON:** Every analysis **computes (assembles) in memory** a well-formed, documented, diff-stable Report JSON (`schemaVersion: "1.0.0"`, pre-impl) — the single source of truth from which any format renders with no re-analysis or AI re-call; it is **written to a destination only when `json` is a selected output** (FR-13). Two top-level subtrees: **`analysis`** (deterministic — all metric values/status, the byte-stable trend-diff target) and **`narrative`** (AI — Summary/Explanation/Coaching + per-metric explanations keyed by metric id). Structured shapes: Coaching `{introduction, chapters[], summary}`; per-metric explanation `{explanation, goodBehaviours, needsImprovement, suggestions}` under `narrative.explanations[metricId]`.
- **FR-13 — Emit and render the selected output formats:** Multi-select from one Report JSON across **four** formats — **JSON** (the canonical artifact, emitted directly; first-class for piping/automation/diffing), **HTML** (self-contained), **Markdown** (PR/wiki), **Terminal** (immediate / CI logs). A single run can emit several formats at once with no re-analysis or second LLM call. `html`, `markdown`, and `json` are file-formats — each defaults to `./commit-sage-report.{html,md,json}` when no path is given, and `-` = stdout; `terminal` is stdout-native. **HTML auto-opens** in the browser in interactive mode when selected; **`--no-open`** suppresses it; CI never auto-opens. All formats present the same facts from the same Report JSON.
- **FR-14 — Interactive (developer) execution:** The bare zero-argument `commit-sage` in an interactive terminal is the product's single interactive entry point — a discovery **menu** + guided prompts collecting only needed inputs, escapable, with visible phase progress; on completion it surfaces the equivalent non-interactive command (self-teaching). **Menu action set, conditioned on effective license state:** Analyze this repository (cwd) · Analyze a remote repository · Status / doctor (tier, configured provider, which required env vars set vs missing) · Help / show all flags · Activate license `[unlicensed]` · **Buy / Restore license** `[unlicensed]` (buy or recover a license) · Buy Me a Coffee `[unlicensed only; hidden when licensed]` · Deactivate license `[licensed]` · Quit (Esc). The menu never collects secrets (names the env var; may accept a license key, which is not a secret). First run with a missing secret names the exact env var (never prompts/stores). Ships as a self-contained executable.
- **FR-15 — Headless / CI execution:** Any invocation with ≥1 argument (any context) is strict single-shot — never opens the menu, never prompts; runs immediately when required inputs are satisfied. Missing required input hard-fails immediately with a typed error + machine-readable exit code (no prompt, no hang); zero-arg in a non-TTY context also fails fast. Reads config from env/config/flags (secrets env-only); the paid license key is supplied via env var and the runner **validates** (not activates), failing closed on validation failure. **Headless/CI defaults to metrics-only** (`aiMode: off`) — no forced per-run inference — with a one-line nudge that narrative is available interactively or via `--ai`. **Operational flags/env:** `--ai`/`--no-ai`, `--show-config` (resolved config + per-field provenance, secrets `***`, then exit), `--non-interactive`, `--config <path>`, `--no-open`, `--verbose`/`--quiet`, `--version`, `NO_COLOR`/`FORCE_COLOR`. **Config/cache home `~/.commit-sage`** holds the config file + cached license activation-instance id (never secrets). Predictable artifact output paths.
- **FR-16 — Enforce license tiers:** Free / Single-device / Unlimited-Automation enforced via online Lemon Squeezy validation at startup before analysis. Free = 100-commit cap (makes no call). Single-device is bound via a server-side activation instance (second device refused; `deactivate` frees an activation to move machines). Unlimited permits many activations including CI. Interactive degrades to the Free cap when validation cannot complete; headless fails closed (exit 8); an explicit invalid/revoked response grants no paid features in either mode. License enforcement never transmits repository data.

### NonFunctional Requirements

- **NFR-1 — Privacy (independent of network use):** With Ollama, no repository data ever leaves the machine. With cloud providers, only Metrics/derived summaries are sent — never tokens, never raw source beyond what a Metric needs. Tokens and keys never appear in JSON, logs, or rendered output.
- **NFR-2 — Security:** Read-only against remotes; secrets read from environment variables only (never config file or bare CLI args); clear failure on insufficient token scope.
- **NFR-3 — Determinism:** Identical history ⇒ identical Metrics. The AI layer is the only non-deterministic part and is bounded by Grounding (FR-9).
- **NFR-4 — Performance:** Handle very long histories within reasonable time and memory; long runs show progress. Budgets for a 50k-commit repo on a 4-vCPU / 16 GB machine: deterministic retrieval + analysis ≤ 10 min, peak RSS ≤ 2.5 GB, AI narrative + metric explanations ≤ 4 min (cloud) / ≤ 8 min (local Ollama-class model).
- **NFR-5 — Network use:** Paid-tier license validation requires network access at startup (transmits only the license key + a device identifier, never repository data); the Free tier makes no such call. Rendered outputs remain self-contained and display with no server.
- **NFR-6 — Portability:** Ships as a self-contained executable across macOS, Linux, and Windows.
- **NFR-7 — Trust / accuracy:** Grounding (FR-9) + Confidence self-assessment (FR-10) are first-class; a confidently wrong Narrative is the worst outcome and is designed against.
- **NFR-8 — No per-developer ranking (locked, absolute):** Both the Metrics and the Narrative analyze at the **repository / change level only** and never rank, score, or single out individual developers; all manager-facing output is team-level health. Binds Group B, Group F, the health bands, every Metric Explanation, and Coaching. This is a deliberate ethical guardrail and a differentiator (every commodity git-stats tool is an author leaderboard; commit-sage refuses to be one).

### Additional Requirements

_Technical requirements derived from the Architecture document that shape implementation._

**Project scaffold (Epic 1, Story 1 — greenfield init):**
- TypeScript 6.0.3 (strict, ESM, `nodenext`), Node.js 22 LTS target; `npm init` + locked deps: commander 15.0.0, @clack/prompts 1.5.1; dev: tsup 8.5.1 (esbuild), vitest 4.1.8, @types/node 22; strict `tsconfig.json` committed.
- ESLint config enforcing patterns P2/P4/P5 (named exports, `CommitSageError`, no `console.log` in pipeline, `process.env` only in `config/`).

**Cross-cutting architecture (foundational):**
- Two-phase configuration resolver: Phase 1 pure deterministic merge (`defaults → config file → env → flags`) → `PartialRunConfig` with per-field provenance; Phase 2 gap handling (prompt only in 0-arg+TTY; typed error otherwise). Produces a frozen `RunConfig`.
- Hexagonal boundary: only `cli/` and `config/` touch `argv`/`env`/prompts; every downstream stage receives the frozen `RunConfig`.
- AI mode (fail-open): a frozen-`RunConfig` field `aiMode: "required" | "auto" | "off"` (forced `--ai` / interactive default / `--no-ai`; headless-CI defaults to `off`). On narration/grounding/provider failure under `auto`, the pipeline **fails open** — renders the deterministic `analysis` substrate with a degraded marker and exit code 9 — rather than discarding computed work; the narrated showpiece requires the `narrative` subtree by construction. The provider reachability preflight is `aiMode`-gated (skipped under `off`, hard-fail under `required`, non-blocking under `auto`).
- Capability gate: `interactive = stdin.isTTY && stdout.isTTY && !isCI && !flags.nonInteractive` (fails closed).
- Stream discipline: stdout = machine data only; stderr = all human chrome (via a single `ui` module).
- `Secret<string>` wrapper redacting to `***` in `toString`/`toJSON`.
- Exit-code enum: 0 success · 1 internal · 2 usage/validation · 3 missing input · 4 git/retrieve · 5 metrics · 6 narration/LLM (when AI required) · 7 render · 8 license · 9 completed-degraded (analysis rendered, narrative unavailable — the one code not thrown as an error). Codes 1–8 = no output; 0 and 9 = output produced.
- Zod 4.4.3 (`zod/mini`) runtime validation at three checkpoints: config-in, LLM-output, Report-JSON-in.
- **RunConfig contract + input source matrix:** 16 config-data fields, each declaring valid sources (flag / `COMMIT_SAGE_*` env / config file / interactive prompt) and precedence; secrets (git PAT, AI key) env-only and never in the prompt column; closed enums for provider and output format; explicit `branch` "all" sentinel; resolved `entitlement {tier, commitCap?}` rides the frozen `RunConfig` (like `analysisTimestamp`) so the license key itself never crosses the hexagonal boundary.
- **Action/mode flags** (short-circuit, never enter `RunConfig`): `--help`, `--version`, `--show-config` (resolved values + per-field provenance, secrets `***`), `--non-interactive`, `--config <path>` (resolved before the config file), license `activate`/`deactivate`/`restore`. **Behavior modifiers:** `--verbose`/`--quiet` (+`COMMIT_SAGE_LOG_LEVEL`), `--no-open`, `NO_COLOR`/`FORCE_COLOR`.
- **Config/cache home `~/.commit-sage`:** holds the config file + cached license activation-instance id; never secrets. (Cross-OS path convention e.g. `%APPDATA%` to confirm at impl.)

**Per-stage architecture:**
- Retrieval: `git clone` shell-out to system `git` (no native bindings); stateless every run; temp working dir with guaranteed cleanup on every exit path (success / failure / Ctrl-C).
- Metrics engine: hybrid topology — one shared normalized in-memory model, each metric a pure function over it; determinism rules (injected `analysisTimestamp`, total stable ordering `[committerDate, sha]`, `.mailmap`-aware author canonicalization, UTC computation); uniform metric envelope `{ id, group, title, status, value?, reason? }`.
- Narration: Vercel AI SDK `ai` 6.0.203 (`@ai-sdk/openai|anthropic|google` + `openai-compatible` + Ollama); `generateObject` bound to Zod schemas; per-group ×6 batching + a coaching call; deterministic post-generation grounding check (no second LLM call).
- Assembly: canonical Report JSON builder + schema (`schemaVersion "1.0.0"`).
- Rendering: HTML via Chart.js 4.5.1 (animations off) + mandatory accessible data-table fallback, typed template literals, self-contained asset inlining; Markdown via typed literals (Mermaid); Terminal via picocolors 1.1.1 + hand-rolled tables; **JSON output path** writes the canonical Report JSON directly.
- Licensing: online Lemon Squeezy License API via global `fetch` (no SDK) — `activate` / `validate` / `deactivate` / `restore` (CLI subcommands + interactive menu actions); device binding via activation instances; CI validates-not-activates with env-var key; cached activation-instance id stored under `~/.commit-sage` (a licensing artifact, not a user secret).
- Packaging (deferred, spike-gated): Node SEA (raw-mode stdin / ANSI across macOS/Linux/Windows); `pkg` / `nexe` fallbacks.

**Tracked risk spikes (validate during implementation, not blockers):** performance at 50k commits vs the 2.5 GB RSS budget; the Node SEA packaging spike; TypeScript 6 toolchain confirmation (tsup/esbuild + vitest).

### UX Design Requirements

- **UX-DR1 — Launchpad menu (zero-arg, TTY):** A calm, line-oriented list of discovery actions, led by **Analyze this repository** (cwd default), then **Analyze a remote repository**, **Settings** (configure provider/model/base URL + defaults, written to `~/.commit-sage`), **Status / doctor**, and **Help / show all flags**; license actions are state-conditioned (**Activate**, **Buy / Restore**, **Buy Me a Coffee** when unlicensed; **Deactivate** when licensed); **Quit** (Esc) always present. A persistent **header readiness line** (tier · AI provider/model or ⚠ not configured · cwd+branch) tops every interactive screen. Escapable via Esc/quit (clean exit + short flags cheatsheet); never a flashy dashboard or mandatory wizard. Fully keyboard-navigable; selection never conveyed by color alone; echoes the selected value in text.
- **UX-DR2 — Guided prompts:** Fill only missing required inputs; default anything inferable (cwd is a git repo, default range/format); collect then go silent; prompt styling never bleeds into the report.
- **UX-DR2a — Status / doctor view:** A read-only "where do I stand" mirror (menu action + impl-optional `--doctor` twin) showing license tier, configured provider/model, **whether the provider is reachable (probed, not just configured)**, and which required environment variables are set vs missing (named, never their values). No gauges/dashboard — a quiet diagnostic.
- **UX-DR2b — First-run, no AI provider configured:** Because AI is required (FR-11) and secrets are never prompted, a brand-new user with no provider/key set must be guided — Status/doctor and the menu clearly name the fix ("set `OPENAI_API_KEY`, or use a local Ollama provider"), surfacing Ollama as the zero-cost local path. The tool never collects the key itself.
- **UX-DR3 — Command echo / self-teaching bridge:** Every interactive run ends by echoing the equivalent full command (`Next time: commit-sage --max-commits 500 --format md`); a single-shot success may show at most one dim tip line.
- **UX-DR4 — Phase log:** Show `retrieve → analyze → narrate → render` in order, one line per phase; progress messages by phase, not a silent spinner.
- **UX-DR5 — Run summary block:** On completion state output is ready and name the saved path(s), repo/branch scope, and confidence level.
- **UX-DR6 — Metric card / section:** Stable layout showing title, value(s), a right-sized **per-metric visual** (visual-by-shape), a derived **health band** (`ok`/`watch`/`risk`/`n/a`) by shape-differentiated glyph + label (never color alone), and the four-facet explanation (meaning, good behaviours, needs improvement, suggestions); a `not_available` metric still shows a card explaining why. In HTML, `ok` cards collapse to a one-line summary and `watch`/`risk` cards expand by default (progressive disclosure; all expanded with no JS).
- **UX-DR7 — Chart block:** Each Metric Group uses its fixed group-overview chart type, paired with a label and explanation, and each metric carries its own per-metric visual; a chart never stands alone without text. Every chart (group + per-metric) has an accessible data-table fallback.
- **UX-DR8 — Coaching report layout:** Introduction, themed chapters of prioritized steps, and a closing summary; consolidates and ranks the per-metric suggestions.
- **UX-DR9 — Confidence indicator:** Surface `high` / `medium` / `low` in terminal + rendered report; when low, name the concrete escalation (which provider/config to change).
- **UX-DR10 — Support link:** Voluntary Buy Me a Coffee link in HTML/Markdown reports + Free-tier terminal summary; visible but never noisy, never blocks reading or export.
- **UX-DR11 — Microcopy voice & tone:** Concise, action-oriented terminal microcopy (state what's happening, what happened, what to do next); plain-language evidence-first Narrative; supportive Coaching; manager-facing wording stays team-level, never per-developer ranking. Adheres to the Do/Don't standard in EXPERIENCE.md.
- **UX-DR12 — State treatments:** Defined terminal/report treatments for cold start, interactive menu, missing required input (argument mode), zero-arg non-TTY, first-run missing secret, running retrieval/analysis/narration, render complete, browser-open failure, Free-tier cap reached, low confidence, auth failure, rate-limit/network failure, unhealthy findings (success, not error), invalid license, second device, and empty/tiny repo.
- **UX-DR13 — HTML report navigation:** Table-of-contents links, in-page anchors for Summary / Explanation / Coaching / each Metric Group, and browser search support.
- **UX-DR14 — Accessibility floor:** No reliance on color alone (every state also in text); status lines wrap cleanly in narrow terminals; browser report meets WCAG 2.2 AA contrast + keyboard navigation; headings/anchors keyboard-reachable; readable with reduced motion (no essential behavior depends on animation); charts have text labels + accompanying narrative for screen readers; copyable paths/links in plain text (not hover-only); interactive menu/prompts fully keyboard-navigable with a text-stated keyboard exit (Esc/quit, Ctrl-C).
- **UX-DR15 — Visual design language (DESIGN.md):** Dark-first, high-contrast palette (warm-neutral surfaces, restrained amber accent, sparing success/warning/danger) with light-mode tokens for the browser report; IBM Plex Sans (display/body) + IBM Plex Mono (mono/meta) typography hierarchy; defined rounding (sm/md/lg/full) and 4/8/12/16/24/32 spacing rhythm; depth from tonal contrast not heavy shadow; component surfaces (terminal-shell, report-surface, metric-card, chart-panel, command-chip, status-pill); avoid rainbow charts, neon, decorative gradients, pill-heavy aesthetics.

### FR Coverage Map

| FR | Primary epic | Notes |
|----|--------------|-------|
| FR-1 Target local/remote repo | Epic 1 (local/cwd) | Remote target added in Epic 5 |
| FR-2 Authenticate private repos | Epic 5 | Conditional, private remote only |
| FR-3 Retrieval limits & failures | Epic 5 | Free-tier cap mechanics in Epic 2 |
| FR-4 Compute metrics catalog | Epic 2 | Engine framework + Group A in Epic 1 |
| FR-5 Group & describe metrics | Epic 2 | |
| FR-6 Render group + per-metric visuals | Epic 4 | Health bands derived from §4.2 thresholds |
| FR-7 Degrade visuals per format | Epic 4 | |
| FR-8 AI Narrative + per-metric | Epic 3 | Minimal narration in Epic 1 |
| FR-9 Ground every claim | Epic 3 | |
| FR-10 Self-assess confidence | Epic 3 | |
| FR-11 BYOK multi-provider | Epic 3 | First provider in Epic 1 |
| FR-12 Canonical Report JSON | Epic 1 | |
| FR-13 Emit/render formats | Epic 4 | Terminal render in Epic 1 |
| FR-14 Interactive execution | Epic 6 | |
| FR-15 Headless / CI execution | Epic 1 (strict single-shot) | Ops flags in Epic 6; CI license in Epic 7 |
| FR-16 Enforce license tiers | Epic 7 | Free-tier cap in Epic 2 |

_NFRs are cross-cutting and verified within the epics that realize them: determinism (NFR-3) via Epic 1's harness extended through Epic 2; performance (NFR-4) across Epics 2/3; privacy & security (NFR-1/2) across Epics 3/5/7; network (NFR-5) in Epic 7; portability (NFR-6) in Epic 7's SEA spike; trust/accuracy (NFR-7) in Epic 3._

## Epic List

### Epic 1: Foundation & Walking Skeleton
A developer can run `commit-sage` in a local git repository and get a real, narrated terminal report — the full pipeline working end-to-end on the thinnest viable slice. Establishes the project scaffold, the two-phase config resolver and frozen `RunConfig`, the capability gate, exit codes and stream discipline, local-cwd retrieval, the metrics-engine framework with its determinism harness and one proving metric group (Group A), minimal single-provider narration, canonical Report JSON assembly, and terminal rendering.
**FRs covered:** FR-1 (local/cwd), FR-4 (framework + Group A), FR-5 (framework), FR-8 (minimal), FR-11 (first provider), FR-12, FR-13 (terminal), FR-15 (core strict single-shot)

### Epic 2: Complete Metrics Catalog
A user gets the full deterministic analysis of their history. Adds the remaining metric groups B–F (~24 metrics) on the proven engine, the commit-selection inputs (author filter, max-commits, no-merges, optional start/end dates, UTC timezone), and the Free-tier 100-commit cap with its truncation notice and date-then-cap ordering.
**FRs covered:** FR-4 (full catalog), FR-5 (full), FR-3 (cap behavior), FR-16 (cap mechanics)

### Epic 3: Grounded AI Narrative & Coaching
A user gets the product's differentiator — a trustworthy, grounded narrative and coaching. Adds the full three-part Narrative and four-facet per-metric explanations, per-group batched generation plus the coaching call, the deterministic grounding verification pass, confidence self-assessment with escalation, and the full BYOK provider breadth (OpenAI, Gemini, Anthropic, OpenAI-compatible, with base URL).
**FRs covered:** FR-8 (full), FR-9, FR-10, FR-11 (full provider breadth)

### Epic 4: Rich Rendered Reports
A user gets shareable, readable reports in every format. Adds the self-contained HTML report (Chart.js per-group charts, the mandatory accessible data-table fallback, asset inlining, navigation and anchors), the Markdown renderer (Mermaid + sparklines), JSON as a selectable output format, multi-select output, and HTML auto-open with `--no-open`.
**FRs covered:** FR-6, FR-7, FR-13 (HTML/Markdown/JSON, multi-select)

### Epic 5: Remote Repositories & Private Auth
A user can analyze any repository, not just a local one. Adds remote HTTPS retrieval (stateless temp clone with guaranteed cleanup), conditional env-only personal-access-token authentication for private remotes, and graceful no-retry failure handling (network, auth, rate-limit, not-found distinguished).
**FRs covered:** FR-1 (remote target), FR-2, FR-3 (remote + rate-limit failures)

### Epic 6: Interactive Experience
A newcomer gets a guided, self-teaching first run. Adds the zero-arg launchpad menu (cwd-first), guided prompts that fill only what's missing, the Settings screen (configure provider/model/base URL + defaults, written to `~/.commit-sage`), the Status/doctor view, first-run-no-AI guidance, the command-echo self-teaching bridge, and the operational flags (`--show-config`, `--non-interactive`, `--verbose`/`--quiet`, `--version`, `NO_COLOR`/`FORCE_COLOR`).
**FRs covered:** FR-14, FR-15 (operational flags)

### Epic 7: Licensing & Distribution
The product can be monetized and shipped. Adds online Lemon Squeezy license validation, the three tiers, activate / deactivate / buy-restore flows, fail-closed (headless) versus degrade-to-Free (interactive) behavior, CI validate-not-activate, the `~/.commit-sage` config home, and the Node SEA self-contained-binary packaging spike across macOS/Linux/Windows.
**FRs covered:** FR-16 (full enforcement), FR-15 (license validation in CI)

## Epic 1: Foundation & Walking Skeleton

Run `commit-sage` in a local git repository and get a real, narrated terminal report — the full pipeline proven end-to-end on the thinnest viable slice.

### Story 1.1: Project scaffold and toolchain

As a developer building commit-sage,
I want a strict, ESM-first TypeScript project scaffold with the locked toolchain,
So that every later story is written against a consistent, type-safe, testable foundation.

**Acceptance Criteria:**

**Given** an empty repository,
**When** the scaffold story is complete,
**Then** `package.json` declares an ESM Node 22 project with the locked runtime deps (commander 15.0.0, @clack/prompts 1.5.1) and dev deps (typescript 6.0.3, tsup 8.5.1, vitest 4.1.8, @types/node 22),
**And** a strict `tsconfig.json` (nodenext, `strict: true`, es2023) is committed,
**And** the `src/` feature-folder structure (`cli/ config/ retrieve/ analyze/ narrate/ assemble/ render/ license/ shared/`) exists.

**Given** the toolchain is installed,
**When** `npm run build`, `npm test`, and the linter are run,
**Then** each succeeds on the empty scaffold,
**And** ESLint enforces named-exports-only, no `console.log` in pipeline modules, and `process.env` access only within `config/`.

### Story 1.2: Two-phase configuration resolver and frozen RunConfig

As a developer,
I want a deterministic config resolver that produces a single frozen `RunConfig`,
So that the pipeline runs from one immutable, provenance-tracked input with no access to argv/env/prompts.

**Acceptance Criteria:**

**Given** defaults, a config file, environment variables, and flags supplying overlapping values,
**When** Phase 1 resolution runs,
**Then** values merge by precedence `defaults → config file → env → flags` (low→high) into a `PartialRunConfig` carrying per-field provenance,
**And** the merge is a pure function with no I/O (table-testable).

**Given** a resolved configuration,
**When** the `RunConfig` is constructed,
**Then** it is frozen and the capability gate is computed as `interactive = stdin.isTTY && stdout.isTTY && !isCI && !flags.nonInteractive`, failing closed when a TTY cannot be proven.

**Given** a non-interactive context with a required field missing,
**When** Phase 2 gap handling runs,
**Then** it produces a typed error (never a prompt).

### Story 1.3: Error model, exit codes, and stream discipline

As a developer,
I want a typed error hierarchy mapped to machine-readable exit codes and disciplined output streams,
So that every failure is scriptable and machine data never mixes with human chrome.

**Acceptance Criteria:**

**Given** any failure in the pipeline,
**When** it propagates to the CLI shell,
**Then** it is a `CommitSageError` subclass carrying an `exitCode` (0 success · 1 internal · 2 usage/validation · 3 missing input · 4 git/retrieve · 5 metrics · 6 narration/LLM · 7 render · 8 license · 9 completed-degraded) and a stable machine `code`,
**And** the process exits with that code, emitting the human message to stderr,
**And** code `9` (analysis rendered, narrative unavailable) is the one code NOT thrown as an error — the CLI shell sets it when the substrate render completes after a narration failure; codes 1–8 mean no output, 0 and 9 mean output produced.

**Given** a run that produces machine output,
**When** output is written,
**Then** stdout carries only machine data and stderr carries all human chrome (via a single `ui` module),
**And** a secret wrapped in `Secret<string>` redacts to `***` in any `toString`/`toJSON`.

### Story 1.4: Local repository retrieval

As a developer in a git repository,
I want commit-sage to read my local history via the system `git`,
So that analysis can run with no network and no clone.

**Acceptance Criteria:**

**Given** the current working directory is a git repository,
**When** retrieval runs with no target argument,
**Then** commit-sage defaults the target to cwd and reads, per commit, the hash, author and committer identity, author and commit timestamps, message, parent hashes, and changed-file metadata via a shell-out to the system `git` (no native bindings).

**Given** a directory that is not a git repository,
**When** retrieval runs,
**Then** it fails with the git/retrieve exit code and an actionable message.

**Given** retrieval of any kind,
**When** it executes,
**Then** it never writes to or mutates the repository (strictly read-only).

### Story 1.5: Metrics-engine framework, determinism harness, and Group A

As a user,
I want deterministic Activity & Cadence metrics computed from my history,
So that I get a reproducible first analysis and the engine pattern is proven.

**Acceptance Criteria:**

**Given** retrieved history,
**When** the engine runs,
**Then** a single shared normalized model is built once, and each Group A metric is a pure function over it returning the uniform envelope `{ id, group, title, status, value?, reason? }`.

**Given** the same input history analyzed twice,
**When** results are compared,
**Then** they are byte-identical, enforced by a determinism harness using an injected `analysisTimestamp`, total ordering `[committerDate, sha]`, `.mailmap`-aware author canonicalization, and UTC computation.

**Given** a metric that cannot be computed,
**When** the engine runs,
**Then** it is emitted with `status: "not_available"` and a reason, never silently omitted.

### Story 1.6: Minimal single-provider AI narration

As a user,
I want a configured LLM provider to produce a narrative summary,
So that every run yields explanation, not just numbers (AI is required).

**Acceptance Criteria:**

**Given** a configured provider and reachable model,
**When** narration runs over the computed metrics,
**Then** the Vercel AI SDK `generateObject` (bound to a Zod schema) produces a structured Summary from the metrics,
**And** only metrics and derived summaries are sent to the LLM — never tokens, never raw diffs,
**And** the LLM key is read from the provider's native environment variable (`GOOGLE_GENERATIVE_AI_API_KEY` for Gemini, with `GEMINI_API_KEY` accepted as an explicitly-read alias).

**Given** a configured provider whose endpoint is unreachable (e.g. Ollama selected but not running, or a missing/invalid cloud key),
**When** a run starts,
**Then** a cheap reachability **preflight** (Ollama endpoint ping / cloud auth-connectivity check, never a paid inference) runs in the pre-pipeline gate band **before** retrieve/analyze — and its consequence depends on `aiMode`: in `required` (forced `--ai`) it hard-fails with the narration/LLM exit code; in `auto` (interactive default) it flags fail-open and the run proceeds; in `off` (`--no-ai`) the preflight is skipped entirely (no provider needed),
**And** "configured" (provider/model set) is distinguished from "reachable" (probe passed).

**Given** `aiMode: auto` (the interactive default) and a narration / grounding / provider failure mid-run,
**When** the failure occurs after the deterministic analysis is already computed,
**Then** commit-sage **fails open** — it renders the deterministic `analysis` substrate rather than discarding computed work, marks the output degraded, and exits with code **9** (completed-degraded), never silently substituting,
**And** the narrated **showpiece** report is impossible to produce without the `narrative` subtree (no AI, no showpiece) — so the report still requires AI by construction.

**Given** `aiMode: off` (`--no-ai`, the headless/CI default),
**When** a run executes,
**Then** it produces the clean `analysis` substrate with no LLM call and exits 0 (intentional, not degraded) — metrics-only is never the interactive default and never the Free-tier identity.

**Given** no provider configured,
**When** a run is attempted,
**Then** it fails per mode (hard error in single-shot) with the narration/LLM exit code — there is no metrics-only mode.

### Story 1.7: Canonical Report JSON assembly

As a user,
I want a single canonical Report JSON assembled from metrics and narrative,
So that all outputs derive from one source of truth and trends diff cleanly.

**Acceptance Criteria:**

**Given** computed metrics and the generated narrative,
**When** assembly runs,
**Then** it produces a well-formed Report JSON with `schemaVersion: "1.0.0"` structured into two top-level subtrees — **`analysis`** (deterministic: all metric values/status from the engine, no AI) and **`narrative`** (AI: Summary/Explanation/Coaching + per-metric explanations keyed by metric id under `narrative.explanations[metricId]`),
**And** the deterministic metric envelope is **not** welded to its AI explanation — the two are joined by metric `id` across the subtrees,
**And** the `analysis` subtree is byte-stable for identical input (the trend-diff target) while `narrative` may vary,
**And** the JSON validates against its Zod schema on read-back.

**Given** a metrics-only or fail-open run with no narration,
**When** assembly runs,
**Then** the `narrative` subtree is **absent** (it is optional) and a top-level `degraded: boolean` marker records whether the run completed degraded (true) or by intent (false), so JSON consumers detect the state without parsing exit codes,
**And** the `analysis` subtree is always present, so trend diffs (FR-4/Group F) never depend on the AI layer.

### Story 1.8: Terminal rendering and end-to-end strict single-shot run

As a developer,
I want `commit-sage` with arguments to print a terminal report end-to-end,
So that the full pipeline is demonstrably working on the walking skeleton.

**Acceptance Criteria:**

**Given** a local repo and a configured provider,
**When** `commit-sage` is invoked with at least one argument,
**Then** it runs strict single-shot (no menu, no prompts) through retrieve → analyze → narrate → assemble → render and prints a terminal report to stdout,
**And** the run exits 0 on success.

**Given** the narrated showpiece versus the analysis substrate,
**When** rendering runs,
**Then** the full narrated **showpiece** render requires the `narrative` subtree (it cannot be produced without AI), while a **substrate** render (fail-open or `--no-ai`) uses a plainer functional layout that carries the metric analysis but omits the narrative bands and cannot masquerade as the showpiece,
**And** a fail-open substrate carries a loud "⚠ Narrative unavailable" banner (exit 9) while an intentional `--no-ai` substrate is clean (exit 0, no banner).

**Given** the same invocation in a non-TTY context,
**When** it runs,
**Then** behavior is identical (headless-safe), confirming the hexagonal boundary.

**Given** a strict single-shot run that hard-fails on a missing required input,
**When** the typed error is shown,
**Then** it names what is missing and points the user to the bare `commit-sage` command for guided setup — the redirect that keeps the failure from being a hostile cliff.

## Epic 2: Complete Metrics Catalog

Get the full deterministic analysis: metric Groups B–F, commit-selection inputs, and the Free-tier cap.

### Story 2.1: Group B — Contribution & Ownership

As a user,
I want contribution and ownership metrics,
So that I can see who does the work and where knowledge concentrates.

**Acceptance Criteria:**

**Given** retrieved history,
**When** the engine runs,
**Then** Group B metrics (contributor count, contribution distribution, bus-factor/knowledge concentration, new vs departed contributors, ownership-by-area on hotspots, co-authorship signal) are computed as pure functions over the shared model, each returning the uniform envelope,
**And** all results are deterministic and manager-facing values are framed at team level, never per-developer ranking.

### Story 2.2: Group C — Commit Message Quality

As a user,
I want commit-message quality metrics,
So that I can assess communication hygiene.

**Acceptance Criteria:**

**Given** retrieved history,
**When** the engine runs,
**Then** Group C metrics (message-length distribution, Conventional Commits adherence, imperative-mood signal, low-information rate, issue-reference rate, revert/fixup signal) are computed deterministically with the uniform envelope,
**And** metrics resting on heuristics document their rule and emit `not_available` with a reason where data is insufficient.

### Story 2.3: Group D — Branching & Merge Structure

As a user,
I want branching and merge metrics,
So that I can understand workflow discipline.

**Acceptance Criteria:**

**Given** retrieved history with parent-hash topology,
**When** the engine runs,
**Then** Group D metrics (branch/merge topology summary, merge-vs-rebase tendency, direct-to-default rate, long-lived-branch signal >30 days, average changes per merge) are computed deterministically with the uniform envelope.

### Story 2.4: Group E — Code Churn & Hotspots

As a user,
I want churn and hotspot metrics,
So that I can find where work and instability concentrate.

**Acceptance Criteria:**

**Given** retrieved history with changed-file metadata,
**When** the engine runs,
**Then** Group E metrics (most-changed files/directories, churn rate over time, add/delete ratio, file survival/age, large-change events) are computed deterministically with the uniform envelope.

### Story 2.5: Group F — Repository Health Signals

As a manager,
I want a transparent, team-level health roll-up,
So that I can track hygiene without surveilling individuals.

**Acceptance Criteria:**

**Given** Groups A–E are computed,
**When** Group F runs,
**Then** the overall hygiene score is the transparent weighted composite (Message Quality 35%, Commit Size 20%, Branching 20%, Collaboration Breadth 15%, Churn Stability 10%) shown with its component sub-scores,
**And** the bus-factor risk flag is framed as team-level risk, never individual ranking,
**And** trend deltas are computed only when a prior Report JSON for the same repo is available.

### Story 2.6: Commit-selection inputs

As a user,
I want to scope which commits are analyzed,
So that I can focus the analysis on the slice I care about.

**Acceptance Criteria:**

**Given** an author filter, a max-commits limit, a no-merges flag, optional start/end dates, and/or a timezone,
**When** any are supplied,
**Then** the analyzed commit set is narrowed accordingly before metrics compute,
**And** empty start/end means unbounded on that side (all history), with no auto-shrinking,
**And** the timezone defaults to UTC and governs date-bound interpretation and time-bucketed metrics,
**And** `no-merges` changes Group A–F values consistently and deterministically for the selected set.

### Story 2.7: Free-tier 100-commit cap and truncation notice

As a Free-tier user,
I want a clear, predictable commit cap,
So that I understand exactly what was analyzed.

**Acceptance Criteria:**

**Given** the Free tier and a repository (or date range) exceeding 100 commits,
**When** analysis runs,
**Then** commits are filtered by date first, then capped to the most-recent 100 within that range,
**And** the output states "Analyzed 100 of N commits — Free tier cap",
**And** where both `--max-commits` and the Free cap apply, the smaller wins.

## Epic 3: Grounded AI Narrative & Coaching

Deliver the differentiator: a trustworthy, grounded narrative and coaching across all providers.

### Story 3.1: Full three-part Narrative

As a user,
I want a Summary, Explanation, and structured Coaching report,
So that my history is explained and turned into a prioritized plan.

**Acceptance Criteria:**

**Given** the computed metrics,
**When** narration runs,
**Then** the Narrative contains exactly three labeled parts in order: Summary, Explanation, and Coaching,
**And** Coaching is a structured report (introduction → themed chapters of prioritized steps → closing summary), not a flat list,
**And** all prose is plain-language and manager-facing content stays team-level.

### Story 3.2: Four-facet per-metric explanations

As a user,
I want every metric explained for my repo,
So that each number means something actionable.

**Acceptance Criteria:**

**Given** the full metric catalog (Groups A–F),
**When** narration runs,
**Then** every metric receives a Metric Explanation covering four facets (meaning, good behaviours, what needs improvement, suggestions),
**And** a `not_available` metric still receives an explanation stating it could not be computed and why,
**And** each explanation is anchored in its own metric and may cross-reference others only where grounded.

### Story 3.3: Per-group batched generation

As a user on a modest or local model,
I want narration generated in bounded batches,
So that runs stay affordable and survive small context windows.

**Acceptance Criteria:**

**Given** ~30 metric explanations plus coaching,
**When** generation runs,
**Then** metric explanations are batched per Metric Group (six batches) with coaching as its own call,
**And** a single failing group degrades gracefully rather than failing the whole run.

### Story 3.4: Deterministic grounding verification pass

As a user,
I want every factual claim checked against the metrics,
So that the narrative never invents history.

**Acceptance Criteria:**

**Given** generated narrative and explanations,
**When** the grounding pass runs,
**Then** it is a deterministic check (no second LLM call) verifying every numeric/factual claim references a metric `id` present in the Report JSON,
**And** unsupported claims are removed or rewritten before render,
**And** where metrics are insufficient, the narrative says so rather than fabricating.

### Story 3.5: Confidence self-assessment and escalation

As a user,
I want the tool to rate its own confidence,
So that I know when to trust the narrative or escalate.

**Acceptance Criteria:**

**Given** a completed narration and grounding pass,
**When** confidence is computed,
**Then** the run yields `high`/`medium`/`low` from verification pass rate, share of `not_available` metrics, and provider/runtime signals,
**And** low confidence explicitly recommends re-running with a stronger provider and names which config to change,
**And** low confidence never silently degrades into confident-sounding output.

### Story 3.6: Full BYOK provider breadth

As a user,
I want to choose among all supported providers,
So that I can bring my own key and endpoint.

**Acceptance Criteria:**

**Given** the provider enum {ollama, openai, gemini, anthropic, openai-compatible},
**When** a provider and model are configured,
**Then** narration works against each via the unified client,
**And** a base URL is required for `ollama` and `openai-compatible` and optional for the hosted providers,
**And** the API key is read only from the provider's native environment variable (e.g. `OPENAI_API_KEY`), never from a flag, config file, or prompt.

## Epic 4: Rich Rendered Reports

Produce shareable, readable reports in every format from the one Report JSON.

### Story 4.1: Self-contained HTML report shell

As a user,
I want a single-file HTML report with navigation,
So that I can open and share a complete report with no server.

**Acceptance Criteria:**

**Given** a Report JSON,
**When** HTML rendering runs,
**Then** it produces a single self-contained file with all assets inlined (no CDN/network) within a ~1 MB weight budget,
**And** the band order is narrative-first — masthead → Summary (TL;DR) → Explanation → Coaching → *then* the Metric Groups (story before evidence),
**And** it provides a table of contents, in-page anchors for Summary/Explanation/Coaching and each Metric Group, and works with browser search,
**And** it meets WCAG 2.2 AA contrast and keyboard-navigation expectations and remains readable with reduced motion.

### Story 4.2: Per-group charts with accessible data-table fallback

As a user,
I want a chart for each metric group with an accessible fallback,
So that the data is legible visually and to assistive tech.

**Acceptance Criteria:**

**Given** the HTML report,
**When** charts render,
**Then** each Metric Group uses its fixed chart type (A line, B Pareto+bus-factor, C stacked bar, D merge timeline, E hotspots bar + churn trend, F radar + gauge) via Chart.js with animations disabled for snapshot determinism,
**And** every chart is accompanied by a mandatory accessible data-table fallback that also serves as the no-JS degradation,
**And** no chart stands alone without its label and explanation text.

**Given** an individual metric card,
**When** it renders,
**Then** it carries a right-sized per-metric visual chosen by the metric's shape (time-series → small line/area; distribution → small bar; scalar-in-range → sparkline/mini-gauge + number; pure scalar → bold stat, no chart),
**And** small visuals use inline SVG/CSS (not a full canvas each) with one shared Chart.js runtime inlined once, keeping the single self-contained file lean,
**And** each per-metric visual also has an accessible data-table/text fallback and a derived health band (`ok`/`watch`/`risk`, or `n/a`) classified at render from §4.2 catalog-owned thresholds (not stored in the Report JSON), shown by **shape-differentiated glyph + label** (e.g. `●`/`◐`/`▲`/`○`), never color alone.

**Given** the rendered report has many metric cards,
**When** it loads with JavaScript enabled,
**Then** `watch` and `risk` cards are expanded by default while `ok` cards collapse to a one-line summary the reader can expand (progressive disclosure, so calm survives ~30 metrics),
**And** with JavaScript disabled all cards render expanded (no-JS degradation), with the data-table fallback open.

### Story 4.3: Markdown renderer

As a user,
I want a diff-able Markdown report,
So that I can commit it or post it in a PR/wiki.

**Acceptance Criteria:**

**Given** a Report JSON,
**When** Markdown rendering runs,
**Then** it emits text tables, ASCII sparklines, and Mermaid diagrams with no embedded/binary images,
**And** per-metric four-facet explanations render as **bold-label bullets, not wide tables** (so they survive a `git diff` and narrow PR columns),
**And** the file stays plain-text and reviewable, presenting the same facts as the other formats.

### Story 4.4: JSON output and multi-select formats

As an automation user,
I want to select one or more output formats including JSON,
So that I can pipe, diff, and archive the canonical artifact.

**Acceptance Criteria:**

**Given** one or more selected output formats,
**When** a run completes,
**Then** all selected formats are produced from the single Report JSON with no re-analysis or second LLM call,
**And** selecting `json` writes the canonical Report JSON to the chosen destination,
**And** HTML/Markdown with no path default to `./commit-sage-report.{html,md}`, and `-` means stdout.

### Story 4.5: HTML auto-open with `--no-open`

As an interactive user,
I want the HTML report to open in my browser automatically,
So that the payoff is immediate — while scripts can suppress it.

**Acceptance Criteria:**

**Given** HTML is selected at an interactive terminal,
**When** rendering completes,
**Then** the report auto-opens in the browser, and on auto-open failure the file path is printed clearly,
**And** `--no-open` suppresses auto-open,
**And** in a non-interactive/CI context HTML is never auto-opened regardless of the flag.

## Epic 5: Remote Repositories & Private Auth

Analyze any repository, with private access and graceful failure.

### Story 5.1: Remote HTTPS clone with stateless cleanup

As a user,
I want to analyze a remote repository by URL,
So that I can report on repos I am not sitting inside.

**Acceptance Criteria:**

**Given** a remote HTTPS repository URL,
**When** retrieval runs,
**Then** commit-sage clones it into an OS temp working directory via the system `git`,
**And** the temp clone is cleaned up on every exit path (success, failure, Ctrl-C),
**And** no clone is persisted between runs (stateless).

### Story 5.2: Private-remote token authentication

As a user with a private repository,
I want to authenticate with a personal access token from the environment,
So that I can analyze private history without leaking secrets.

**Acceptance Criteria:**

**Given** a private remote target,
**When** a token is required,
**Then** it is read only from an environment variable (never a flag, config file, or prompt) and never written to Report JSON, logs, or output,
**And** a local path or public remote requires no token and its absence is never an error,
**And** a token with insufficient scope produces a clear, actionable error naming the missing permission.

### Story 5.3: Graceful no-retry failure handling

As a user,
I want clear, distinct failures with no silent retries,
So that I know exactly what went wrong and can choose to re-run.

**Acceptance Criteria:**

**Given** a retrieval failure,
**When** it occurs,
**Then** network failure, auth failure, and "repo not found" are distinguished in the message,
**And** on a transient or rate-limit error the tool does not retry — it reports the provider and the failure class (including reset guidance where available) and exits without producing a partial Report.

## Epic 6: Interactive Experience

Give a newcomer a guided, self-teaching first run, a Settings screen to configure AI and defaults, plus the operational flag surface.

### Story 6.1: Launchpad menu

As a newcomer in my repo,
I want a discovery menu when I run the bare command,
So that I can find what the tool does without reading docs.

**Acceptance Criteria:**

**Given** zero arguments in an interactive terminal,
**When** `commit-sage` runs,
**Then** a calm, line-oriented launchpad opens led by "Analyze this repository (cwd)", then "Analyze a remote repository", **"Settings"**, "Status / doctor", and "Help / show all flags",
**And** a persistent **header readiness line** (tier · AI provider/model or ⚠ not configured · cwd path + branch) tops the screen,
**And** license actions are shown by effective state (Activate, Buy / Restore, Buy Me a Coffee when unlicensed; Deactivate when licensed),
**And** the menu is fully keyboard-navigable, never relies on color alone, and Esc/quit exits cleanly printing a short flags cheatsheet.

### Story 6.2: Guided prompts and command echo

As a newcomer,
I want to be asked only for what's missing and shown the equivalent command,
So that the run is easy now and I learn the headless form for next time.

**Acceptance Criteria:**

**Given** a guided run,
**When** prompts are collected,
**Then** only missing required inputs are asked, anything inferable (cwd is a git repo, default format) is defaulted, and prompt styling never bleeds into the report,
**And** on completion the equivalent non-interactive command is echoed (e.g. `Next time: commit-sage --max-commits 500 --format md`),
**And** the menu names any required secret's environment variable but never collects the secret.

### Story 6.3: Status/doctor view and first-run-no-AI guidance

As a user who isn't sure my setup is right,
I want a status view that tells me where I stand,
So that I can fix configuration before running.

**Acceptance Criteria:**

**Given** the Status/doctor action,
**When** it runs,
**Then** it shows the current license tier, the configured provider/model, **whether the provider is reachable (probed, not merely configured)**, and which required environment variables are set vs missing (named, never their values),
**And** for a first run with no AI provider configured it names the fix ("set `OPENAI_API_KEY`, or use a local Ollama provider") and surfaces Ollama as the zero-cost local path,
**And** it is read-only and never collects a secret.

**Given** a user chooses an Analyze action while no provider is configured,
**When** the choice is made,
**Then** the Analyze row is **not** disabled — a calm no-AI interstitial appears that names the env var / points to Settings and the zero-cost Ollama path (teach, never wall),
**And** choosing Ollama is accompanied by a note that it must be running (`ollama serve` / `ollama pull <model>`), since selection alone is not reachability.

### Story 6.4: Operational flags

As a power user and CI author,
I want operational flags for config inspection and output control,
So that I can verify and tune behavior precisely.

**Acceptance Criteria:**

**Given** `--show-config`,
**When** it runs,
**Then** it prints the resolved configuration with per-field provenance, renders every secret as `***`, and exits without running.

**Given** `--non-interactive`, `--verbose`/`--quiet`, `--version`, and `NO_COLOR`/`FORCE_COLOR`,
**When** each is used,
**Then** `--non-interactive` forces strict single-shot from a TTY, verbosity adjusts stderr only, `--version` prints and exits, and color honors `NO_COLOR`/`FORCE_COLOR` alongside TTY detection.

**Given** the `aiMode` flags `--ai` / `--no-ai`,
**When** a run is invoked,
**Then** `--no-ai` forces metrics-only (no LLM call, clean substrate, exit 0) and `--ai` forces narration-required (hard-fail with the narration exit code if the provider is unreachable),
**And** with neither flag the default is `auto` interactively (AI-first, fail-open on failure) and `off` in headless/CI (metrics-only, with a one-line nudge that narrative is available interactively or with a key).

### Story 6.5: Settings — configure AI and defaults

As a user,
I want a Settings screen to choose my AI provider and defaults once,
So that I don't re-specify them every run and the first-run "no AI" state has a clear cure.

**Acceptance Criteria:**

**Given** the Settings menu action,
**When** the user configures provider (closed enum), model, base URL, default output format, timezone, and/or max-commits,
**Then** the non-secret choices are written to the config home (`~/.commit-sage`) via an atomic write (temp + rename) and remembered across runs,
**And** no secret is ever collected or written — a cloud provider's API key remains environment-variable-only and is named, never entered.

**Given** a saved Setting and an overriding environment variable or flag,
**When** the next run resolves config,
**Then** the resolver precedence holds (config < env < flags) so the explicit override wins,
**And** choosing the local Ollama provider in Settings resolves the first-run "no AI provider" state at zero cost.

## Epic 7: Licensing & Distribution

Monetize and ship: online tier enforcement and a self-contained binary.

### Story 7.1: Online license validation and tier resolution

As the product owner,
I want licenses validated online at startup,
So that paid tiers are enforced before any analysis.

**Acceptance Criteria:**

**Given** a run that requires a tier check,
**When** commit-sage starts,
**Then** before any analysis or rendering it validates the license online via the Lemon Squeezy License API and resolves the effective tier into the frozen `RunConfig` (e.g. `entitlement {tier, commitCap?}`),
**And** the Free tier holds no key, makes no API call, and runs with the 100-commit cap,
**And** license validation transmits only the license key and a device identifier — never repository data.

### Story 7.2: Activate, deactivate, and buy/restore

As a paid user,
I want to activate, move, and recover my license,
So that I control my devices without new purchases.

**Acceptance Criteria:**

**Given** the unlicensed interactive menu,
**When** the user chooses "Buy / Restore license",
**Then** commit-sage opens the store in the browser to buy a new license or recover an existing purchase (no in-terminal key entry, no in-app checkout).

**Given** the unlicensed interactive menu and a license key in hand,
**When** the user chooses "Activate license" and enters the key,
**Then** commit-sage validates it online and caches the activation-instance id under `~/.commit-sage` — this is the only in-app key-entry screen.

**Given** a licensed Single-device user,
**When** they choose "Deactivate license",
**Then** the current activation instance is freed so the license can move to another device with no new purchase,
**And** activating on a second device while still active is refused with a clear message.

### Story 7.3: Fail-closed vs degrade-to-Free and CI validate-not-activate

As a CI author and an interactive user,
I want correct behavior when validation can't complete,
So that automation stays trustworthy and interactive use stays friendly.

**Acceptance Criteria:**

**Given** a headless/CI run whose license validation fails (unreachable, network, transient, or definitively invalid/revoked),
**When** the gate evaluates,
**Then** it fails closed — no analysis or rendering — exiting with the license exit code,
**And** the CI runner is supplied the key via environment variable and performs a validate (never a fresh activate), so a multi-repo matrix does not exhaust activations.

**Given** an interactive run whose license cannot be validated,
**When** the gate evaluates,
**Then** it degrades to the Free 100-commit cap and clearly states it is running under the Free cap, never refusing to run.

### Story 7.4: Node SEA packaging spike

As a user without a Node runtime,
I want a self-contained executable,
So that I can run commit-sage with no prerequisites.

**Acceptance Criteria:**

**Given** the Node SEA build,
**When** it is produced and run on macOS, Linux, and Windows,
**Then** interactive prompts, raw-mode stdin, and ANSI rendering work correctly from the packaged binary,
**And** git retrieval works via the system `git` shell-out (no native bindings) from the packaged binary,
**And** if SEA proves unviable on a platform the spike records `pkg`/`nexe` as the fallback.
