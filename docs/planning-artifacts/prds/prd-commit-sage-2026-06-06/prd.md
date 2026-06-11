---
title: commit-sage
status: final
created: 2026-06-06
updated: 2026-06-11
---

# PRD: commit-sage

## 0. Document Purpose

This PRD is for the product owner (George), downstream BMAD workflow owners (UX, architecture, epics & stories), and any engineer implementing commit-sage. It builds on the finalized product brief at [brief.md](../../briefs/brief-commit-sage-2026-06-06/brief.md) and its [addendum.md](../../briefs/brief-commit-sage-2026-06-06/addendum.md) (competitive landscape) — it does not duplicate them. Structure: a Glossary anchors vocabulary; features are grouped with globally numbered Functional Requirements (FR-N) nested beneath them; the metrics catalog (§4.2) is the analytical heart; cross-cutting NFRs, constraints, and monetization live in their own sections; assumptions are tagged inline as `[ASSUMPTION]` and indexed in §13. Implementation/technology detail (the "how") is kept out of the FRs and parked in `addendum.md`.

## 1. Vision

commit-sage is a terminal-native tool that turns impenetrable git history into a clear, narrated report. Existing tools produce git statistics and graphs, but developers still can't *understand* them. commit-sage closes that comprehension gap: it retrieves commit history from a remote, computes a thorough analysis, and then uses AI to **explain the history in plain language** and **coach the reader toward better git practices** — grounded entirely in what the repository's own data shows.

The need is one of scale. A developer, team, or engineering manager can be responsible for many repositories, each with a history far too long for any human to read end to end. commit-sage reads what no human can and hands back a story plus a path to improvement. Because it lives in the terminal and emits a canonical JSON artifact, it runs on a developer's machine, automates inside CI/CD, and renders into HTML, Markdown, or terminal output from one analysis.

It is positioned as **developer-owned insight** — the developer learns how to improve; a manager who is part of the team sees repository *health* to help the team shore up weaknesses and confirm strengths — never a per-developer surveillance scoreboard. Its tagline: *"I know what you did last commit."*

## 2. Target User

### 2.1 Jobs To Be Done

- **Understand an unfamiliar or long history fast** — "I inherited this repo / these repos; tell me what happened and what matters."
- **Learn to use git better** — "Show me, from my own history, how to write better commits and branch more sanely."
- **Onboard into a codebase's past** — a new hire reconstructing context without reading thousands of commits by hand.
- **Keep history healthy at scale** — run repeatedly / in CI to watch hygiene trend over time across many repos.
- **See team-level repository health (manager)** — where knowledge concentrates (bus-factor risk), where practices are slipping, where they're strong — to help, not to rank individuals.

### 2.2 Non-Target Users

- Teams wanting a hosted web dashboard / SaaS analytics portal — commit-sage is terminal-native and emits files; there is no central portal.
- Managers seeking a per-developer productivity/ranking scoreboard — out by design, permanently.
- Users wanting forward authoring (AI that writes their next commit message / PR) — that is a different category; commit-sage explains the *past*.

### 2.3 Key User Journeys

- **UJ-1. Dana inherits a five-year-old repo and needs the story by lunch.**
  - **Persona + context:** Dana, a senior dev who just joined the team and was handed a long-lived service repo nobody fully remembers.
  - **Entry state:** terminal open, commit-sage installed, a GitHub repo URL to hand, and a personal access token set in her environment (or config file) so it stays out of shell history.
  - **Path:** runs `commit-sage analyze <repo-url>`; the tool reads all branches by default (she could scope to one branch if she wanted), computes metrics, calls her configured LLM; a progress indicator shows phases (retrieve → analyze → explain).
  - **Climax:** an HTML report opens — a TL;DR of the repo's story up top, plain-language explanation of the patterns (ownership, cadence, risky hotspots), graphs she can actually read, and a coaching section.
  - **Resolution:** Dana can recount the repo's history and names two concrete improvements. She bookmarks the report and shares the file with her team.

