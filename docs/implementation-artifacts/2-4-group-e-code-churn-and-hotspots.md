---
epic: 2
story: 4
title: Group E — Code Churn & Hotspots
baseline_commit: fa1d430d6f42bd474ed46b80e082eebabea5f56d
---

# Story 2.4: Group E — Code Churn & Hotspots

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want churn and hotspot metrics,
so that I can find where work and instability concentrate.

## Acceptance Criteria

1. **Five Group E metrics over changed-file metadata, deterministic, uniform envelope (AC1).** **Given** retrieved history with changed-file metadata, **when** the engine runs, **then** Group E metrics — **most-changed files/directories**, **churn rate over time**, **add/delete ratio**, **file survival/age**, **large-change events** — are computed **deterministically** as pure functions over the shared `RepoModel` (using `commit.files` + `committedAtMs`), each returning the uniform `Metric` envelope (`computed` with a value, or `not_available` with a reason — never thrown, never omitted).

2. **Binary handling + honest degradation documented (AC2).** **Given** that `git log --numstat` emits `-`/`null` add-del for **binary** files and that the HEAD-only retrieval carries **no working-tree listing**, **when** the churn/age metrics run, **then** binary files are **counted as touches but excluded from line-churn sums** (documented), the **file-age** metric documents that "present in HEAD" is approximated by "seen in the analyzed history" (the retrieval has no `ls-tree`), and any metric with no usable changed-file data emits `not_available` with a specific reason rather than a misleading zero.

## Tasks / Subtasks

- [ ] **Task 1 — `analyze/groups/e-churn.ts`: per-file aggregation helper (AC1, AC2).** A pure local helper `aggregateFiles(commits)` → `Map<path, FileStat>` where `FileStat = { touchCount, additions, deletions, firstSeenMs, lastSeenMs }`:
  - [ ] For each commit, for each `file` in `commit.files`: `touchCount += 1`; if `file.additions`/`file.deletions` are **non-null** (text file), add them (binary `null` ⇒ **counted as a touch, excluded from line sums** — documented); track `firstSeenMs = min(committedAtMs)`, `lastSeenMs = max(committedAtMs)`.
  - [ ] A second helper `directoryOf(path)` (same rule as Group B: everything before the last `/`, root ⇒ `"."`) and a small `topByTouch(map, limit)` that sorts by `touchCount` desc then `path` asc (`compareCodeUnits`) and slices — reused for files and directories.

