---
epic: 2
story: 6
title: Commit-selection inputs
baseline_commit: 0cbbaf3e5623ea7059d7426a5c719cc3476a373b
---

# Story 2.6: Commit-selection inputs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to scope which commits are analyzed,
so that I can focus the analysis on the slice I care about.

## Acceptance Criteria

1. **Selection narrows the analyzed commit set before metrics compute (AC1).** **Given** an author filter, a max-commits limit, a no-merges flag, optional start/end dates, and/or a timezone, **when** any are supplied, **then** the analyzed commit set is **narrowed accordingly before metrics compute** — the narrowing happens between retrieve and analyze, so all 32 catalog metrics (Groups A–F) compute over exactly the selected set, deterministically.

2. **Unbounded dates, UTC default, timezone governs interpretation (AC2).** **Given** start/end dates, **when** either is empty, **then** that side is **unbounded** (all history on that side), with **no auto-shrinking**; **and** the timezone **defaults to UTC** and **governs both the date-bound interpretation and the time-bucketed metrics** (Group A day/week/month + time-of-day) — the same configured timezone drives both.

3. **`no-merges` changes Group A–F values consistently and deterministically (AC3).** **Given** `--no-merges`, **when** selection runs, **then** merge commits are excluded from the analyzed set, **so every group's values change consistently** (e.g. Group D's merge-dependent metrics degrade to `not_available`, Group E churn excludes nothing new since merges carry no numstat, Group A volume drops the merge commits) — and the result is byte-identical for the same selection.

## Tasks / Subtasks

- [ ] **Task 1 — `analyze/select.ts`: the pure commit-selection stage (AC1, AC2, AC3).** A new pure module (no I/O) operating on the raw `RepoHistory`:
  - [ ] `SelectionCriteria = { authorFilter?: string; maxCommits?: number; noMerges: boolean; startDate?: string; endDate?: string; timezone: string }`.
  - [ ] `selectCommits(history: RepoHistory, criteria: SelectionCriteria): RepoHistory` — applies, **in this documented order** (so Story 2.7's Free cap slots in after): **(1) no-merges** (drop `parents.length >= 2`), **(2) author filter** (case-insensitive substring match on the **author** `name` OR `email`), **(3) date range** (commit's day bucket in the timezone within `[startDay, endDay]`, inclusive, unbounded when a side is empty), **(4) max-commits cap** (keep the **most-recent N** by the model's total order `[committedAtMs, sha]`). Returns `{ repoTarget, commits: kept }`.
  - [ ] `projectSelection(config: RunConfig): SelectionCriteria` — maps the frozen `RunConfig` fields (`authorFilter`, `maxCommits`, `noMerges`, `startDate`, `endDate`, `timezone`) into the criteria; no env/argv access (the config is already resolved).
  - [ ] **Date interpretation (documented):** a bound is compared at **day granularity in the configured timezone** — each commit's `dayBucket(committedAtMs, timezone)` (`YYYY-MM-DD`, reusing Group A's `time.ts`) is compared lexically against the bound's date component (`bound.slice(0, 10)`); empty/absent bound ⇒ unbounded on that side. **Max-commits picks the most recent** = the last N in the deterministic `[committedAtMs, sha]` order (a date-then-cap ordering Story 2.7 builds on).

