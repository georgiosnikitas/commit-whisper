---
epic: 3
story: 3
title: Per-group batched generation
baseline_commit: 9bb6adb
---

# Story 3.3: Per-group batched generation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user on a modest or local model,
I want narration generated in bounded batches,
so that runs stay affordable and survive small context windows.

## Acceptance Criteria

1. **Explanations batched per Metric Group — six batches — with coaching as its own call (AC1).** **Given** ~30 metric explanations plus coaching, **when** generation runs, **then** the per-metric explanations are generated in **one `generateObject` call per Metric Group** (Groups A–F ⇒ up to six batches, one batch over only that group's metrics), and **coaching is generated in its own call** (the holistic repo-level narrative call), **not** folded into the per-group explanation batches — so each response is bounded (survives a modest/local model's context window) and the calls are independent/parallelizable.

2. **A single failing group degrades gracefully (AC2).** **Given** the per-group batches run, **when** one group's generation fails (throws / times out / returns an invalid object), **then** that group's metrics are simply **absent** from `narrative.explanations` while **every other group's explanations are still produced and carried** — the failed group does **not** fail the whole run; the repo-level narrative (Summary/Explanation/Coaching) and the surviving groups render as a normal narrated showpiece.

3. **Deterministic, anchored, privacy-safe merge (AC3).** **Given** the per-group batch results, **when** they are merged into `narrative.explanations`, **then** the merged map is **deterministic** (keyed by metric id in stable Group-then-metric order, independent of which batch resolved first), each explanation stays **anchored** to a metric in its own group (ungrounded ids dropped, as in 3.2), and every per-group prompt is built from **`Analysis` only** (the group's metric envelopes), so commit messages, paths, diffs, and the key remain structurally absent (privacy by construction).

## Tasks / Subtasks

- [ ] **Task 1 — Split `generateExplanations` into per-group batches (AC1, AC2, AC3) [src/narrate/generate.ts].** Keep the signature `generateExplanations(model, analysis, deps): Promise<MetricExplanations>` (the orchestrator is untouched), but reimplement the body:
  - [ ] `METRIC_GROUPS = ["A", "B", "C", "D", "E", "F"] as const` (typed `readonly MetricGroup[]`) — the stable batch order.
  - [ ] Partition `analysis.metrics` by group; for each group with **≥1 metric**, schedule one batch over a group-filtered `Analysis` (`{ metrics: groupMetrics }`). An empty group is **skipped** (no wasted call).
  - [ ] Run the batches with **`Promise.allSettled`** (concurrent, parallelizable). A **rejected** batch is dropped (graceful degradation — AC2); a **fulfilled** batch contributes its keyed record.
  - [ ] **Merge in `METRIC_GROUPS` order** (not completion order) so the merged map is deterministic regardless of which batch resolves first (AC3). Within a group, `buildExplanationsRecord` already emits in that group's analysis order — so the overall key order is Group-then-metric (matching the byte-stable `analysis` order).
  - [ ] Extract `generateGroupExplanations(model, groupAnalysis, deps): Promise<MetricExplanations>` — the single per-group `generateObject` call (binds `ExplanationBatchSchema`, `temperature: 0`, `buildExplanationsPrompt(groupAnalysis)`, then `buildExplanationsRecord(object.explanations, groupAnalysis)`). Exported for direct unit test. (This is exactly the **old** one-call `generateExplanations` body, now scoped to one group.)
  - [ ] `buildExplanationsRecord` is **unchanged** — per group, its `validIds` is that group's ids, so a cross-group hallucinated id is dropped (anchoring holds per batch).

- [ ] **Task 2 — Confirm the orchestrator + coaching call need no change (AC1) [src/narrate/narrate.ts].** `createNarrate` already runs `Promise.all([generate(model, analysis), generateExpl(model, analysis)])` — `generate` = `generateNarrative` (Summary + Explanation + **Coaching** in one holistic call = the "coaching call"), `generateExpl` = the now-batched `generateExplanations`. The per-group graceful degradation lives **inside** `generateExplanations` (it no longer throws for a single group's failure), so the orchestrator's contract is unchanged. **Update the comment** that currently says "graceful per-group degradation is Story 3.3" to state it is now implemented (the narrative call still fails the whole narration if IT fails — the repo-level narrative is required for the showpiece; only per-group explanation batches degrade gracefully).

- [ ] **Task 3 — Tests (AC1, AC2, AC3) [src/narrate/generate.test.ts].**
  - [ ] **Per-group batching (AC1):** a **multi-group** fixture (metrics spanning Groups A, B, C) → `generateExplanations` makes **one call per group** (assert the call count = number of non-empty groups), each call's prompt contains **only** that group's metric ids (and not another group's), and the merged record covers every metric across all groups.
  - [ ] **Empty group skipped:** a fixture with metrics in only some groups makes no call for the absent groups (call count = populated-group count).
  - [ ] **Graceful single-group failure (AC2):** a fake `generateObject` that **rejects for exactly one group** (detected via the group-specific metric id in `opts.prompt`) → the merged record **omits that group's metrics** but **includes every other group's** (no throw out of `generateExplanations`).
  - [ ] **Deterministic merge order (AC3):** the merged keys are in Group-then-metric order even when the per-group fakes resolve out of order (e.g. group C resolves before group A); two runs are byte-identical.
  - [ ] **`generateGroupExplanations` (unit):** a single group's call binds `ExplanationBatchSchema`, pins `temperature: 0`, sends the group prompt, and keys by id (incl. a `not_available` metric in that group — AC carry-over from 3.2).
  - [ ] **Privacy (AC3):** a group batch's prompt contains only `analysis.metrics` for that group (the `buildExplanationsPrompt` privacy probe, per group).
  - [ ] **`generateNarrative` unchanged:** still one call binding `NarrativeSchema` (Summary/Explanation/Coaching) — the "coaching call" is untouched.
  - [ ] **`narrate.test.ts`:** the existing injected-fake cases still hold (a fake `generateExplanations` that throws still degrades — that tests the orchestrator's handling of a TOTAL explanations failure, distinct from the in-function per-group graceful path). No fixture change.

## Dev Notes

### Review Findings

**Code review — 2026-06-14** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **Unanimously clean — 0 source patches.** The spec-aware Acceptance Auditor cleared **all ACs MET (4/0/0)** and explicitly judged the "coaching as its own call" interpretation **faithful and correct** (coaching = the holistic `generateNarrative` call, distinct from the six per-group explanation batches — matching the architecture's "per-group × 6 + a coaching call"), with scope discipline "SOUND." The **Edge Case Hunter returned 0/0/0**, explicitly validating every boundary (empty analysis, all-groups-fail, cross-group contamination dropped per batch, prototype-pollution safe, deterministic merge). The Blind Hunter found 0 patches (2 Consider · 1 Nit, all test-coverage). Triage: **0 patch · 2 actioned coverage tests · ~3 dismissed.**

**Actioned (non-blocking coverage — all three reviewers converged on the graceful-path extremes):**

- [x] Added a test that **EVERY group failing** → an empty map with **no throw** (the extreme of graceful degradation — the repo-level narrative still gates the showpiece).
- [x] Added a test that an **analysis with no metrics** → an empty map with **zero `generateObject` calls** (no wasted call; `Promise.allSettled([])` path).

**Dismissed:**
- **Blind Hunter — hardcoded metric-id list in the test fake** (Consider): the `MULTI` fixture is local and stable; deriving the id list from it would add indirection for no real safety. Test fragility is negligible.
- **Blind Hunter — combined delay+rejection determinism test** (Nit): the determinism test (staggered resolution) and the graceful-degradation test (a rejected group) each prove their property; a combined permutation adds little.
- **Acceptance Auditor — empty-batch (a group fulfilling with `[]` entries)**: in production the `.min(1)` on `ExplanationBatchSchema` makes `generateObject` reject an empty batch → that group is dropped via `allSettled` (the all-fail / single-fail path, already tested); `buildExplanationsRecord([])` returning `{}` is already covered.

### Architecture decision — split only the explanations; coaching rides the holistic narrative call (read first)

The authoritative design is explicit: **"Batching: per-group × 6 + a coaching call. Metric explanations are batched by Metric Group (A–F); coaching is its own call. Bounds each response size (survives modest local models), parallelizable, and a single failed group degrades gracefully instead of failing the whole run."** [Source: docs/planning-artifacts/architecture.md#Narration — Batching]

- **Six explanation batches.** The ~30 per-metric explanations are the heavy, multiplying output (FR-8's `[NOTE FOR PM]`). Splitting them **one call per Metric Group** bounds each response to that group's ~4–6 metrics — which is what lets a modest/local model (small context window) succeed, and makes the calls independently parallelizable. 3.2 deliberately built `generateExplanations` as the **single-call seam** so 3.3 reimplements its body without touching the orchestrator (the signature is unchanged). [Source: src/narrate/generate.ts, 3-2 story]
- **Coaching is its own call = the holistic narrative call.** `generateNarrative` (Story 3.1) produces Summary + Explanation + **Coaching** in **one** call. That call is "coaching's call" in the architecture's sense — coaching is generated **wholesale, once**, NOT fragmented across the six per-group explanation batches (coaching consolidates *across* all groups, so it cannot be a per-group batch). Keeping the three repo-level parts together is faithful to "coaching is its own call" (one call, distinct from the explanation batches) and preserves the 3.1 three-part `NarrativeSchema` contract verbatim. The total call shape — **6 explanation batches + 1 narrative(=coaching) call** — matches the architecture's "per-group × 6 + a coaching call." [Source: docs/planning-artifacts/architecture.md#Narration, src/narrate/generate.ts (generateNarrative)]
- **Graceful degradation via `Promise.allSettled`, inside `generateExplanations`.** A rejected group batch is **dropped** (its metrics get no explanation); the surviving groups still produce and merge. Because the per-group handling is internal, `generateExplanations` no longer throws for a single group's failure — so the orchestrator's `Promise.all([narrative, explanations])` only rejects (→ degrade/throw per `aiMode`) if the **narrative** call fails (the repo-level narrative is required for the showpiece — 3.1/FR-11), exactly the right asymmetry. [Source: src/narrate/narrate.ts, prd.md#FR-11 fail-open]
- **Deterministic merge.** The batches run concurrently (non-deterministic resolution order), so the merge **iterates `METRIC_GROUPS` in fixed order** and, within a group, relies on `buildExplanationsRecord`'s analysis-order emission (the 3.2 determinism patch). The merged `narrative.explanations` is therefore keyed in stable **Group-then-metric** order — the same order as the byte-stable `analysis` subtree — regardless of network timing. [Source: src/narrate/generate.ts (buildExplanationsRecord), 3-2 review patch]

### Scope discipline — what this story does and does NOT include

**In scope:** reimplementing `generateExplanations` as six (≤6) per-Group `generateObject` batches run with `Promise.allSettled`, merged deterministically in Group order with graceful single-group degradation; the extracted `generateGroupExplanations`; the comment update in the orchestrator. No new schema, no new prompt, no orchestrator-signature change.

**Out of scope / deferred (do NOT build here):**
- **Splitting coaching out of `generateNarrative` into a separate `generateObject` call** — unnecessary and not required: the architecture's "coaching is its own call" is satisfied by the holistic narrative call (coaching is generated once, not per-group). Refactoring the 3.1 three-part call would be churn for no AC value. [Source: architecture.md#Narration, epics.md#Story 3.1]
- **Deterministic grounding verification pass** (claim-by-claim numeric check; remove/rewrite unsupported claims) — **Story 3.4**. 3.3 keeps the 3.2 id-anchoring (drop ungrounded ids per group) but adds no numeric verification. [Source: epics.md#Story 3.4]
- **Confidence self-assessment** (`high`/`medium`/`low`; surfacing that a group degraded / the explanation set is incomplete) — **Story 3.5**. 3.3 degrades a group **silently-but-honestly** (the metrics are simply absent from the map); 3.5 is where a degraded/partial set lowers confidence and is surfaced to the user. [Source: epics.md#Story 3.5]
- **A concurrency limit / sequential fallback for tiny local models** — a perf/robustness refinement. 3.3 runs the ≤7 calls concurrently (the architecture's "parallelizable"); a pool/limit can be added later behind the same `generateExplanations` signature without changing callers. [Source: architecture.md#Narration (parallelizable)]
- **Full BYOK provider breadth** — **Story 3.6** (gemini-only slice holds). **Rendering** the per-metric facets — **Epic 4** (the Report JSON carries them; the terminal stays a summary, as in 3.2). [Source: epics.md#Story 3.6, #Epic 4]

### The exact contracts to build on (do NOT redefine)

- **`generateExplanations(model, analysis, deps): Promise<MetricExplanations>` (3.2):** the seam to reimplement. Signature unchanged — the orchestrator calls it as-is. [Source: src/narrate/generate.ts]
- **`buildExplanationsRecord(entries, analysis)` (3.2):** PURE; keys by id, drops ids not in the passed analysis (per group ⇒ that group's ids), first-wins on a dup, strips `metricId`, **emits in analysis order**. Reused per group — **do not change**. [Source: src/narrate/generate.ts]
- **`ExplanationBatchSchema` / `buildExplanationsPrompt(analysis)` (3.2):** reused **per group** (the prompt over a group-filtered analysis serializes only that group's metrics — privacy holds). No new schema/prompt. [Source: src/narrate/schema.ts, src/narrate/prompt.ts]
- **`generateNarrative(model, analysis): Promise<NarrativeParts>` (3.1):** the holistic Summary+Explanation+**Coaching** call — the "coaching call." **Unchanged.** [Source: src/narrate/generate.ts]
- **`createNarrate` orchestrator (3.2):** `Promise.all([generate, generateExpl])` → `{ ...parts, explanations }`; `off → skipped`, fail-open in `auto`, throw in `required`. The narrative-call failure still degrades/throws the whole narration; only the explanation **batches** degrade gracefully (now inside `generateExplanations`). **Comment update only.** [Source: src/narrate/narrate.ts]
- **`MetricGroup = "A".."F"` (1.5):** the group key on every metric envelope. `METRIC_GROUPS` lists them in stable output order (matching the registry's A→F append order). [Source: src/analyze/metric.ts, src/analyze/registry.ts]

### Determinism, privacy & fail-open posture (unchanged)

- **`temperature: 0`** pinned on **every** per-group batch (as on the narrative call). The narrative/explanations subtree is the one non-deterministic layer; `analysis` stays byte-stable (the determinism harness never narrates). The **merge order** is deterministic by construction (fixed Group iteration + analysis-order within a group), so the same model outputs always produce the same `narrative.explanations` key order. [Source: architecture.md#LLM sampling determinism, 3-2 patch]
- **Privacy by construction holds per batch:** each group's prompt serializes only that group's `analysis.metrics` — never `RepoHistory`. [Source: src/narrate/prompt.ts]
- **Fail-open preserved + sharpened:** the narrative call failing → degrade (`auto`, exit 9) / throw (`required`, exit 6); a single explanation **group** failing → that group dropped, narration continues (AC2). [Source: src/narrate/narrate.ts]
- **No new dependencies.** Reuses `ai` `generateObject` + `zod` (`Promise.allSettled` is platform-native). gemini-only slice holds.

### Previous-story intelligence

- **3.2 built the seam on purpose.** `generateExplanations` was deliberately the single-call entry point so 3.3 only reimplements its body; `buildExplanationsRecord` already emits in analysis order (the 3.2 determinism patch), which is exactly what makes the per-group merge deterministic. [Source: 3-2 story, src/narrate/generate.ts]
- **`Promise.allSettled` over `Promise.all`** for the group batches: `all` would reject the whole set on the first group failure (the opposite of AC2). `allSettled` collects every outcome so a failed group is droppable. (The orchestrator keeps `Promise.all` for narrative+explanations because there the narrative IS required.) [Source: src/narrate/narrate.ts]
- **Group filtering reuses the metric's `group` field** — every envelope carries `group: "A".."F"` (1.5), so partitioning is a pure filter; no registry coupling in the narrate layer. [Source: src/analyze/metric.ts]
- **Test the per-group failure via the prompt content:** the fake `generateObject` receives `opts.prompt`; branch on a group-specific metric id to reject exactly one group deterministically (timing-independent), since the batches run concurrently. [Source: src/narrate/generate.test.ts pattern]

### Project Structure Notes

- Modified: `src/narrate/generate.ts` (+ `generate.test.ts`), `src/narrate/narrate.ts` (comment only). **No** schema/prompt/orchestrator-signature change; **no** engine/model/metric/select/config/render/assemble change. The `analysis` subtree, the Report schema, and the terminal renderer are untouched. [Source: architecture.md#Complete Project Directory Structure]
- No new files — the batching lives in the existing `narrate/generate.ts`.

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.3: Per-group batched generation] (the ACs)
- [Source: docs/planning-artifacts/architecture.md#Narration — Batching: per-group × 6 + a coaching call] (six batches; coaching its own call; parallelizable; single failed group degrades gracefully)
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-8 NOTE] (batching to bound cost/latency on the BYOK budget) · [Source: …#FR-11] (fail-open)
- [Source: src/narrate/generate.ts] (the `generateExplanations` seam + `buildExplanationsRecord`) · [Source: src/narrate/narrate.ts] (the orchestrator) · [Source: src/analyze/metric.ts] (`MetricGroup`) · [Source: src/analyze/registry.ts] (A→F order)

### Completion Notes

- **Both ACs satisfied.** AC1: `generateExplanations` partitions `analysis.metrics` by Group and makes **one `generateObject` call per non-empty Group** (A–F ⇒ ≤6 batches), each over only that group's metrics (bounded response — survives a modest/local model's context window); coaching stays in the **holistic `generateNarrative` call** (Summary+Explanation+Coaching, one call) = the architecture's "coaching call," distinct from the explanation batches. AC2: the batches run with **`Promise.allSettled`**, so a single rejected group is **dropped** (its metrics absent) while every other group's explanations are produced and carried — the run does not fail.
- **Deterministic merge.** The merge iterates `METRIC_GROUPS` in fixed A→F order (not completion order) and `buildExplanationsRecord` emits within a group in analysis order, so `narrative.explanations` is keyed in stable **Group-then-metric** order — proven by a test that staggers batch resolution (C first, A last) yet asserts A→B→C key order. Privacy holds per batch (each prompt serializes only that group's metrics); anchoring holds per batch (a cross-group hallucinated id is dropped by `buildExplanationsRecord`'s group-scoped `validIds`).
- **Minimal, localized change.** Only `generate.ts` (the `generateExplanations` body + the extracted `generateGroupExplanations`) changed; the **orchestrator signature is unchanged** (`createNarrate` calls `generateExpl(model, analysis)` as before — the per-group graceful degradation lives inside `generateExplanations`), and `generateNarrative`, the schemas, the prompt, assemble, and render are all untouched. The narrative-call failure still degrades/throws the whole narration (the repo-level narrative is required for the showpiece); only explanation **groups** degrade gracefully.
- **414 tests** (+6); typecheck / lint / build clean. Substrate (`--no-ai`) path verified unchanged on the real binary; the per-group batching + graceful degradation + deterministic merge are proven at the `generate.ts` unit level (the real narrated path needs a Gemini key).
- **No new dependencies.** Reuses `ai` `generateObject` + `zod`; `Promise.allSettled` is platform-native. gemini-only slice holds.
- **Deferred (unchanged):** the grounding verification pass (3.4), confidence self-assessment incl. surfacing a degraded/partial group (3.5), a concurrency limit for tiny local models (perf, behind the same signature), full BYOK breadth (3.6), and rendering the facets (Epic 4).

### File List

**Modified (source):**
- `src/narrate/generate.ts` — `METRIC_GROUPS`; reimplement `generateExplanations` as per-Group `Promise.allSettled` batches merged in Group order; extract `generateGroupExplanations` (the single-group call); `buildExplanationsRecord` unchanged
- `src/narrate/narrate.ts` — comment-only: per-group graceful degradation is now implemented inside `generateExplanations`; the narrative call still gates the whole narration

**Modified (tests):**
- `src/narrate/generate.test.ts` — per-group batching (one call per non-empty group, prompt isolation), empty-group skip, graceful single-group failure, all-groups-fail → empty map, empty-analysis → no call, deterministic Group-order merge under out-of-order resolution, `generateGroupExplanations` single-group unit test

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 3-3 → in-progress → done
- `docs/implementation-artifacts/3-3-per-group-batched-generation.md` — this story (record filled, status → done)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 3.3 drafted via create-story (ultimate context engine). Status → in-progress. |
| 2026-06-14 | Story 3.3 implemented (TDD): split `generateExplanations` into one `generateObject` batch per non-empty Metric Group (≤6), run with `Promise.allSettled` (a single failing group degrades gracefully), merged deterministically in Group-then-metric order; extracted `generateGroupExplanations`; coaching stays in the holistic `generateNarrative` call. Orchestrator signature unchanged. 41 files / 412 tests green; substrate e2e verified. Status → review. |
| 2026-06-14 | Code review (3 parallel layers) → UNANIMOUS 0 source patches [Acceptance Auditor all ACs MET 4/0/0 + "coaching as its own call" interpretation faithful; Edge Case Hunter 0/0/0 (all boundaries validated); Blind Hunter 0-patch]. Actioned 2 convergent non-blocking coverage tests (all-groups-fail → empty map no-throw; empty-analysis → no call). 414 tests green; typecheck/lint/build clean. Status → done. |
