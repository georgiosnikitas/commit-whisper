---
epic: 2
story: 5
title: Group F — Repository Health Signals
baseline_commit: 2859e2d54bb9633b962faac07ba8a4b468bf6d6b
---

# Story 2.5: Group F — Repository Health Signals

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a manager,
I want a transparent, team-level health roll-up,
so that I can track hygiene without surveilling individuals.

## Acceptance Criteria

1. **Transparent weighted hygiene composite with component sub-scores (AC1).** **Given** Groups A–E are computed, **when** Group F runs, **then** the **overall hygiene score** is the transparent weighted composite — **Message Quality 35%, Commit Size 20%, Branching 20%, Collaboration Breadth 15%, Churn Stability 10%** — computed from the already-computed A–E metric values, **shown with its component sub-scores** (each 0–100 with its weight and source), and each Group F metric returns the uniform `Metric` envelope deterministically.

2. **Team-level bus-factor risk, never individual ranking (AC2 — NFR-8).** **Given** the computed Group B bus-factor, **when** Group F runs, **then** the **bus-factor risk flag** is framed as **team-level concentration-of-knowledge risk** to mitigate (`low`/`moderate`/`high`), **never** a ranking or naming of any individual developer — no author name/email appears in any Group F value.

3. **Trend deltas only when a prior report is available (AC3).** **Given** trend deltas, **when** Group F runs, **then** they are computed **only when a prior Report JSON for the same repo is available** (injected); with no prior available the trend-delta metric emits `not_available` with a specific reason rather than a fabricated zero — the honest-degradation posture.

## Tasks / Subtasks

