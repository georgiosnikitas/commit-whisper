---
epic: 2
story: 3
title: Group D — Branching & Merge Structure
baseline_commit: 4b29ad0e99736482d89d4edb5341600fe64d7aa3
---

# Story 2.3: Group D — Branching & Merge Structure

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want branching and merge metrics,
so that I can understand workflow discipline.

## Acceptance Criteria

1. **Five Group D metrics over parent-hash topology, deterministic, uniform envelope (AC1).** **Given** retrieved history with parent-hash topology, **when** the engine runs, **then** Group D metrics — **branch/merge topology summary**, **merge-vs-rebase tendency**, **direct-to-default rate**, **long-lived-branch signal (>30 days)**, **average changes per merge** — are computed **deterministically** as pure functions over the shared `RepoModel` (using `commit.parents`), each returning the uniform `Metric` envelope (`computed` with a value, or `not_available` with a reason — never thrown, never omitted).

2. **Topology heuristics document their rule and degrade honestly (AC2).** **Given** the `[ASSUMPTION]`-tagged topology heuristics (merge-vs-rebase tendency, direct-to-default rate) and the merge-dependent metrics (long-lived branch, average changes per merge), **when** they run, **then** each **documents the rule it applies** (the tip/mainline definition, the thresholds, the integrated-size definition) as commented module constants/helpers, **and** a metric with no merge commits to assess emits `not_available` with a specific reason rather than a misleading zero.

## Tasks / Subtasks