- **UJ-2. Marco automates a monthly health check in CI.**
  - **Persona + context:** Marco, a team lead with the unlimited/automation license, wants hygiene tracked without anyone remembering to run it.
  - **Entry state:** a CI pipeline, the commit-sage binary, and a token plus an LLM key stored in CI secrets.
  - **Path:** a scheduled job runs commit-sage headless against each repo; secrets (token, LLM key) are injected as environment variables from the CI secret store, while non-secret config (repo URL, output formats) is passed as flags; the tool emits JSON and a Markdown report as build artifacts; non-zero exit only on operational failure, not on "unhealthy" findings.
  - **Climax:** the Markdown health report lands in the pipeline artifacts every month; the JSON is diffed against last month to show whether hygiene is trending up.
  - **Resolution:** the team sees improvement over time without manual effort; Marco never opens a dashboard.

- **UJ-3. Sofia, who is rusty with git, runs it on her own side project to get better.**
  - **Persona + context:** Sofia, a solo developer on the free or single-device tier, knows her commits are messy.
  - **Path:** runs commit-sage on her own repo; the coaching section, grounded in her actual messages and branching, gives her step-by-step changes; on the free tier, an optional Buy Me a Coffee support link is available.
  - **Resolution:** *"I finally understand what my history says about me, and I know exactly what to fix."*

## 3. Glossary

- **Repository (repo)** — a single git repository identified by a remote URL. The unit commit-sage analyzes.
- **Remote provider** — the hosting service for a repo: GitHub, GitLab, or Bitbucket.
- **Commit history** — the full set of commits, authors, timestamps, messages, branch/merge structure, and changed-file metadata commit-sage reads from a repo.
- **Analysis** — the complete set of computed Metrics for a repo, independent of AI.
- **Metric** — a single computed measurement about the history, belonging to a Metric Group, with a title and a description of what it represents (catalog in §4.2).
- **Metric Group** — a named cluster of related Metrics (e.g., *Contribution & Ownership*).
- **Metric Explanation** — an LLM-generated, repo-specific assessment attached to an individual Metric (§4.2), grounded in that Metric's data, covering four things: (1) an **explanation** of what the Metric's value means for this repo, (2) the **good behaviours** it reveals, (3) what **needs improvement**, and (4) **suggestions** on how to improve. Distinct from the repo-level AI Narrative.
- **Report JSON** — the canonical machine-readable artifact: all Metrics (each with its Metric Explanation) plus the AI Narrative, from which all rendered outputs are generated. Single source of truth.
- **Rendered output** — a human-facing report generated from Report JSON via a template: **HTML**, **Markdown**, or **Terminal**.
- **AI Narrative** — the LLM-generated text, in three parts: **Summary**, **Explanation**, **Coaching** (defined below).
- **Summary** — a short TL;DR of the repo's story and headline findings, for skimming.
- **Explanation** — plain-language interpretation of what the Metrics show and why.
- **Coaching** — a structured improvement **report** (introduction → themed chapters → closing summary), prescriptive and prioritized, grounded in this repo's Metrics; it consolidates and ranks the per-metric improvement suggestions (§4.2 Metric Explanations) into a coherent plan to improve future git practice.
- **LLM provider** — the user-configured AI backend: Ollama (local), OpenAI, Gemini, Anthropic, or any OpenAI-compatible endpoint. **BYOK** (bring-your-own-key).
- **Grounding** — the requirement that every factual AI claim trace to a specific computed Metric; the AI may not assert history facts the Metrics don't support.
- **Confidence self-assessment** — the AI's own rating of how well the available model/data supported a trustworthy Narrative, with escalation advice when low.
- **License tier** — Free, Single-device, or Unlimited/Automation (defined in §9 Monetization).
- **Headless / CI mode** — non-interactive execution suitable for CI/CD: no prompts, machine-readable exit codes, file artifacts.

## 4. Features

### 4.1 Repository Retrieval

**Description:** commit-sage connects to a remote git provider and retrieves the full Commit history for a Repository. It supports GitHub, GitLab, and Bitbucket, including private repositories via a personal access token. Retrieval is read-only. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Connect to a remote repository

