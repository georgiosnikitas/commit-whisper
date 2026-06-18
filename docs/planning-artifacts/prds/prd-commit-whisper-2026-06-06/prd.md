---
title: commit-whisper
status: final
created: 2026-06-06
updated: 2026-06-13
---

# PRD: commit-whisper

## 0. Document Purpose

This PRD is for the product owner (George), downstream BMAD workflow owners (UX, architecture, epics & stories), and any engineer implementing commit-whisper. It builds on the finalized product brief at [brief.md](../../briefs/brief-commit-whisper-2026-06-06/brief.md) and its [addendum.md](../../briefs/brief-commit-whisper-2026-06-06/addendum.md) (competitive landscape) — it does not duplicate them. Structure: a Glossary anchors vocabulary; features are grouped with globally numbered Functional Requirements (FR-N) nested beneath them; the metrics catalog (§4.2) is the analytical heart; cross-cutting NFRs, constraints, and monetization live in their own sections; assumptions are tagged inline as `[ASSUMPTION]` and indexed in §13. Implementation/technology detail (the "how") is kept out of the FRs and parked in `addendum.md`.

## 1. Vision

commit-whisper is a terminal-native tool that turns impenetrable git history into a clear, narrated report. Existing tools produce git statistics and graphs, but developers still can't *understand* them. commit-whisper closes that comprehension gap: it retrieves commit history from a remote, computes a thorough analysis, and then uses AI to **explain the history in plain language** and **coach the reader toward better git practices** — grounded entirely in what the repository's own data shows.

The need is one of scale. A developer, team, or engineering manager can be responsible for many repositories, each with a history far too long for any human to read end to end. commit-whisper reads what no human can and hands back a story plus a path to improvement. Because it lives in the terminal and emits a canonical JSON artifact, it runs on a developer's machine, automates inside CI/CD, and renders into HTML, Markdown, or terminal output from one analysis.

It is positioned as **developer-owned insight** — the developer learns how to improve; a manager who is part of the team sees repository *health* to help the team shore up weaknesses and confirm strengths — never a per-developer surveillance scoreboard. Its tagline: *"I know what you did last commit."*

## 2. Target User

### 2.1 Jobs To Be Done

- **Understand an unfamiliar or long history fast** — "I inherited this repo / these repos; tell me what happened and what matters."
- **Learn to use git better** — "Show me, from my own history, how to write better commits and branch more sanely."
- **Onboard into a codebase's past** — a new hire reconstructing context without reading thousands of commits by hand.
- **Keep history healthy at scale** — run repeatedly / in CI to watch hygiene trend over time across many repos.
- **See team-level repository health (manager)** — where knowledge concentrates (bus-factor risk), where practices are slipping, where they're strong — to help, not to rank individuals.

### 2.2 Non-Target Users

- Teams wanting a hosted web dashboard / SaaS analytics portal — commit-whisper is terminal-native and emits files; there is no central portal.
- Managers seeking a per-developer productivity/ranking scoreboard — out by design, permanently.
- Users wanting forward authoring (AI that writes their next commit message / PR) — that is a different category; commit-whisper explains the *past*.

### 2.3 Key User Journeys