- [ ] **Task 1 — `analyze/groups/d-branching.ts`: topology primitives (the shared, documented foundation) (AC1, AC2).** Pure local helpers, each named + commented:
  - [ ] `shaIndex(commits)` → `Map<string, NormalizedCommit>` (sha → commit).
  - [ ] `isMerge(c)` = `c.parents.length >= 2`; `isRoot(c)` = `c.parents.length === 0`.
  - [ ] `findTip(commits)` → the **HEAD/tip** commit, identified by **topology** (the unique commit whose sha appears in **no** other commit's `parents` — in a HEAD-only history there is exactly one such leaf = HEAD). If somehow >1 leaf, pick the max by the model's `[committedAtMs, sha]` order (deterministic). Document this as the tip rule.
  - [ ] `firstParentMainline(tip, index)` → `Set<string>` of SHAs on the **first-parent chain** from the tip (follow `parents[0]` until none / missing). This is "the default branch" for the heuristics. Document it.

- [ ] **Task 2 — `analyzeBranches(...)`: the merge-integration helper (powers metrics 4 & 5) (AC1, AC2).** A pure helper returning, **per merge commit** (in model order), `{ integratedCommitCount, integratedChanges, branchSpanMs }`:
  - [ ] For a merge `M`, for each **non-first parent** `p` (index ≥ 1): DFS the ancestors of `p` following **all** parents, **stopping** at any commit already in `firstParentMainline` (the merge-base / trunk rejoin) or already visited for this merge; collect the off-mainline ("integrated") commits.
  - [ ] `integratedChanges` = Σ `(additions + deletions)` over the collected commits. **CRITICAL:** this uses the **branch commits' own churn**, NOT the merge commit's numstat — `git log --numstat` (the 1.4 retrieval) **emits no diff for merge commits**, so a merge's own `additions/deletions` are always `0`. Document this prominently; it is the single most important correctness fact in the story.
  - [ ] `integratedCommitCount` = number of collected off-mainline commits. `branchSpanMs` = `M.committedAtMs − min(committedAtMs of collected commits)` (or `0` when a merge integrated no unique off-mainline commits, e.g. merging an already-merged ancestor). Bound the DFS defensively (per-merge visited set; stop at mainline) and note the octopus / cross-branch-merge-base approximation.

- [ ] **Task 3 — The five metric functions + specs + `GROUP_D_METRICS` (AC1, AC2).** Mirror `a/b/c-*.ts` exactly (exported `MetricSpec` consts, `MetricFn`s, a `GROUP_D_METRICS: RegisteredMetric[]` in stable order). Empty history ⇒ `not_available` for every metric:
  - [ ] **`d-topology-summary` "Branch/merge topology summary"** — `{ totalCommits, mergeCommitCount, mergeSharePct, regularCommitCount, rootCommitCount, octopusMergeCount, workflow }`. `octopusMergeCount` = commits with `parents.length >= 3`; `workflow` = `"linear"` (no merges) or `"merge-based"` (documented two-value classification). `not_available` only on empty history.
  - [ ] **`d-merge-vs-rebase` "Merge vs. rebase tendency"** `[ASSUMPTION]` — `{ mergeSharePct, firstParentLinearityPct, tendency }`. `firstParentLinearityPct` = `mainlineCount / totalCommits * 100` (high = linear/rebase trunk); `tendency` by documented thresholds: `mergeSharePct === 0` → `"linear"`, `mergeSharePct >= MERGE_HEAVY_PCT` (15 `[ASSUMPTION]`) → `"merge-heavy"`, else `"mixed"`. `not_available` only on empty history.
  - [ ] **`d-direct-to-default` "Direct-to-default-branch rate"** `[ASSUMPTION]` — `{ directToDefaultCount, directToDefaultSharePct, viaMergeCount, mainlineCommitCount, totalCommits }`. `direct` = **non-merge** commits on the first-parent mainline (landed straight on the default branch); `viaMerge` = everything else (merge commits + off-mainline branch commits brought in via merges). Document the tip/mainline assumption. `not_available` only on empty history.
  - [ ] **`d-long-lived-branches` "Long-lived branch signal"** — `{ longLivedBranchCount, thresholdDays: 30, mergesAnalyzed, longestBranchDays, branchesWithUniqueCommits }`. Using `analyzeBranches`: a branch is long-lived when `branchSpanMs > 30 days` **and** it integrated ≥1 unique commit. `longestBranchDays` = max span (days, rounded). **`not_available` when there are no merge commits** ("No merge commits to assess branch lifespans.") — the honest-degradation case (AC2), distinct from empty history.
  - [ ] **`d-average-changes-per-merge` "Average changes per merge"** — `{ mergeCount, averageIntegratedChanges, medianIntegratedChanges, maxIntegratedChanges, mergesWithNoUniqueCommits }`. Using `analyzeBranches`: per merge, `integratedChanges` (branch-commit churn, per Task 2). `averageIntegratedChanges`/`median`/`max` over merges (rounded). **`not_available` when there are no merge commits** ("No merge commits to measure integrated change size.").

- [ ] **Task 4 — Register Group D in the engine (AC1).** In [src/analyze/registry.ts](src/analyze/registry.ts), append `...GROUP_D_METRICS` to `ALL_METRICS` after Group C (stable order A→B→C→D). The engine does not change.

- [ ] **Task 5 — Tests: per-metric correctness + topology + determinism (AC1, AC2).**
  - [ ] Co-locate `d-branching.test.ts` with a **purpose-built feature-branch fixture**: a mainline (`c1` root → `c2`), a feature branch off `c2` (`f1` → `f2`, with `f1` committed ~40 days before the merge so it is long-lived and carries real churn), and a merge `m1` with `parents: [c2, f2]` (mainline first-parent + branch tip). Plus a **linear** fixture (no merges) and **empty** history.
  - [ ] Assert each metric: topology summary counts (1 merge, root count, workflow `"merge-based"` vs `"linear"`); merge-vs-rebase tendency on the merge fixture vs the linear fixture; direct-to-default rate (mainline non-merge commits vs the via-merge branch commits); long-lived-branch detects the 40-day branch (and `not_available` on the linear fixture — no merges); average-changes-per-merge = the branch commits' churn (proving it is **not** the merge's own zero numstat), and `not_available` on the linear fixture.
  - [ ] **The merge-numstat fact, tested:** include an assertion that a merge whose branch integrated real churn reports a **non-zero** `averageIntegratedChanges` even though the merge commit's own `additions/deletions` are `0` — the test that would catch a naive "sum the merge commit's numstat" regression.
  - [ ] Confirm `tests/determinism/analysis-determinism.test.ts` stays green with Group D appended (byte-identical + order-independent over `ALL_METRICS`). `SYNTHETIC_HISTORY` already contains a merge commit (`c4`, parents `[c3, c2]`); verify Group D produces stable output for it (note: `c4`'s second parent `c2` is already on the mainline, so it integrates 0 unique commits — a valid degenerate case the harness will exercise). Adjust the fixture only if needed and without disturbing Group A/B/C asserted values.

## Dev Notes

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The Edge Case Hunter walked 50 boundaries (cycles, octopus merges, shallow boundaries, clock skew, exact thresholds) with 0 patches, and the spec-aware Acceptance Auditor verified both ACs MET + all five PRD metrics faithful (incl. the headline merge-numstat check) + scope held — 0 patches.** The Blind Hunter raised one defensive-determinism item. Triage: **1 patch · 0 defer · ~13 dismissed · 0 decision-needed.**

**Patch:**

- [x] [Review][Patch] `findTip` selected the tip via `leaves.at(-1)`, relying on the *documented* precondition that `model.commits` is pre-sorted `[committedAtMs, sha]` (true today, and `filter` preserves order) — but the precondition was assumed, not enforced, so a future caller passing unsorted commits would get a non-deterministic tip [src/analyze/groups/d-branching.ts] — **Fixed:** `findTip` now computes the latest leaf **explicitly** via a `reduce` over an `isLater(a, b)` comparator (`[committedAtMs, sha]` using `compareCodeUnits`), so the choice is order-independent regardless of input order. Added a multi-leaf determinism test (two independent roots; tip is identical for forward vs. reversed input). 289 tests green.

**Dismissed (highlights):** the Blind Hunter's other 9 checks self-dismissed (the `firstParentMainline` cycle guard, the `integrateBranch` visited-before-process DFS, the `earliestMs`/`branchSpanMs` `Infinity` guard, `regularCommitCount` non-negativity since merge/root are mutually exclusive, `sharePct` zero-guard, the merge-numstat handling, JSON serialization). The Edge Case Hunter's 50-edge walk found everything handled — notably: parent **cycles** and **self-parents** terminate (per-merge visited set), **shallow-clone boundaries** (parent sha not in index) skip gracefully, **octopus merges** integrate over all non-first parents, **multiple roots** pick a deterministic tip, **clock-skew negative spans** are correctly rejected (not > 30d), and the **exact-threshold** cases (merge share 15.0%, span 30.0d) match the spec's `>=`/`>` boundaries. One informational note (clock-skew negative span is silently accepted) was deemed working-as-designed (the metric reflects data quality implicitly). **Test infra note:** one full-suite run showed a transient 2-failure/107s flake from the 1.6 narrate-preflight `AbortSignal.timeout` real-timer tests; three subsequent clean runs confirmed 289/289 green — logged as a pre-existing fake-timer defer.

### Scope discipline — what this story does and does NOT include

This is the **third Epic 2 metrics story** — Group D, the **topology** group. It reads `commit.parents` (and, for integrated-size, the branch commits' existing `additions/deletions`); like Groups A–C it uses the Story 1.5 engine/model unchanged and needs **no model/stats/schema change** (`"D"` is already in the `MetricGroup` union and the Report schema enum).

**In scope:**
- The five Group D metric functions (`d-branching.ts`), pure `MetricFn`s over the DAG topology, registered into `ALL_METRICS`.
- The documented topology primitives (`findTip`, `firstParentMainline`, `analyzeBranches`) as named/commented helpers (AC2).

**Out of scope / deferred (do NOT build here):**
- **Groups E, F** — Stories 2.4–2.5. (Group F's hygiene score weights "Branching Discipline 20%"; it will *consume* the computed Group D values — Story 2.5.)
- **Changing the retrieval (`git log`) flags** — do **NOT** add `-m`/`--first-parent`/`--cc` to capture merge diffs; that is a 1.4/retrieval concern and would change Groups A/B/C/E values. Group D computes integrated size from the branch commits already in the history. [Source: src/retrieve/git-log.ts]
- **Commit-selection inputs** (author filter / max-commits / no-merges / dates / timezone narrowing the set) — **Story 2.6**. Group D computes over the model's existing commit set. Note `--no-merges` (2.6) would strip merge commits entirely, which by design makes the merge-dependent Group D metrics `not_available` — that interaction is 2.6's to wire, not 2.3's. [Source: docs/planning-artifacts/epics.md#Story 2.6]
- **Free-tier 100-commit cap** — **Story 2.7**.
- **AI Metric Explanations** (Epic 3, Story 3.2); **health bands** (render-time, Epic 4); the **Group D overview chart** (branch/merge timeline + merge-density bars — Epic 4 consumes this data). [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-6/FR-8]
- **Remote / multi-branch retrieval** — retrieval is local HEAD history (Branch "head" default, 1.2/1.4); Group D's tip/mainline model assumes a single HEAD leaf. Multi-branch (`--all`) is a later concern. [Source: src/config/run-config.ts, src/retrieve/local.ts]

### The merge-numstat fact — read this before writing any code

The 1.4 retrieval runs `git log --numstat` with **no** `-m` / `--first-parent` / `-c`/`--cc`. **Git omits the diff for merge commits by default**, so every merge commit arrives with an **empty `files` array** ⇒ `additions === 0` and `deletions === 0`. Therefore:
- **"Average changes per merge" must NOT sum the merge commit's own numstat** (it would always be `0`). It is the **size of the integrated unit** = the total churn of the off-mainline commits the merge brought in (Task 2's `analyzeBranches`). This is the faithful reading of the PRD ("size of integrated units; small steady merges vs. big-bang integrations").
- **"Long-lived branch"** likewise measures the integrated branch's lifespan (first off-mainline commit → merge), not anything on the merge commit itself.
- A test must assert a **non-zero** average integrated change for a merge whose branch carried real churn — the regression guard against a naive implementation.

[Source: src/retrieve/git-log.ts (`gitLogArgs` — `--numstat`, no `-m`); git's default merge-diff suppression]

### Topology model — tip, mainline, integrated branches (the documented heuristics, AC2)

- **Tip (= HEAD):** retrieval is HEAD-only, so the DAG reachable from HEAD has exactly **one leaf** — the commit whose sha appears in no other commit's `parents`. That leaf is HEAD. (`findTip` returns it; >1 leaf, defensively, → max by `[committedAtMs, sha]`.) This is topology-based and avoids relying on timestamps. [Source: src/retrieve/local.ts (HEAD history), src/analyze/model.ts (order)]
- **Mainline (= the default branch):** the **first-parent chain** from the tip (`parents[0]` repeatedly). In git's model, `parents[0]` of a merge is the branch you were *on* when you merged (the trunk), so the first-parent chain is the canonical "default branch" line. The merge-base where a feature branch diverged is on this chain. [Source: git first-parent semantics]
- **Integrated (off-mainline) commits of a merge:** ancestors of the merge's **non-first** parents that are **not** on the mainline (DFS stopping at the mainline = the rejoin/merge-base). These are the branch's unique commits — their count and churn are the "integrated unit." Bounded by stopping at the mainline; the rare octopus / branch-of-a-branch merge-base case is a documented approximation. [Source: this story]
- **Determinism:** tip, mainline, and the per-merge DFS sums/counts/min are all order-independent; merges are processed in the model's stable `[committedAtMs, sha]` order; no `Date.now()`, no `Map`/`Set` in emitted values (used internally only). [Source: src/analyze/model.ts]

### PRD §4.2 Group D catalog — the authoritative metric definitions

| id | Title (PRD) | What it represents (static description) |
|---|---|---|
| `d-topology-summary` | Branch/merge topology summary | count of merges, share of merge commits, presence of a recognizable workflow |
| `d-merge-vs-rebase` | Merge vs. rebase tendency | merge-heavy vs. linear, from merge-commit share + first-parent linearity `[ASSUMPTION]` |
| `d-direct-to-default` | Direct-to-default-branch rate | share landing straight on the default branch vs. via merge `[ASSUMPTION]` |
| `d-long-lived-branches` | Long-lived branch signal | merged branches whose span (first unique commit → merge) exceeds **30 days** |
| `d-average-changes-per-merge` | Average changes per merge | size of integrated units; small steady merges vs. big-bang integrations |

[Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 Group D] — IDs follow the kebab convention; titles verbatim. Note the PRD title for D2 is "Merge vs. rebase tendency" and D5 "Average changes per merge."

### The exact engine/model contracts to build on (do NOT redefine)

- **`MetricFn = (model, ctx) => Metric`**; `computed(spec, value)` / `notAvailable(spec, reason)`; a throw → `not_available` via the engine. [Source: src/analyze/engine.ts]
- **`Metric` envelope** = `{ id, group, title, status, value?, reason? }`; `value` = `MetricValue` (JSON only — **no `Date`/`Map`/`Set`/`bigint`**). `MetricGroup` already includes `"D"`; the Report `MetricSchema` enum already includes `"D"` — **no type/schema change.** [Source: src/analyze/metric.ts, src/assemble/report-schema.ts]
- **`NormalizedCommit`** carries **`parents: string[]`** (the `%P` shas, root = `[]`), `committedAtMs`, and `additions`/`deletions` (binary-excluded line totals). `RepoModel.commits` is sorted `[committedAtMs, sha]`. [Source: src/analyze/model.ts]
- **Stats helpers:** `mean`, `median`, `round` for the average/median integrated-change + longest-branch; emit shares via a local `sharePct(part, total)` (mirror Group C). Reduce-based `minOf`/`maxOf` if needed (never `Math.min(...arr)`). [Source: src/analyze/stats.ts, src/analyze/groups/c-message-quality.ts]

### Implementation patterns this story must follow (mirror Groups A/B/C)

- **P2/P3:** `kebab-case.ts`, **named exports only**, co-located `*.test.ts` under `src/analyze/groups/`. New file `d-branching.ts` (architecture map calls it `d-branch-merge.ts`; the PRD/epics theme is "Branching & Merge Structure" — use **`d-branching.ts`**, consistent with the `a-cadence`/`b-contribution`/`c-message-quality` short-theme naming, and note the variance like Story 1.5 did). [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure, 1-5 Project Structure Notes]
- **P5:** `analyze/` is under `no-console`, reads no env/clock/fs — pure functions of `(model, ctx)`. [Source: eslint.config.js]
- **Determinism:** key-sorted objects if any map-like value is emitted (none currently — Group D emits flat scalar objects + enums); reduce-based min/max; rounded shares/days; no `Map`/`Set`/`Date` in values. Use a **non-recursive (explicit stack) DFS** for `analyzeBranches` to avoid stack overflow on deep histories, with a per-merge visited `Set`. [Source: src/analyze/groups/a-cadence.ts]
- **`[ASSUMPTION]` thresholds** (`MERGE_HEAVY_PCT = 15`, `LONG_LIVED_DAYS = 30`) are named module consts with comments, like Group A/B/C. [Source: src/analyze/groups/b-contribution.ts]

### Determinism harness — free coverage, must stay green

`tests/determinism/analysis-determinism.test.ts` runs `analyze(SYNTHETIC_HISTORY, ctx())` over **`ALL_METRICS`**, so appending Group D subjects it to byte-identical + order-independent + serializable checks. `SYNTHETIC_HISTORY` has a merge commit (`c4`, parents `[c3, c2]`) whose second parent is already on the mainline → it integrates **0 unique commits** (a valid degenerate case; long-lived/avg-changes will see a merge with empty integration). Group D must handle that without `NaN`/throw. Keep Group A/B/C asserted values unchanged. [Source: tests/determinism/analysis-determinism.test.ts, src/analyze/sample-history.ts]

### Previous-story intelligence (2.1, 2.2, 1.5)

- **Groups A/B/C are the template:** specs as exported consts, `MetricFn`s, a `GROUP_x_METRICS` array, `computed`/`notAvailable`, local pure helpers, named-const thresholds. [Source: src/analyze/groups/*.ts]
- **Type gotcha from 2.1:** an emitted **object-array element** type must be a **`type` alias, not an `interface`** (interfaces aren't assignable to `MetricValue`'s index signature). Group D emits flat objects + enum strings — if any per-item array of objects is added, use a `type`. [Source: 2.1 Debug Log]
- **Regex/`[ASSUMPTION]` discipline from 2.2:** thresholds as named commented consts; honest `not_available` with a *specific* reason (here: distinguish "empty history" from "no merge commits to assess"). [Source: src/analyze/groups/c-message-quality.ts]
- **`minOf`/`maxOf` self-safe (2.2 patch):** return `0` for an empty array if you add them. [Source: 2.2 review patch]

### Project Structure Notes

- New file: `src/analyze/groups/d-branching.ts` (+ `d-branching.test.ts`). Modified: `src/analyze/registry.ts` (+Group D) and `src/analyze/engine.test.ts` (metric-id-order assertion → A→B→C→D). **No model/stats/schema change.** [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.3: Group D — Branching & Merge Structure]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 History Analysis — Metrics Catalog (Group D)] · [Source: …#FR-4] · [Source: …#FR-5]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/addendum.md#Metrics catalog — feasibility notes] (rebase tendency + long-lived branches are `[ASSUMPTION]`-tagged for a computability pass)
- [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]
- [Source: src/retrieve/git-log.ts] (the `--numstat` merge-diff omission) · [Source: src/analyze/model.ts] (`parents`) · [Source: src/analyze/groups/c-message-quality.ts] (the pattern) · [Source: src/analyze/metric.ts] · [Source: src/analyze/stats.ts] · [Source: src/analyze/registry.ts] · [Source: tests/determinism/analysis-determinism.test.ts]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean. (One dev fix: `firstParentMainline`'s `firstParent` needed an explicit `string | undefined` annotation — TS hit a circular-inference error TS7022 because `current` is reassigned from a value derived from `current`.)
- `npm run lint` → ESLint clean. (Editor SonarQube nudges resolved during dev: extracted `integrateBranch` from `analyzeBranches` to cut cognitive complexity; `.at(-1)` for the tip; dropped an unnecessary `as string`; two-arg `Math.max(m, v)` in the reduce.)
- `npm test` → vitest: **38 files / 288 tests passed** (was 37/273; +1 file, +15 tests). The determinism harness covers Group D via `ALL_METRICS` — byte-identical + order-independent green (incl. `SYNTHETIC_HISTORY`'s merge `c4` whose 2nd parent is already on the mainline → 0 integrated).
- `npm run build` → tsup ESM build success (`dist/index.js` 63.85 KB).
- **Real e2e on this repo (linear history):** all five Group D metrics render — topology `linear`, 100% first-parent linearity, 100% direct-to-default, and the two merge-dependent metrics correctly `not_available` with specific reasons ("No merge commits to assess branch lifespans" / "…to measure integrated change size") — the AC2 honest-degradation behavior in the wild.

### Completion Notes List

- **Both ACs satisfied.** AC1: five Group D metrics (`d-topology-summary`, `d-merge-vs-rebase`, `d-direct-to-default`, `d-long-lived-branches`, `d-average-changes-per-merge`) are pure `MetricFn`s over the parent-hash topology, each returning the uniform envelope, registered into `ALL_METRICS` after Group C (stable A→B→C→D). AC2: the `[ASSUMPTION]` heuristics document their rule via named/commented helpers + consts (`findTip`, `firstParentMainline`, `analyzeBranches`/`integrateBranch`, `LONG_LIVED_DAYS=30`, `MERGE_HEAVY_PCT=15`), and the two merge-dependent metrics emit `not_available` with a *specific* reason when there are no merge commits — distinct from the empty-history reason — rather than a misleading zero.
- **The merge-numstat fact handled correctly (the story's headline correctness concern):** `git log --numstat` (the 1.4 retrieval) emits no diff for merge commits, so a merge's own `additions/deletions` are always `0`. "Average changes per merge" and "long-lived branch" therefore measure the **integrated unit** — the off-mainline branch commits' own churn/timestamps via `analyzeBranches`, never the merge's empty numstat. A dedicated regression test asserts a **non-zero** `averageIntegratedChanges` (55, the branch churn) for a merge whose own numstat is empty — the guard against a naive "sum the merge's numstat → always 0" implementation.
- **Topology model (documented):** the **tip = HEAD** is found by topology (the unique commit referenced by no other commit's `parents`; >1 leaf → last in `[committedAtMs, sha]` order), not by timestamp; the **mainline = the first-parent chain** from the tip (git's first parent of a merge is the trunk you were on); **integrated commits** = ancestors of a merge's non-first parents that aren't on the mainline, via an **explicit-stack DFS** (no recursion → safe on deep histories) bounded by a per-merge visited set + the mainline stop boundary. Octopus / branch-of-a-branch merge bases are a documented approximation.
- **Determinism:** tip, mainline, and per-merge sums/counts/min are order-independent; merges processed in model `[committedAtMs, sha]` order; rounded shares/days; no `Map`/`Set`/`Date` in emitted values (internal only); no `Date.now()`. The degenerate merge (2nd parent already on the mainline → 0 integrated commits) is handled without `NaN`/throw and has its own test.
- **No model/stats/schema change** — Group D reads the existing `commit.parents` (+ branch commits' `additions/deletions`); `"D"` is already in the `MetricGroup` union and the Report schema enum. Only `d-branching.ts` (new) + the registry line changed in source.
- **Scope deferrals honored:** no Groups E/F (2.4–2.5; Group F will *consume* the Group D value for "Branching Discipline 20%"); **retrieval flags untouched** (did NOT add `-m`/`--cc` to capture merge diffs — that would change A/B/C/E values); no commit-selection inputs (2.6 — note `--no-merges` would make the merge-dependent metrics `not_available`, which is 2.6's interaction to wire); no Free-tier cap (2.7); no AI explanations (Epic 3); no health bands / Group D chart (Epic 4). No new dependencies.
- **Naming variance (flagged):** the architecture directory map calls this `d-branch-merge.ts`; this story uses **`d-branching.ts`** to match the `a-cadence`/`b-contribution`/`c-message-quality` short-theme convention (same kind of variance noted in Story 1.5 for A/B).
- **Test update (not a behavior change):** `engine.test.ts`'s metric-id-order assertion extended from 18 (A+B+C) to the full 23-id A→B→C→D catalog.
- **SonarQube advisory** (unchanged): `type IsoDate = string` — intentional. No new gate-failing advisories.

### File List

**Added (source):**
- `src/analyze/groups/d-branching.ts` — five Group D `MetricFn`s + specs + `GROUP_D_METRICS` + topology helpers (`findTip`, `firstParentMainline`, `analyzeBranches`/`integrateBranch`)

**Added (tests, co-located):**
- `src/analyze/groups/d-branching.test.ts` (feature-branch + linear + degenerate-merge fixtures; the merge-numstat regression guard)

**Modified (source):**
- `src/analyze/registry.ts` — append `GROUP_D_METRICS` to `ALL_METRICS`

**Modified (tests):**
- `src/analyze/engine.test.ts` — metric-id-order assertion extended to the A→B→C→D catalog

**Modified (review patch):**
- `src/analyze/groups/d-branching.ts` — `findTip` selects the tip via an explicit `[committedAtMs, sha]` `reduce` (order-independent, no sorted-input precondition)
- `src/analyze/groups/d-branching.test.ts` — multi-leaf deterministic-tip test

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 2-3 → in-progress → review
- `docs/implementation-artifacts/2-3-group-d-branching-and-merge-structure.md` — this story (record filled, status → review)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 2.3 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 2.3 implemented (TDD): five deterministic Group D topology metrics (`d-branching.ts`) over `commit.parents`; documented tip/mainline/integrated-branch helpers (explicit-stack DFS); "avg changes per merge" + "long-lived branch" measure the INTEGRATED branch churn (merge numstat is empty by git design) with a non-zero regression guard; merge-dependent metrics degrade to `not_available` honestly. No model/stats/schema change. 1 new suite; 38 files / 288 tests green; typecheck/lint/build clean; real e2e verified. Status → review. |
| 2026-06-13 | Code review (3 parallel layers) → Edge Case Hunter 0 (50 edges walked) + Acceptance Auditor 0 (both ACs MET, all 5 PRD metrics faithful incl. merge-numstat, scope held). 1 patch / 0 defer-in-story (2 logged to deferred-work) / ~13 dismissed. Applied: `findTip` order-independent tip selection (+multi-leaf test). 289 tests green; typecheck/lint/build clean. Status → done. |