A user can point commit-sage at a Repository by remote URL and retrieve its Commit history. Realizes UJ-1.

**Consequences (testable):**
- Accepts repository URLs for GitHub, GitLab, and Bitbucket (HTTPS form at minimum).
- Retrieves the full commit history across all branches reachable without extra credentials by default; the user can scope retrieval to a single named branch.
- Reads, at minimum, per commit: hash, author identity, committer identity, author timestamp, commit timestamp, message, parent hashes (to reconstruct branch/merge structure), and changed-file metadata (paths, insertions, deletions).
- Operation is strictly read-only; commit-sage never writes to, pushes to, or mutates the remote.

`[NOTE FOR PM]` The **retrieval mechanism** — full `git clone` vs. provider REST/GraphQL API paging — is capability-shaping, not merely an implementation detail: it gates rate-limit exposure (FR-3's no-retry hard stop), performance budgets (§7), and which Group E churn/diff metrics (§4.2) are affordable. Current leaning is **`git clone`**, chosen partly to minimize rate-limit exposure given the no-retry posture; to be confirmed in the architecture phase, with the rationale and override conditions captured in `addendum.md`.

#### FR-2: Authenticate to private repositories

A user can supply a personal access token to analyze a private Repository. Realizes UJ-2.

**Consequences (testable):**
- A token is provided via environment variable and/or config file, never as a command-line argument. This single rule holds in both interactive and headless/CI mode: interactively it keeps the token out of shell history, and in CI it matches how providers inject secrets (e.g. GitHub Actions secrets, GitLab CI variables) — as environment variables, not flags.
- A token with insufficient scope produces a clear, actionable error naming the missing permission, not a raw provider error.
- Tokens are never written to Report JSON, logs, or any Rendered output.

#### FR-3: Handle retrieval limits and failures gracefully

commit-sage degrades gracefully on partial or failed retrieval.

**Consequences (testable):**
- Network failure, auth failure, and "repo not found" are distinguished in error messages.
- On a transient or rate-limit error from a provider, the tool does not retry: it reports the condition clearly (including which provider and, where available, the provider's own guidance such as a rate-limit reset time) and exits without producing a partial Report. commit-sage does not absorb or work around faults in systems outside its responsibility; re-running is the user's choice.
- A repository larger than the Free tier cap (§9) is retrieved only up to the capped number of most-recent commits, and the report states it was capped.

**Out of Scope:**
- Self-hosted / generic git servers beyond the three named providers (GitHub, GitLab, Bitbucket). Not planned.
- SSH-key authentication. Token-based only.

### 4.2 History Analysis — Metrics Catalog

**Description:** commit-sage computes a thorough, deterministic Analysis from the retrieved Commit history, independent of any AI. Metrics are organized into Metric Groups; each Metric has a title and a description of what it represents. This catalog is the analytical heart of the product and the factual basis the AI Narrative is grounded against (§4.4). All Metrics are computed from data already retrieved in §4.1; none require writing to the repo. In addition to its deterministic title and one-line description, **every Metric also receives an LLM-generated Metric Explanation** (§4.4, FR-8) that, for this repo, explains what the Metric's value means, calls out the **good behaviours** it reveals, identifies **what needs improvement**, and gives **suggestions on how to improve**. Realizes UJ-1, UJ-2, UJ-3.

> **Catalog note:** the groups and metrics below are the target set. The one-line text under each Metric is its *static* description (what it represents); the per-run, repo-specific **Metric Explanation** (explanation + good behaviours + what needs improvement + how to improve) is generated by the LLM (FR-8) and is separate. Individual metrics carry `[ASSUMPTION]` where definition or feasibility needs confirmation. The exact graph paired with each group is named in §4.3.

**Group A — Activity & Cadence** *(how the project moves over time)*
- **Commit volume over time** — count of commits per day/week/month; shows the project's heartbeat and lulls.
- **Commit frequency / cadence** — average and median interval between commits; regularity vs. burstiness.
- **Active vs. dormant periods** — stretches of high activity and silence, with start/end dates.
- **Project age & lifespan** — first commit date, latest commit date, total elapsed time.
- **Commit size distribution** — distribution of changed lines per commit; reveals "giant commit" tendencies.
- **Time-of-day / day-of-week pattern** — when work happens (e.g., heavy weekend or late-night commits). `[ASSUMPTION: timezone derived from commit metadata.]`

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

**Functional Requirements:**

#### FR-4: Compute the metrics catalog

commit-sage computes the Metrics in Groups A–F from the retrieved history, deterministically and without AI.

**Consequences (testable):**
- Every Metric in the catalog is either computed and present in Report JSON, or explicitly marked `not_available` with a reason (e.g., data insufficient) — never silently omitted.
- Identical input history produces identical Metric values across runs (determinism).
- Each Metric in Report JSON carries its title, machine value(s), and the description of what it represents.
- No Metric computation requires any network call beyond the retrieval in §4.1, and none mutate the repo.

#### FR-5: Group and describe metrics for human consumption

Metrics are organized into the named Groups, each Metric self-describing.

**Consequences (testable):**
- Report JSON represents Groups and the Metrics within them as a stable structure with stable keys (so templates and downstream tooling can rely on them).
- Each Group has a title and short description; each Metric has a title and a one-line description of what it represents.

**Notes:** The metric set is confirmed computable from retrieved history data and bounded to fit the performance budgets in §7.

### 4.3 Visualization

**Description:** commit-sage renders modern, clean graphs of the Metrics in the HTML Rendered output, with text-appropriate reductions in Markdown and Terminal. Graphs exist to make Metric Groups legible at a glance, paired with the AI Explanation. Realizes UJ-1.

**Functional Requirements:**

#### FR-6: Render graphs for the metric groups

The HTML output presents a graph for each Metric Group where a graph aids comprehension.

**Consequences (testable):**
- HTML chart mapping is fixed: Group A = multi-series line chart (commits and churn over time); Group B = Pareto bar chart (contribution concentration) plus bus-factor marker; Group C = stacked bar chart (message quality categories); Group D = branch/merge timeline with merge-density bars; Group E = horizontal bar chart for hotspots plus churn trend line; Group F = radar chart for component scores plus overall score gauge.
- Graphs render from Report JSON without re-running the Analysis.
- HTML is **self-contained**: a single file that renders fully by opening it in a browser, with no external network dependency, CDN, or companion asset files — assets (CSS, scripts, fonts, images) are inlined. (The inlining *technique* is an architecture detail. Upholds the offline-capable NFR in §7 and the no-central-portal positioning.)

#### FR-7: Degrade visuals appropriately per output format

Each Rendered output presents visuals suited to its medium.

**Consequences (testable):**
- Markdown output uses **no embedded/binary images**. Visuals are expressed as text: tables, ASCII charts/sparklines, and **Mermaid diagrams** (rendered natively by GitHub, GitLab, and common Markdown viewers; shown as fenced code where unsupported). The file stays plain-text, diff-able, and reviewable in a pull request.
- Terminal output presents compact textual summaries / sparklines rather than full graphs.
- No Rendered output depends on a network connection or a central server to display.

### 4.4 AI Narrative — Explanation & Coaching

**Description:** commit-sage sends the computed Metrics (not raw code) to the user-configured LLM provider and produces (a) the repo-level AI Narrative in three parts — **Summary**, **Explanation**, and a **Coaching** improvement report (introduction → themed chapters → summary) — and (b) a **Metric Explanation** for every Metric in the §4.2 catalog. The Narrative is the product's core differentiator: it makes the Analysis *understandable* and turns it into improvement. Every factual claim must be grounded in the Metrics, and the AI rates its own confidence and escalates when low. Realizes UJ-1, UJ-3.

**Voice & tone standard:** the Narrative reads like a knowledgeable peer who has read the entire history and wants to help — plain language, no unexplained jargon, encouraging rather than judgmental. Coaching is prescriptive but supportive ("a good next step is…", not "you should have…"). This voice is load-bearing: it is the felt difference between commit-sage and a raw statistics dashboard, and it carries the brief's promise of a *narrated story*.

All AI prose must follow this style guide:
- Use direct, plain language; explain any unavoidable technical term in context.
- Prefer constructive, actionable phrasing over blame or scorekeeping.
- Ground tone in repository evidence (metrics first, interpretation second).
- Avoid absolutist wording unless the metric support is explicit.

**Functional Requirements:**

#### FR-8: Generate the AI Narrative and a per-metric explanation

commit-sage produces, from the computed Metrics, (a) the repo-level Narrative — Summary, Explanation, and Coaching — and (b) a Metric Explanation paragraph for every Metric in the §4.2 catalog. Realizes UJ-1, UJ-3.

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
- Both the repo-level Narrative and all Metric Explanations are carried in Report JSON (FR-12) and rendered in every output format (FR-13).

`[NOTE FOR PM]` Per-metric explanations multiply LLM output (~30 Metrics). To bound cost and latency on the user's BYOK budget, generation may be **batched into a single request** rather than one call per Metric — an architecture decision, not a capability change. No per-use cost accrues to commit-sage (FR-11).

#### FR-9: Ground every factual claim in the metrics

The AI Narrative may not assert history facts the Metrics don't support (Grounding).

**Consequences (testable):**
- Factual statements in the Narrative and in every Metric Explanation (FR-8) trace to specific Metric(s) present in Report JSON.
- The system uses prompt constraints **and** a post-generation verification pass against Report JSON; unsupported factual claims are removed or rewritten before render.
- Where the Metrics are insufficient to support a claim, the Narrative says so instead of fabricating.

#### FR-10: Self-assess confidence and escalate

commit-sage reports how trustworthy the Narrative is and advises escalation when confidence is low.

**Consequences (testable):**
- Each run yields a Confidence self-assessment surfaced in the output as one of: `high`, `medium`, `low`.
- Confidence level is computed from: verification pass rate, share of `not_available` metrics, and provider/runtime warning signals.
- When confidence is low (e.g., a small local model produced weak or generic output), the output explicitly recommends re-running with a stronger LLM provider, and names how (which config to change).
- Low confidence never silently degrades into a confident-sounding but unreliable Narrative.

#### FR-11: Support multiple BYOK LLM providers

A user configures their own LLM provider and key. Realizes UJ-3.

**Consequences (testable):**
- Supported providers: Ollama (local/offline), OpenAI, Gemini, Anthropic, and any OpenAI-compatible endpoint.
- Provider, model, and key are user-configurable via config file and/or environment variables.
- With Ollama (local), no Commit history data leaves the user's machine — satisfying privacy-sensitive use.
- A missing/invalid key or unreachable provider yields a clear, actionable error, not a stack trace.
- commit-sage incurs no per-use AI cost itself; inference is always on the user's key.

**Feature-specific NFRs:**
- Only Metrics and derived summaries are sent to the LLM — never tokens, never raw source file contents beyond what a Metric description requires. Raw diffs are never sent.

### 4.5 Report Output & Rendering

**Description:** commit-sage emits a canonical Report JSON and renders human-facing outputs from it via predefined templates: HTML, Markdown, and Terminal. JSON is the single source of truth; all Rendered outputs derive from it, so they never disagree. There is no central web portal. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-12: Emit canonical Report JSON

Every analysis produces a Report JSON containing all Metrics (each with its Metric Explanation) and the AI Narrative.

**Consequences (testable):**
- Report JSON is well-formed, documented, and stable enough to diff across runs (powers trend deltas, FR-4/Group F).
- Report JSON contains everything needed to render any output format with no re-analysis and no AI re-call.
- Report JSON is itself a first-class artifact a user can keep, script against, or archive.

`[NOTE FOR PM]` **Commitment.** The structured AI outputs ship as structured JSON, not flat strings: **Coaching** as a nested object (`introduction`, `chapters[]`, `summary`) and each **Metric Explanation** as an object with its four facets (`explanation`, `goodBehaviours`, `needsImprovement`, `suggestions`). Report JSON schema is fixed as `schemaVersion: "1.0.0"`; any backward-incompatible change requires a major schema-version bump.

#### FR-13: Render HTML, Markdown, and Terminal from templates

commit-sage renders HTML, Markdown, and Terminal outputs from Report JSON using predefined templates.

**Consequences (testable):**
- The user can select one or more output formats for a run.
- HTML is self-contained and presents the full report (Summary, graphs, Explanation, Coaching).
- Markdown is suitable for committing as a file or posting in a PR/wiki; Terminal output is suitable for immediate reading and CI logs.
- All formats present the same facts (Metrics + Narrative) from the same Report JSON.

### 4.6 Execution Modes & Licensing

**Description:** commit-sage runs interactively on a developer's machine and headless in CI/CD, ships as a self-contained executable, and enforces the three License tiers. Realizes UJ-2, UJ-3.

**Functional Requirements:**

#### FR-14: Interactive (developer) execution

A developer runs commit-sage from a terminal and gets a report. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- A single command runs the full pipeline: retrieve → analyze → narrate → render.
- Progress is visible (phases indicated) for long histories.
- The tool ships as a self-contained executable so a user without a preinstalled Node runtime can run it. Packaging may use Node SEA, pkg, or nexe; `npx` remains an optional convenience path for users who already have Node.

#### FR-15: Headless / CI execution

commit-sage runs non-interactively in CI/CD. Realizes UJ-2.

**Consequences (testable):**
- A headless mode runs with no interactive prompts, reading all config from environment variables, config file, and/or CLI flags. Secrets (token, LLM key) come only from environment variables or config file (per FR-2/FR-11), never from CLI flags; non-secret config (repo URL, provider, model, output formats) may come from flags.
- Exit codes are machine-readable: success vs. operational failure (auth, network, config). An "unhealthy" repo finding is NOT a failure exit.
- Report JSON and selected Rendered outputs are written to predictable paths suitable for CI artifacts.

#### FR-16: Enforce license tiers

commit-sage enforces Free, Single-device, and Unlimited/Automation tiers (defined in §9). Realizes UJ-2.

**Consequences (testable):**
- At startup, commit-sage checks whether the installed license is valid before beginning analysis or rendering.
- Free tier analyzes only the 100 most-recent commits and clearly states the cap in output; all other features remain available within that cap.
- Single-device tier removes the commit cap but is licensed to one device; running on a second device is refused with a clear message.
- Unlimited/Automation tier permits any number of devices and headless/CI execution.
- License enforcement uses two paid product SKUs: Single-device and Unlimited/Automation. Single-device is device-bound; Unlimited/Automation is not device-bound and includes headless/CI use. License enforcement fails safe and never transmits repository data.

## 5. Non-Goals (Explicit)

- **No central web portal / hosted SaaS dashboard.** The deliverable is the tool's own output (JSON + Rendered files).
- **No per-developer ranking or productivity surveillance.** Manager-facing health is team-level only.
- **No forward authoring.** commit-sage does not write the user's commit messages, PRs, or code.
- **No becoming a CI platform / code-quality linter.** It analyzes git *history*, not static code quality or test coverage.
- **No bundled AI / no hosted inference.** Always BYOK; commit-sage carries no inference cost or vendor lock-in.
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

- **Privacy:** with a local provider (Ollama), no repository data leaves the machine. With cloud providers, only Metrics/derived summaries are sent — never tokens, never raw source beyond what a Metric needs. Tokens and keys never appear in JSON, logs, or Rendered output.
- **Security:** read-only against remotes; secrets read from env/config, not bare CLI args; clear failure on insufficient token scope.
- **Determinism:** identical history ⇒ identical Metrics (the AI layer is the only non-deterministic part, and it is bounded by Grounding).
- **Performance:** must handle very long histories (the core painkiller) within reasonable time and memory; long runs show progress. Budgets for a 50k-commit repo on a 4-vCPU / 16 GB RAM machine: deterministic retrieval+analysis <= 10 minutes, peak RSS <= 2.5 GB, AI narrative+metric explanations <= 4 minutes (cloud provider) or <= 8 minutes (local Ollama-class model).
- **Offline-capable:** with Ollama and after retrieval, analysis and rendering require no network; all Rendered outputs display with no server.
- **Portability:** ships as a self-contained executable across major OSes (macOS, Linux, Windows).
- **Trust/accuracy:** Grounding (FR-9) + Confidence self-assessment (FR-10) are first-class; a confidently wrong Narrative is the worst outcome and is designed against.

## 8. Constraints & Guardrails

- **Cost:** zero marginal AI cost to commit-sage (BYOK). The product's price is a one-time perpetual license.
- **Privacy guardrail:** the local/offline (Ollama) path must remain a fully supported first-class option, not a degraded fallback — it is the answer for orgs that forbid sending commit data to a cloud.
- **Positioning guardrail (from brief):** all manager-facing output is framed as team-level health, risk, and improvement — never individual ranking. This constraint binds the wording of Group F and the Coaching section. It is deliberate protection against the documented backlash against developer-productivity surveillance (see the brief's competitive analysis): any drift toward per-developer ranking would forfeit the trust the product depends on, so it is forbidden even when technically easy.

## 9. Monetization

Perpetual, one-time purchase. Three tiers (from the finalized brief):

- **Free** — capped at the 100 most-recent commits (the funnel; full features within the cap) and includes a voluntary Buy Me a Coffee support link.
- **Single-device ($2.99)** — one device; unlimited runs, repositories, and remote servers; commit cap removed.
- **Unlimited/Automation ($100)** — any number of devices plus headless/CI automation; the team & manager-of-many-teams tier where value concentrates.
- **AI cost is the user's** (BYOK), so the license price stays pure margin after the sale.
- Prices are final: no additional pricing tiers are planned.

`[NOTE FOR PM]` **Cannibalization risk (accepted).** Because Single-device grants unlimited repositories and remote servers, a small team can buy N× Single-device (e.g., 4 × $2.99 = $11.96) and obtain everything the Unlimited tier offers *except* (a) multiple devices under one license and (b) headless/CI automation (FR-15). This tradeoff is accepted and pricing remains fixed.

## 10. Why Now

The comprehension gap is unaddressed: OSS tools graph but don't explain; engineering-intelligence platforms sell manager dashboards, not plain-language history or coaching; AI git tools write the *next* commit, not an explanation of the *past*. Capable BYOK LLMs (local and cloud) now make grounded, affordable explanation feasible without per-use cost to the vendor. commit-sage is first to fuse retrospective explanation with prescriptive coaching in the terminal — the chance is to define the category before incumbents (notably GitHub/Copilot) add "explain history" natively. The barrier is execution and focus, not proprietary technology, so the strategy is to define the category and earn trust first. This also answers the obvious objection — *"why not just ask ChatGPT over `git log`?"* — an ungrounded chat will confidently invent history, whereas Grounding (FR-9) ties every claim to Metrics computed from the user's own repository, and CI-scale, multi-repository analysis needs a tool, not a chat session.

## 11. Success Metrics

`[NOTE FOR PM]` **Measurement model.** commit-sage remains portal-less, local-first, BYOK, and does not collect product telemetry. Success metrics are measured via proxy signals only: license sales/conversion, refund/chargeback rate, review sentiment, support-ticket themes, and opt-in user surveys.

### Primary

- **SM-1: Comprehension.** After reading the report, a user can accurately recount the repo's story and name a concrete next improvement. Validates FR-8, FR-9. *(Measured via user feedback; qualitative for early stages.)*
- **SM-2: Repeat / automated use.** Users run commit-sage more than once per repo and/or wire it into CI/CD. Validates FR-12, FR-15 — proof it's a painkiller, not a one-time novelty.

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

## 13. Assumptions Index

- §4.2 — remaining assumptions are limited to timezone derivation, bus-factor threshold, co-authorship trailer coverage, imperative-mood heuristic, issue-reference rate, and direct-to-default detection nuances.