- **UJ-1. Dana inherits a five-year-old repo and needs the story by lunch.**
  - **Persona + context:** Dana, a senior dev who just joined the team and was handed a long-lived service repo nobody fully remembers.
  - **Entry state:** terminal open, commit-whisper installed, a GitHub repo URL to hand, and a personal access token set as an environment variable so it stays out of shell history.
  - **Path:** runs `commit-whisper analyze <repo-url>` — because she passes arguments, the run is strict single-shot with no prompts (a first-timer who didn't yet know the command could instead run the bare `commit-whisper` command for a guided, menu-driven setup); the tool reads all branches by default (she could scope to one branch if she wanted), computes metrics, calls her configured LLM; a progress indicator shows phases (retrieve → analyze → explain).
  - **Climax:** an HTML report opens — a TL;DR of the repo's story up top, plain-language explanation of the patterns (ownership, cadence, risky hotspots), graphs she can actually read, and a coaching section.
  - **Resolution:** Dana can recount the repo's history and names two concrete improvements. She bookmarks the report and shares the file with her team.

- **UJ-2. Marco automates a monthly health check in CI.**
  - **Persona + context:** Marco, a team lead with the unlimited/automation license, wants hygiene tracked without anyone remembering to run it.
  - **Entry state:** a CI pipeline, the commit-whisper binary, a token plus an LLM key stored in CI secrets, and the Unlimited/Automation license key supplied to the runner as an environment variable.
  - **Path:** a scheduled job runs commit-whisper headless against each repo — it always passes arguments, so execution is strictly non-interactive: were a required input missing it would fail fast with a typed error and machine-readable exit code, never hang; secrets (token, LLM key) are injected as environment variables from the CI secret store, while non-secret config (repo URL, output formats) is passed as flags; at startup the runner **validates** the license against its existing activation instance rather than re-activating (per FR-16), so a multi-repository matrix never exhausts the tier's activation limit; the tool emits JSON and a Markdown report as build artifacts; non-zero exit only on operational failure, not on "unhealthy" findings.
  - **Climax:** the Markdown health report lands in the pipeline artifacts every month; the JSON is diffed against last month to show whether hygiene is trending up.
  - **Resolution:** the team sees improvement over time without manual effort; Marco never opens a dashboard.

- **UJ-3. Sofia, who is rusty with git, runs it on her own side project to get better.**
  - **Persona + context:** Sofia, a solo developer on the free or single-device tier, knows her commits are messy.
  - **Path:** runs commit-whisper on her own repo — rusty with the CLI, she starts with the bare `commit-whisper` command (no arguments) for a guided, menu-driven run that prompts her for the non-secret inputs it needs; her LLM key is read only from an environment variable, so on first run, if it is unset, the menu names the exact variable to set and she exports it and re-runs (the tool never prompts for or stores secrets); on the paid Single-device tier her first run also walks her through a **one-time interactive activation** — a single network call that caches the activation-instance id locally, so later runs simply validate — while on the free tier she supplies no key and that step never happens; the coaching section, grounded in her actual messages and branching, gives her step-by-step changes; on the free tier, an optional Buy Me a Coffee support link is available.
  - **Resolution:** *"I finally understand what my history says about me, and I know exactly what to fix."*

## 3. Glossary

- **Repository (repo)** — a single git repository commit-whisper analyzes, identified **either** by a local filesystem path **or** by a remote URL (FR-1).
- **Remote provider** — the hosting service for a repo: GitHub, GitLab, or Bitbucket.
- **Commit history** — the full set of commits, authors, timestamps, messages, branch/merge structure, and changed-file metadata commit-whisper reads from a repo.
- **Analysis** — the complete set of computed Metrics for a repo, independent of AI.
- **Metric** — a single computed measurement about the history, belonging to a Metric Group, with a title and a description of what it represents (catalog in §4.2).
- **Metric Group** — a named cluster of related Metrics (e.g., *Contribution & Ownership*).
- **Metric Explanation** — an LLM-generated, repo-specific assessment paired with an individual Metric (§4.2) — carried in the Report JSON `narrative` subtree and keyed to its Metric by metric id (FR-12), not nested inside the Metric's deterministic record — grounded in that Metric's data, covering four things: (1) an **explanation** of what the Metric's value means for this repo, (2) the **good behaviours** it reveals, (3) what **needs improvement**, and (4) **suggestions** on how to improve. Distinct from the repo-level AI Narrative.
- **Report JSON** — the canonical machine-readable artifact, organized into top-level subtrees: **`analysis`** (the deterministic Metrics — each Metric's value(s), status, and reason, with no AI content; the byte-stable trend-diff target) and **`narrative`** (all AI content — the repo-level AI Narrative plus the per-metric Metric Explanations, keyed by metric id), plus an **optional `provenance`** subtree of run metadata (repo identity, scale, AI provider/model, timestamp + tool version, entitlement) that every renderer displays and that is **excluded from the trend-diff**, so `analysis` stays byte-stable (FR-17). All rendered outputs are generated from it; it is the single source of truth. (Full shape and the `schemaVersion: "1.0.0"` pre-implementation status are defined in FR-12; the provenance subtree in FR-17.)
- **Rendered output** — a human-facing report generated from Report JSON via a template: **HTML**, **Markdown**, or **Terminal**.
- **Output format** — a user-selectable form of a run's output. There are four: **JSON** (the canonical Report JSON itself, emitted for piping/automation/diffing), **HTML**, **Markdown**, and **Terminal**. Output is **multi-select** — a single run can emit several formats from the one Report JSON (FR-13).
- **Config home** — the directory `~/.commit-whisper` where commit-whisper keeps its **config file** and the cached **license activation-instance id** (a licensing artifact, not a secret). Secrets (git access token, LLM key) are never stored here — they are environment-variable-only (FR-2, FR-11, FR-16); the config-file location is overridable with `--config <path>`.
- **AI Narrative** — the LLM-generated text, in three parts: **Summary**, **Explanation**, **Coaching** (defined below).
- **Summary** — a short TL;DR of the repo's story and headline findings, for skimming.
- **Explanation** — plain-language interpretation of what the Metrics show and why.
- **Coaching** — a structured improvement **report** (introduction → themed chapters → closing summary), prescriptive and prioritized, grounded in this repo's Metrics; it consolidates and ranks the per-metric improvement suggestions (§4.2 Metric Explanations) into a coherent plan to improve future git practice.
- **LLM provider** — the user-configured AI backend: Ollama (local), OpenAI, Gemini, Anthropic, or any OpenAI-compatible endpoint. **BYOK** (bring-your-own-key).
- **Grounding** — the requirement that every factual AI claim trace to a specific computed Metric; the AI may not assert history facts the Metrics don't support.
- **Confidence self-assessment** — the AI's own rating of how well the available model/data supported a trustworthy Narrative, with escalation advice when low.
- **License tier** — Free, Single-device, or Unlimited/Automation (defined in §9 Monetization). Paid tiers are enforced by an online License validation check (below).
- **License validation** — the online check, performed at startup before any analysis or rendering, that confirms a paid license via the third-party licensing service (Lemon Squeezy License API: *activate* / *validate* / *deactivate*). Single-device device binding is enforced server-side through Lemon Squeezy *activation instances*; Unlimited/Automation permits many activations, including headless/CI (which *validate* against an existing instance rather than re-*activate*). The Free tier performs no check — no key, no network call. Validation transmits only the license key and a device identifier — never repository data (FR-16).
- **Non-interactive (headless / CI) mode** — any execution that is *not* the bare zero-argument interactive run: no prompts, all inputs from environment variables, config file, and/or flags (secrets from environment variables only), machine-readable exit codes, file artifacts, and a hard fail on missing required input. Covers arg-bearing terminal runs and CI/CD alike.

## 4. Features

### 4.1 Repository Retrieval

**Description:** commit-whisper retrieves the full Commit history for a Repository — from a **local filesystem path** (read in place) or a **remote** git provider (GitHub, GitLab, or Bitbucket, including private repositories via a personal access token; cloned statelessly and cleaned up). In interactive mode the default target is the current directory. Retrieval is read-only. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-1: Target a local or remote repository

A user can point commit-whisper at a Repository — a **local filesystem path** to a git working copy **or** a **remote HTTPS URL** — and retrieve its Commit history. Both are first-class targets. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- Accepts **both** a local filesystem path to an existing git repository **and** a remote repository URL for GitHub, GitLab, and Bitbucket (HTTPS form at minimum); neither target type is privileged over the other.
- In **interactive mode** (the bare zero-argument command, FR-14) the **default target is the current working directory (cwd)** when the cwd is a git repository; the user may instead choose to analyze a remote repository.
- A **local path** is read in place: it requires **no clone and no access token** (FR-2), whether the upstream remote is public, private, or absent.
- A **remote** repository is retrieved by a **stateless clone** to a temporary location that is **guaranteed cleaned up** on every exit path; commit-whisper keeps no persistent copy of remote repository data.
- Retrieves the full commit history across all branches reachable without extra credentials by default; the user can scope retrieval to a single named branch.
- **Commit-selection inputs narrow which commits feed the Analysis (§4.2), independently of target type:** an **author filter** (focus on / limit to a single author), a **max-commits** limit (analyze at most N commits), and **no-merges** (exclude merge commits). All are optional; omitting them analyzes the full reachable set (subject to the Free-tier cap, §9 / FR-16).
- **Date range is optional and unbounded by default.** Optional **start** and **end** dates bound the analyzed history; an empty value means unbounded on that side (all history). commit-whisper does **not** auto-shrink or cap-aware-shrink the range.
- **Timezone is an explicit input defaulting to UTC.** A user-supplied timezone governs how date-range bounds are interpreted and how time-bucketed Metrics are computed (§4.2 Group A, FR-4); when unset it defaults to **UTC**, keeping date filtering and time-of-day/day-of-week Metrics deterministic and reproducible.
- Reads, at minimum, per commit: hash, author identity, committer identity, author timestamp, commit timestamp, message, parent hashes (to reconstruct branch/merge structure), and changed-file metadata (paths, insertions, deletions).
- Operation is strictly read-only; commit-whisper never writes to, pushes to, or mutates the local repository or the remote.

`[NOTE FOR PM]` The **retrieval mechanism** — full `git clone` vs. provider REST/GraphQL API paging — is capability-shaping, not merely an implementation detail: it gates rate-limit exposure (FR-3's no-retry hard stop), performance budgets (§7), and which Group E churn/diff metrics (§4.2) are affordable. Current leaning is **`git clone`**, chosen partly to minimize rate-limit exposure given the no-retry posture; to be confirmed in the architecture phase, with the rationale and override conditions captured in `addendum.md`.

#### FR-2: Authenticate to private repositories

A user can supply a personal access token to analyze a private **remote** Repository. Realizes UJ-2.

**Consequences (testable):**
- **A token is needed only for a *private remote* Repository.** A **local** repository path (FR-1) needs no token regardless of upstream visibility, and a **public** remote needs none either; commit-whisper requests a token only to retrieve a private remote, and the absence of a token is never an error for local or public targets.
- When a token is needed, it is provided via environment variable **only** — never as a command-line argument and never via the config file. This single rule holds in both interactive and headless/CI mode: interactively it keeps the token out of shell history, and in CI it matches how providers inject secrets (e.g. GitHub Actions secrets, GitLab CI variables) — as environment variables, not flags. commit-whisper never prompts for the token and never persists it.
- **The token's primary environment variable is `COMMIT_WHISPER_GIT_TOKEN`; host-specific variables are a lower-precedence fallback.** commit-whisper reads the namespaced **`COMMIT_WHISPER_GIT_TOKEN`** first and, only when it is unset, falls back to the host-specific convenience variable matching the target's provider — **`GITHUB_TOKEN`**, **`GITLAB_TOKEN`**, or **`BITBUCKET_TOKEN`**. When both are present the namespaced variable **wins**. This precedence is deliberate: CI platforms **auto-inject `GITHUB_TOKEN`** (GitHub Actions provides one scoped to the *current* workflow's repository), which would otherwise silently shadow a token a user set to analyze a *different* private repo — so `COMMIT_WHISPER_GIT_TOKEN` is the namespaced escape hatch that always takes precedence over that auto-injected value.
- A token with insufficient scope produces a clear, actionable error naming the missing permission, not a raw provider error.
- Tokens are never written to Report JSON, logs, or any Rendered output.

#### FR-3: Handle retrieval limits and failures gracefully

commit-whisper degrades gracefully on partial or failed retrieval.

**Consequences (testable):**
- Network failure, auth failure, and "repo not found" are distinguished in error messages.
- On a transient or rate-limit error from a provider, the tool does not retry: it reports the condition clearly (including which provider and, where available, the provider's own guidance such as a rate-limit reset time) and exits without producing a partial Report. commit-whisper does not absorb or work around faults in systems outside its responsibility; re-running is the user's choice.
- **The Free-tier cap is applied *after* date filtering.** When the analyzed set exceeds the Free-tier cap (§9, FR-16), commit-whisper keeps only the **most-recent 100 commits** and the report states it was capped. When a **date range** (FR-1) is supplied the ordering is explicit and testable: **filter by date first, then cap to the most-recent 100 *within that range*** — never cap first and then filter. The truncation notice names both counts, e.g. **"Analyzed 100 of N commits — Free tier cap."** Where both `--max-commits` and the Free cap would apply, the smaller limit wins.

**Out of Scope:**
- Self-hosted / generic git servers beyond the three named providers (GitHub, GitLab, Bitbucket). Not planned.
- SSH-key authentication. Token-based only.

### 4.2 History Analysis — Metrics Catalog

**Description:** commit-whisper computes a thorough, deterministic Analysis from the retrieved Commit history, independent of any AI. Metrics are organized into Metric Groups; each Metric has a title and a description of what it represents. This catalog is the analytical heart of the product and the factual basis the AI Narrative is grounded against (§4.4). All Metrics are computed from data already retrieved in §4.1; none require writing to the repo. In addition to its deterministic title and one-line description, **every Metric also receives an LLM-generated Metric Explanation** (§4.4, FR-8) that, for this repo, explains what the Metric's value means, calls out the **good behaviours** it reveals, identifies **what needs improvement**, and gives **suggestions on how to improve**. Realizes UJ-1, UJ-2, UJ-3.

> **Catalog note:** the groups and metrics below are the target set. The one-line text under each Metric is its *static* description (what it represents); the per-run, repo-specific **Metric Explanation** (explanation + good behaviours + what needs improvement + how to improve) is generated by the LLM (FR-8) and is separate. Individual metrics carry `[ASSUMPTION]` where definition or feasibility needs confirmation. The exact graph paired with each group is named in §4.3.

**Group A — Activity & Cadence** *(how the project moves over time)*
- **Commit volume over time** — count of commits per day/week/month; shows the project's heartbeat and lulls.
- **Commit frequency / cadence** — average and median interval between commits; regularity vs. burstiness.
- **Active vs. dormant periods** — stretches of high activity and silence, with start/end dates.
- **Project age & lifespan** — first commit date, latest commit date, total elapsed time.
- **Commit size distribution** — distribution of changed lines per commit; reveals "giant commit" tendencies.
- **Time-of-day / day-of-week pattern** — when work happens (e.g., heavy weekend or late-night commits), bucketed in the user-supplied **timezone** (default UTC; see FR-1/FR-4).

**Group B — Contribution & Ownership** *(who does the work)*
- **Contributor count** — total distinct authors over the history and currently active.
- **Contribution distribution** — share of commits/lines per author; concentration vs. spread.
- **Bus-factor / knowledge concentration** — how few people account for the majority of changes; a key team-health/risk signal. `[ASSUMPTION: threshold-based, e.g. authors covering 50% of changes.]`
- **New vs. departed contributors** — first-seen and last-seen dates per author; onboarding and attrition signal.
- **Ownership by area** — which authors dominate which directories/files, computed on hotspots only (top 10 directories and top 20 files by touch count) to bound cost.
- **Co-authorship / collaboration signal** — use of `Co-authored-by` trailers where present. `[ASSUMPTION]`

**Group C — Commit Message Quality** *(communication hygiene)*
- **Message length distribution** — subject/body length; flags chronically terse ("fix", "wip") or absent messages.
- **Conventional Commits adherence** — share of messages matching the Conventional Commits standard (`feat:`, `fix:`, etc.).
- **Imperative-mood / style signal** — heuristic on subject style and capitalization/punctuation consistency. `[ASSUMPTION]`
- **Low-information message rate** — proportion of messages that are empty, single-word, or boilerplate.
- **Issue/ticket reference rate** — share of messages linking an issue/ticket ID. `[ASSUMPTION]`
- **Revert / fixup / amend signal** — frequency of reverts and `fixup!`/`squash!` style messages; churn-of-intent indicator.

**Group D — Branching & Merge Structure** *(workflow discipline)*
- **Branch/merge topology summary** — count of merges, share of merge commits, presence of a recognizable workflow.
- **Merge vs. rebase tendency** — heuristic on whether history is merge-heavy or linear, based on merge-commit share and first-parent linearity.
- **Direct-to-default-branch rate** — share of commits landing straight on the default branch vs. via merge. `[ASSUMPTION]`
- **Long-lived branch signal** — merged branches whose span (first unique commit timestamp to merge timestamp) exceeds 30 days.
- **Average changes per merge** — size of integrated units; small steady merges vs. big-bang integrations.

**Group E — Code Churn & Hotspots** *(where the work concentrates)*
- **Most-changed files / directories** — files touched most often; likely complexity or instability hotspots.
- **Churn rate over time** — insertions+deletions trend; rising churn can signal instability.
- **Add/delete ratio** — growth vs. refactor/removal balance.
- **File survival / age** — median file age measured as days between first-seen and latest-seen commit timestamps for files currently present in HEAD.
- **Large-change events** — commits/merges with outsized diffs, flagged with dates and context.

**Group F — Repository Health Signals** *(roll-up for managers, team-level only)*
- **Overall hygiene score** — a transparent 0-100 composite: Commit Message Quality 35%, Commit Size Discipline 20%, Branching Discipline 20%, Collaboration Breadth (bus-factor/contribution spread) 15%, Churn Stability 10%; always shown with component sub-scores so it is not a black box.
- **Bus-factor risk flag** — team-level concentration-of-knowledge risk (from Group B), framed as risk to mitigate, never as individual ranking.
- **Trend deltas** — where a prior Report JSON for the same repo is available, change since last run (improving/declining hygiene). Powers UJ-2.
- **Hygiene strengths & weaknesses** — the repo's best and worst dimensions, surfaced for the Coaching section.

**Metric health bands** *(presentational framing — team-level, never per-developer judgement)*

Every Metric additionally carries a **health band** — one of `ok`, `watch`, or `risk`, plus `n/a` — that tells a reader at a glance whether the Metric is healthy, worth watching, or a risk to address. Each band is derived from **catalog-owned thresholds**: per-Metric boundaries that are **domain knowledge owned here in §4.2** — the same kind of owned domain knowledge as the Group F hygiene-score weights above — not a rendering concern. The band is **classified presentationally at render time** by comparing a Metric's computed value against those thresholds; it adds nothing to the deterministic Analysis and is therefore **not stored in Report JSON** (it is re-derived on every render). Bands are **team-level framing meant to direct attention**, never a judgement of any individual developer — the §8 positioning guardrail binds them exactly as it binds Group F. A Metric marked `not_available` (FR-4) is band **`n/a`**. Ownership is split cleanly: the **thresholds live with the domain** (this catalog); the **renderer (FR-6) only consumes** them to show the band.

**Functional Requirements:**

#### FR-4: Compute the metrics catalog

commit-whisper computes the Metrics in Groups A–F from the retrieved history, deterministically and without AI.

**Consequences (testable):**
- Every Metric in the catalog is either computed and present in Report JSON, or explicitly marked `not_available` with a reason (e.g., data insufficient) — never silently omitted.
- Identical input history produces identical Metric values across runs (determinism), **for a fixed selection**: the same history *and* the same commit-selection and timezone inputs (FR-1) always yield identical values.
- **Commit-selection inputs (FR-1) change which commits feed the Metrics.** Author filter, max-commits, no-merges, and the date range determine the input commit set; in particular **`no-merges` excludes merge commits and therefore changes the computed values across Groups A–F** (e.g., merge counts and merge-density in Group D, churn in Group E). The **timezone** input (default UTC) governs the day/week/month and time-of-day/day-of-week bucketing in Group A.
- Each Metric lives under the Report JSON **`analysis`** subtree (FR-12), carrying its title, machine value(s), status, and the description of what it represents — `analysis` holds deterministic facts only, with no AI content.
- No Metric computation requires any network call beyond the retrieval in §4.1, and none mutate the repo.

#### FR-5: Group and describe metrics for human consumption

Metrics are organized into the named Groups, each Metric self-describing.

**Consequences (testable):**
- The Report JSON **`analysis`** subtree (FR-12) represents Groups and the Metrics within them as a stable structure with stable keys (so templates and downstream tooling can rely on them).
- Each Group has a title and short description; each Metric has a title and a one-line description of what it represents.

**Notes:** The metric set is confirmed computable from retrieved history data and bounded to fit the performance budgets in §7.

### 4.3 Visualization

**Description:** commit-whisper renders modern, clean graphs of the Metrics in the HTML Rendered output, with text-appropriate reductions in Markdown and Terminal. Graphs exist to make Metric Groups legible at a glance, paired with the AI Explanation. Realizes UJ-1.

**Functional Requirements:**

#### FR-6: Render group charts and a per-metric visual for every metric

The HTML output presents a **group overview chart for each Metric Group** *and* a **right-sized per-metric visual on every Metric**, so the report is legible both at a glance (per group) and metric by metric.

**Consequences (testable):**
- **The six group overview charts keep their fixed signature types:** Group A = multi-series line chart (commits and churn over time); Group B = Pareto bar chart (contribution concentration) plus bus-factor marker; Group C = stacked bar chart (message quality categories); Group D = branch/merge timeline with merge-density bars; Group E = horizontal bar chart for hotspots plus churn trend line; Group F = radar chart for component scores plus overall score gauge.
- **Every Metric additionally carries its own per-metric visual, sized to the Metric's shape** so the self-contained file does not balloon: a **time-series** Metric → a small line/area chart; a **distribution** Metric → a small bar/histogram; a **scalar within a range** (e.g. hygiene score, Conventional-Commits %) → a sparkline or mini-gauge plus the number; a **pure scalar** (e.g. bus factor, project age) → a bold stat with **no chart**. The per-metric visual is *in addition to* — never a replacement for — the six group overview charts.
- **Every Metric's visual/card also carries its derived health band** (§4.2 *Metric health bands*) — `ok`, `watch`, `risk`, or `n/a` for a `not_available` Metric — **shown by a distinct glyph *and* a text label, never by color alone**, so the band survives greyscale, color-blindness, and no-CSS rendering. The band is **derived presentationally at render time** from the §4.2 catalog-owned thresholds; it is not stored in Report JSON.
- **Every chart — group overview and per-metric — is paired with explanatory text and carries an accessible data-table fallback**, so no chart ever stands alone and screen-reader / no-JS readers lose no data.
- Graphs render from Report JSON without re-running the Analysis.
- HTML is **self-contained**: a single file that renders fully by opening it in a browser, with no external network dependency, CDN, or companion asset files — assets (CSS, scripts, fonts, images) are inlined. (The inlining *technique* is an architecture detail; it keeps the rendered report self-contained and upholds the no-central-portal positioning.)
- **Carrying both group and per-metric visuals increases the inlined file weight**, mitigated by the shape-based right-sizing above: the bulk of per-metric visuals are lightweight sparklines or bold stats rather than full canvases, and the charting runtime is inlined once and shared by every chart.

#### FR-7: Degrade visuals appropriately per output format

Each Rendered output presents visuals suited to its medium.

**Consequences (testable):**
- Markdown output uses **no embedded/binary images**. Visuals are expressed as text: tables, ASCII charts/sparklines, and **Mermaid diagrams** (rendered natively by GitHub, GitLab, and common Markdown viewers; shown as fenced code where unsupported). The file stays plain-text, diff-able, and reviewable in a pull request.
- Terminal output presents compact textual summaries / sparklines rather than full graphs.
- No Rendered output depends on a network connection or a central server to display.

### 4.4 AI Narrative — Explanation & Coaching

**Description:** commit-whisper sends the computed Metrics (not raw code) to the user-configured LLM provider and produces (a) the repo-level AI Narrative in three parts — **Summary**, **Explanation**, and a **Coaching** improvement report (introduction → themed chapters → summary) — and (b) a **Metric Explanation** for every Metric in the §4.2 catalog. The Narrative is the product's core differentiator: it makes the Analysis *understandable* and turns it into improvement. Every factual claim must be grounded in the Metrics, and the AI rates its own confidence and escalates when low. Realizes UJ-1, UJ-3.

**Voice & tone standard:** the Narrative reads like a knowledgeable peer who has read the entire history and wants to help — plain language, no unexplained jargon, encouraging rather than judgmental. Coaching is prescriptive but supportive ("a good next step is…", not "you should have…"). This voice is load-bearing: it is the felt difference between commit-whisper and a raw statistics dashboard, and it carries the brief's promise of a *narrated story*.

All AI prose must follow this style guide:
- Use direct, plain language; explain any unavoidable technical term in context.
- Prefer constructive, actionable phrasing over blame or scorekeeping.
- Ground tone in repository evidence (metrics first, interpretation second).
- Avoid absolutist wording unless the metric support is explicit.

**Functional Requirements:**

#### FR-8: Generate the AI Narrative and a per-metric explanation

commit-whisper produces, from the computed Metrics, (a) the repo-level Narrative — Summary, Explanation, and Coaching — and (b) a Metric Explanation paragraph for every Metric in the §4.2 catalog. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- The repo-level Narrative contains exactly three labeled parts in order: Summary (TL;DR of the repo's story and headline findings), Explanation (what the Metrics show and why), Coaching (the structured improvement report defined below).
- **The Coaching part is a structured report**, not a flat list: it contains an **introduction** (framing the repo's current state and what the plan addresses), one or more **themed chapters** (each grouping related improvements — e.g., commit-message hygiene, branching discipline, churn/hotspots — with prescriptive, prioritized steps), and a **closing summary** (the top priorities and recommended order of action).
- Coaching **consolidates and prioritizes the per-metric improvement suggestions** (the facet-4 "how to improve" content of the §4.2 Metric Explanations): per-metric suggestions are local to one Metric, while Coaching ranks across all of them into one plan, so the two never contradict.
- **Every Metric in Groups A–F carries its own Metric Explanation** — a repo-specific, grounded assessment of *that* Metric (not a restatement of its static one-line description, FR-5) covering four things: (1) an **explanation** of what the Metric's value(s) mean for this repo, (2) the **good behaviours** the Metric reveals, (3) what **needs improvement**, and (4) concrete **suggestions on how to improve**.
- Where a Metric reveals no notable strength, or nothing to improve, its Metric Explanation says so explicitly rather than inventing one — the four facets are always addressed, even if the answer is "no issues found" / "already healthy" (grounded per FR-9).
- A Metric marked `not_available` (FR-4) still receives a Metric Explanation stating it could not be computed and why — so the explanation set covers the full catalog with no silent gaps.
- Each Metric Explanation is **anchored** in its own Metric's value(s) but **may reference other Metrics in the Analysis** where a connection is genuinely informative (e.g., the bus-factor explanation noting that the same authors dominate the commit-message-quality Metric). Every fact it cites — its own or a cross-referenced Metric — must trace to a computed Metric in Report JSON (FR-9); it invents no numbers, dates, contributors, or events absent from the Analysis. The cross-metric *prioritized plan* remains Coaching's job (below), so an explanation may note a link but does not try to be the global roll-up.
- Coaching guidance references the repo's own Metrics (e.g., "62% of your commit messages are under 10 characters — adopt Conventional Commits, starting with…") rather than generic advice.
- All AI prose (repo-level Narrative and every Metric Explanation) is written in plain language for a developer audience and avoids unexplained jargon.
- Both the repo-level Narrative and all Metric Explanations are carried in the Report JSON **`narrative`** subtree (FR-12) — the Narrative under its three parts and each Metric Explanation keyed by metric id — and rendered in every output format (FR-13).

`[NOTE FOR PM]` Per-metric explanations multiply LLM output (~30 Metrics). To bound cost and latency on the user's BYOK budget, generation may be **batched into a single request** rather than one call per Metric — an architecture decision, not a capability change. No per-use cost accrues to commit-whisper (FR-11).

#### FR-9: Ground every factual claim in the metrics

The AI Narrative may not assert history facts the Metrics don't support (Grounding).

**Consequences (testable):**
- Factual statements in the Narrative and in every Metric Explanation (FR-8) trace to specific Metric(s) present in Report JSON.
- The system uses prompt constraints **and** a post-generation verification pass against Report JSON; unsupported factual claims are removed or rewritten before render.
- Where the Metrics are insufficient to support a claim, the Narrative says so instead of fabricating.

#### FR-10: Self-assess confidence and escalate

commit-whisper reports how trustworthy the Narrative is and advises escalation when confidence is low.

**Consequences (testable):**
- Each run yields a Confidence self-assessment surfaced in the output as one of: `high`, `medium`, `low`.
- Confidence level is computed from: verification pass rate, share of `not_available` metrics, and provider/runtime warning signals.
- When confidence is low (e.g., a small local model produced weak or generic output), the output explicitly recommends re-running with a stronger LLM provider, and names how (which config to change).
- Low confidence never silently degrades into a confident-sounding but unreliable Narrative.

#### FR-11: Support multiple BYOK LLM providers

A user configures their own LLM provider and key. The narrated **report** — commit-whisper's shareable showpiece — **requires a reachable model**: no AI, no report. When narration is unavailable the run does **not** produce nothing — it **fails open to the deterministic `analysis` substrate** (FR-13) rather than discarding computed work — and an explicit **metrics-only** path (`--no-ai`) skips the model deliberately for headless/CI. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- **The narrated *report* requires a reachable model — no AI, no showpiece.** The full narrated **report** (the shareable HTML/Markdown hero artifact assembled from FR-8) is **structurally impossible to produce without narration** — it is bound to the AI Narrative by construction — so a **configured provider and a reachable model** are required to build *the report*. This honors the AI-required ruling (§12 #14) at the level that actually carries it — **the report** — rather than forcing every invocation through inference. (Reframes the prior "a run cannot complete without a reachable model": the narrated **report** requires a reachable model; if narration fails the run degrades to the analysis substrate rather than producing nothing.)
- **Fail-open: a narration, grounding, or provider failure degrades to the `analysis` substrate, never to nothing.** When the AI narration, the grounding pass (FR-9), or the provider fails or is unreachable, commit-whisper **still renders the deterministic `analysis` substrate** (FR-4/FR-12) and **never discards already-computed analysis** — replacing the old "narration fails → no output, hard error" behavior in the interactive/default case (FR-14). The degraded output is **visibly degraded, not a clean alternative**: it carries a prominent **"⚠ Narrative unavailable — showing raw analysis"** banner, is the plainer substrate render (never the polished showpiece), and exits with a **distinct, machine-detectable degraded exit code** — a human still gets value and a script still detects the degradation. The exact exit code is **reconciled in the architecture exit-code enum** (not assigned here); the degraded render is specified in FR-13.
- **Metrics-only mode (`--no-ai`) is an explicit, clean no-AI path — the headless/CI default.** A metrics-only run makes **no LLM call** and emits the `analysis` substrate **cleanly (exit 0 — intended, not degraded)**. It is the **default in headless/CI** (FR-15) — removing the CI tax of forced per-run inference for a narrative no one reads — but it is **never** the interactive default (interactive stays AI-first, FR-14) and **never** the Free-tier identity (Free keeps the narrative, FR-16). In CI a one-line notice mentions that the narrated report is available interactively or with a configured provider.
- **The Free tier keeps the narrative and is unaffected by the AI-required posture:** **Ollama (local) is a zero-cost provider**, so a Free-tier user gets the full narrated report with no spend and no data leaving the machine; metrics-only is a headless/CI convenience, **not** the Free-tier surface (FR-16).
- Supported providers are a **closed enum**: `ollama` (local), `openai`, `gemini`, `anthropic`, and `openai-compatible` (any OpenAI-compatible endpoint).
- Provider and model are user-configurable via config file and/or environment variables. Where a provider requires an API key, that **key is read from an environment variable only** — never from the config file, never from a flag, never via a prompt — and from the provider's **SDK-native key variable** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and for Gemini the SDK-native **`GOOGLE_GENERATIVE_AI_API_KEY`**), matching the variable each vendor's own SDK reads. **For Gemini, commit-whisper *also* accepts `GEMINI_API_KEY` as a friendly alias** — read **explicitly** by commit-whisper and injected as the key, not relied on through SDK auto-pickup — so a user who exported either variable is served while the principle (use the SDK-native variable) and the names stay consistent. (Ollama local needs no key.)
- A **base URL** input is supported and is **required for provider ∈ {`ollama`, `openai-compatible`}** (the local Ollama endpoint or the custom OpenAI-compatible endpoint) — it is not limited to Ollama; for the hosted providers (`openai`, `gemini`, `anthropic`) it is optional and defaults to the vendor's standard endpoint.
- With Ollama (local), no Commit history data leaves the user's machine — satisfying privacy-sensitive use.
- A missing/invalid key or unreachable provider yields a clear, actionable error, not a stack trace.
- **Provider reachability is checked by a cheap preflight *before* any costly work.** When a narrated report is requested, commit-whisper runs a low-cost **preflight reachability probe** of the configured provider **before** the retrieve and analyze stages — for **Ollama** a local endpoint ping (e.g. listing local models at the configured base URL), for a **cloud** provider a low-cost auth/connectivity check, **never a paid full inference**. **Metrics-only mode (`--no-ai`) runs no probe** — no model is called. When the probe **fails**, commit-whisper learns early and clearly that the showpiece cannot be narrated (and why), and the run **fails open to the `analysis` substrate** (the degraded render of FR-13) rather than hard-stopping in the interactive/default case — so an unreachable provider (e.g. Ollama selected but not running) is surfaced in **seconds**, not discovered only after a full narration attempt. The exact stop-vs-degrade sequencing and the distinct degraded exit code are **reconciled in the architecture exit-code enum**. This makes **"configured"** (a provider and model are set) distinct from **"reachable"** (the preflight passed); **Doctor** (FR-14) reflects **both**.
- commit-whisper incurs no per-use AI cost itself; inference is always on the user's key.

**Feature-specific NFRs:**
- Only Metrics and derived summaries are sent to the LLM — never tokens, never raw source file contents beyond what a Metric description requires. Raw diffs are never sent.

### 4.5 Report Output & Rendering

**Description:** commit-whisper emits a canonical Report JSON and renders human-facing outputs from it via predefined templates: HTML, Markdown, and Terminal. JSON is the single source of truth; all Rendered outputs derive from it, so they never disagree. There is no central web portal. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-12: Compute the canonical Report JSON

Every analysis **computes (assembles) a canonical Report JSON in memory** — the single source of truth holding all Metrics and the AI Narrative. It is **always computed** as the basis for every Rendered output; it is **emitted to a destination only when `json` is a selected output format** (FR-13).

**Consequences (testable):**
- **Always computed; emitted only on selection.** Every run assembles the Report JSON in memory as the single source of truth from which all formats render (FR-13); the JSON is **written to a destination only when `json` is among the selected output formats** — assembling it is unconditional, emitting it is conditional. (This resolves the prior produce-vs-emit conflation with FR-13's selectable-JSON rule.)
- **Report JSON is well-formed, documented, and split into two top-level subtrees — `analysis` (deterministic) and `narrative` (AI).** The **`analysis`** subtree holds every Metric's machine value(s), status, and reason with **no AI content**, and is the **byte-stable target for trend diffing** (powers trend deltas, FR-4/Group F, UJ-2). The **`narrative`** subtree holds all AI content — the repo-level Summary / Explanation / Coaching **and** the per-metric Metric Explanations, **keyed by metric id**. Separating deterministic facts from varying AI prose is what makes "diff the metrics for trends" genuinely byte-stable: the per-metric explanation no longer lives welded inside each Metric object (where only sub-fields were stable, defeating a clean metric-level diff).
- **The `analysis` subtree is always present; the `narrative` subtree may be absent.** Because `analysis` is computed deterministically with no AI, it is **always** assembled — including in **metrics-only** mode (`--no-ai`) and under **fail-open** degradation (FR-11/FR-13), where the `narrative` subtree is **empty or absent**. A consumer (and a trend diff, UJ-2) can therefore always rely on `analysis`; `narrative` is present only when narration succeeded. This is what lets the substrate render stand on its own.
- Report JSON contains everything needed to render any output format with no re-analysis and no AI re-call.
- Report JSON is itself a first-class artifact a user can keep, script against, or archive.

`[NOTE FOR PM]` **Commitment.** The structured AI outputs ship as structured JSON, not flat strings, and live under the **`narrative`** subtree: **Coaching** as a nested object (`introduction`, `chapters[]`, `summary`) and each **Metric Explanation** as an object with its four facets (`explanation`, `goodBehaviours`, `needsImprovement`, `suggestions`), **keyed by metric id** so each pairs with its Metric in the **`analysis`** subtree (which carries that Metric's deterministic value(s)/status/reason — no AI). The schema's version number is pinned at `schemaVersion: "1.0.0"` and its two-subtree shape is decided, but it is **pre-implementation and not yet frozen** — it may still evolve until the first shipped release freezes it; thereafter any backward-incompatible change requires a major schema-version bump. (So §12 #9 "fixed" and #16 "not yet frozen" agree: the version is fixed at 1.0.0, while the field-level schema is settled-but-still-revisable until first ship.)

#### FR-13: Emit and render the selected output formats

commit-whisper emits or renders one or more **selectable output formats** from the single Report JSON: **JSON, HTML, Markdown, and Terminal**. JSON is emitted directly (the canonical Report JSON of FR-12); HTML, Markdown, and Terminal are rendered from it via predefined templates.

**Consequences (testable):**
- **Output format is multi-select.** A single run can emit **several formats at once**, all derived from the one Report JSON computed that run — so e.g. JSON + HTML + Terminal are produced together with no re-analysis and no second LLM call.
- **JSON is a first-class, selectable output format** (the fourth, alongside HTML, Markdown, and Terminal): selecting `json` writes the canonical Report JSON — always computed as the single source of truth (FR-12) — to the chosen destination, exposed for **piping, automation, and diffing**.
- **Default output destinations.** **HTML, Markdown, and JSON are all file-formats**: when one is selected with **no output path**, commit-whisper writes a **default filename** in the current directory — `./commit-whisper-report.html`, `./commit-whisper-report.md`, or `./commit-whisper-report.json` respectively — while a path of **`-` means stdout**. **Terminal** output is **stdout-native** by nature.
- **HTML auto-open and `--no-open`.** When a human is at an interactive terminal, selecting HTML **auto-opens the rendered file in the browser by default**; the **`--no-open`** flag (FR-15) suppresses this for scripting. In a non-interactive / CI context HTML is **never** auto-opened, regardless of the flag.
- HTML is self-contained and presents the full report — Summary, Explanation, Coaching, and every Metric Group with both its **group overview chart and a per-metric visual on each Metric** (FR-6).
- Markdown is suitable for committing as a file or posting in a PR/wiki; Terminal output is suitable for immediate reading and CI logs.
- **The per-metric visuals (FR-6) render in every selected format, degraded to the medium** (FR-7): **Markdown** expresses them as ASCII sparklines, small text-bar tables, or bold numbers — with **Mermaid** for the group overviews and **no binary/embedded images** — while **Terminal** reduces them to compact textual summaries and only **HTML** draws full charts.
- **The narrated report is the showpiece; the substrate render is not the report.** The full report (Summary, Explanation, Coaching, and every narrated Metric) is the **polished showpiece** and exists only when narration succeeded (FR-11 — no AI, no showpiece). When narration is unavailable, every selected format instead renders the deterministic **`analysis` substrate** (FR-12) in one of two clearly distinct modes:
  - **Metrics-only (`--no-ai`, the headless/CI default, FR-15):** a **clean** substrate render — the Metrics and their visuals with **no narrative and no degraded banner** — emitted as **intended** (exit 0). In headless/CI a one-line notice points to the narrated report being available interactively or with a configured provider.
  - **Fail-open (degraded, FR-11):** the substrate render carrying a prominent **"⚠ Narrative unavailable — showing raw analysis"** banner, plainer than the showpiece and never mistakable for it, exited with a **distinct, machine-detectable degraded exit code** (reconciled in the architecture exit-code enum) — so a human still gets value and a script still detects the degradation.
- All formats present the same facts from the same Report JSON — the **Metrics always**, and the **Narrative when present** (absent under metrics-only and fail-open, per the `analysis` / `narrative` split of FR-12).

#### FR-17: Carry Report-JSON provenance metadata

Every analysis assembles an **optional top-level `provenance` subtree** on the canonical Report JSON — a third sibling of `analysis` and `narrative` (FR-12) — capturing the run's **contextual facts** (repo identity, scale, AI provider/model, run timestamp/version, and entitlement) so every renderer (the HTML masthead/footer, the Markdown header, and the JSON output itself) can display them **without re-deriving** them from the pipeline. Provenance is **run metadata, not analysis**: it is excluded from the byte-stable trend-diff target (FR-12) and never carries a secret. Realizes UJ-1, UJ-2; it lands the *TEMPLATE-HTML* masthead ① / footer ⑦ provenance chips and the Free-tier cap line. (Numbered next-available and placed here in §4.5 beside the FR-12/FR-13 it extends, rather than renumbering the heavily-cross-referenced FR-14/FR-15/FR-16.)

**Consequences (testable):**
- **One OPTIONAL top-level `provenance` subtree, sourced once and rendered everywhere.** It is **assembled at report-assembly time** (FR-12) from facts the pipeline already holds and **emitted verbatim in the JSON output**; no renderer re-derives a provenance fact. It is a **third sibling** of `analysis` and `narrative` — never nested inside either — and **each field is independently optional**.
- **Repo identity — sourced at retrieve (FR-1).** The repository **name/path**, the analyzed **branch**, and whether the source was a **local path or a remote clone**. A remote identity is recorded as a **credential-stripped** URL (never a token-bearing URL — see security); a local identity is the path / basename.
- **Scale — sourced at retrieve + analyze (FR-1/FR-4).** The **total reachable commit count** and the **contributor count** analyzed — the commit count from retrieval, the contributor count from `analyze`'s `.mailmap`-canonicalized author set (so it matches every other figure on the page). The contributor figure is an **aggregate count only** — never a per-developer list or ranking (§7, §8).
- **AI — sourced at narrate; absent without it (FR-8/FR-11).** The **provider** and **model** that produced the narrative, recorded **only when narration actually ran** — so they are **absent on a `--no-ai` metrics-only run and on a fail-open degraded run** (FR-13), mirroring the `narrative`-subtree presence rule exactly.
- **Run — sourced at the config/license layer.** A **generated ISO-8601 timestamp** (the injected `analysisTimestamp` determinism anchor, never `Date.now()`) and the **tool version**. Because the timestamp varies every run, it is **run metadata and MUST live in `provenance`, never in `analysis`** (see the determinism rule below).
- **Entitlement — sourced at the license/tier gate (FR-16).** The **tier** (Free / Single-device / Unlimited) and, **on the Free tier only**, the **commit cap actually applied**, rendered as **"100 of N"** (the cap against the total reachable count from the scale fields).
- **Determinism rule (load-bearing).** Provenance is **RUN METADATA, NOT ANALYSIS.** The non-deterministic / run-varying fields — the **timestamp especially**, and **provider/model** — **MUST live in `provenance`, never in `analysis`**, so the byte-stable trend-diff target (FR-12) stays clean. **Provenance is excluded from any analysis trend-diff** (UJ-2 diffs `analysis` only).
- **Privacy / safety (reaffirms §7 / §8).** Provenance **never carries a secret** — no API key, no git token, no `Secret<string>` value, ever. A **remote-clone repo identity is credential-stripped** so a token embedded in a clone URL (`https://x-access-token:…@host/…`) can never leak into a shareable artifact. Contributor data stays **team-level** — a count, never per-developer ranking (the LOCKED §8 guardrail).
- **Graceful degradation (back-compat).** **Every provenance field is optional and the whole subtree may be absent.** A renderer shows **only the chips it has** — no provider/model chip on `--no-ai`, the cap line **only** on Free — and the masthead ① / footer ⑦ **render correctly with `provenance` entirely absent**, so a Report assembled before this FR (no `provenance`) still renders with no empty chips and no error.
- **Cross-format parity (FR-13).** The same provenance facts surface in the **HTML masthead/footer**, the **Markdown header**, and are **present verbatim in the JSON output** — all derived from the one `provenance` subtree, so no two formats can disagree.

`[NOTE FOR PM]` **Scope / phasing.** The committed first increment is the **`provenance` schema addition** (FR-12) + **populating it across the pipeline** + the **HTML masthead/footer chips** (the *TEMPLATE-HTML* ① / ⑦ surfaces ADR H3's typographic upgrade made more prominent). **Markdown/JSON visual parity** (beyond the subtree being present verbatim in the JSON) and **wiring the Free-tier Buy-Me-a-Coffee link** (§9) into the footer alongside the cap line **may phase as a fast-follow** — the schema + populate + HTML chips are the validating increment.

### 4.6 Execution Modes & Licensing

**Description:** commit-whisper runs interactively on a developer's machine and headless in CI/CD, ships as a self-contained executable, and enforces the three License tiers. Realizes UJ-2, UJ-3.

**Functional Requirements:**

#### FR-14: Interactive (developer) execution

A developer runs commit-whisper from a terminal and gets a report. The bare `commit-whisper` command, invoked with **zero arguments in an interactive terminal**, is the product's single interactive entry point: rather than running blind, it opens an interactive mode that helps the user discover the tool and supply what a run needs. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- Invoked with **zero arguments in an interactive terminal**, commit-whisper enters **interactive mode**: a top-level **menu** that lets the user discover what the tool can do, plus **guided prompts** that collect the inputs a run needs (e.g., repository target — the current directory or a remote URL — branch scope, output formats). This bare-command path is the product's *only* interactive entry point.
- The interactive **menu is escapable**: the user can leave it and exit cleanly at any point without starting an analysis.
- **The menu exposes a defined action set, conditioned on effective license state** (a paid license that fails validation in interactive mode presents as unlicensed, keeping Activate / Buy-Restore reachable):
  - **Analyze this repository (cwd)** — analyze the current working directory when it is a git repository (FR-1 default target).
  - **Analyze a remote repository** — prompt for a remote HTTPS URL and analyze it (stateless clone, FR-1).
  - **Settings** — a guided picker for **non-secret** AI configuration — **provider** (the closed enum of FR-11), **model**, and **base URL** — plus everyday run defaults (**default output format**, **timezone**, **max-commits**). It **writes these non-secret choices to the config home** (`~/.commit-whisper`), set once and remembered; the two-phase resolver precedence still holds, so an explicit environment variable or flag overrides a saved Setting (config < env < flags). Settings **never collects or stores a secret** — a cloud provider's API key stays environment-variable-only (FR-2/FR-11) — which is exactly what distinguishes it (writable, non-secret config) from **Doctor** (read-only diagnostic). Shown in all states (an ORIENT item, not license-gated).
  - **Doctor** — a read-only diagnostic showing the current **license tier**, the **configured LLM provider**, and **which required environment variables are set vs missing** (named, never their values).
  - **Help** — list every flag and its purpose (the headless surface, FR-15).
  - **Activate license** *(shown only when unlicensed)* — the **only in-app license-key entry screen**: the user **enters the license key in the terminal**, and commit-whisper runs the one-time online activation (FR-16), validating the key and caching the returned **activation-instance id** under the config home (`~/.commit-whisper`). The license **key** is not a secret-env-only value (FR-16), unlike the git token / LLM key.
  - **Buy Me a Coffee** *(shown only when unlicensed; hidden once licensed)* — the voluntary support link (§9).
  - **Deactivate license** *(shown only when licensed)* — free the current activation instance so the license can move to another device (FR-16 *deactivate*).
  - **Buy / Restore license** *(shown only when unlicensed)* — the single door for a user without an active license, and a **browser hand-off**: it **opens the store in the browser** to **buy** a new license (the Lemon Squeezy checkout, §9) **or** look up and **recover an existing purchase** (and its license key). commit-whisper handles no payment or account lookup in the terminal, and there is **no in-terminal restore-by-key flow** — the only place a key is typed is **Activate license** above. The natural returning-user loop is Buy / Restore (recover the key online) → Activate (enter it) (FR-16).
  - **Quit (Esc)** — leave the menu and exit cleanly without starting an analysis.
- **The menu never collects secrets.** It may accept a **license key** (not a secret, FR-16) at **Activate license**, but it **never** prompts for the git access token or the LLM key — for those it only **names the exact environment variable** to set (FR-2, FR-11, §12 #12). The **Settings** screen likewise writes only non-secret fields and never accepts a key.
- Guided prompts collect **only the inputs a run actually needs** — they never silently default or invent a required input the user was not asked about.
- On completing a guided run, commit-whisper **surfaces the equivalent non-interactive command** (the flags and values that would reproduce the run), so the interactive path teaches the user how to run it headless next time (self-teaching).
- A single command runs the full pipeline: retrieve → analyze → narrate → render.
- Progress is visible (phases indicated) for long histories.
- **First run with no secret configured (interactive mode):** commit-whisper does **not** prompt for the LLM key or the access token and never stores them — secrets are read from environment variables only (per FR-2/FR-11). If a required secret's variable is unset, the menu **names the exact environment variable to set**; the user exports it and re-runs. Guided prompts cover only non-secret inputs.
- The tool ships as a self-contained executable so a user without a preinstalled Node runtime can run it. Packaging may use Node SEA, pkg, or nexe; `npx` remains an optional convenience path for users who already have Node.

`[NOTE FOR PM]` **Resolved (see §12 #12).** The git access token and the LLM key are handled identically: both are read from environment variables only — never from the config file, never from a flag, and never via a prompt. Guided prompts cover only non-secret inputs; a missing secret is surfaced by naming its exact environment variable.

#### FR-15: Headless / CI execution

commit-whisper runs non-interactively whenever it is invoked with **one or more arguments**, or in any **non-interactive context** (no interactive terminal / CI) — covering scheduled CI/CD jobs and scripted local runs alike. Realizes UJ-2.

**Consequences (testable):**
- **Any invocation with one or more arguments is non-interactive and strict single-shot**, in every context — including an interactive terminal. Passing an argument is a declaration of intent to run non-interactively, so commit-whisper **never opens the menu and never prompts**; it runs immediately when all required inputs are satisfied (non-secret config from CLI flags, environment variables, and/or config file; secrets from environment variables only).
- **Missing required input is an operational failure, never a prompt.** When a required input is absent, commit-whisper **hard-fails immediately** with a clear, actionable, **typed error and a machine-readable exit code** — it does not prompt for the missing value and does not hang waiting for input, even in an interactive terminal.
- **Zero arguments in a non-interactive context** (no interactive terminal / CI) also **fails fast** the same way — a typed error and machine-readable exit code — rather than waiting for input that can never arrive. commit-whisper never hangs and never silently guesses a missing input.
- A headless run uses no interactive prompts, reading all config from environment variables, config file, and/or CLI flags. Secrets (token, LLM key) come **only from environment variables** (per FR-2/FR-11) — never from the config file and never from CLI flags; non-secret config (repo URL, provider, model, output formats) may come from flags.
- Exit codes are machine-readable: clean success, a **distinct degraded exit** (fail-open — substrate rendered, narrative unavailable, FR-11/FR-13), and operational failure (auth, network, config, missing required input, license). An "unhealthy" repo finding is NOT a failure exit, and the **degraded exit is distinct from both clean success and operational failure** (exact codes reconciled in the architecture exit-code enum).
- **Metrics-only (`--no-ai`) is the headless/CI default.** Because a narrated report no one reads is pure CI tax, headless/CI runs **default to metrics-only** — they make **no LLM call**, emit the deterministic `analysis` substrate **cleanly (exit 0 — intended, not degraded)**, and print a one-line notice that the narrated report is available interactively or with a configured provider. A narrated report in CI is **opt-in**; when it is requested and narration fails, the run **fails open** to the same substrate with the **degraded** exit above — never silently, but note this is unlike the license fail-closed rule: the `analysis` subtree (the byte-stable trend target, FR-12) is fully intact, so there is no trend data to corrupt. Metrics-only is the headless default **only** — never the interactive default (FR-14) or the Free-tier identity (FR-16).
- **Paid-tier license validation:** for the Single-device and Unlimited/Automation tiers the license key is provided as an **environment variable**, and the run **validates** the existing activation rather than re-activating (per FR-16) — so a multi-repository CI matrix never exhausts activation limits. On validation failure or an unreachable licensing server the run **fails closed**: it performs no analysis or rendering and exits as an **operational failure** with a typed error and machine-readable exit code (the same exit-code policy above). **This fail-closed rule is the headless/CI behavior only; in interactive mode the same validation failure instead degrades to the Free 100-commit cap rather than refusing to run (per FR-16) — CI must never silently degrade, because a silent cap would corrupt trend data and artifacts.** The **Free tier** holds no key, makes no validation call, and its path is unaffected.
- **First run with no LLM key configured (argument / non-interactive mode):** because headless/CI **defaults to metrics-only**, a missing LLM key is **no longer a first-run cliff** — the run emits the clean `analysis` substrate (exit 0) with the one-line notice that the narrated report is available interactively or with a configured provider. The helpful on-ramp still applies **when a narrated report is explicitly requested but no provider is reachable**: commit-whisper **names the exact environment variable to set** and points to the bare `commit-whisper` command for guided first-run setup (the exact fail-vs-degrade response is reconciled in the architecture exit-code enum). No secret is ever read from a CLI argument or the config file (per FR-2/FR-11).
- Report JSON and selected Rendered outputs are written to predictable paths suitable for CI artifacts.
- **Operational flags and environment controls** (usable in argument / non-interactive mode):
  - **`--show-config`** — print the **resolved** configuration with **per-field provenance** (which source supplied each value — CLI flag, environment variable, config file, or default), render every secret as `***` (never the real value), then **exit without running**.
  - **`--non-interactive`** — force headless / strict single-shot even from an interactive terminal (no menu, no prompts; the strict rules above apply).
  - **`--config <path>`** — override the config-file location (otherwise read from the config home below).
  - **`--no-open`** — suppress auto-opening rendered HTML (FR-13).
  - **`--no-ai`** — **metrics-only**: skip narration entirely (no LLM call) and emit the deterministic `analysis` substrate cleanly (exit 0). The **default in headless/CI**; never the interactive default (FR-14) or the Free-tier identity (FR-16). See FR-11.
  - **`--verbose` / `--quiet`** — raise / lower diagnostic verbosity on **stderr** (never on the stdout data stream).
  - **`--version`** — print the version and exit.
  - **`NO_COLOR` / `FORCE_COLOR`** — honored to disable / force ANSI color, alongside TTY auto-detection.
- **Config / cache home is `~/.commit-whisper`.** The non-secret config file and the cached **license activation-instance id** (a licensing artifact, not a secret — FR-16, §3) live under `~/.commit-whisper`; secrets are **never** stored there (FR-2 / FR-11). `--config <path>` overrides only the config-file location.

#### FR-16: Enforce license tiers

commit-whisper enforces Free, Single-device, and Unlimited/Automation tiers (defined in §9). Realizes UJ-2.

**Consequences (testable):**
- At startup, **before** beginning analysis or rendering, commit-whisper validates the license **online** by calling the Lemon Squeezy License API (*activate* / *validate* / *deactivate* endpoints).
- **Free tier** needs no license key and makes no API call: it analyzes only the 100 most-recent commits, clearly states the cap in output, and runs with no network and no account; all other features remain available within that cap.
- **The Free tier keeps the narrative — it gates volume, not the soul.** The AI Narrative (FR-8) is the product's hook and is a **first-class part of the Free experience**, never a paid upsell: a Free-tier user gets the full narrated report within the 100-commit cap, at **zero cost via Ollama** (local, no key) or with any configured provider. The Free tier limits **volume** (the 100-commit cap, unchanged) and **nothing about the narrative**. The **metrics-only** path (`--no-ai`, FR-11/FR-15) is a headless/CI convenience and is **never the Free-tier surface** — Free is narrated by default, exactly like the paid tiers.
- **Single-device tier** removes the commit cap and is bound to one device via a Lemon Squeezy *activation instance* (server-side); activating on a second device is refused with a clear message — the server-side instance is what makes the device limit enforceable.
- **Moving devices (deactivation):** a Single-device user can **free their activation** to move to another machine — commit-whisper exposes a clear, discoverable path to **deactivate** the current activation instance (Lemon Squeezy *deactivate*); once deactivated, the freed activation can be used to activate on the new device. The one-device limit is movable, not a one-time lock-in, and moving requires no new purchase.
- **Restoring a license (clean machine):** a paid user on a machine that holds no local activation artifact **recovers their purchase in the browser** via the **Buy / Restore license** menu item (FR-14, shown only when unlicensed) — Buy / Restore opens the store to buy a new license **or** look up an existing purchase and its **license key**. The user then **enters that key in Activate license** (the only in-app key-entry screen, FR-14), which validates online and re-creates the cached activation-instance id under the config home. **There is no in-terminal restore-by-key flow** — recovery happens in the browser, and the key is consumed only by Activate. **The license key alone re-activates on a clean machine:** the Lemon Squeezy *activate* call takes only the key plus a device/instance identifier, so commit-whisper never asks the user to type an order id or purchase email — and if a given purchase ever needs those details, **Buy / Restore** already surfaces them in the browser, outside the terminal.
- **Unlimited/Automation tier** permits many activations — any number of devices plus headless/CI runners.
- **Headless / CI runs validate, they do not re-activate:** the runner is supplied the license key as an **environment variable** and performs a *validate* call against the existing activation instance — never a fresh *activate* — so a multi-repository CI matrix does not exhaust the tier's activation limit.
- The license **key** is supplied via environment variable (headless/CI) or via a one-time interactive activation that caches the returned **activation-instance id** in the **config home** (`~/.commit-whisper`, §3 / FR-15). This cached instance id is a **licensing artifact, not a user secret**, and is explicitly distinct from the git access token and LLM key — those remain environment-variable-only (FR-2/FR-11) and this cached id does not change that rule.
- **Interactive mode degrades gracefully; it never refuses to run on a license problem (FR-14).** When a paid user's key **cannot be validated** — licensing server unreachable, network blocked, or a transient error (as opposed to a definitive negative) — commit-whisper **falls back to the Free tier**, runs the 100-commit-capped analysis, and **clearly states it is running under the Free cap because the license could not be validated**. A definitive ***invalid / revoked / expired*** response from Lemon Squeezy also grants **no paid features** and lands on the same Free cap, but the message names the license as invalid/revoked rather than as a transient validation failure. Either way the bare interactive command always yields a usable run.
- **Headless / CI mode fails closed on any validation failure (FR-15).** In any argument / non-interactive context, **both** an inability to validate (unreachable / network / transient) **and** a definitive ***invalid / revoked / expired*** response perform no analysis or rendering and exit as an **operational failure** with a typed error and a machine-readable exit code (the license-gate case of the FR-15 exit-code policy). CI **never silently degrades to the Free cap**, because a silent cap would corrupt trend data and CI artifacts.
- **The Free 100-commit path is unaffected in both modes.** Free holds no key and makes no validation call, so no validation outcome can break it; "degrade to Free" simply means falling back to that same capped, no-call path.
- License enforcement transmits **only** the license key and a device identifier — **never repository data** — so the privacy posture (§7) is upheld.

## 5. Non-Goals (Explicit)

- **No central web portal / hosted SaaS dashboard.** The deliverable is the tool's own output (JSON + Rendered files).
- **No per-developer ranking or productivity surveillance.** Manager-facing health is team-level only.
- **No forward authoring.** commit-whisper does not write the user's commit messages, PRs, or code.
- **No becoming a CI platform / code-quality linter.** It analyzes git *history*, not static code quality or test coverage.
- **No bundled AI / no hosted inference.** Always BYOK; commit-whisper carries no inference cost or vendor lock-in.
- **No writing to the analyzed repository.** Strictly read-only.

## 6. Scope

### 6.1 In Scope

- Retrieval from GitHub, GitLab, Bitbucket; private repos via token (§4.1).
- Full Metrics catalog, Groups A–F, deterministic and AI-independent (§4.2).
- Graphs in HTML; reduced visuals in Markdown/Terminal (§4.3).
- AI Narrative (Summary → Explanation → Coaching), grounded, with confidence self-assessment + escalation; BYOK multi-provider (§4.4).
- Canonical Report JSON + HTML/Markdown/Terminal rendering from templates (§4.5).
- Interactive + headless/CI execution; self-contained executable; three license tiers (§4.6).

### 6.2 Out of Scope

- Self-hosted / generic git servers beyond the three named providers — *not planned.*
- SSH-key authentication — *token-based only.*
- Trend deltas across runs require a prior Report JSON to exist; first run has no trend — *acceptable; trend value accrues over time.*
- A fourth mid "team" pricing tier — *not planned.*
- Multi-language localization of the Narrative — *out of scope; English only.*

## 7. Cross-Cutting NFRs

- **Privacy (independent of network use):** with a local provider (Ollama), no repository data ever leaves the machine — a guarantee that stands apart from, and is unaffected by, the network calls commit-whisper does make (paid-tier license validation, cloud LLM providers). With cloud providers, only Metrics/derived summaries are sent — never tokens, never raw source beyond what a Metric needs. Tokens and keys never appear in JSON, logs, or Rendered output.
- **Security:** read-only against remotes; secrets read from env vars only, never config file or bare CLI args; clear failure on insufficient token scope.
- **Determinism:** identical history **under identical commit-selection and timezone inputs (FR-1/FR-4)** ⇒ identical Metrics (the AI layer is the only non-deterministic part, and it is bounded by Grounding).
- **Performance:** must handle very long histories (the core painkiller) within reasonable time and memory; long runs show progress. Budgets for a 50k-commit repo on a 4-vCPU / 16 GB RAM machine: deterministic retrieval+analysis <= 10 minutes, peak RSS <= 2.5 GB, AI narrative+metric explanations <= 4 minutes (cloud provider) or <= 8 minutes (local Ollama-class model).
- **Network use:** paid-tier license validation requires network access at startup — an online check against the third-party licensing service (FR-16) that transmits only the license key and a device identifier, never repository data. The Free tier makes no such call. Rendered outputs (HTML/Markdown/Terminal) remain self-contained and display with no server.
- **Portability:** ships as a self-contained executable across major OSes (macOS, Linux, Windows).
- **Trust/accuracy:** Grounding (FR-9) + Confidence self-assessment (FR-10) are first-class; a confidently wrong Narrative is the worst outcome and is designed against.

## 8. Constraints & Guardrails

- **Cost:** zero marginal AI cost to commit-whisper (BYOK). The product's price is a one-time perpetual license.
- **Privacy guardrail:** the local (Ollama) path must remain a fully supported first-class option, not a degraded fallback — it is the answer for orgs that forbid sending commit data to a cloud.
- **Positioning guardrail (from brief):** all manager-facing output is framed as team-level health, risk, and improvement — never individual ranking. This constraint binds the wording of Group F and the Coaching section. It is deliberate protection against the documented backlash against developer-productivity surveillance (see the brief's competitive analysis): any drift toward per-developer ranking would forfeit the trust the product depends on, so it is forbidden even when technically easy.
- **No-per-developer-ranking guardrail (LOCKED, absolute):** both the deterministic **Metrics** (§4.2) **and** the **AI Narrative** (§4.4) analyze the repository at the **repository / change level** — they describe the history, the code, and **team-level** health, and they **never rank, score, grade, or single out an individual developer**. Contribution and ownership signals (Group B, bus-factor) exist **only** to surface team-level risk (knowledge concentration to mitigate), never to compare or rank people. This rule is **absolute and load-bearing**: it is the deliberate differentiator from developer-productivity-surveillance tools (§10), and it binds the wording of Group F, the Metric health bands (§4.2), every Metric Explanation (FR-8), and the Coaching report — forbidden even when technically trivial. Manager-facing output is **team-level health only** (reaffirms the §5 Non-Goal and counter-metric SM-C2).

## 9. Monetization

Perpetual, one-time purchase. Three tiers (from the finalized brief):

- **Free** — capped at the 100 most-recent commits (the funnel; full features within the cap) and includes a voluntary Buy Me a Coffee support link.
- **Single-device ($10)** — one device; unlimited runs, repositories, and remote servers; commit cap removed.
- **Unlimited/Automation ($100)** — any number of devices plus headless/CI automation; the team & manager-of-many-teams tier where value concentrates.
- **AI cost is the user's** (BYOK), so the license price stays pure margin after the sale.
- Prices are final: no additional pricing tiers are planned.
- **Enforcement (Lemon Squeezy):** the two paid SKUs are sold and enforced through Lemon Squeezy. Single-device's one-device limit is bound server-side via Lemon Squeezy *activation instances*; Unlimited/Automation allows many activations (including headless/CI). The license is validated online at startup (FR-16). Lemon Squeezy is a third-party licensing/checkout service — **not** a commit-whisper portal — so the no-central-portal Non-Goal (§5) is unaffected.

`[NOTE FOR PM]` **Cannibalization risk (accepted).** Because Single-device grants unlimited repositories and remote servers, a small team can buy N× Single-device (e.g., 4 × $10 = $40) and obtain everything the Unlimited tier offers *except* (a) multiple devices under one license and (b) headless/CI automation (FR-15). The arbitrage breaks even around ten devices ($100 ÷ $10), so it is a real but bounded pressure on small teams; the tradeoff is accepted and pricing remains fixed.

## 10. Why Now

The comprehension gap is unaddressed: OSS tools graph but don't explain; engineering-intelligence platforms sell manager dashboards, not plain-language history or coaching; AI git tools write the *next* commit, not an explanation of the *past*. Capable BYOK LLMs (local and cloud) now make grounded, affordable explanation feasible without per-use cost to the vendor. commit-whisper is first to fuse retrospective explanation with prescriptive coaching in the terminal — the chance is to define the category before incumbents (notably GitHub/Copilot) add "explain history" natively. The barrier is execution and focus, not proprietary technology, so the strategy is to define the category and earn trust first. This also answers the obvious objection — *"why not just ask ChatGPT over `git log`?"* — an ungrounded chat will confidently invent history, whereas Grounding (FR-9) ties every claim to Metrics computed from the user's own repository, and CI-scale, multi-repository analysis needs a tool, not a chat session.

## 11. Success Metrics

`[NOTE FOR PM]` **Measurement model.** commit-whisper remains portal-less, privacy-respecting, BYOK, and does not collect product telemetry. Success metrics are measured via proxy signals only: license sales/conversion, refund/chargeback rate, review sentiment, support-ticket themes, and opt-in user surveys. The **fail-open / degrade event** (FR-11/FR-13) is surfaced **locally** to the user (via `--verbose` and Doctor) and is **never phoned home**; any future product analytics that might instrument such events stays **opt-in and off by default**, consistent with this proxy-signal model.

### Primary

- **SM-1: Comprehension.** After reading the report, a user can accurately recount the repo's story and name a concrete next improvement. Validates FR-8, FR-9. *(Measured via user feedback; qualitative for early stages.)*
- **SM-2: Repeat / automated use.** Users run commit-whisper more than once per repo and/or wire it into CI/CD. Validates FR-12, FR-15 — proof it's a painkiller, not a one-time novelty.

### Secondary

- **SM-3: Conversion.** Free-tier users with long histories / many repos upgrade to a paid tier. Validates FR-16. Target conversion rate: at least 5%.
- **SM-4: Trust.** Low rate of "that's wrong" feedback on the Narrative; low rate of low-confidence runs that the user couldn't resolve by escalating. Validates FR-9, FR-10.

### Counter-metrics (do not optimize)

- **SM-C1: Don't trade trust for vividness.** A more dramatic/engaging Narrative that increases "that's wrong" feedback is a regression, even if users like the prose. Counterbalances SM-1.
- **SM-C2: Don't let manager value drift into surveillance.** Adoption gains that come from per-developer ranking features are not wins; they violate the positioning guardrail. Counterbalances SM-3.

## 12. Decision Log (Resolved)

1. **Free-tier cap:** fixed at 100 commits. (Affects FR-3, FR-16, §9.)
2. **License mechanism:** fixed to two paid SKUs, Single-device and Unlimited/Automation. (Affects FR-16.)
3. **Overall hygiene score formula:** fixed as the transparent weighted composite defined in Group F. (Affects §4.2.)
4. **Metric feasibility:** computable definitions fixed for rebase tendency, long-lived branches, file survival, and ownership-by-area. (Affects §4.2.)
5. **Grounding enforcement:** fixed to prompt constraints plus post-generation verification pass. (Affects FR-9.)
6. **Performance budgets:** fixed for 50k-commit scale in §7. (Affects §7, FR-8, FR-10.)
7. **Pricing:** fixed. (Affects §9.)
8. **Chart types:** fixed per metric group in FR-6; HTML self-containment remains required. (Affects FR-6, FR-7.)
9. **Report JSON schema:** fixed with `schemaVersion: "1.0.0"` and structured coaching/metric-explanation objects. (Affects FR-8, FR-12, FR-13.)
10. **Measurement model:** fixed as proxy-based only (no product telemetry). (Affects §11.)
11. **Interaction model:** fixed. Zero arguments in an interactive terminal = interactive mode (a discoverable top-level menu plus guided prompts); one or more arguments, in any context = strict single-shot that hard-fails on any missing required input with a typed error and machine-readable exit code and never prompts; zero arguments in a non-interactive context (no interactive terminal / CI) fails fast the same way. The bare `commit-whisper` command is the product's only interactive entry point; commit-whisper never hangs waiting for input and never silently guesses. (Affects FR-14, FR-15.)
12. **Secret sourcing:** fixed. The git access token and the LLM key are read from **environment variables only** — never from the config file, never from a CLI flag, and never via an interactive prompt. Both secrets are handled identically; a missing secret is surfaced by naming its exact environment variable (argument mode hard-fails; the bare interactive command names it in the menu). commit-whisper never prompts for or persists a secret. (Affects FR-2, FR-11, FR-14, FR-15, §3 Glossary.)
13. **License enforcement & offline:** fixed to **online** validation. At startup, before analysis or rendering, commit-whisper validates the license via the Lemon Squeezy License API (*activate* / *validate* / *deactivate*). Single-device device binding is enforced server-side through Lemon Squeezy *activation instances*; Unlimited/Automation allows many activations including headless/CI, where runners **validate** against an existing instance rather than re-activate (key supplied as an environment variable, to avoid exhausting activation limits across a multi-repo matrix). The license key comes from an environment variable or a one-time interactive activation that caches the activation-instance id locally — a **licensing artifact, not a user secret**, leaving the FR-2/FR-11 secret rules unchanged. Validation **fails closed in headless/CI** (any validation failure — unreachable server *or* a definitive invalid/revoked/expired response — yields a typed error and machine-readable exit code, never a silent cap) but **degrades to the Free 100-commit cap in interactive mode** so the bare command still yields a usable run; it transmits only the key plus a device identifier, never repository data. Consequently the blanket **"Offline-capable" NFR is removed** (§7) — paid validation needs network at startup — while the **privacy** guarantee (Ollama ⇒ no repository data leaves the machine) and the **no-central-portal** Non-Goal (Lemon Squeezy is a third-party service, not our portal) both stand. (Affects FR-16, FR-15, §7, §9, §3 Glossary, §11, FR-6, FR-11, §2.3 UJ-2/UJ-3; §5 Non-Goals reaffirmed.)
14. **Complete input inventory:** fixed the full v1 input surface while preserving the env-only secret rule (#12), the strict interaction model (#11), and the license fail-closed/degrade split (#13) unchanged — this entry **adds input surface only**. **Repo target** is a local filesystem path *or* a remote HTTPS URL, both first-class; the interactive default is the current directory (cwd); a local target needs no clone and no token, while remotes are stateless-cloned and cleaned up (FR-1, FR-2, §3, §4.1). **AI is required on every run** — no metrics-only/analyze-only mode; a run needs a configured provider and a reachable model; the Free tier stays free via Ollama (local) as a zero-cost provider; the LLM key is read from the provider's **native** environment variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, …), still env-only; the **base URL** input applies to provider ∈ {ollama, openai-compatible} (not Ollama-only); provider is a closed enum {ollama, openai, gemini, anthropic, openai-compatible} (FR-11). **JSON is the fourth selectable output format** and output is **multi-select** (one run, several formats from one Report JSON); HTML/Markdown without a path default to `./commit-whisper-report.{html,md}`, `-` means stdout, and `--no-open` suppresses HTML auto-open (interactive auto-opens by default) (FR-13, FR-12, §3). **New commit-selection inputs:** author filter, `--max-commits`, `--no-merges` (excludes merges → changes Group A–F values), and an explicit **timezone** (default UTC) governing date filters and time-bucketed metrics; **start/end dates are optional** — empty means unbounded, with no cap-aware auto-shrinking (FR-1, FR-4, §4.2 Group A, §13). **Date × Free-cap ordering:** filter by date first, then cap to the most-recent 100 within the range on the Free tier, with a truncation notice "Analyzed 100 of N commits — Free tier cap"; where both `--max-commits` and the Free cap apply, the smaller wins (FR-3, FR-16). **Interactive menu action set** fixed: Analyze cwd · Analyze remote · Doctor (tier + provider + which required env vars set/missing) · Help/show-all-flags · Activate [unlicensed] · Buy/Restore [unlicensed] · Buy Me a Coffee [unlicensed-only, hidden when licensed] · Deactivate [licensed] · Quit (Esc); the menu names secret env vars but never collects them, and accepts a license key (not a secret) for Activate/Buy-Restore (FR-14, FR-2, FR-11). **Operational flags:** `--show-config` (resolved config + per-field provenance, secrets `***`, then exit), `--non-interactive`, `--config <path>`, `--no-open`, `--verbose`/`--quiet`, `--version`, and `NO_COLOR`/`FORCE_COLOR` (FR-15). **Restore-license** capability added, consuming a license key (FR-16). **Config/cache home is `~/.commit-whisper`** — config file + cached license activation-instance id, never secrets (FR-15, FR-16, §3). (Affects FR-1, FR-2, FR-3, FR-4, FR-11, FR-13, FR-14, FR-15, FR-16, §3 Glossary, §4.1, §4.2, §7, §13.)
15. **UX composition specs (menus + report templates):** fixed three composition decisions George locked while Sally authored the interactive-menu and report-template UX specs (MENUS.md, TEMPLATE-HTML.md, TEMPLATE-MARKDOWN.md); preserves the env-only secret rule (#12), the strict interaction model (#11), the AI-required ruling (#14/FR-11), and the license fail-closed/degrade split (#13) unchanged. **(1) New "Settings" menu item (FR-14):** a guided picker for **non-secret** AI config — provider (closed enum), model, base URL — plus everyday defaults (default output format, timezone, max-commits), which **writes** these choices to the config home (`~/.commit-whisper`), set-once/remembered; the two-phase resolver precedence still holds (config < env < flags), and it **never** collects or stores a secret (a cloud key stays env-var-only, FR-2/FR-11). Settings is the **writable** non-secret-config door, distinct from the **read-only** Doctor; shown in all states (an ORIENT item, not license-gated). **(2) Licensing menu split (FR-14, FR-16):** the interactive licensing actions split by where the work happens — **Activate license** [unlicensed] is the **only** in-app key-entry screen (the key is typed in the terminal, validated online, and its activation-instance id cached under `~/.commit-whisper`); **Buy / Restore license** [unlicensed] is a **browser** hand-off to buy a new license **or** recover an existing purchase/key, with **no in-terminal restore-by-key flow**; **Deactivate license** [licensed] frees this device's activation. This **revises** FR-14's "Buy / Restore … from its key" and FR-16's "Restore re-validates from the license key (the only input it consumes)" — restore is now browser-based recovery, and a key is typed only in Activate; the deactivate-to-move, CI validate-not-activate, and fail-closed-vs-degrade rules (#13) are unchanged. **(3) Per-metric visuals (FR-6, FR-13):** the HTML report now carries a **right-sized per-metric visual on every Metric** *in addition to* the six **group overview charts**, which keep their locked signature types (#8/FR-6). The per-metric visual is sized to the Metric's shape — time-series → small line/area chart; distribution → small bar/histogram; scalar-within-a-range → sparkline or mini-gauge + number; pure scalar (bus factor, project age) → bold stat with **no chart** — so the self-contained file does not balloon. Markdown degrades these to ASCII sparklines / small text-bar tables / bold numbers, with Mermaid for the group overviews and no binary/embedded images (FR-7); every chart (group and per-metric) keeps an accessible data-table fallback and is paired with text, and the self-contained / offline guarantees hold. This **adds to** #8 (chart-types-per-group) rather than replacing it. (Affects FR-6, FR-13, FR-14, FR-16; references UX specs MENUS.md, TEMPLATE-HTML.md, TEMPLATE-MARKDOWN.md.)

16. **Alignment fix pass (party-mode review):** fixed the PRD-side defects surfaced by the cross-document party-mode alignment review, applying the cross-cutting resolutions the orchestrator locked identically across PRD, architecture, UX, and epics; preserves #11–#15 unchanged. **(A) Report JSON `analysis`/`narrative` split (FR-12):** the canonical Report JSON gains two top-level subtrees — **`analysis`** (deterministic: every Metric's value(s)/status/reason, no AI; the byte-stable trend-diff target) and **`narrative`** (AI: Summary / Explanation / Coaching **plus** the per-metric Metric Explanations, keyed by metric id). Welding each per-metric explanation inside its Metric object had left "diff the metrics for trends" stable only in sub-fields; the split makes the deterministic subtree cleanly diffable (sharpens UJ-2's trend value and the §7 determinism/honesty posture). **(B) FR-12 compute-vs-emit (FR-12, FR-13):** retitled "Compute the canonical Report JSON" — the Report JSON is **always computed (assembled) in memory** as the single source of truth and **emitted to a destination only when `json` is a selected output format** (FR-13), resolving the old "every analysis produces/emits" conflation with the selectable-JSON rule. **(C) JSON default destination (FR-13):** `html`, `markdown`, **and `json`** are all file-formats — each defaults to `./commit-whisper-report.{html,md,json}` when given no path, with `-` meaning stdout; `terminal` is stdout-native (FR-13 previously named defaults for html/md only). **(D) Gemini env var (FR-11):** the SDK-native key variable is **`GOOGLE_GENERATIVE_AI_API_KEY`** (canonical), and commit-whisper **also** accepts **`GEMINI_API_KEY`** as a friendly alias read explicitly (not via SDK auto-pickup) — fixing the prior text that named only `GEMINI_API_KEY` yet claimed it matched the SDK. **(E) Git PAT naming (FR-2):** **`COMMIT_WHISPER_GIT_TOKEN`** is the **primary** token variable; host-specific **`GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN`** are a lower-precedence convenience fallback — the namespaced variable must win because CI platforms (GitHub Actions) auto-inject `GITHUB_TOKEN` scoped to the current repo. **(F) Provider reachability preflight (FR-11):** because AI is required every run, commit-whisper runs a cheap **preflight reachability probe** of the configured provider (Ollama → local endpoint ping; cloud → low-cost auth/connectivity check, never a paid full inference) **before** retrieve/analyze, failing fast with the LLM-gate exit code if unreachable — so e.g. Ollama-selected-but-not-running fails in seconds, not minutes — and **Doctor** now distinguishes **configured** from **reachable**. **(G) Metric health bands (§4.2, FR-6):** a new §4.2 sub-section defines a per-Metric **health band** (`ok` / `watch` / `risk`, plus `n/a`) derived from **catalog-owned thresholds** (domain knowledge, like the Group F hygiene weights), classified **presentationally at render time** and never stored in Report JSON — team-level framing, never per-developer judgement; FR-6 gains a consequence that every Metric's visual/card carries its band shown by **glyph + label, never color alone**. FR numbering is unchanged. `schemaVersion` stays `"1.0.0"` (still pre-implementation, not frozen). (Affects FR-2, FR-6, FR-11, FR-12, FR-13, §4.2, §7, §2.3 UJ-2.)

17. **Pricing update (Single-device $2.99 → $10):** the Single-device tier price is raised from $2.99 to **$10** (Unlimited/Automation stays **$100**); structure is otherwise unchanged (perpetual one-time, two paid SKUs, Free 100-commit cap). Rationale: at $2.99 the per-sale net (~$2.3 after fees) barely justified the online activate/validate/deactivate licensing machinery, whereas ~$9 net at $10 clearly does; the tier gap narrows from 33× to **10×** (softer ladder); and the cannibalization break-even moves from ~33 devices to **~10** ($100 ÷ $10), shrinking the buy-N-singles arbitrage window. $10 stays impulse-priced for a developer while signalling a real tool rather than a throwaway. The value ladder remains a **capacity** ladder (commits/devices/CI), not a quality ladder — quality rides on the user's BYOK model and is not a paid upsell. Supersedes the price figure in #7 (pricing now $10/$100); §9, the §9 cannibalization note, and the brief Monetization section updated. (Affects §9, §11 SM-3, FR-16.)
18. **Final polish pass:** a closing review-and-reconcile pass — no scope added, no locked decision touched (#11–#17 intact). Reconciled the Report JSON two-subtree split (#16-A) into the few places that still implied the old welded shape: the §3 **Report JSON** glossary term now describes the `analysis` (deterministic Metric records, no AI) and `narrative` (AI Narrative + per-metric Metric Explanations keyed by metric id) subtrees rather than "all Metrics each with its Metric Explanation," and the §3 **Metric Explanation** term now says the explanation is keyed to its Metric by metric id under `narrative`, not nested in the Metric's record. Named the subtrees where the contract matters — **FR-4/FR-5** Metric records map to **`analysis`**, **FR-8** Narrative + per-metric explanations map to **`narrative`** (previously only FR-12 named them). Made the schema status read consistently so a reader is not tripped by #9 ("fixed") vs #16 ("not yet frozen"): the FR-12 note and the glossary now both state the version is pinned at `1.0.0` while the field-level shape stays pre-implementation and revisable until the first shipped release freezes it. Resolved the FR-16 restore-on-clean-machine `[ASSUMPTION]` to a clean default — the license key alone re-activates (Lemon Squeezy *activate* needs only key + device id; order id / purchase email, if ever required, are recovered in the browser by Buy / Restore), which also makes the §13 Assumptions Index accurate (the remaining inline assumptions are now only the §4.2 set). Confirmed the prior-price figure survives only in the append-only #17 pricing entry, and SM-3 (≥5% conversion) reads sensibly and price-agnostically at the $10/$100 ladder (left as-is). (Affects §3, FR-4, FR-5, FR-8, FR-12, FR-16, §13.)
19. **Fail-open + metrics-only (resilience refinement of AI-required):** a party-mode debate (Winston / Sally / John / Mary) that the orchestrator locked into a **resilience refinement of the AI-required ruling** — it **refines, does not reverse, #14 / FR-11**: the *report* still needs AI, but the deterministic analysis substrate now survives provider/narration failure, and an explicit metrics-only path serves headless/CI. **(1) Fail-open (FR-11/FR-13):** when narration, the grounding pass (FR-9), or the provider fails or is unreachable, commit-whisper **still renders the deterministic `analysis` substrate** and **never discards already-computed analysis** — replacing the old "narration fails → no output, hard error" behavior in the interactive/default case. **(2) Visibly degraded, not a clean alternative (FR-13):** the fail-open output carries a prominent **"⚠ Narrative unavailable — showing raw analysis"** banner, is the plainer substrate render (never the polished showpiece), and exits with a **distinct, machine-detectable degraded exit code** — the exact code **reconciled in the architecture exit-code enum**, not assigned here. A human still gets value; a script still detects the degradation. **(3) The report is AI-bound by construction (FR-11):** the full narrated **showpiece** report (the shareable HTML/Markdown hero artifact) is **structurally impossible to produce without narration** — no AI, no showpiece — which is how the "an LLM is required to build the report" ruling is honored: the **report** needs AI; the fail-open substrate is explicitly **not** the report. FR-11's "a run cannot complete without a reachable model" is reframed to "the narrated **report** requires a reachable model; if narration fails the run degrades to the analysis substrate rather than producing nothing." **(4) Metrics-only mode (FR-11/FR-15):** an explicit **`--no-ai`** / metrics-only path (no LLM call) exists and is the **default in headless/CI** — removing the CI tax of forced per-run inference for an unread narrative — but is **never** the interactive default and **never** the Free-tier identity. Metrics-only emits the substrate **cleanly (exit 0 — intended, not degraded)**; in CI a one-line notice points to the narrated report being available interactively / with a configured provider. **(5) Free tier keeps the narrative (FR-16):** the narrative is the hook and is experienced on the **Free tier** (volume-capped at the unchanged 100-commit cap); metrics-only is **not** the Free surface; Free gates **volume, not the soul** (pricing and the cap number unchanged). **(6) No per-developer ranking — promoted to an explicit, absolute LOCKED guardrail (§8):** both the Metrics and the Narrative analyze at the **repository / change level** and **never** rank, score, or single out individual developers — manager-facing output is team-level health only; the previously-implicit §8 positioning guardrail is now explicit and absolute, a deliberate differentiator. **(7) Telemetry stays off (clarified, §11):** the no-product-telemetry stance holds; the fail-open/degrade event is surfaced **locally** (verbose / doctor), and any future product analytics that might instrument it stays **opt-in, off by default** — consistent with the proxy-signal measurement model. Preserves #11–#18 unchanged; the AI-required ruling (#14) **stands, refined not reversed**. The **exact degraded exit code** is owned by the architecture exit-code enum (Winston); the **interactive degraded state + banner wording** is owned by the UX specs (Sally). (Affects FR-11, FR-12, FR-13, FR-15, FR-16, §8, §11.)

20. **Report-JSON provenance subtree (FR-17, new):** added an **optional top-level `provenance` subtree** to the canonical Report JSON — a third sibling of `analysis` / `narrative` (#16-A) — carrying the run's contextual facts so every renderer shows the *TEMPLATE-HTML* masthead ① / footer ⑦ chips and the Free-tier cap line **without re-deriving** them: **repo identity** (name/path · branch · local-vs-remote, sourced at retrieve/FR-1), **scale** (total commit count · contributor count, retrieve + analyze/FR-4), **AI provider/model** (narrate/FR-8·FR-11; absent on `--no-ai`/degraded), **run** timestamp + tool version (the injected `analysisTimestamp`, never `Date.now()`), and **entitlement** (tier + the Free "100 of N" cap, license/FR-16). **Determinism preserved:** provenance is **run metadata, not analysis** — the run-varying fields (timestamp, provider/model) live in `provenance`, never `analysis`, and provenance is **excluded from the trend-diff** (UJ-2 diffs `analysis` only), so the byte-stable subtree (#16-A) is untouched. **Schema status:** an **additive, optional** subtree decided pre-1.0.0-freeze (consistent with #9 / #18 — version pinned at `1.0.0`, field-level shape still revisable); a Report with no `provenance` stays valid, so the masthead/footer are back-compatible. **Privacy:** no secret/token ever in provenance, a remote identity is credential-stripped, and contributor data is an aggregate count — never per-developer (reaffirms §7 / §8). (Affects FR-12, FR-13, FR-17 [new], §3 Glossary, §4.5, §7, §8.)

## 13. Assumptions Index

- §4.2 — remaining assumptions are limited to bus-factor threshold, co-authorship trailer coverage, imperative-mood heuristic, issue-reference rate, and direct-to-default detection nuances.
