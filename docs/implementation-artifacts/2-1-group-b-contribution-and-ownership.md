---
epic: 2
story: 1
title: Group B — Contribution & Ownership
baseline_commit: 0dc59fd7d03542e19287827721f0d52b7415489b
---

# Story 2.1: Group B — Contribution & Ownership

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want contribution and ownership metrics,
so that I can see who does the work and where knowledge concentrates — **at the team level, never as an individual leaderboard**.

## Acceptance Criteria

1. **Six Group B metrics, pure over the shared model, uniform envelope (AC1).** **Given** retrieved history, **when** the engine runs, **then** Group B metrics — **contributor count**, **contribution distribution**, **bus-factor / knowledge concentration**, **new vs. departed contributors**, **ownership by area** (on hotspots), **co-authorship / collaboration signal** — are computed as **pure functions over the shared `RepoModel`**, each returning the uniform `Metric` envelope (`computed` with a value, or `not_available` with a reason — never thrown, never omitted).

2. **Deterministic + team-level framing, never per-developer ranking (AC2 — the NFR-8 guardrail).** **Given** the same selection, **when** Group B runs, **then** all results are **deterministic** (identical input ⇒ byte-identical values; order-independent) **and** every manager-facing value is **framed at team level** — **no author name or email ever appears in any Group B metric value.** Distribution/ownership are emitted as **anonymized shapes** (sorted shares, concentration coefficients, per-area concentration + author counts) and team-level counts (contributor totals, onboarding/attrition counts, bus factor), never a named or identifiable ranking of individuals.

## Tasks / Subtasks