- [ ] **Task 2 — The five metric functions + specs + `GROUP_E_METRICS` (AC1, AC2).** Mirror `a/b/c/d-*.ts` exactly (exported `MetricSpec` consts, `MetricFn`s, a `GROUP_E_METRICS: RegisteredMetric[]` in stable order). Empty history ⇒ `not_available` for every metric; a metric needing changed-file data emits `not_available` when there is none:
  - [ ] **`e-most-changed` "Most-changed files / directories"** — `{ topFiles: [{ path, touchCount, churn }], topDirectories: [{ path, touchCount, churn }], totalFilesTouched, totalDirectoriesTouched }`. Hotspots = **top 20 files + top 10 directories** by `touchCount` (tie-break `path` asc). `churn` = additions+deletions (binary excluded). `not_available` when no files were touched.
  - [ ] **`e-churn-over-time` "Churn rate over time"** — `{ perMonth: Record<"YYYY-MM", { additions, deletions, churn, commitCount }>, totalChurn }`. Bucket commits by `monthBucket(committedAtMs, ctx.timezone)` (reuse Group A's time helper), key-sorted object. Uses the commit-level `additions`/`deletions` (already binary-excluded in the model). `not_available` only on empty history.
  - [ ] **`e-add-delete-ratio` "Add/delete ratio"** — `{ totalAdditions, totalDeletions, addDeleteRatio, netLines }`. `addDeleteRatio` = `round(additions / deletions)` with a documented convention when `deletions === 0` (emit `null` = "undefined / all growth, no deletions", never `Infinity`). `netLines` = additions − deletions. `not_available` only on empty history.
  - [ ] **`e-file-age` "File survival / age"** `[ASSUMPTION]` — `{ medianAgeDays, maxAgeDays, filesConsidered, singleTouchFileCount, presenceApproximation }`. Per file: `ageDays = (lastSeenMs − firstSeenMs) / DAY_MS`; emit `median`/`max` over all files. `presenceApproximation: "seen-in-history"` documents that the HEAD-only retrieval carries no working-tree listing, so "present in HEAD" is approximated by "appeared in the analyzed history" (precise HEAD filtering needs an `ls-tree` retrieval enhancement — deferred). `not_available` when no files were touched.
  - [ ] **`e-large-change-events` "Large-change events"** `[ASSUMPTION]` — `{ thresholdLines, largeChangeCount, largeChangeSharePct, events: [{ date, churn, changedFileCount }] }`. A commit is a large change when its `additions+deletions ≥ LARGE_CHANGE_LINES` (1000 `[ASSUMPTION]`). `events` = the **top 10 largest** commits by churn (desc, tie-break `committedAtMs` then `sha`), each emitting **`date` (ISO), `churn`, `changedFileCount` — NEVER the author** (NFR-8: change-level, not developer ranking). Merge commits have empty numstat (churn 0) so are never flagged — documented. `not_available` only on empty history.

- [ ] **Task 3 — Register Group E in the engine (AC1).** In [src/analyze/registry.ts](src/analyze/registry.ts), append `...GROUP_E_METRICS` to `ALL_METRICS` after Group D (stable order A→B→C→D→E). The engine does not change.

- [ ] **Task 4 — Tests: per-metric correctness + binary/degradation + determinism (AC1, AC2).**
  - [ ] Co-locate `e-churn.test.ts` with a **purpose-built fixture** exercising every branch: multiple commits touching overlapping files/directories (hotspot ranking), at least one **binary** file (`additions/deletions: null` — counted as a touch, excluded from churn), commits across ≥2 months (churn-over-time buckets), a file touched once (age 0) and a file touched across a long span (non-zero age), a commit with `deletions: 0` (ratio convention), and one **large** commit (≥1000 churn) plus normal commits.
  - [ ] Assert: most-changed ranking + tie-break; churn-over-time month buckets + binary excluded from churn but counted as a touch; add/delete ratio incl. the `deletions === 0 ⇒ null` convention; file-age median/max + `presenceApproximation`; large-change threshold + the top-10 events carrying `date`/`churn`/`changedFileCount` and **no author identity**; each metric's `not_available` (empty history, and the no-files-touched path).
  - [ ] **NFR-8 guard (large-change events):** serialize `e-large-change-events` for a fixture with sentinel author names/emails and assert **none appear** in the output (events are change-level, never developer-level).
  - [ ] Confirm `tests/determinism/analysis-determinism.test.ts` stays green with Group E appended (byte-identical + order-independent over `ALL_METRICS`). `SYNTHETIC_HISTORY` has text + binary files across days — verify stable Group E output; adjust the fixture only if needed and without disturbing Group A/B/C/D asserted values.

## Dev Notes

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **A unanimous clean review: Blind Hunter 0 patches, Edge Case Hunter 0 patches (every binary/null/path/time/age/ratio/large-event/determinism boundary walked and verified), and the spec-aware Acceptance Auditor 0 patches — both ACs MET, all five PRD metrics faithful (incl. the headline file-age HEAD-presence honesty check), NFR-8 proven by the guard test, scope held.** Triage: **0 patch · 0 defer · ~6 dismissed · 0 decision-needed.** One non-blocking **test-coverage gap** the Edge Case Hunter flagged was actioned (added tests, not a code change).

**Test hardening (review-driven, no behavior change):**

- [x] [Review][Tests] The Edge Case Hunter noted three correct-but-untested large-event/asymmetry boundaries — actioned with 3 new tests: (1) **>10 positive-churn commits** → `events` capped at `LARGE_EVENT_LIMIT` (10); (2) **all commits below the 1000-line threshold** → `largeChangeCount: 0` but `events` still emitted (the dual-measure intent); (3) **all-merge history** → file-level metrics (`e-most-changed`, `e-file-age`) are `not_available` while commit-level metrics (`e-churn-over-time`, `e-add-delete-ratio`, `e-large-change-events`) compute with zero churn — locking in the intentional file-level-vs-commit-level `not_available` split. 307 tests green.

**Dismissed (highlights):** "all-merge history returns `computed` with empty `events` instead of `not_available`" — **intentional** (an all-merge history *has* commits, just no change events; an empty `events` array is a valid computed result, distinct from the no-commits `not_available`; now explicitly tested); "a duplicate path within one commit would double-count touches" — **unreachable** from `git log --numstat` (the parser yields one entry per changed path); "`median(ages) ?? 0` is redundant" — harmless defensive guard (ages are non-empty when `fileStats.size > 0`); plus the full binary-`null`, mixed binary/text, ratio-`0/0`, year-boundary-bucket, and Map-iteration-order paths all verified correct by both hunters.

### Scope discipline — what this story does and does NOT include

This is the **fourth Epic 2 metrics story** — Group E, the **churn & hotspots** group. It reuses the `NormalizedCommit.files` per-file records **added in Story 2.1** (this is the story they were forward-built for) plus the `monthBucket` time helper (Story 1.5). Like Groups A–D it uses the Story 1.5 engine/model unchanged and needs **no model/stats/schema change** (`"E"` is already in the `MetricGroup` union and the Report schema enum).

**In scope:**
- The five Group E metric functions (`e-churn.ts`), pure `MetricFn`s over `commit.files` + `committedAtMs`, registered into `ALL_METRICS`.
- A documented per-file aggregation helper (`aggregateFiles`) + the binary-handling and HEAD-presence-approximation documentation (AC2).

**Out of scope / deferred (do NOT build here):**
- **Group F** — Story 2.5. Group F's hygiene score weights "Churn Stability 10%"; it will *consume* the computed Group E values, not re-aggregate files. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#Group F]
- **Precise "present in HEAD" filtering for file-age** — needs a retrieval enhancement (`git ls-tree HEAD`, or rename/delete tracking). `git log --numstat` does **not** distinguish a file deletion from a large removal, and the HEAD-only retrieval carries no tree listing, so this story **approximates** "present in HEAD" by "seen in the analyzed history" and documents it. Precise filtering is a later retrieval/Epic-5 concern. [Source: src/retrieve/git-log.ts]
- **Changing the retrieval (`git log`) flags / capturing rename history** — do NOT add `--follow`/`-M`/`--cc`; rename resolution is already best-effort in the 1.4 parser (`resolveNumstatPath`), and changing flags would alter A/B/C/D values. [Source: src/retrieve/git-log.ts]
- **Commit-selection inputs** (author/max/no-merges/dates/timezone narrowing the set) — **Story 2.6**. Group E computes over the model's existing commit set. [Source: docs/planning-artifacts/epics.md#Story 2.6]
- **Free-tier 100-commit cap** — **Story 2.7**.
- **AI Metric Explanations** (Epic 3); **health bands** (render-time, Epic 4); the **Group E overview chart** (hotspots horizontal bar + churn trend line — Epic 4 consumes this data). [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-6]

### The changed-file data reality — read before coding (AC2)

- **Binary files:** the 1.4 numstat parser emits `additions: null, deletions: null` for a binary file (git's `-` columns). Group E must **count a binary file as a touch** (it IS a hotspot signal — a binary asset changing often matters) but **exclude `null` from line-churn sums** (you cannot add `null`). The commit-level `additions`/`deletions` in the model are **already** binary-excluded (`buildModel` sums only non-null), so the **churn-over-time** metric can use those directly; the **per-file** churn (in `aggregateFiles`) must itself skip `null`. [Source: src/analyze/model.ts (buildModel binary exclusion), src/retrieve/git-log.ts (numstat `-` ⇒ null)]
- **Merge commits:** carry an **empty `files` array** (git omits merge diffs under `--numstat`, per Story 2.3) ⇒ churn 0, no file touches. So merges contribute nothing to hotspots/churn/large-events — which is **correct** (the integrated work is attributed to the branch commits) and must be documented so a reviewer doesn't read it as a bug. [Source: 2.3 merge-numstat finding, src/retrieve/git-log.ts]
- **"Present in HEAD" (file-age):** the HEAD-only `git log --numstat` retrieval gives changed-file metadata **per commit** but **no working-tree listing**, and numstat cannot reliably distinguish a file *deletion* from a large *removal*. So a precise "files currently present in HEAD" set is **not computable** from the retrieved data. This story computes age over **all files seen in history** and emits a `presenceApproximation: "seen-in-history"` marker documenting the gap. (Faithful, honest degradation — the same posture Story 2.3 took on merge numstat.) [Source: src/retrieve/local.ts, src/retrieve/git-log.ts]

### PRD §4.2 Group E catalog — the authoritative metric definitions

| id | Title (PRD) | What it represents (static description) |
|---|---|---|
| `e-most-changed` | Most-changed files / directories | files touched most often; likely complexity or instability hotspots |
| `e-churn-over-time` | Churn rate over time | insertions+deletions trend; rising churn can signal instability |
| `e-add-delete-ratio` | Add/delete ratio | growth vs. refactor/removal balance |
| `e-file-age` | File survival / age | median file age = days between first-seen and latest-seen commit timestamps for files currently present in HEAD `[ASSUMPTION]` |
| `e-large-change-events` | Large-change events | commits/merges with outsized diffs, flagged with dates and context |

[Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 Group E] — IDs follow the kebab convention; titles verbatim. The PRD addendum tags file-survival/age `[ASSUMPTION]` pending exactly the HEAD-presence computability pass this story documents.

### NFR-8 reminder (large-change events)

Group E is mostly change-level (files/churn), but **large-change events** could tempt a "who made the big commit" framing. It must NOT. Emit only **change-level** context per event — `date`, `churn`, `changedFileCount` — and **never the author name/email** (NFR-8: repository/change-level only, never single out a developer). A guard test asserts no author identity leaks into the large-change-events value. [Source: docs/planning-artifacts/epics.md#NFR-8, src/analyze/groups/b-contribution.ts (the same anonymization posture)]

### The exact engine/model contracts to build on (do NOT redefine)

- **`MetricFn = (model, ctx) => Metric`**; `computed(spec, value)` / `notAvailable(spec, reason)`; a throw → `not_available` via the engine. [Source: src/analyze/engine.ts]
- **`Metric` envelope** = `{ id, group, title, status, value?, reason? }`; `value` = `MetricValue` (JSON only — **no `Date`/`Map`/`Set`/`bigint`**). `MetricGroup` already includes `"E"`; the Report `MetricSchema` enum already includes `"E"` — **no type/schema change.** [Source: src/analyze/metric.ts, src/assemble/report-schema.ts]
- **`NormalizedCommit`** carries **`files: FileChange[]`** (`{ path, additions: number|null, deletions: number|null }` — the 2.1 field), `additions`/`deletions` (commit-level, binary-excluded line totals), `committedAtMs`, `changedFileCount`, `parents`. `RepoModel.commits` is sorted `[committedAtMs, sha]`. [Source: src/analyze/model.ts]
- **Time bucketing:** `monthBucket(epochMs, timezone)` (reuse Group A's `time.ts`; returns `"YYYY-MM"`). [Source: src/analyze/time.ts, src/analyze/groups/a-cadence.ts]
- **Stats helpers:** `median`, `percentile`, `mean`, `round` for age/median/threshold math; emit shares via a local `sharePct`. **Type gotcha (2.1):** an emitted object-array element type must be a **`type` alias, not an `interface`** (interfaces aren't assignable to `MetricValue`'s index signature) — Group E emits arrays of `{path,…}` / `{date,…}`, so define those as `type`. [Source: src/analyze/stats.ts, 2.1 Debug Log]

### Implementation patterns this story must follow (mirror Groups A–D)

- **P2/P3:** `kebab-case.ts`, **named exports only**, co-located `*.test.ts` under `src/analyze/groups/`. New file `e-churn.ts` (architecture map calls it `e-churn-hotspots.ts`; use **`e-churn.ts`** matching the `a-cadence`/`b-contribution`/`c-message-quality`/`d-branching` short-theme convention, and note the variance like Stories 1.5/2.3). [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure, 2-3 Project Structure Notes]
- **P5:** `analyze/` is under `no-console`, reads no env/clock/fs — pure functions of `(model, ctx)`. [Source: eslint.config.js]
- **Determinism:** key-sorted `perMonth` object; value-sorted arrays with `compareCodeUnits` tie-breaks; reduce-based `minOf`/`maxOf` if needed (self-safe on empty — return 0, the 2.2 patch); rounded shares/ratios/days; **no `Map`/`Set`/`Date` in emitted values** (the per-file `Map` is internal only); no `Date.now()`. `date` fields are ISO strings via `new Date(ms).toISOString()` (a pure function of the injected ms, like Group A's `projectAge`). [Source: src/analyze/groups/a-cadence.ts, src/analyze/groups/b-contribution.ts]
- **`[ASSUMPTION]` thresholds** (`LARGE_CHANGE_LINES = 1000`, hotspot top-20/top-10) are named module consts with comments, like Groups A–D. [Source: src/analyze/groups/d-branching.ts]

### Determinism harness — free coverage, must stay green

`tests/determinism/analysis-determinism.test.ts` runs `analyze(SYNTHETIC_HISTORY, ctx())` over **`ALL_METRICS`**, so appending Group E subjects it to byte-identical + order-independent + serializable checks. `SYNTHETIC_HISTORY` has text + binary files (`assets/logo.png` with `null` add/del) across multiple days and a merge — enough to exercise binary handling, hotspots, and churn buckets. Every Group E value is an order-independent aggregate of plain JSON. Keep Group A/B/C/D asserted values unchanged. [Source: tests/determinism/analysis-determinism.test.ts, src/analyze/sample-history.ts]

### Previous-story intelligence (2.1, 2.2, 2.3, 1.5)

- **Groups A–D are the template:** specs as exported consts, `MetricFn`s, a `GROUP_x_METRICS` array, `computed`/`notAvailable`, local pure helpers, named-const thresholds. [Source: src/analyze/groups/*.ts]
- **`NormalizedCommit.files` was added in 2.1 for exactly this** (ownership-by-area + Group E hotspots) — reuse it; the `directoryOf` rule (last `/`, root ⇒ `"."`) and the `topByTouch` sort+slice mirror Group B's `topAreas`. [Source: src/analyze/groups/b-contribution.ts]
- **Binary exclusion:** `buildModel` already excludes `null` from commit-level totals; per-file aggregation must do the same. [Source: src/analyze/model.ts]
- **Self-safe reductions (2.2):** any `minOf`/`maxOf` returns `0` for an empty array. **Order-independent selection (2.3):** never rely on input array order for a "top/last" pick — compute it explicitly (sort or reduce with an explicit comparator). [Source: 2.2/2.3 review patches]
- **NFR-8 (2.1):** anonymized/change-level only; a guard test proves no identity leak. [Source: src/analyze/groups/b-contribution.test.ts]

### Project Structure Notes

- New file: `src/analyze/groups/e-churn.ts` (+ `e-churn.test.ts`). Modified: `src/analyze/registry.ts` (+Group E) and `src/analyze/engine.test.ts` (metric-id-order assertion → A→B→C→D→E). **No model/stats/schema change.** [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.4: Group E — Code Churn & Hotspots]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 History Analysis — Metrics Catalog (Group E)] · [Source: …#FR-4] · [Source: …#FR-5]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/addendum.md#Metrics catalog — feasibility notes] (file survival/age `[ASSUMPTION]`)
- [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]
- [Source: src/analyze/model.ts] (`files`, binary exclusion) · [Source: src/analyze/time.ts] (`monthBucket`) · [Source: src/analyze/groups/b-contribution.ts] (`topAreas`/`directoryOf` pattern, NFR-8 guard) · [Source: src/retrieve/git-log.ts] (numstat binary `null`, merge omission) · [Source: src/analyze/metric.ts] · [Source: src/analyze/stats.ts] · [Source: src/analyze/registry.ts] · [Source: tests/determinism/analysis-determinism.test.ts]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean. (One dev fix, the recurring 2.1 gotcha: the emitted `MonthChurn` bucket type had to be a `type` alias, not an `interface` — interfaces aren't assignable to `MetricValue`'s index-signature `Record` shape. `Hotspot`/`LargeChangeEvent` were already `type`.)
- `npm run lint` → ESLint clean. (One editor SonarQube nudge resolved during dev: dropped an unnecessary `as MonthChurn` by iterating sorted `Map` entries directly.)
- `npm test` → vitest: **39 files / 304 tests passed** (was 38/289; +1 file, +15 tests). The determinism harness covers Group E via `ALL_METRICS` — byte-identical + order-independent green (incl. `SYNTHETIC_HISTORY`'s binary `assets/logo.png`).
- `npm run build` → tsup ESM build success (`dist/index.js` 70.66 KB).
- **Real e2e on this repo:** all five Group E metrics render — top hotspot `sprint-status.yaml`, churn bucketed per month, add/delete ratio, file-age (`presenceApproximation: "seen-in-history"`), and 6 large-change events ≥1000 lines.

### Completion Notes List

- **Both ACs satisfied.** AC1: five Group E metrics (`e-most-changed`, `e-churn-over-time`, `e-add-delete-ratio`, `e-file-age`, `e-large-change-events`) are pure `MetricFn`s over `commit.files` + `committedAtMs`, each returning the uniform envelope, registered into `ALL_METRICS` after Group D (stable A→B→C→D→E). AC2: binary files are **counted as touches but excluded from line-churn** (documented in `aggregateFiles`); file-age carries a `presenceApproximation: "seen-in-history"` marker documenting that the HEAD-only retrieval has no working-tree listing; and the file-dependent metrics emit `not_available` with a *specific* reason ("No changed-file data…") distinct from the empty-history reason.
- **Reuses the 2.1 forward-build:** `NormalizedCommit.files` (added in Story 2.1 for exactly this) powers `aggregateFiles`; the `directoryOf` rule + the `topByTouch` sort/slice mirror Group B's `topAreas`; `monthBucket` (Story 1.5) buckets churn-over-time. **No model/stats/schema change** — `"E"` was already in the `MetricGroup` union and the Report schema enum. Only `e-churn.ts` (new) + the registry line changed in source.
- **The changed-file data realities handled + documented (AC2's heart):** (1) **binary** → touch counted, `null` excluded from churn (per-file in `aggregateFiles`; the commit-level `additions/deletions` were already binary-excluded by `buildModel`, so `churn-over-time` uses those directly); (2) **merge commits** have empty `files` (Story 2.3) → contribute nothing, documented as correct (integrated work is on the branch commits); (3) **"present in HEAD"** is not computable from `git log --numstat` (no tree listing; can't distinguish delete from removal) → age computed over all files seen, marked `presenceApproximation`.
- **NFR-8 (large-change events):** events are **change-level only** — `{ date, churn, changedFileCount }`, **never the author**. A guard test asserts no sentinel author name/email leaks into the value. A zero-churn commit (e.g. a merge) is filtered out of events; the top-10 are the largest by churn (desc, tie-break `committedAtMs` then `sha`).
- **Add/delete ratio convention:** `deletions === 0` ⇒ `addDeleteRatio: null` ("all growth, no removals"), **never `Infinity`** (which would not survive JSON cleanly / would mislead). Documented + tested.
- **Determinism idioms followed:** key-sorted `perMonth`; value-sorted hotspot/event arrays with `compareCodeUnits` tie-breaks; `Math.min`/`Math.max` over scalars (not array spread); rounded ratios/shares/days; ISO `date` via `new Date(ms).toISOString()` (pure function of the injected ms); no `Map`/`Set`/`Date` in emitted values (the per-file `Map` is internal only); no `Date.now()`.
- **Scope deferrals honored:** no Group F (2.5 — it will *consume* the Group E value for "Churn Stability 10%"); **retrieval flags untouched** (no `--follow`/`-M`/`--cc`); precise HEAD-presence filtering deferred (needs an `ls-tree` retrieval enhancement); no commit-selection inputs (2.6); no Free-tier cap (2.7); no AI explanations (Epic 3); no health bands / Group E chart (Epic 4). No new dependencies.
- **Naming variance (flagged):** architecture map calls this `e-churn-hotspots.ts`; this story uses **`e-churn.ts`** to match the short-theme convention (`a-cadence`/`b-contribution`/`c-message-quality`/`d-branching`), as noted for prior groups.
- **Test update (not a behavior change):** `engine.test.ts`'s metric-id-order assertion extended from 23 (A+B+C+D) to the full 28-id A→B→C→D→E catalog.
- **SonarQube advisory** (unchanged): `type IsoDate = string` — intentional. No new gate-failing advisories.

### File List

**Added (source):**
- `src/analyze/groups/e-churn.ts` — five Group E `MetricFn`s + specs + `GROUP_E_METRICS` + the `aggregateFiles`/`directoryOf`/`topByTouch` helpers

**Added (tests, co-located):**
- `src/analyze/groups/e-churn.test.ts` (per-metric correctness, binary handling, ratio-null, file-age approximation, the NFR-8 large-change-events guard; +3 review-driven boundary tests: top-10 event cap, all-below-threshold dual measure, all-merge file-vs-commit-level `not_available` split)

**Modified (source):**
- `src/analyze/registry.ts` — append `GROUP_E_METRICS` to `ALL_METRICS`

**Modified (tests):**
- `src/analyze/engine.test.ts` — metric-id-order assertion extended to the A→B→C→D→E catalog

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 2-4 → in-progress → review
- `docs/implementation-artifacts/2-4-group-e-code-churn-and-hotspots.md` — this story (record filled, status → review)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 2.4 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 2.4 implemented (TDD): five deterministic Group E churn/hotspot metrics (`e-churn.ts`) over `commit.files` (the 2.1 forward-build) + `monthBucket`; binary counted-as-touch-but-excluded-from-churn, file-age `presenceApproximation` marker, add/delete ratio `null` convention, NFR-8 change-level large-change events with a guard test. No model/stats/schema change. 1 new suite; 39 files / 304 tests green; typecheck/lint/build clean; real e2e verified. Status → review. |
| 2026-06-13 | Code review (3 parallel layers) → unanimous 0 patches (Blind Hunter 0, Edge Case Hunter 0, Acceptance Auditor 0: both ACs MET, all 5 PRD metrics faithful incl. file-age HEAD-presence honesty, NFR-8 proven, scope held). Actioned the one non-blocking note: +3 boundary tests (top-10 cap, all-below-threshold dual measure, all-merge file-vs-commit asymmetry). 307 tests green; typecheck/lint/build clean. Status → done. |