- [ ] **Task 2 — Wire the selection stage into `cli/run.ts` + the selection flags into `cli/cli.ts` (AC1, AC2).** Between `retrieve(config)` and `analyze(...)`, insert `const selected = selectCommits(history, projectSelection(config));` and pass `selected` to `analyze`. The frozen `RunConfig` already carries every selection field (Story 1.2) and `config.timezone` already flows into `ctx.timezone` (Story 1.8) — so the **same timezone governs both** date bounds and bucketing (AC2). **Also wire the commit-selection CLI flags** in `cli/cli.ts` (these are FR-1 config-data inputs, distinct from Epic 6's *operational* flags): `--no-merges` (commander negation → `noMerges`), `--max-commits <count>` (positive-int, `UsageError` on invalid), `--author <text>` (`authorFilter`), `--since <date>` (`startDate`), `--until <date>` (`endDate`); `--timezone` is already wired. Selection is otherwise a pure stage the shell composes.

- [ ] **Task 3 — Tests: per-filter + combination + ordering + determinism (AC1, AC2, AC3).**
  - [ ] Co-locate `select.test.ts` with a **purpose-built mixed fixture** (multiple authors, a merge commit, commits across several months/timezone-boundary days, and >N commits for the cap):
    - [ ] **no-op:** empty criteria (no filters, `noMerges: false`) returns the history unchanged (same commits).
    - [ ] **no-merges:** drops `parents.length >= 2`; a history that becomes merge-free.
    - [ ] **author filter:** case-insensitive substring on name and on email; a query matching neither returns empty; a query matching one author narrows to that author's commits.
    - [ ] **date range:** start-only (unbounded end), end-only (unbounded start), both; a commit exactly on a bound day is **included** (inclusive); a different timezone shifts a near-midnight commit across a day boundary (tz governs the bound — the AC2 proof).
    - [ ] **max-commits:** keeps the most-recent N (by `[committedAtMs, sha]`); `N >= count` is a no-op; the kept set is deterministic at a committedAt tie (sha tie-break).
    - [ ] **ordering / combination:** no-merges + author + date + cap together yield the date-filtered set capped to N (date before cap — the 2.7 seam); deterministic / byte-identical across two runs and input-order-independent.
  - [ ] **`run.test.ts` (AC1, AC3):** a `runPipeline` test with a config carrying `maxCommits` (or `noMerges`) over an injected fake retrieve proves the **analysis reflects the narrowed set** (e.g. commit-volume total = N, not the full count) — selection is genuinely applied in the pipeline, end-to-end.
  - [ ] Confirm `tests/determinism/analysis-determinism.test.ts` stays green — it calls `analyze` directly on the full `SYNTHETIC_HISTORY` (no selection), so it is unaffected; selection is a separate pre-stage. The existing `run.test.ts` cases (no selection criteria ⇒ `selectCommits` is a no-op) stay green.

## Dev Notes

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The Blind Hunter and the spec-aware Acceptance Auditor both cleared it with 0 patches** — the Auditor verified all three ACs genuinely MET (the tz-aware date-boundary test was called "the smoking gun for 'governs both'"), the pure-stage-before-`buildModel` architecture sound, the CLI-flag wiring correctly scoped (FR-1 config-data, not Epic 6 operational), and scope held. The Edge Case Hunter found a genuine **date-bound robustness** cluster. Triage: **3 patch · 2 defer-dismissed · ~2 dismissed · 0 decision-needed.**

**Patch:**

- [x] [Review][Patch] A **partial or malformed date bound** (`--since 2024-03`, `--until garbage`) was sliced to its first 10 chars and lexically compared, **silently producing a wrong filter** (e.g. `"2024-03-15" > "2024-03"` → wrongly excluded) [src/analyze/select.ts] — **Fixed:** `dayBound` now requires a well-formed `YYYY-MM-DD` shape; a malformed bound is treated as **unbounded** (not a wrong compare). Added a select test (`treats a malformed/partial date bound as unbounded`).
- [x] [Review][Patch] The **CLI accepted malformed `--since`/`--until` and non-decimal `--max-commits`** (`0x10`→16, `1e3`→1000) silently [src/cli/cli.ts] — **Fixed:** `--since`/`--until` are validated to a `YYYY-MM-DD` shape (full ISO timestamp allowed) and `--max-commits` to a decimal positive integer (`/^\d+$/`), each a typed `UsageError` (exit 2). Added cli tests for the hex/scientific `--max-commits` and the partial-date rejections + the well-formed acceptance. (Full **semantic** date validation — is `2024-13-45` a real date — stays deferred to the Zod-schema story.)
- [x] [Review][Patch] The **most-recent-N cap sort was non-deterministic on an unparseable `committedAt`** (`Date.parse → NaN` makes the `am − bm` comparator non-total) [src/analyze/select.ts] — **Fixed:** the comparator coerces a non-finite date to a fixed extreme (`NEGATIVE_INFINITY`) and uses `< ? -1 : 1` with the `sha` tie-break, so it is **total and deterministic** regardless of input order; `buildModel.parseInstant` remains the downstream authority that fails loud on a truly bad timestamp. (git emits valid `%cI`, so this is defensive.)

**Dismissed:** "inconsistent unparseable-date handling (date filter excludes vs no-filter lets it reach `buildModel` which throws `MetricsError`)" — unreachable with valid git data (`%cI` is always parseable); `buildModel.parseInstant` is the documented single authority, and the date filter's defensive exclusion is reasonable; with the cap-determinism patch there is no non-determinism. "scientific-notation `--max-commits`" — folded into the decimal-only patch above.

### Scope discipline — what this story does and does NOT include

This story adds the **commit-selection stage** — a pure filter between retrieve and analyze that narrows which commits feed the catalog. It realizes FR-1's commit-selection inputs (author / max-commits / no-merges / dates / timezone) on top of the already-resolved `RunConfig` fields and the already-wired timezone bucketing.

**In scope:**
- The pure `selectCommits` + `projectSelection` stage (`analyze/select.ts`), wired into `cli/run.ts`.
- Tz-aware day-granular date bounds, author substring match, no-merges exclusion, most-recent-N cap, with a documented filter order (date-before-cap) that Story 2.7 extends.

**Out of scope / deferred (do NOT build here):**
- **The Free-tier 100-commit cap + the "Analyzed 100 of N" truncation notice** — **Story 2.7**. 2.6 establishes the **filter order (filters → cap)** and the most-recent-N cap mechanic; 2.7 layers the Free cap on top (the smaller of `--max-commits` and the Free cap wins; date-then-cap; the notice). 2.6 emits **no selection notice** (keep minimal). [Source: docs/planning-artifacts/epics.md#Story 2.7]
- **Flag/CLI parsing for the selection inputs** — the `RunConfig` fields already exist (Story 1.2) and resolve from env/flags. 2.6 **wires the FR-1 commit-selection flags** in `cli/cli.ts` (`--no-merges`/`--max-commits`/`--author`/`--since`/`--until`; `--timezone` was wired in 1.8) since they are the user-facing way the AC's inputs are "supplied." Epic 6's *operational* flags (`--show-config`, `--non-interactive`, `--verbose`/`--quiet`, `--version`, `--config`, `NO_COLOR`/`FORCE_COLOR`) — a distinct surface — stay deferred. [Source: src/cli/cli.ts, docs/planning-artifacts/epics.md#Story 6.4]
- **ISO date / timezone validation** — value validation is the deferred Zod-schema concern (already logged from Story 1.2). 2.6 interprets a well-formed `YYYY-MM-DD` (or ISO timestamp) bound at day granularity; malformed bounds are the user's responsibility until the validation story. [Source: deferred-work.md — Story 1.2 env validation]
- **Pushing filters down to `git log`** (`--author`/`--max-count`/`--since`/`--until`/`--no-merges`) for very-large-repo performance — a deferred **perf optimization** (NFR-4). 2.6 filters **in memory** for determinism, testability, and the explicit date-then-cap ordering 2.7 needs; the git-side push-down can be added later behind the same `SelectionCriteria` without changing callers. [Source: docs/planning-artifacts/architecture.md#NFR-4, src/retrieve/git-log.ts]
- **Remote / multi-branch retrieval, `.mailmap` author canonicalization for the author filter** — the author filter matches the **raw** author identity (name/email substring); `.mailmap` collapsing is an analyze-model concern (already applied inside `buildModel` for the metrics) and the raw substring match is the faithful, simple reading of "author filter." [Source: src/analyze/identity.ts]

### Architecture decision — selection is a pure stage between retrieve and analyze (read first)

The hexagonal pipeline is `retrieve → analyze → narrate → assemble → render`. The cleanest home for commit selection is a **pure function inserted between retrieve and analyze**, narrowing the raw `RepoHistory` **before** `buildModel`:

- **Why before `buildModel`:** every metric (A–F) is a pure function of the model, and the model is built from the history it's given. Filtering the history first means **all 32 metrics automatically compute over the selected set** — satisfying AC3's "no-merges changes Group A–F values consistently" with **zero per-metric change**. (Re-filtering inside each metric would be 32× duplication and drift-prone.)
- **Why a pure function (not pushed to `git log`):** in-memory selection is deterministic, table-testable (feed a `RepoHistory`, assert the kept set), and lets us control the **date-then-cap ordering** Story 2.7 requires. Pushing to git is a later perf optimization (deferred) that can hide behind the same `SelectionCriteria`.
- **Why in `analyze/` (not `retrieve/`):** selection is about *what to analyze*; it reads the tz-aware day helper (`analyze/time.ts`) and operates on the analyze boundary. `cli/run.ts` (the shell) composes `selectCommits(retrieve(config), projectSelection(config))` — the shell already owns the frozen `RunConfig`. The `analyze` function stays a pure function of whatever history it receives (the determinism harness, which calls `analyze` directly on the full fixture, is unaffected).

This keeps the change **small and localized**: one new pure module + a two-line `run.ts` insertion; no engine/model/metric/schema change.

### The exact contracts to build on (do NOT redefine)

- **`RunConfig` selection fields (frozen, Story 1.2):** `authorFilter?: string`, `maxCommits?: number` (positive int), `noMerges: boolean` (default `false`), `startDate?: IsoDate`, `endDate?: IsoDate` (absent ⇒ unbounded), `timezone: string` (default `"UTC"`). These are exactly FR-1's commit-selection inputs; they already resolve through the two-phase merge. [Source: src/config/run-config.ts]
- **`RepoHistory` / `RawCommit` (Story 1.4):** `RepoHistory = { repoTarget: string; commits: RawCommit[] }`; `RawCommit = { sha, author: { name, email }, committer: { name, email }, authoredAt, committedAt, message, parents: string[], files: ChangedFile[] }`. `committedAt`/`authoredAt` are ISO-8601 strings; a **merge** is `parents.length >= 2` (consistent with Group D's `isMerge`). Date bounds use **`committedAt`** (the metrics' ordering key). [Source: src/retrieve/retrieve.port.ts, src/analyze/groups/d-branching.ts]
- **`dayBucket(epochMs, timezone): "YYYY-MM-DD"` (Story 1.5):** reuse it for tz-aware date-bound comparison (lexical `YYYY-MM-DD` compare = chronological). Parse `committedAt` → ms via `Date.parse` (git always emits valid `%cI`; `buildModel`'s `parseInstant` remains the authority that throws on a truly bad timestamp downstream). [Source: src/analyze/time.ts, src/analyze/model.ts]
- **`cli/run.ts` pipeline (Story 1.8):** `const history = await retrieve(config)` then `analyze(history, ctx)` with `ctx.timezone = config.timezone`. Insert `selectCommits` between them; pass the selected history to `analyze`. `runPipeline` and its tests already exist. [Source: src/cli/run.ts]

### Determinism & ordering rules (mirror Groups A–F)

- **Pure function of `(history, criteria)`** — no clock, no env, no I/O; `analyze/` is under `no-console`. [Source: eslint.config.js]
- **Most-recent-N is order-independent:** sort a copy by the model's total order `[committedAtMs, sha]` and take the last N (`slice(-N)`); a committedAt tie breaks by sha — so the kept set is identical regardless of input order. Never rely on git's emit order for the cap (the 2.3 lesson: compute the selection explicitly). [Source: src/analyze/model.ts, 2-3 review patch]
- **Filter order is fixed and documented:** no-merges → author → date → cap. The cap is **last** (date-then-cap), so Story 2.7's Free cap composes as `min(maxCommits, freeCap)` applied at the same final step. [Source: docs/planning-artifacts/epics.md#Story 2.7]
- **Tz-aware, deterministic dates:** `dayBucket` uses `Intl.DateTimeFormat` (the established determinism boundary noted in 1.5); the same `config.timezone` drives bounds and bucketing, so a date-filtered run and its Group A buckets agree. [Source: src/analyze/time.ts]

### `no-merges` ripple across Groups A–F (AC3 — what the reviewer will check)

Excluding merge commits from the **input set** (before `buildModel`) changes the model every metric sees, consistently:
- **Group A** (volume/cadence/size): fewer commits → different counts/intervals/size distribution.
- **Group B** (contribution): merge commits' authorship drops out of the tallies.
- **Group C** (messages): `Merge branch …` subjects no longer counted.
- **Group D** (topology): **merge count → 0**, so the merge-dependent metrics (`d-long-lived-branches`, `d-average-changes-per-merge`) emit `not_available` ("No merge commits…") — the honest, consistent consequence.
- **Group E** (churn/hotspots): merges carry empty numstat anyway, so churn sums are unchanged but the commit-count denominators shift.
- **Group F** (roll-up): recomputes over the changed A–E values automatically (it consumes the computed envelopes).
A test asserts a no-merges selection is byte-identical for the same input and visibly changes a downstream metric (e.g. Group A volume / Group D merge count). [Source: src/analyze/groups/*.ts]

### Previous-story intelligence

- **The `RunConfig` already has every selection field** (1.2) — 2.6 only *consumes* them; no resolver change. `noMerges` defaults `false`, dates default `undefined` (unbounded) — so an unconfigured run makes `selectCommits` a **no-op**, keeping every existing `run.test.ts` / e2e case green. [Source: src/config/run-config.ts, src/config/gaps.ts]
- **Order-independent selection (2.3 lesson):** never trust input array order for a "top/most-recent N" pick — sort explicitly by `[committedAtMs, sha]`. [Source: 2-3 review patch (`findTip`)]
- **Self-safe reductions (2.2):** guard empty arrays. **Type-alias-for-emitted-objects** doesn't apply here (selection returns `RepoHistory`, not a `MetricValue`). [Source: 2.2 patch]
- **Timezone already governs bucketing** (Group A, wired through `ctx.timezone` in 1.8) — 2.6 makes the **same** `config.timezone` govern date bounds, so AC2's "governs both" holds by construction. [Source: src/cli/run.ts, src/analyze/groups/a-cadence.ts]

### Project Structure Notes

- New file: `src/analyze/select.ts` (+ `select.test.ts`). Modified: `src/cli/run.ts` (insert the selection stage), `src/cli/run.test.ts` (a narrowed-set test). **No engine/model/metric/schema change**; the `Analysis` shape and every metric are untouched. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- The architecture directory map does not name a dedicated selection module (selection is implied by FR-1 + the retrieve/analyze boundary); `analyze/select.ts` is the natural home (pure, tz-aware, operates on the analyze input). Flag the addition in Completion Notes.

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.6: Commit-selection inputs] · [Source: docs/planning-artifacts/epics.md#Story 2.7] (the cap that builds on this ordering)
- [Source: docs/planning-artifacts/prds/prd-commit-sage-2026-06-06/prd.md#FR-1] (commit-selection inputs) · [Source: …#FR-4 Consequences] (selection changes which commits feed the metrics; no-merges changes A–F; timezone governs bucketing)
- [Source: docs/planning-artifacts/architecture.md#Hexagonal Boundary] · [Source: docs/planning-artifacts/architecture.md#NFR-4] (perf — git push-down deferred)
- [Source: src/config/run-config.ts] (selection fields) · [Source: src/retrieve/retrieve.port.ts] (`RepoHistory`/`RawCommit`) · [Source: src/analyze/time.ts] (`dayBucket`) · [Source: src/cli/run.ts] (pipeline wiring) · [Source: src/analyze/groups/d-branching.ts] (`isMerge` = `parents.length >= 2`)

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean.
- `npm run lint` → ESLint clean: `select.ts` is pure (`analyze/` `no-console`); the cli flag additions follow the 1.8 pattern.
- `npm test` → vitest: **41 files / 351 tests passed** (was 40/328; +1 file `select.test.ts`, +23 tests across select/run/cli). The determinism harness calls `analyze` directly on the full `SYNTHETIC_HISTORY` (no selection), so it is unaffected; existing run/e2e cases (no selection criteria ⇒ `selectCommits` is a no-op) stay green.
- `npm run build` → tsup ESM build success (`dist/index.js` 81.29 KB).
- **Real e2e on this repo:** `commit-sage . --no-ai --max-commits 3` narrows Group A volume to the 3 most-recent commits and shifts the size distribution; `--no-merges` is accepted (this repo is linear → 0 merges); `--max-commits abc` → typed usage error "Invalid --max-commits …" (exit 2). `COMMIT_SAGE_MAX_COMMITS=3` also works (env path), confirming flag + env both resolve.

### Completion Notes List

- **All three ACs satisfied.** AC1: a pure `selectCommits` stage runs **between retrieve and analyze** in `cli/run.ts`, so the narrowed `RepoHistory` feeds `buildModel` and **all 32 catalog metrics (A–F) compute over exactly the selected set** with zero per-metric change. AC2: empty `startDate`/`endDate` are unbounded (no auto-shrink); the **same `config.timezone`** governs both the tz-aware date bounds (`dayBucket`) and the time-bucketed metrics (Group A) — proven by a test where a near-midnight commit crosses a day boundary between UTC and Europe/Berlin. AC3: `--no-merges` drops `parents.length >= 2` from the input, so every group's values change consistently (a run-pipeline test shows the metric commit-count drop; Group D's merge-dependent metrics degrade to `not_available`), byte-identically for the same selection.
- **The architecture decision — selection is a pure stage before `buildModel`.** Filtering the raw history first (rather than re-filtering inside each metric, which would be 32× duplication and drift-prone) means selection composes cleanly and `analyze` stays a pure function of whatever history it's given (the determinism harness, which calls `analyze` on the full fixture, is untouched). In-memory (not pushed to `git log`) for determinism, table-testability, and the explicit **date-then-cap ordering** Story 2.7 builds on; the git push-down is a deferred perf optimization behind the same `SelectionCriteria`.
- **Filter order is fixed + documented:** no-merges → author → date → **max-commits cap (last)**. The cap keeps the **most-recent N** by the model's total order `[committedAtMs, sha]` (sort a copy, `slice(-N)`), so it is order-independent and tie-broken by sha. Story 2.7's Free cap composes as `min(maxCommits, freeCap)` at this same final step.
- **Date bounds are day-granular in the configured timezone:** each commit's `dayBucket(committedAtMs, timezone)` is compared lexically (`YYYY-MM-DD` = chronological) against the bound's date component (`bound.slice(0, 10)`); inclusive on both sides; an unparseable commit date is defensively excluded from a range match (git always emits valid `%cI`; `buildModel.parseInstant` remains the downstream authority). Author filter is a case-insensitive substring on the **raw** author `name` OR `email`.
- **CLI flags wired (the FR-1 selection surface).** Added `--no-merges` (commander negation: `opts.merges === false`), `--max-commits <count>` (positive-int, typed `UsageError` on invalid → exit 2), `--author <text>`, `--since <date>`, `--until <date>` to `cli/cli.ts` (`--timezone` was already wired in 1.8). These are FR-1 config-data inputs (distinct from Epic 6's *operational* flags). They also resolve via `COMMIT_SAGE_*` env, so flag + env + config all work through the resolver.
- **No engine/model/metric/schema change.** `selectCommits` returns a `RepoHistory`; the `Analysis` shape and every metric/roll-up are untouched. An unconfigured run makes `selectCommits` a no-op (noMerges defaults false, dates undefined), keeping every prior test green.
- **New module flagged:** `analyze/select.ts` is not in the architecture's directory map (selection is implied by FR-1 + the retrieve/analyze boundary); it is the natural pure, tz-aware home operating on the analyze input.
- **Scope deferrals honored:** the Free-tier cap + "Analyzed N of M" notice (2.7 — 2.6 establishes the filter→cap ordering and the most-recent-N mechanic, emits no notice); Epic 6 operational flags; ISO date/timezone *validation* (the deferred Zod story); git-side push-down (perf); `.mailmap` canonicalization for the author filter (raw substring match is the faithful reading). No new dependencies.

### File List

**Added (source):**
- `src/analyze/select.ts` — `selectCommits`, `projectSelection`, `SelectionCriteria` (the pure selection stage)

**Added (tests, co-located):**
- `src/analyze/select.test.ts` (per-filter, tz-aware dates, most-recent-N + tie-break, combination/ordering, no-op, no-mutation, `projectSelection`)

**Modified (source):**
- `src/cli/run.ts` — insert `selectCommits(history, projectSelection(config))` between retrieve and analyze
- `src/cli/cli.ts` — wire `--no-merges`/`--max-commits`/`--author`/`--since`/`--until` (+ `CliOptions` + `buildFlags`)

**Modified (tests):**
- `src/cli/run.test.ts` — a narrowed-set pipeline test (max-commits + no-merges reflected in the analysis)
- `src/cli/cli.test.ts` — selection-flag resolution + invalid `--max-commits` / malformed `--since` usage errors

**Modified (review patches):**
- `src/analyze/select.ts` — `dayBound` requires a well-formed `YYYY-MM-DD` (malformed ⇒ unbounded); `capMostRecent` comparator total/deterministic on a non-finite date
- `src/cli/cli.ts` — reject malformed `--since`/`--until` + non-decimal `--max-commits` (typed `UsageError`)
- `src/analyze/select.test.ts` — malformed-bound-as-unbounded test
- `src/cli/cli.test.ts` — hex/scientific `--max-commits` + partial-date rejection + well-formed acceptance tests

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 2-6 → in-progress → review
- `docs/implementation-artifacts/2-6-commit-selection-inputs.md` — this story (record filled, status → review)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 2.6 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 2.6 implemented (TDD): a pure `selectCommits` stage (no-merges → author → date → most-recent-N cap, tz-aware day-granular date bounds) inserted between retrieve and analyze, so all 32 metrics compute over the selected set; wired the FR-1 selection flags (`--no-merges`/`--max-commits`/`--author`/`--since`/`--until`) into `cli.ts`. No engine/model/metric/schema change. 1 new suite; 41 files / 351 tests green; typecheck/lint/build clean; real e2e verified. Status → review. |
| 2026-06-13 | Code review (3 parallel layers) → Blind Hunter 0 + Acceptance Auditor 0 (all 3 ACs MET, architecture sound, flag wiring correctly scoped). 3 patches from the Edge Case Hunter's date-bound robustness cluster: `dayBound` requires well-formed `YYYY-MM-DD` (malformed ⇒ unbounded, not silently-wrong); cli rejects malformed `--since`/`--until` + non-decimal `--max-commits` (usage error); cap comparator total/deterministic on a non-finite date. 355 tests green; typecheck/lint/build clean. Status → done. |