- [ ] **Task 1 — Retain per-file change records in the shared model (enables ownership-by-area; Group E will reuse) (AC1).**
  - [ ] Add `FileChange { path: string; additions: number | null; deletions: number | null }` and a `files: FileChange[]` field to `NormalizedCommit` in [src/analyze/model.ts](src/analyze/model.ts). `buildModel` already iterates `c.files` to sum totals — additionally retain the per-file records (raw git order preserved; aggregations are order-independent). `null` add/del marks a binary file (verbatim from the 1.4 `ChangedFile`).
  - [ ] This is the **one shared-model change** in the story; the existing `additions`/`deletions`/`changedFileCount` totals stay unchanged (Group A keeps working untouched). Co-locate the model-extension assertion in `model.test.ts` (a commit's `files` round-trips path + add/del incl. the binary `null`).

- [ ] **Task 2 — `analyze/stats.ts`: a `gini` concentration helper (AC2).**
  - [ ] Add `gini(values: readonly number[]): number | null` — the Gini coefficient (0 = perfectly even, →1 = fully concentrated) over non-negative values, `null` on empty. Deterministic (sorts a copy). Used by contribution-distribution + reused by Group F's Collaboration Breadth (Story 2.5). Co-locate tests (even → 0, single non-zero → high, empty → null, known small-vector value).

- [ ] **Task 3 — `analyze/groups/b-contribution.ts`: the six metric functions + specs + `GROUP_B_METRICS` (AC1, AC2).** Mirror `a-cadence.ts` exactly (named `MetricSpec` consts, `MetricFn`s, a `GROUP_B_METRICS: RegisteredMetric[]` in stable order). **Every value is anonymized / team-level** (helper `tallyByAuthor` derives per-author counts internally but the metric values emit only aggregates):
  - [ ] **`b-contributor-count` "Contributor count"** — `{ total, active, activeWindowDays }`. `total` = `model.authors.length`; `active` = authors whose `lastCommittedAtMs ≥ analysisTimestampMs − ACTIVE_WINDOW` (90 days `[ASSUMPTION]`). `not_available` for empty history.
  - [ ] **`b-contribution-distribution` "Contribution distribution"** — anonymized concentration shape: `{ authorCount, commitShares: number[] (desc, rounded), lineShares: number[] (desc, rounded), giniCommits, giniLines, topCommitSharePct, top3CommitSharePct }`. **No identities** — sorted-descending fractional shares + Gini. `not_available` for empty history.
  - [ ] **`b-bus-factor` "Bus-factor / knowledge concentration"** — `{ busFactor, thresholdPct: 50, topAuthorSharePct, totalAuthors }`. `busFactor` = min #authors (by descending commit share) whose cumulative share ≥ 50% `[ASSUMPTION]`. Pure team-risk scalar. `not_available` for empty history.
  - [ ] **`b-new-departed` "New vs. departed contributors"** — team-level counts only: `{ totalContributors, newContributors, departedContributors, onboardWindowDays, departWindowDays }`. `new` = `firstCommittedAtMs ≥ analysisTimestampMs − ONBOARD_WINDOW` (90 d); `departed` = `lastCommittedAtMs < analysisTimestampMs − DEPART_WINDOW` (180 d `[ASSUMPTION]`). **No names.** `not_available` for empty history.
  - [ ] **`b-ownership-by-area` "Ownership by area"** — hotspots only (**top 10 directories + top 20 files by touch count**), each as **anonymized concentration**: `{ path, touchCount, authorCount, topAuthorSharePct }` (the dominant author's *share* of touches + the distinct-author count — a per-area knowledge-concentration risk — **never the author identity**). Directory = `dirname` (root → `"."`). Sort by `touchCount` desc, then `path` asc. `not_available` when no file-change data. Uses Task 1's `files`.
  - [ ] **`b-co-authorship` "Co-authorship / collaboration signal"** — parse `Co-authored-by:` trailers (case-insensitive, line-anchored) from each commit message: `{ commitsWithCoAuthors, coAuthoredSharePct, totalCoAuthorTrailers, distinctCoAuthors }` (distinct counted by normalized trailer email, **emitted as a count, not identities**). `[ASSUMPTION]`. Commits-but-no-trailers ⇒ `computed` with zeros (a real "no co-authorship" signal); empty history ⇒ `not_available`.

- [ ] **Task 4 — Register Group B in the engine (AC1).**
  - [ ] In [src/analyze/registry.ts](src/analyze/registry.ts), append `...GROUP_B_METRICS` to `ALL_METRICS` after Group A (stable output order A→B). The engine itself does not change.

- [ ] **Task 5 — Tests: per-metric correctness + the NFR-8 anonymization guard + determinism (AC1, AC2).**
  - [ ] Co-locate `b-contribution.test.ts`: each metric's `computed` value on a purpose-built multi-author fixture (skewed distribution, a departed author, hotspot directories/files, `Co-authored-by` trailers) + each metric's `not_available` on empty history.
  - [ ] **NFR-8 guard test (load-bearing):** serialize the full Group B output for a fixture whose author names/emails are known sentinel strings, and assert **none of those name/email strings appears anywhere** in the serialized Group B values (the anonymization is airtight by test, not just by inspection).
  - [ ] Determinism is already covered for the whole catalog by `tests/determinism/analysis-determinism.test.ts` (it runs `analyze` over `ALL_METRICS`); confirm it stays green with Group B appended (byte-identical + order-independent), and add the `SYNTHETIC_HISTORY` a `Co-authored-by` trailer if needed to exercise `b-co-authorship` there **without** breaking Group A expectations.

## Dev Notes

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The spec-aware **Acceptance Auditor independently verified both ACs genuinely MET, all six PRD §4.2 Group B metrics faithfully implemented, NFR-8 proven by the guard test, scope held, and architecture fidelity "excellent" — 0 patches.** Triage: **1 patch · 0 defer · 2 dismissed · 0 decision-needed.**

**Patch:**

- [x] [Review][Patch] A malformed `Co-authored-by:` trailer with a **whitespace-only value** was captured, normalized to `""`, and counted as a phantom distinct co-author (inflating `distinctCoAuthors`/`totalCoAuthorTrailers`) [src/analyze/groups/b-contribution.ts] — **Fixed:** `coAuthorship` now computes the trailer key first and `continue`s on an empty key, so a malformed identity-less trailer is not counted as a trailer, a commit, or a distinct co-author. Added a regression test (`skips a malformed Co-authored-by trailer with no identity`). 255 tests green.

**Dismissed (2):**
- "Bus-factor off-by-one on a 49%+51% split (returns 2 instead of 1)" — **false positive.** The Blind Hunter traced `counts = [49, 51]`, but `busFactor` **sorts the commit counts descending** (`.sort((a, b) => b - a)`) before the cumulative loop, so the array is `[51, 49]`: iter 1 → `cumulative=51`, `factor=1`, `0.51 ≥ 0.5` → break → `busFactor = 1` (correct). Verified against `[3,1,1,1]`→1, `[40,35,25]`→2, `[50,50]`→1.
- "`maxOf` returns 0 silently for an empty iterable" — **not reachable:** `topAreas` only ever calls `maxOf(area.byAuthor.values())` for an area that exists in the map, and an area is added to the map only when a touch is recorded, so `byAuthor` is always non-empty with positive counts (the Edge Case Hunter self-dismissed this too).

### Scope discipline — what this story does and does NOT include

This is the **first Epic 2 metrics story**: it adds **Group B** to the catalog using the Story 1.5 engine/model/determinism machinery unchanged, plus the **one** model extension (per-file retention) that ownership-by-area needs (and Group E will reuse).

**In scope:**
- The six Group B metric functions (`b-contribution.ts`), each a pure `MetricFn` returning the uniform envelope, registered into `ALL_METRICS`.
- The shared-model `files` retention (Task 1) and a `gini` stats helper (Task 2).
- The **NFR-8 team-level/anonymized framing** for every Group B value, proven by a dedicated guard test.

**Out of scope / deferred (do NOT build here):**
- **Groups C, D, E, F** — Stories 2.2–2.5. (Group E's churn/hotspots will *reuse* this story's `files` model field; Group F's Collaboration Breadth will *reuse* `gini` + bus-factor.)
- **Commit-selection inputs** (author filter / max-commits / no-merges / dates / timezone actually narrowing the set) — **Story 2.6**. Group B computes over whatever commit set the model already holds; it does not parse or apply selection. [Source: docs/planning-artifacts/epics.md#Story 2.6]
- **Free-tier 100-commit cap** — **Story 2.7**. [Source: docs/planning-artifacts/epics.md#Story 2.7]
- **AI Metric Explanations** (the four-facet per-metric LLM text) — **Epic 3, Story 3.2**. Group B emits only the deterministic envelope (`title` + machine `value` + `status`); the static one-line description lives in the PRD catalog, not the envelope. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2]
- **Health bands** (`ok`/`watch`/`risk`/`n/a`) — render-time classifier (Epic 4), **not** stored in the envelope. Do not add a band field. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#Metric health bands]
- **The Group B overview chart** (Pareto + bus-factor marker) — Epic 4 render. 2.1 produces the *data* (anonymized shares + bus factor) that chart will consume. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-6]
- **`.mailmap` file reading** — still injected via `AnalysisContext.mailmap` (Epic 6 wires the real read); Group B uses the already-canonicalized identities in the model. [Source: src/analyze/identity.ts]

### NFR-8 — the absolute guardrail this story lives under (read first)

> **NFR-8 (locked, absolute):** Both the Metrics and the Narrative analyze at the **repository / change level only** and **never rank, score, or single out individual developers**; all manager-facing output is team-level health. **Binds Group B** explicitly. [Source: docs/planning-artifacts/epics.md#NFR-8]

Group B is the **highest-risk** group for NFR-8 because its raw material *is* per-author data. The resolution is **anonymization by construction**:
- Per-author tallies are computed **internally** (from `model.authors` + a per-author line tally over `model.commits`) but **never emitted with identity**.
- "Contribution distribution" / "ownership by area" emit **sorted-descending shares**, **Gini/concentration coefficients**, **counts**, and **anonymized per-area concentration** — the *shape* of concentration, which is the metric's stated purpose ("concentration vs. spread", "knowledge concentration"), not a named leaderboard.
- The **NFR-8 guard test** (Task 5) makes this enforceable: it fails if any author name/email string leaks into a Group B value. This is the single most important test in the story and what the Acceptance Auditor will check.
- Framing wording (titles already team-level) and the bus-factor "risk to mitigate" framing align with the PRD's Group F bus-factor-risk note. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#Group F / NFR-8]

### PRD §4.2 Group B catalog — the authoritative metric definitions

| id | Title (PRD) | What it represents (static description) |
|---|---|---|
| `b-contributor-count` | Contributor count | total distinct authors over history **and** currently active |
| `b-contribution-distribution` | Contribution distribution | share of commits/lines per author; **concentration vs. spread** |
| `b-bus-factor` | Bus-factor / knowledge concentration | how few people account for the majority of changes; team risk signal `[ASSUMPTION: authors covering 50%]` |
| `b-new-departed` | New vs. departed contributors | first-seen/last-seen per author → onboarding & attrition signal |
| `b-ownership-by-area` | Ownership by area | which authors dominate which dirs/files, **on hotspots only** (top 10 dirs + top 20 files by touch count) to bound cost |
| `b-co-authorship` | Co-authorship / collaboration signal | use of `Co-authored-by` trailers where present `[ASSUMPTION]` |

[Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 Group B] — IDs follow the `a-…` kebab convention from Group A; titles are verbatim from the catalog (the static description is NOT stored in the envelope — it surfaces via the catalog / Epic 3 explanations).

### The exact engine/model contracts to build on (Story 1.5 — do NOT redefine)

- **`MetricFn = (model: RepoModel, ctx: AnalysisContext) => Metric`**; a metric that can't compute returns `notAvailable(spec, reason)`; the engine wraps any throw into `not_available` via the spec, so Group B never sinks the run. [Source: src/analyze/engine.ts, src/analyze/model.ts]
- **`Metric` envelope** = `{ id, group, title, status, value?, reason? }` via `computed(spec, value)` / `notAvailable(spec, reason)`. `value` must be `MetricValue` (JSON: number/string/boolean/null/array/object — **no `Date`/`Map`/`Set`**). [Source: src/analyze/metric.ts]
- **`RepoModel`** = `{ repoTarget, analysisTimestampMs, timezone, commits: NormalizedCommit[], authors: AuthorSummary[] }`. `authors` is already de-duped + canonicalized + **sorted by `[email,name]`** (not insertion order). `commits` is ordered `[committedAtMs, sha]`. [Source: src/analyze/model.ts]
- **`NormalizedCommit`** = `{ sha, author, committer, authoredAtMs, committedAtMs, message, parents, additions, deletions, changedFileCount }` — **Task 1 adds `files`**. `author`/`committer` are `CanonicalIdentity { name, email }`. [Source: src/analyze/model.ts]
- **`AuthorSummary`** = `{ identity: CanonicalIdentity, commitCount, firstCommittedAtMs, lastCommittedAtMs }`. Has commit counts + first/last timestamps — **but not line totals**, so `b-contribution-distribution` must tally lines per author over `model.commits` itself. [Source: src/analyze/model.ts]
- **Determinism rules (C2):** inject time via `ctx`/model (`analysisTimestampMs`, never `Date.now()`); total stable order already applied; **`compareCodeUnits`** (NOT `localeCompare`) for any string ordering; emit key-sorted plain objects for map-like values (see Group A's `countByBucket`). [Source: src/analyze/model.ts, src/analyze/groups/a-cadence.ts]
- **Stats helpers available:** `mean`, `median`, `percentile`, `round` (round to 2 dp for non-integers, for stable JSON) — **Task 2 adds `gini`**. Empty input → `null` (caller emits `not_available` or a 0 default). [Source: src/analyze/stats.ts]

### Implementation patterns this story must follow (mirror Group A)

- **P2/P3:** `kebab-case.ts`, **named exports only**, co-located `*.test.ts` under `src/analyze/groups/`. New file `b-contribution.ts` beside `a-cadence.ts`. [Source: eslint.config.js, src/analyze/groups/a-cadence.ts]
- **P5:** `analyze/` is under `no-console` and reads no env/clock/fs — pure functions of `(model, ctx)`. [Source: eslint.config.js]
- **Determinism / anti-spread:** for min/max over commit-sized arrays use the **reduce-based `minOf`/`maxOf`** idiom (Group A) — never `Math.min(...arr)` (argument-spread overflow on large repos). Build map-like outputs then emit **key-sorted plain objects** / **value-sorted arrays with a `compareCodeUnits` tiebreak**. [Source: src/analyze/groups/a-cadence.ts]
- **`[ASSUMPTION]` thresholds** (active 90 d, departed 180 d, bus-factor 50%, hotspot top-10/top-20) are named module consts with a comment, exactly like Group A's `DORMANT_GAP_SECONDS`. [Source: src/analyze/groups/a-cadence.ts]

### Determinism harness — free coverage, must stay green

`tests/determinism/analysis-determinism.test.ts` runs `analyze(SYNTHETIC_HISTORY, ctx())` over **`ALL_METRICS`**, so appending Group B automatically subjects it to: byte-identical across runs, **order-independent** (input commits shuffled), no `Date.now()` leak, and fully JSON-serializable (no `Map`/`Set`/`Date`). Every Group B value must therefore be an order-independent aggregate of plain JSON — which the anonymized-shape design already guarantees. If `b-co-authorship` needs a trailer to be exercised there, add a `Co-authored-by:` line to a `SYNTHETIC_HISTORY` commit body **without** changing Group A's asserted values (Group A doesn't parse messages, so a trailer is safe). [Source: tests/determinism/analysis-determinism.test.ts, src/analyze/sample-history.ts]

### Previous-story intelligence

- **Group A (1.5)** is the precise template: specs as exported consts, `MetricFn`s, `GROUP_A_METRICS` array, the `countByBucket`/`minOf`/`maxOf` idioms, `not_available` on insufficient data. Copy its structure. [Source: src/analyze/groups/a-cadence.ts]
- **The model already discards file paths** (only `additions`/`deletions`/`changedFileCount` survive `buildModel`) — Task 1 is *required* for ownership-by-area; it is a small, forward-looking extension Group E also needs. Keep the existing totals; just *also* retain the records. [Source: src/analyze/model.ts]
- **`MetricValue` forbids `bigint`/`Date`/`Map`/`Set`** — emit shares as rounded `number`s, dates (if ever) as ISO strings (Group B emits counts/shares, no dates in values). [Source: src/analyze/metric.ts]
- **The fixture** (`SYNTHETIC_HISTORY`) has Alice (×2, incl. a mailmap-collapsible casing) + Bob, text + binary files, a merge — enough for several Group B assertions; build a richer purpose-built fixture in the test for skew/departed/co-author/hotspot edges. [Source: src/analyze/sample-history.ts]

### Project Structure Notes

- New file: `src/analyze/groups/b-contribution.ts` (+ `b-contribution.test.ts`). Modified: `src/analyze/model.ts` (+`files`), `src/analyze/stats.ts` (+`gini`), `src/analyze/registry.ts` (+Group B), and their co-located tests; optionally `src/analyze/sample-history.ts` (+ a co-author trailer). No engine change. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- The architecture's directory map labels the Group A file `b-cadence.ts` and Group B `a-contribution.ts` (groups transposed); the **PRD §4.2 is authoritative** (A = Activity & Cadence → `a-cadence.ts`, B = Contribution & Ownership → `b-contribution.ts`), as resolved in Story 1.5. Keep the PRD ordering. [Source: 1-5 Project Structure Notes]

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.1: Group B — Contribution & Ownership] · [Source: docs/planning-artifacts/epics.md#NFR-8]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 History Analysis — Metrics Catalog (Group B)] · [Source: …#FR-4 Compute the metrics catalog] · [Source: …#FR-5]
- [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture] (hybrid topology, determinism rules, uniform envelope)
- [Source: src/analyze/groups/a-cadence.ts] (the pattern) · [Source: src/analyze/model.ts] · [Source: src/analyze/metric.ts] · [Source: src/analyze/stats.ts] · [Source: src/analyze/registry.ts] · [Source: src/analyze/identity.ts] · [Source: tests/determinism/analysis-determinism.test.ts]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean (one fix during dev: `AreaConcentration` changed from `interface` to a `type` alias so it satisfies `MetricValue`'s index-signature shape — interfaces are not assignable to `Record`-like types).
- `npm run lint` → ESLint clean: no `console`/`process.env` in `analyze/`; named-exports-only; reduce-based `maxOf` (no `Math.max(...spread)`).
- `npm test` → vitest: **36 files / 254 tests passed** (was 34/233; +2 files, +21 tests). The determinism harness (`tests/determinism`) automatically covers Group B via `ALL_METRICS` — byte-identical + order-independent both green.
- `npm run build` → tsup ESM build success (`dist/index.js` 48.39 KB).
- **Real e2e on this repo:** `node dist/index.js . --no-ai` now renders all six Group B metrics, fully anonymized (shares/counts/concentration; no author identity).

### Completion Notes List

- **Both ACs satisfied.** AC1: six Group B metrics (`b-contributor-count`, `b-contribution-distribution`, `b-bus-factor`, `b-new-departed`, `b-ownership-by-area`, `b-co-authorship`) are pure `MetricFn`s over the shared `RepoModel`, each returning the uniform envelope (`computed`/`not_available`), registered into `ALL_METRICS` after Group A. AC2: deterministic (the determinism harness proves byte-identical + order-independent over the full A+B catalog) **and** team-level — the **NFR-8 guard test** asserts no author name/email appears anywhere in the serialized Group B output; values are anonymized descending shares, Gini coefficients, team counts, and per-area concentration + author counts.
- **NFR-8 by construction (the story's load-bearing concern):** per-author tallies are computed in an internal `tallyByAuthor`/`AreaTouches` and **never emitted with identity**. `contribution-distribution` emits sorted-descending `commitShares`/`lineShares` + `giniCommits`/`giniLines` + top/top-3 share; `ownership-by-area` emits per-hotspot `{ path, touchCount, authorCount, topAuthorSharePct }` (the dominant author's *share*, never who); `co-authorship` emits a `distinctCoAuthors` *count*, never the trailer identities. A dedicated test fails if any of 8 sentinel name/email strings leaks.
- **One shared-model extension (Task 1):** `NormalizedCommit` gains `files: FileChange[]` (path + add/del, binary `null` preserved), populated in `buildModel`. Group A is untouched (totals unchanged). This is the file-path retention ownership-by-area needs and **Group E (churn/hotspots, Story 2.4) will reuse** — done once, here.
- **New stats helper (Task 2):** `gini(values)` (0 even → →1 concentrated; `null` empty; `0` when total is zero), deterministic (sorts a copy). **Group F's Collaboration Breadth (Story 2.5) will reuse it.**
- **`[ASSUMPTION]` thresholds** are named module consts (active 90 d, onboard 90 d, departed 180 d, bus-factor 50 %, hotspots top-10 dirs/top-20 files) with comments — mirroring Group A's `DORMANT_GAP_SECONDS`. "Currently active"/"new"/"departed" are measured against the injected `analysisTimestampMs` (never `Date.now()`), so they stay deterministic.
- **Determinism idioms followed:** reduce-based `maxOf` (no argument-spread), `compareCodeUnits` tie-breaks (never `localeCompare`), value-sorted arrays + count outputs (no `Map`/`Set`/`Date` in values), shares rounded (2 dp pct; 4 dp Gini) for stable JSON. `co-authorship` with commits-but-no-trailers is `computed` zeros (a real "no signal"), not `not_available`.
- **Scope deferrals honored:** no Groups C–F (2.2–2.5); no commit-selection inputs (2.6 — Group B computes over the model's existing set); no Free-tier cap (2.7); no AI explanations (Epic 3); no health bands (render-time, Epic 4); no Group B overview chart (Epic 4 consumes this data). No new dependencies.
- **Test update (not a behavior change):** `engine.test.ts`'s metric-id-order assertion was extended from the 6 Group A ids to the full 12-id A→B catalog (the registry changed).
- **SonarQube advisory** (unchanged): `type IsoDate = string` — intentional. No new advisories.

### File List

**Added (source):**
- `src/analyze/groups/b-contribution.ts` — six Group B `MetricFn`s + specs + `GROUP_B_METRICS`

**Added (tests, co-located):**
- `src/analyze/groups/b-contribution.test.ts` (incl. the NFR-8 anonymization guard), `src/analyze/stats.test.ts` (gini)

**Modified (source):**
- `src/analyze/model.ts` — `FileChange` type + `NormalizedCommit.files` (populated in `buildModel`)
- `src/analyze/stats.ts` — `gini` helper
- `src/analyze/registry.ts` — append `GROUP_B_METRICS` to `ALL_METRICS`

**Modified (tests):**
- `src/analyze/model.test.ts` — per-file retention assertion
- `src/analyze/engine.test.ts` — metric-id-order assertion extended to the A→B catalog

**Modified (review patch):**
- `src/analyze/groups/b-contribution.ts` — `coAuthorship` skips a malformed identity-less trailer (empty-key guard)
- `src/analyze/groups/b-contribution.test.ts` — malformed-trailer regression test

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — epic-2 → in-progress; 2-1 → in-progress → review
- `docs/implementation-artifacts/2-1-group-b-contribution-and-ownership.md` — this story (record filled, status → review)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 2.1 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 2.1 implemented (TDD): six anonymized/team-level Group B metrics (`b-contribution.ts`) over the shared model; one model extension (`NormalizedCommit.files`, reused by Group E) + a `gini` stats helper (reused by Group F); registered into `ALL_METRICS`. NFR-8 guard test proves no identity leaks; determinism harness covers A+B. 2 new suites; 36 files / 254 tests green; typecheck/lint/build clean; real e2e on this repo verified. Status → review. |
| 2026-06-13 | Code review (3 parallel layers) → Acceptance Auditor verified both ACs met + all six PRD metrics faithful + NFR-8 proven + scope held (0 patches). 1 patch / 0 defer / 2 dismissed. Applied: empty-key guard so a malformed identity-less `Co-authored-by:` trailer is not a phantom co-author (+regression test); dismissed a bus-factor "off-by-one" (false positive — counts are sorted descending) and a `maxOf` empty-iterable concern (unreachable). 255 tests green; typecheck/lint/build clean. Status → done. |