- [ ] **Task 1 — Engine: the roll-up pass (the key architectural decision) (AC1).** Group F consumes the *computed* A–E envelopes, not raw commits, so the engine gains a second metric-function shape that runs after the base pass:
  - [ ] In [src/analyze/engine.ts](src/analyze/engine.ts): add `RollupFn = (metrics: ReadonlyMap<string, Metric>, ctx: AnalysisContext) => Metric` and `RegisteredRollup = { spec: MetricSpec; fn: RollupFn }`; add `runRollup` (mirrors `runMetric`'s throw→`not_available` guard). Extend `analyze(history, ctx, metrics = ALL_METRICS, rollups = ALL_ROLLUPS)`: run the base `metrics` pass, build a `Map<id, Metric>` from the results (the only consumer of map order is internal; the map is built from the ordered base results), then run each rollup over that map, **appending** the rollup metrics to the base metrics (stable order A–E then F). Export the new types.
  - [ ] In [src/analyze/model.ts](src/analyze/model.ts): add an **optional** `priorMetrics?: readonly Metric[]` to `AnalysisContext` (the injected prior-report seam for trend deltas; typed as `Metric[]` from `metric.ts` to avoid a circular import with `engine.ts`). Default behavior (absent) ⇒ trend deltas `not_available`.
  - [ ] Roll-ups are **pure functions of the computed metrics + ctx** (no model access) — trivially testable by feeding synthetic envelopes.

- [ ] **Task 2 — `analyze/stats.ts`: a `stdev` helper (AC1).** Add `stdev(values: readonly number[]): number | null` — population standard deviation (deterministic; `null` on empty). Used by Churn Stability's coefficient-of-variation. Co-locate tests (known vector, single value → 0, empty → null).

- [ ] **Task 3 — `analyze/groups/f-health.ts`: the documented sub-score transforms + 4 roll-ups (AC1, AC2, AC3).** The component sub-score transforms are **catalog-owned domain knowledge** (sibling to the weights), each a named/commented helper mapping a source metric value → a 0–100 sub-score (higher = healthier). A component whose **source metric is `not_available` is excluded** and the weights **renormalize over the available components** (the composite never collapses to 0 because one group couldn't compute). Internal helper `componentSubScores(byId): Component[]` (used by 3 of the 4 metrics; no cross-metric dependency, no duplication):
  - [ ] **Message Quality 35%** ← `c-conventional-commits.adherenceSharePct` blended with `(100 − c-low-information-rate.lowInfoSharePct)` (mean of whichever are available).
  - [ ] **Commit Size Discipline 20%** ← `a-commit-size-distribution.median` (lines/commit): `≤ GOOD_MEDIAN_LINES (50)` → 100, `≥ POOR_MEDIAN_LINES (500)` → 0, linear between (clamped). `[ASSUMPTION]`.
  - [ ] **Branching Discipline 20%** ← `100 − d-direct-to-default.directToDefaultSharePct` (high direct-to-default = low review/branch discipline). `[ASSUMPTION]` — document that a fully-linear/solo repo legitimately scores low here; transparency (the visible sub-score) keeps it honest.
  - [ ] **Collaboration Breadth 15%** ← `100 − b-contribution-distribution.topCommitSharePct` (top author's share; lower = broader). A single-author repo → top share 100 → 0 (correctly narrow — **NOT** `1−gini`, which is degenerately 0 for one author).
  - [ ] **Churn Stability 10%** ← coefficient of variation of `e-churn-over-time.perMonth[*].churn`: `cv = stdev/mean`; `subScore = clamp(100 − cv·100, 0, 100)`. Needs ≥2 months, else the component is `not_available` (excluded).
  - [ ] **`f-hygiene-score` "Overall hygiene score"** — `{ score, components: [{ name, weightPct, subScore: number|null, contributed: boolean }], componentsContributing, methodology }`. `not_available` only when **no** component is available.
  - [ ] **`f-bus-factor-risk` "Bus-factor risk flag"** — consumes `b-bus-factor`: `{ busFactor, risk: "low"|"moderate"|"high", topAuthorSharePct, framing }` (`busFactor === 1` → `high`, `=== 2` → `moderate`, `≥ 3` → `low`; `[ASSUMPTION]`). **No author identity** (NFR-8). `not_available` when `b-bus-factor` is `not_available`.
  - [ ] **`f-trend-deltas` "Trend deltas"** — when `ctx.priorMetrics` is absent: `not_available("No prior report available for trend comparison.")`. When present: build a prior `byId`, compute current vs prior hygiene score via the shared helper, emit `{ priorHygieneScore, currentHygieneScore, hygieneScoreDelta, direction: "improving"|"declining"|"stable" }`. Document the injection seam (a later trend story / Epic 4 JSON read wires the prior).
  - [ ] **`f-strengths-weaknesses` "Hygiene strengths & weaknesses"** — from the contributing components: `{ strengths: [{ name, subScore }], weaknesses: [{ name, subScore }] }` (best/worst by sub-score, sorted desc/asc, tie-break by component order; top 2 each `[ASSUMPTION]`). `not_available` when no component contributed. Surfaced for Coaching (Epic 3).

- [ ] **Task 4 — Register Group F roll-ups in the engine (AC1).** In [src/analyze/registry.ts](src/analyze/registry.ts): export `ALL_ROLLUPS: RegisteredRollup[] = [...GROUP_F_ROLLUPS]` (kept separate from `ALL_METRICS`, which stays A–E). `analyze` defaults to running both; the final order is A→B→C→D→E→F.

- [ ] **Task 5 — Tests: roll-up engine + per-metric + renormalization + NFR-8 + determinism (AC1, AC2, AC3).**
  - [ ] Co-locate `f-health.test.ts` driving the roll-ups with **synthetic A–E `Metric` envelopes** (the clean way to test a roll-up): a healthy fixture, an unhealthy fixture, and a partial fixture (some sources `not_available`) proving **weight renormalization**; assert each sub-score transform at its documented boundary; the hygiene score on a known set; bus-factor risk bands; strengths/weaknesses ordering; trend deltas `not_available` without a prior and computed with an injected prior.
  - [ ] **NFR-8 guard:** serialize the full Group F output for inputs whose source metrics were derived from sentinel author identities and assert **no author name/email appears** (Group F is team-level only).
  - [ ] **Engine roll-up test** in `engine.test.ts`: `analyze` appends Group F after A–E (full 28+4 = 32-id order); a roll-up that throws → `not_available`; **update the existing probe tests** to pass `[]` as the 4th `rollups` arg so they keep asserting the base pass in isolation.
  - [ ] Confirm `tests/determinism/analysis-determinism.test.ts` stays green with Group F appended (byte-identical + order-independent over the full catalog incl. roll-ups). Group F is a deterministic pure function of the deterministic A–E values, so it inherits determinism by construction.

## Dev Notes

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **A unanimous clean review — all three layers 0 patches.** The Edge Case Hunter walked every source-availability / boundary-sub-score / CV / renormalization / engine-roll-up path and found them all handled; the spec-aware Acceptance Auditor verified **all three ACs genuinely MET, the exact PRD weights (35/20/20/15/10), the engine roll-up extension faithful + minimal + backward-compatible (zero downstream change), the gini single-author trap explicitly avoided, NFR-8 proven, and scope held.** Triage: **0 patch · 0 defer · 1 dismissed · 0 decision-needed.**

**Dismissed (1):** Blind Hunter flagged the bus-factor risk band using `busFactor <= 1` rather than `=== 1` for `high` — **correct as defensive coding** (Group B's `busFactor` is a count that is always ≥1 for any non-empty repo; `<= 1` simply treats a hypothetical malformed `0` as high risk too, which is the safe direction). Both hunters and the Auditor independently confirmed the rest: the safe reads (`computedValue`/`numAt`/`monthlyChurn`) reject `not_available` sources, non-object values, missing fields, and non-finite numbers; the transforms are all clamped (no Infinity/negative leaks); the CV guards `<2 months` and `mean === 0`; renormalization guards the zero-contributing case; `stdev` is order-independent population std; and the roll-up pass indexes only base metrics (roll-ups never see each other), appends in stable order, and is deterministic by construction.

### Scope discipline — what this story does and does NOT include

This is the **Epic 2 capstone** — Group F, the **roll-up** that consumes Groups A–E into a transparent, team-level health summary. Unlike A–E it does **not** read raw commits; it is a pure function of the computed metric envelopes. It is the story the engine's "hybrid topology" anticipated, so it makes the **one deliberate engine extension** of Epic 2 (the roll-up pass).

**In scope:**
- The engine roll-up pass (`RollupFn`/`RegisteredRollup`, the second pass in `analyze`) + the `priorMetrics` seam on `AnalysisContext`.
- The four Group F roll-up metrics (`f-health.ts`) + the documented component sub-score transforms + weight renormalization.
- A `stdev` stats helper (churn stability).

**Out of scope / deferred (do NOT build here):**
- **Loading a real prior Report JSON** for trend deltas — the *seam* is built (`ctx.priorMetrics`), but reading a previous report file is a **CLI/render concern** (the deterministic engine reads no files — hexagonal). Trend deltas degrade to `not_available` until a later trend story / Epic 4's JSON read wires the prior in. [Source: docs/planning-artifacts/architecture.md#Hexagonal Boundary]
- **Health bands** (`ok`/`watch`/`risk`/`n/a`) — the render-time classifier (`render/health-band.ts`, Epic 4), **not** Group F. Group F's hygiene score is a *metric value*; the per-metric band is a separate presentational derivation. Do not build the band here. [Source: docs/planning-artifacts/architecture.md#C2]
- **Commit-selection inputs** (2.6) / **Free-tier cap** (2.7) / **AI explanations** (Epic 3) / **the Group F overview chart** (radar + gauge, Epic 4 — consumes this data). [Source: docs/planning-artifacts/epics.md]
- **Re-deriving A–E logic** — Group F must **consume the computed A–E values**, never re-parse commits/messages/topology (that would duplicate Group A–E logic and risk drift). This is why the roll-up pass exists.

### The key architectural decision — Group F is a roll-up pass (read first)

The engine's C2 "hybrid topology" runs each of ~30 metrics as a pure function over the shared model. Group F is the exception the PRD names explicitly: **"Given Groups A–E are computed, When Group F runs."** It is a **roll-up of the catalog**, not a function of raw commits. Two designs were possible:

- **Re-derive over the model** (keep the `MetricFn` shape) — rejected: it duplicates Group C/D/E logic (e.g. re-computing Conventional-Commits adherence), so a heuristic change in Group C would silently drift the hygiene score. Violates the "transparent composite of the catalog" intent.
- **Consume the computed envelopes** (a second pass) — **chosen**: faithful to the PRD wording, drift-free (one source of truth per signal), and trivially testable (feed synthetic envelopes). The engine runs the base `MetricFn` pass, indexes the results by `id`, then runs the `RollupFn` pass over that index.

This is a **minimal, well-motivated engine extension** the architecture anticipated — not scope creep. Document it in Completion Notes as the story's central decision. The roll-up is a **pure function of deterministic inputs**, so determinism is preserved (the harness covers it).

### The hygiene composite — transparent, renormalized, honest (AC1)

- **Weights (catalog-owned domain knowledge, verbatim from PRD §4.2):** Message Quality 35 · Commit Size Discipline 20 · Branching Discipline 20 · Collaboration Breadth 15 · Churn Stability 10 (= 100). Named module consts.
- **Each component sub-score is a documented transparent transform** of a single source metric value to 0–100 (higher = healthier) — see Task 3. The transforms are `[ASSUMPTION]`-tagged where they encode a judgement (size thresholds, branching interpretation), exactly like Group A–E thresholds.
- **Renormalization over available components:** `score = Σ(subScore·weight) / Σ(weight of available)`, rounded. A component whose source metric is `not_available` is **excluded** and its weight redistributed proportionally — so a repo where (say) Group D had no merges still gets a meaningful hygiene score from the other four, and the `components` array shows exactly which contributed (`contributed: boolean`, `subScore: null` when excluded). This is the honest, transparent design; the alternative (treat a missing component as 0) would falsely punish a healthy repo.
- **`not_available` only when no component is available** (e.g. an empty repo where every source is `not_available`).

### NFR-8 — Group F is team-level only (AC2)

The §8 positioning guardrail binds Group F as hard as Group B. The **bus-factor risk flag** consumes `b-bus-factor` (already an anonymized team-level scalar) and frames the result as **risk to mitigate** (`low`/`moderate`/`high`), never a person. **No Group F value contains an author name or email** — the sources it consumes (Group B's shares/gini/bus-factor) are already anonymized, and Group F adds only scores/risk-bands/component-names. A guard test serializes the full Group F output and asserts no sentinel identity leaks. [Source: docs/planning-artifacts/epics.md#NFR-8, src/analyze/groups/b-contribution.ts]

### Trend deltas — the seam, honestly degraded (AC3)

The PRD: trend deltas exist **"where a prior Report JSON for the same repo is available."** The deterministic engine cannot read files (hexagonal), so this story builds the **injection seam** — an optional `ctx.priorMetrics?: readonly Metric[]` — and, **when absent (the default), emits `not_available("No prior report available for trend comparison.")`**. When a prior IS injected (by a future CLI trend story / Epic 4 JSON read), it computes the current-vs-prior hygiene-score delta + direction. This mirrors Story 2.3/2.4's honest-degradation posture (name the gap, don't fabricate). Powers UJ-2 (trend diffing) once the prior-load lands. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#Group F trend deltas, #UJ-2]

### PRD §4.2 Group F catalog — the authoritative definitions

| id | Title (PRD) | What it represents |
|---|---|---|
| `f-hygiene-score` | Overall hygiene score | transparent 0–100 weighted composite (MsgQuality 35 · CommitSize 20 · Branching 20 · Collab 15 · ChurnStability 10), shown with component sub-scores |
| `f-bus-factor-risk` | Bus-factor risk flag | team-level concentration-of-knowledge risk (from Group B), framed as risk, never individual ranking |
| `f-trend-deltas` | Trend deltas | change since last run, **only when a prior Report JSON for the same repo is available** |
| `f-strengths-weaknesses` | Hygiene strengths & weaknesses | the repo's best and worst dimensions, surfaced for Coaching |

[Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 Group F] — IDs follow the kebab convention; titles verbatim. The static one-line description is not stored in the envelope.

### The exact engine/model contracts + the A–E value shapes Group F consumes

- **`Metric` envelope** = `{ id, group, title, status, value?, reason? }`; `value` = `MetricValue` (JSON only). `MetricGroup` already includes `"F"`; the Report `MetricSchema` enum already includes `"F"` — **no schema change.** [Source: src/analyze/metric.ts, src/assemble/report-schema.ts]
- **Type gotcha (2.1/2.4):** an emitted object-array element type must be a **`type` alias, not an `interface`** (interfaces aren't assignable to `MetricValue`'s index signature). Group F emits `components`/`strengths`/`weaknesses` arrays of objects — define those as `type`. [Source: 2.1/2.4 Debug Log]
- **Source metric value shapes (read these from the computed `byId` map; each may be `not_available`):**
  - `a-commit-size-distribution` → `{ min, median, p90, max, mean, commitCount }`
  - `c-conventional-commits` → `{ adherentCount, adherenceSharePct, byType, subjectsConsidered }`
  - `c-low-information-rate` → `{ lowInfoCount, lowInfoSharePct, … }`
  - `b-contribution-distribution` → `{ authorCount, commitShares, lineShares, giniCommits, giniLines, topCommitSharePct, top3CommitSharePct }`
  - `b-bus-factor` → `{ busFactor, thresholdPct, topAuthorSharePct, totalAuthors }`
  - `d-direct-to-default` → `{ directToDefaultCount, directToDefaultSharePct, viaMergeCount, mainlineCommitCount, totalCommits }`
  - `e-churn-over-time` → `{ perMonth: Record<"YYYY-MM", { additions, deletions, churn, commitCount }>, totalChurn }`
  [Source: src/analyze/groups/a-cadence.ts, b-contribution.ts, c-message-quality.ts, d-branching.ts, e-churn.ts]
- **Reading a source safely:** a helper `numAt(byId, id, path)` that returns the numeric field when the metric is `computed` and the path exists, else `undefined` (⇒ the component is excluded). Never assume a source is `computed`. Use a `type`-narrowed read, not `as` casts where avoidable.
- **Stats helpers:** `mean`, `median`, `round`, `gini` (2.1) — **add `stdev`** (Task 2). [Source: src/analyze/stats.ts]

### Implementation patterns this story must follow (mirror Groups A–E)

- **P2/P3:** `kebab-case.ts`, **named exports only**, co-located `*.test.ts`. New file `f-health.ts` (the architecture map's name for Group F — for F the map and the short-theme agree). [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure, eslint.config.js]
- **P5:** `analyze/` is under `no-console`, reads no env/clock/fs — pure functions. The roll-ups are pure functions of `(byId, ctx)`. [Source: eslint.config.js]
- **Determinism:** fixed component order; rounded scores; clamped sub-scores; no `Map`/`Set`/`Date` in emitted values; no `Date.now()`. The roll-up is a deterministic function of the deterministic A–E values. [Source: src/analyze/groups/*.ts]
- **`[ASSUMPTION]` thresholds** (`GOOD_MEDIAN_LINES`, `POOR_MEDIAN_LINES`, bus-factor risk bands, the weights, strengths/weaknesses top-N) are named module consts with comments. [Source: src/analyze/groups/d-branching.ts]

### Determinism harness — free coverage, must stay green

`tests/determinism/analysis-determinism.test.ts` runs `analyze(SYNTHETIC_HISTORY, ctx())` which now runs A–E **and** the Group F roll-ups, so the harness automatically subjects Group F to byte-identical + order-independent + serializable checks. Group F is a pure function of the deterministic A–E envelopes ⇒ deterministic by construction. Keep A–E asserted values unchanged. [Source: tests/determinism/analysis-determinism.test.ts]

### Previous-story intelligence (2.1–2.4, 1.5)

- **Groups A–E are the template** for the metric shape; Group F differs only in the fn signature (roll-up). Reuse `computed`/`notAvailable`, named-const thresholds, the `type`-alias-for-emitted-objects rule. [Source: src/analyze/groups/*.ts]
- **`gini` is degenerate for one author** (single-element ⇒ 0), so Collaboration Breadth uses `topCommitSharePct` (correctly 100→narrow), not `1−gini`. A real review trap — documented in Task 3. [Source: src/analyze/stats.ts, src/analyze/groups/b-contribution.ts]
- **Engine signature change ripples to `engine.test.ts` probe tests** — they must pass `[]` as the new `rollups` arg to keep testing the base pass in isolation; the full-catalog id test extends to include `f-*`. [Source: src/analyze/engine.test.ts]
- **Honest degradation (2.3/2.4):** distinguish `not_available` reasons precisely (no prior report vs no contributing component vs source unavailable). [Source: src/analyze/groups/d-branching.ts, e-churn.ts]

### Project Structure Notes

- New file: `src/analyze/groups/f-health.ts` (+ `f-health.test.ts`). Modified: `src/analyze/engine.ts` (roll-up pass + types), `src/analyze/model.ts` (`AnalysisContext.priorMetrics?`), `src/analyze/stats.ts` (+`stdev`), `src/analyze/registry.ts` (+`ALL_ROLLUPS`), `src/analyze/engine.test.ts` (probe tests + id order). **No Report-schema change** (`"F"` already in the enums). [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- The `analyze` return shape (`Analysis = { metrics: Metric[] }`) is **unchanged** — roll-up metrics are appended to the same `metrics` array, so 1.7 assembly / 1.8 render / the Report schema all consume Group F with zero downstream change.

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.5: Group F — Repository Health Signals] · [Source: docs/planning-artifacts/epics.md#NFR-8]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 Group F] · [Source: …#FR-4] · [Source: …#FR-5] · [Source: …#UJ-2 trend diffing]
- [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture] (hybrid topology, uniform envelope, health-band ownership)
- [Source: src/analyze/engine.ts] (the pass to extend) · [Source: src/analyze/model.ts] (`AnalysisContext`) · [Source: src/analyze/metric.ts] · [Source: src/analyze/stats.ts] · [Source: src/analyze/registry.ts] · [Source: src/analyze/groups/a-cadence.ts] · [Source: src/analyze/groups/b-contribution.ts] · [Source: src/analyze/groups/c-message-quality.ts] · [Source: src/analyze/groups/d-branching.ts] · [Source: src/analyze/groups/e-churn.ts] · [Source: tests/determinism/analysis-determinism.test.ts]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean. (One dev fix: an optional-chain advisory on the `computedValue` guard → `metric?.status !== "computed"`.)
- `npm run lint` → ESLint clean. The `RollupFn`/`RegisteredRollup` types live in `model.ts` (next to `MetricFn`/`RegisteredMetric`) so `f-health.ts → model.ts` has **no import cycle** with the engine (engine → registry → f-health would otherwise loop back to engine for the types).
- `npm test` → vitest: **40 files / 328 tests passed** (was 39/307; +2 files, +21 tests). The determinism harness now runs A–E **and** the Group F roll-ups via `analyze` — byte-identical + order-independent green (Group F is a pure function of the deterministic A–E values).
- `npm run build` → tsup ESM build success (`dist/index.js` 78.16 KB).
- **Real e2e on this repo — the full 32-metric catalog renders** (6 A + 6 B + 6 C + 5 D + 5 E + 4 F): hygiene score 31.28 (accurate for a solo docs repo — bus-factor risk `high` with one author, Branching Discipline low since everything is direct-to-default), and **Trend deltas correctly `not_available` ("No prior report available for trend comparison.")** — AC3's honest degradation in the wild.

### Completion Notes List

- **All three ACs satisfied.** AC1: the hygiene score is the transparent weighted composite (MsgQuality 35 · CommitSize 20 · Branching 20 · Collab 15 · ChurnStability 10) computed from the already-computed A–E values, emitted **with its component sub-scores** (each `{ name, weightPct, subScore, contributed }`) + `methodology`. AC2: the bus-factor risk flag is team-level (`low`/`moderate`/`high` from Group B's anonymized bus-factor), and the NFR-8 guard test proves no author identity appears in any Group F value. AC3: trend deltas are `not_available` ("No prior report available…") by default and computed only against an injected prior — honest degradation, not a fabricated zero.
- **The key architectural decision — the roll-up pass.** Group F consumes the *computed* A–E envelopes, so the engine gained a second metric-function shape: `RollupFn = (metrics: ReadonlyMap<string, Metric>, ctx) => Metric` + `RegisteredRollup`. `analyze` runs the base `MetricFn` pass, indexes the results by `id`, then runs the roll-ups over that index, **appending** them (stable A–E→F order). This is faithful to the PRD's "Given Groups A–E are computed, When Group F runs," **drift-free** (Group F never re-derives Group C/D/E logic — one source of truth per signal), and trivially testable (the roll-ups take synthetic `Metric` envelopes, no model). The architecture's "hybrid topology" anticipated this; it's a minimal, well-motivated engine extension, not scope creep.
- **Transparent renormalization (the composite's honesty).** A component whose source metric is `not_available` is **excluded** and the weights **renormalize over the contributing components** — so a repo where one group couldn't compute still gets a meaningful score (never a false 0), and `components[].contributed`/`subScore: null` show exactly which counted. `not_available` only when **no** component is available. Proven by a dedicated renormalization test (drop Churn Stability → score over the remaining 90% weight).
- **The documented sub-score transforms** (catalog-owned domain knowledge, `[ASSUMPTION]`-tagged): Message Quality = mean of `c-conventional-commits.adherenceSharePct` and `(100 − c-low-information-rate.lowInfoSharePct)`; Commit Size = linear `median` lines/commit (≤50→100, ≥500→0); Branching = `100 − d-direct-to-default.directToDefaultSharePct` (documented to score a solo/linear repo low — transparency keeps it honest); Collaboration Breadth = `100 − b-contribution-distribution.topCommitSharePct` (**NOT** `1−gini`, which is degenerately 0 for a single author — the documented review trap); Churn Stability = `100 − CV·100` of monthly churn (needs ≥2 months, else excluded). A new `stdev` stats helper backs the CV.
- **Trend-delta seam.** `AnalysisContext.priorMetrics?: readonly Metric[]` (typed as `Metric[]`, not `Analysis`, to avoid a circular import) is the injection point; reading a real prior Report JSON is a CLI/render concern (the engine reads no files — hexagonal), so it's deferred and degrades honestly today.
- **Zero downstream change.** `Analysis = { metrics: Metric[] }` is unchanged — roll-up metrics append to the same array, so 1.7 assembly, the 1.7 Report schema (`"F"` already in the enum), and 1.8 render all consume Group F untouched. The full 32-metric catalog flows through the existing pipeline.
- **Scope deferrals honored:** no health bands (render-time, Epic 4); no real prior-report load (seam only); no commit-selection inputs (2.6); no Free-tier cap (2.7); no AI explanations (Epic 3); no Group F chart (Epic 4). No new dependencies.
- **Test updates (engine signature):** the three `engine.test.ts` probe tests now pass `[]` as the 4th `rollups` arg (testing the base pass in isolation); the id-order test extends to the full 32-id A→B→C→D→E→F catalog; +2 engine roll-up-mechanics tests (a roll-up sees the base metrics; a throwing roll-up → `not_available`).
- **SonarQube advisory** (unchanged): `type IsoDate = string` — intentional. No new gate-failing advisories.

### File List

**Added (source):**
- `src/analyze/groups/f-health.ts` — four Group F roll-ups + specs + `GROUP_F_ROLLUPS` + the documented sub-score transforms + renormalization

**Added (tests, co-located):**
- `src/analyze/groups/f-health.test.ts` (per-roll-up correctness, sub-score boundaries, renormalization, bus-factor bands, trend deltas with/without prior, strengths/weaknesses, the NFR-8 guard, determinism)

**Modified (source):**
- `src/analyze/engine.ts` — the roll-up pass (`runRollup`; `analyze` gains a `rollups` param; re-exports `RollupFn`/`RegisteredRollup`)
- `src/analyze/model.ts` — `RollupFn`/`RegisteredRollup` types + `AnalysisContext.priorMetrics?` seam
- `src/analyze/stats.ts` — `stdev` helper
- `src/analyze/registry.ts` — `ALL_ROLLUPS` (Group F), kept separate from `ALL_METRICS` (A–E)

**Modified (tests):**
- `src/analyze/engine.test.ts` — probe tests pass `[]` rollups; id-order → 32-id catalog; +2 roll-up-mechanics tests
- `src/analyze/stats.test.ts` — `stdev` tests

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 2-5 → in-progress → review
- `docs/implementation-artifacts/2-5-group-f-repository-health-signals.md` — this story (record filled, status → review)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 2.5 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 2.5 implemented (TDD): the Epic 2 capstone. Engine gains a **roll-up pass** (`RollupFn`/`RegisteredRollup`; `analyze` runs base A–E then roll-ups over the indexed results). Four Group F roll-ups (`f-health.ts`) consume A–E into the transparent weighted hygiene composite (renormalized over available components), team-level bus-factor risk (NFR-8 guard), the trend-delta seam (`ctx.priorMetrics`; honest `not_available` default), and strengths/weaknesses. +`stdev` stat. Full 32-metric catalog. 2 new suites; 40 files / 328 tests green; typecheck/lint/build clean; real e2e verified. Status → review. |
| 2026-06-13 | Code review (3 parallel layers) → **unanimous 0 patches** (Blind Hunter 0, Edge Case Hunter 0, Acceptance Auditor 0: all 3 ACs MET, exact PRD weights, engine roll-up extension faithful+minimal+backward-compatible, gini single-author trap avoided, NFR-8 proven, scope held). 1 dismissed (bus-factor `<=1` is defensive, not a bug). 328 tests green; typecheck/lint/build clean. Status → done. |
