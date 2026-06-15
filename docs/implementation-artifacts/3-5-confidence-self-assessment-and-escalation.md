---
epic: 3
story: 5
title: Confidence self-assessment and escalation
baseline_commit: 130c4a5
---

# Story 3.5: Confidence self-assessment and escalation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the tool to rate its own confidence,
so that I know when to trust the narrative or escalate.

## Acceptance Criteria

1. **A `high`/`medium`/`low` rating computed from the three FR-10 signals (AC1).** **Given** a completed narration and grounding pass, **when** confidence is computed, **then** the run yields exactly one of `high`/`medium`/`low`, computed **deterministically** from (a) the **verification pass rate** (the Story-3.4 grounding report: grounded ÷ total numeric claims), (b) the **share of `not_available` metrics** (availability = computed ÷ total metrics), and (c) a **provider/runtime signal** (explanation **coverage** = metrics that received an explanation ÷ total metrics — a failed per-group batch or an incomplete model response lowers it); the rating is carried in the Report JSON `narrative` subtree (`narrative.confidence`), with a human-readable rationale naming the signals.

2. **Low confidence explicitly names the escalation (AC2).** **Given** the rating is `low`, **when** the output is produced, **then** the confidence carries an **escalation** message that **explicitly recommends re-running with a stronger provider** and **names which config to change** — the `COMMIT_WHISPER_PROVIDER` and `COMMIT_WHISPER_LLM_MODEL` env vars (and the current provider/model) — so the user knows the concrete next step; a `high`/`medium` rating carries **no** escalation (it is absent, not empty).

3. **Low confidence is surfaced, never silently confident (AC3).** **Given** the rating is `low`, **when** the narrated showpiece is rendered, **then** the confidence level **and** its escalation are shown **prominently** (a labeled, visible band) so the narrative never reads as confident-sounding output without the caveat; a `high`/`medium` rating still shows its level (UX-DR9 — surfaced in the terminal). The `analysis` subtree stays byte-stable (confidence lives only under `narrative`), and confidence is a quality signal — it does **not** change the exit code (a low-confidence narrated run is still a clean showpiece, exit 0).

## Tasks / Subtasks

- [ ] **Task 1 — The confidence schema (AC1, AC2) [src/narrate/schema.ts].**
  - [ ] `CONFIDENCE_LEVELS = ["high", "medium", "low"] as const`; `ConfidenceLevel` type.
  - [ ] `ConfidenceSchema = z.object({ level: z.enum(CONFIDENCE_LEVELS), rationale: z.string().min(1), escalation: z.string().min(1).optional() })`; type `Confidence`. The `escalation` is present **iff** `level === "low"` (the producer's invariant; the schema allows it optional).
  - [ ] Extend `FullNarrativeSchema` with `confidence: ConfidenceSchema.optional()` (consistent with the optional `explanations` map — a narrated run always sets it, but the read-back shape predates it). `Narrative` now structurally carries `confidence?`.

- [ ] **Task 2 — The pure confidence assessor (AC1, AC2) [src/narrate/confidence.ts] (new).**
  - [ ] `assessConfidence(input): Confidence`, `input = { grounding: GroundingReport; analysis: Analysis; explanations?: MetricExplanations; provider?: Provider; llmModel?: string }` — **pure** (no clock/I/O/LLM/random).
  - [ ] Sub-scores in `[0,1]`: `passRate = grounding.totalClaims === 0 ? 1 : (totalClaims - ungroundedClaims) / totalClaims`; `availability = totalMetrics === 0 ? 1 : computedCount / totalMetrics`; `coverage = totalMetrics === 0 ? 1 : explainedCount / totalMetrics` (explained = `explanations` has the metric's id).
  - [ ] Level (documented `[ASSUMPTION]` thresholds, named constants): **`low`** when `passRate < LOW_PASS_RATE (0.5)` **or** `coverage < LOW_COVERAGE (0.5)` (strong failure signals — many fabrications, or half the metrics unexplained); **`high`** when not-low **and** `passRate ≥ HIGH_PASS_RATE (0.9)` **and** `coverage ≥ HIGH_COVERAGE (0.9)` **and** `availability ≥ MIN_AVAILABILITY_FOR_HIGH (0.5)` (the `not_available` share **gates** `high` — you cannot be highly confident when most metrics could not be computed); **`medium`** otherwise.
  - [ ] `rationale`: a non-empty human string naming the three signals as rounded percentages (e.g. "Grounding 100%, explanation coverage 92%, 31% of metrics not available.").
  - [ ] `escalation` (only when `low`): `buildEscalation(provider, llmModel)` — "Confidence is low — re-run with a stronger model. Set `COMMIT_WHISPER_PROVIDER` and `COMMIT_WHISPER_LLM_MODEL` (currently `{provider}`/`{model}`) to a more capable provider/model." Names the exact config to change (AC2). Exported for direct test.

- [ ] **Task 3 — Compute + carry confidence in the orchestrator (AC1, AC3) [src/narrate/narrate.ts].** After grounding, `const confidence = assessConfidence({ grounding: grounded.report, analysis, explanations: grounded.narrative.explanations, provider: config.provider, llmModel: config.llmModel })`; return `{ kind: "narrated", narrative: { ...grounded.narrative, confidence } }`. Inside the existing fail-open try; no outcome-kind change. (The grounding report — unconsumed since 3.4 — is now consumed here.)

- [ ] **Task 4 — Source the confidence schema in the Report read-back (AC1) [src/assemble/report-schema.ts].** Import `ConfidenceSchema` from `narrate/schema.js`; add `confidence: ConfidenceSchema.strict().optional()` to the Report `NarrativeSchema` (the strict read-back boundary — rejects an unknown key inside `confidence`). No other report change (`assembleReport` `structuredClone`s the narrative verbatim, so confidence flows through).

- [ ] **Task 5 — Render the confidence band in the showpiece (AC3) [src/render/terminal/terminal-renderer.ts].** In `renderShowpiece`, after the heading, render a labeled band when `narrative.confidence` is present: `Confidence: HIGH|MEDIUM|LOW` (color-coded — high green, medium yellow, low bold-red) + the rationale; when `low`, the escalation on its own line. Absent confidence ⇒ no band (back-compat; render stays pure, `Report` in → string out). Substrate path unchanged (no narrative ⇒ no confidence).

- [ ] **Task 6 — Tests (AC1, AC2, AC3).**
  - [ ] **`confidence.test.ts` (pure, exhaustive):** all-grounded + full coverage + high availability → **high**, no escalation; many ungrounded (passRate < 0.5) → **low** + escalation; low coverage (< 0.5) → **low**; the **availability gate** (perfect pass + coverage but > 50% `not_available`) → **not high** (medium); a borderline case → **medium**; escalation **only** when low and **names** `COMMIT_WHISPER_PROVIDER`/`COMMIT_WHISPER_LLM_MODEL` + the current provider/model; rationale always non-empty; edge cases (zero claims → passRate 1; zero metrics → coverage/availability 1); determinism (two runs identical).
  - [ ] **`narrate.test.ts`:** the `narrated` outcome carries `narrative.confidence` (level + rationale); a controlled analysis/grounding that yields `low` carries an escalation; off/degraded/required branches unchanged.
  - [ ] **`terminal-renderer.test.ts`:** the showpiece renders `Confidence` + the level; a `low` fixture renders the escalation text; a narrative **without** confidence still renders (no band, no crash). Substrate tests unchanged.
  - [ ] **`report-schema.test.ts` / `report.test.ts`:** a narrative with `confidence` parses + round-trips (`assembleReport` → `parseReport`); read-back **rejects** an unknown key inside `confidence` (strict); a `narrative.confidence` survives `structuredClone` verbatim.

## Dev Notes

### Review Findings

**Code review — 2026-06-14** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The spec-aware Acceptance Auditor cleared all 3 ACs MET (0 patches, 0 consider)** — verifying all three FR-10 signals genuinely move the needle **independently** (pass rate alone → low; coverage alone → low; availability gates `high` but never forces `low`), the escalation names the exact config and fires only when low, the band is rendered prominently, the `analysis` subtree + exit code are untouched, and `schemaVersion` stays 1.0.0. Triage: **1 patch (convergent Blind Hunter + Edge Case) · 2 actioned boundary tests · ~4 dismissed.**

**Patch:**

- [x] [Review][Patch] The read-back schema did **not enforce the “escalation present iff low” invariant** — the producer (`assessConfidence`) is correct, but a hand-edited/malformed Report JSON could read back `{ level: "high", escalation: "…" }` (or a `low` with no escalation), and the renderer would surface an escalation on a non-low [src/assemble/report-schema.ts] — **Fixed:** the read-back `confidence` now carries a `.refine()` enforcing `(level === "low") === (escalation !== undefined)` (bidirectional — low requires escalation, non-low forbids it) at the strict trust boundary. Added a read-back test (low-without / non-low-with → rejected; low-with / high-without → accepted). *(Blind Hunter Patch + Edge Case Hunter Consider — same invariant.)*

**Actioned (non-blocking coverage — both reviewers):**

- [x] Added the two **exact-threshold** boundary tests (passRate === 0.5 and coverage === 0.5 → `medium`, proving the strict `<` so an operator flip to `<=` would fail).

**Dismissed:**
- **Edge Case Hunter — “HIGH with 50% not available is misleading”** (Consider): the thresholds are documented `[ASSUMPTION]` named constants explicitly deferred to “calibration against real model output later,” and it is **not silent** — the rationale states “50% of metrics not available” alongside the level. Re-tuning `MIN_AVAILABILITY_FOR_HIGH` now would be premature.
- **Edge Case Hunter — “no numeric claims → passRate 1 → can be high”**: by design — a number-free narrative has no figures to fabricate; the qualitative prose is governed by the 3.1/3.2 prompt constraints, and coverage/availability still gate `high`. Both reviewers deemed it “acceptable per design.”
- **Blind Hunter — emoji `⚠` under `color: false`**: already proven — the low-confidence render test runs with `{ color: false }` and asserts the `⚠` line; the emoji is a Unicode char, not an ANSI code.
- **Blind Hunter — narrate.test rationale-completeness** (Nit): the dedicated `confidence.test.ts` exhaustively asserts the rationale percentages; the integration test rightly asserts only the level + escalation seam.

### What FR-10 requires (canonical — do not re-derive)

[Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-10, epics.md#FR-10, #UX-DR9]

- **Each run yields a Confidence self-assessment surfaced as one of `high`/`medium`/`low`.**
- **Computed from:** (1) verification pass rate, (2) share of `not_available` metrics, (3) provider/runtime warning signals.
- **When low:** the output **explicitly recommends re-running with a stronger LLM provider, and names how (which config to change)**.
- **Low confidence never silently degrades into a confident-sounding but unreliable Narrative** (NFR-7: "a confidently wrong Narrative is the worst outcome and is designed against").
- **UX-DR9:** surface `high`/`medium`/`low` in **terminal + rendered report**; when low, name the concrete escalation.

### Architecture decision — a deterministic quality rating in the narrative subtree (read first)

- **Computed deterministically, not LLM-generated.** Confidence is a *self-assessment of the run*, derived from measurable signals — the architecture pairs it with grounding: *"unreferenced claims fail the confidence check and trigger the FR-10 low-confidence escalation. Cheaper, reproducible, cannot itself hallucinate."* So `assessConfidence` is a **pure function** of the grounding report + the analysis + a coverage signal — never a second model call. [Source: architecture.md#Grounding → FR-10]
- **The three signals, concretely.** (1) **Pass rate** = the Story-3.4 grounding report `(total − ungrounded) / total` — the seam 3.4 produced and left unconsumed; 3.5 consumes it. (2) **`not_available` share** = `computed / total` metrics (availability) — a tiny/young repo with many uncomputable metrics is inherently less certain, so availability **gates `high`** (it cannot force `low` on its own — a perfectly grounded narrative over a small computable set is still trustworthy *as far as it goes*). (3) **Provider/runtime signal** = explanation **coverage** (metrics that actually received an explanation): a failed per-group batch (Story 3.3 graceful degradation) or an incomplete model response (Story 3.2) lowers coverage — exactly the architecture's "a small local model produced weak or generic output" runtime signal. [Source: prd.md#FR-10, src/narrate/grounding.ts, src/narrate/generate.ts]
- **Why coverage (not the provider name) is the runtime signal.** Judging confidence by provider identity ("ollama is weak") is unfair and brittle — a good local model would be wrongly penalized. The honest, deterministic signal is the **output**: did generation actually explain every metric and stay grounded? The provider/model name is used only in the **escalation text** (naming the config to change), not in the score. [Source: prd.md#FR-10 "weak or generic output", architecture.md]
- **Carried under `narrative`, rendered, never an exit-code change.** Confidence is AI-layer output → it lives in the Report JSON `narrative` subtree (`narrative.confidence`), leaving `analysis` byte-stable. A **low** rating is still a successful narrated run (a showpiece, exit 0) — it is a *quality signal*, not a failure; the protection against "confidently wrong" is **visibility** (a prominent rendered band + escalation), per UX-DR9 / UX-DR12 (low confidence is a render *state treatment*, not an error). [Source: architecture.md#Canonical Report JSON, epics.md#UX-DR9, #UX-DR12]

### Scope discipline — what this story does and does NOT include

**In scope:** the deterministic `assessConfidence` (the three signals → `high`/`medium`/`low` + rationale + low-only escalation), the `ConfidenceSchema` carried in `narrative.confidence` (read-back strict), wiring it into `createNarrate` (consuming the 3.4 grounding report), and rendering the confidence band in the **terminal** showpiece.

**Out of scope / deferred (do NOT build here):**
- **Rendering confidence in the HTML / Markdown report** — **Epic 4** (the rich report). 3.5 carries it in the Report JSON (the source of truth) + the terminal band; HTML/MD surface it later. [Source: epics.md#Epic 4, #UX-DR9 "terminal + rendered report"]
- **Full BYOK provider breadth** — **Story 3.6** (gemini-only slice holds; the escalation text names the generic `COMMIT_WHISPER_PROVIDER`/`COMMIT_WHISPER_LLM_MODEL`, not a specific stronger provider — provider-specific recommendations can refine once 3.6 lands). [Source: epics.md#Story 3.6]
- **Changing the exit code for low confidence** — low confidence is **success** (a narrated showpiece, exit 0), not a degraded/error state (degraded = narrative absent, exit 9). Confidence never touches `exit-codes.ts`. [Source: src/cli/exit-codes.ts, prd.md#FR-11 fail-open]
- **A run-summary block / saved-path naming (UX-DR5)** — Epic 6 (interactive/operational chrome). 3.5 renders the confidence band in the showpiece; the broader run-summary is later. [Source: epics.md#UX-DR5]
- **Rewriting the narrative prose when confidence is low** — not deterministic/feasible; the protection is the visible band + escalation, not prose surgery (the grounding pass already removed unsupported claims in 3.4). [Source: prd.md#FR-9, #FR-10]
- **Tuning the threshold constants from real runs** — the `[ASSUMPTION]` thresholds (0.5 / 0.9 / 0.5) are documented, named constants; calibration against real model output is a later refinement behind the same `assessConfidence`. [Source: this story]

### The exact contracts to build on (do NOT redefine)

- **`GroundingReport` (3.4):** `{ totalClaims: number; ungroundedClaims: number }` — returned by `groundNarrative`, currently unconsumed in `createNarrate`. 3.5 reads it for the pass rate. [Source: src/narrate/grounding.ts]
- **`Narrative` / `MetricExplanations` (3.1–3.2):** the grounded narrative + the keyed explanation map (coverage source). `confidence?` extends the same `FullNarrativeSchema`; `Narrative` stays structurally equal to the report's `ReportNarrative`. [Source: src/narrate/schema.ts]
- **`Analysis` / `Metric` (1.5):** `{ metrics: Metric[] }`, `status: "computed" | "not_available"` — the availability source. [Source: src/analyze/metric.ts]
- **`NarrateConfig` (1.6):** carries `provider?` + `llmModel?` — the escalation names them. [Source: src/narrate/narrate.port.ts]
- **`createNarrate` orchestrator (3.1–3.4):** `off → skipped`; success → `narrated`; `auto`+fail → `degraded`; `required`+fail → throw. 3.5 inserts `assessConfidence` after grounding, inside the try; no outcome-kind change. [Source: src/narrate/narrate.ts]
- **Report read-back (`report-schema.ts`, `.strict()`):** the confidence-carrying narrative must still parse; `ConfidenceSchema.strict()` at read-back. The showpiece renderer reads `report.narrative.confidence`. [Source: src/assemble/report-schema.ts, src/render/terminal/terminal-renderer.ts]
- **`COMMIT_WHISPER_PROVIDER` / `COMMIT_WHISPER_LLM_MODEL` (1.2):** the exact env-var names the escalation cites. [Source: src/config/env.ts, src/config/sources.ts]

### Determinism & fail-open posture (unchanged)

- **Fully deterministic, no LLM/clock/I/O.** `assessConfidence` is a pure function of `(grounding, analysis, explanations, provider, llmModel)` — reproducible, no `Date`/`Math.random`, no `Map`/`Set` in the emitted value. `analysis` stays byte-stable (confidence lives only under `narrative`); the determinism harness never narrates. [Source: architecture.md#Grounding → FR-10, C2]
- **Fail-open preserved:** confidence runs inside `createNarrate`'s try; a (defensive) throw degrades (`auto`) / throws (`required`). In practice the pure assessor always yields a valid `Confidence`. [Source: src/narrate/narrate.ts]
- **No new dependencies.** Pure TS + zod (the enum schema). gemini-only slice holds.

### Previous-story intelligence

- **3.4 built the seam.** `groundNarrative` already returns `{ narrative, report }` and 3.4 deliberately left `report` unconsumed "for Story 3.5"; 3.5 only reads it — no grounding change. [Source: src/narrate/grounding.ts, 3-4 story]
- **Optional-in-schema, always-produced (the 3.2 `explanations` pattern):** `confidence?` is optional in the read-back schema (so the existing NARRATIVE fixtures — none carry confidence — keep passing), but `createNarrate` always sets it on a narrated run. Only the new narrate/render/report tests add it. The renderer guards `if (confidence !== undefined)` for back-compat. [Source: 3-2 story, src/render/terminal/terminal-renderer.ts]
- **Coverage uses the post-grounding explanations.** Grounding (3.4) can empty a facet but never drops a metric's explanation **key** (it placeholders the meaning), so coverage = explained ids ÷ metrics is unaffected by grounding — it reflects what **generation** produced (the runtime signal). [Source: src/narrate/grounding.ts]
- **Availability gates `high`, never forces `low`:** the 2.x lesson that a "silently wrong" downgrade is worse than a fair one — a tiny repo with a perfectly grounded narrative over its computable metrics is honestly `medium`, not `low`. [Source: 2-6 review philosophy]

### Project Structure Notes

- New file: `src/narrate/confidence.ts` (+ `confidence.test.ts`). Modified: `src/narrate/schema.ts` (the `ConfidenceSchema`), `src/narrate/narrate.ts` (compute + carry), `src/assemble/report-schema.ts` (read-back), `src/render/terminal/terminal-renderer.ts` (the band), + their tests. **No** engine/model/metric/select/config/generate/grounding change; the `analysis` subtree and determinism harness are untouched. [Source: architecture.md#Complete Project Directory Structure]
- `confidence.ts` is a new pure module in `narrate/` (the natural home — it consumes the grounding report + analysis at the narrate boundary). Flag the addition in Completion Notes.

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.5: Confidence self-assessment and escalation] (the ACs) · [Source: …#FR-10] · [Source: …#UX-DR9] (surface in terminal + report; name escalation) · [Source: …#NFR-7] (confidently-wrong is the worst outcome)
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-10] (the three signals; explicit escalation naming the config; never silently confident)
- [Source: docs/planning-artifacts/architecture.md#Grounding (FR-9) → FR-10 low-confidence escalation] (deterministic, reproducible, cannot itself hallucinate) · [Source: …#Canonical Report JSON] (confidence under `narrative`)
- [Source: src/narrate/grounding.ts] (the `GroundingReport` seam) · [Source: src/narrate/narrate.ts] (the orchestrator) · [Source: src/narrate/schema.ts] (the narrative shape) · [Source: src/assemble/report-schema.ts] (read-back) · [Source: src/render/terminal/terminal-renderer.ts] (the showpiece) · [Source: src/config/env.ts] (`COMMIT_WHISPER_PROVIDER`/`COMMIT_WHISPER_LLM_MODEL`)

### Completion Notes

- **All three ACs satisfied.** AC1: `assessConfidence` is a **pure, deterministic, no-LLM/no-clock/no-I/O** function yielding `high`/`medium`/`low` from the three FR-10 signals — (a) the Story-3.4 **grounding pass rate**, (b) the **`not_available` share** (availability, which **gates `high`** but never forces `low`), and (c) the **runtime coverage** signal (metrics that received an explanation — a failed 3.3 batch / incomplete 3.2 response lowers it). Each signal moves the needle independently (the Auditor verified this with three separate tests). Carried under `narrative.confidence` with a rationale naming all three. AC2: a `low` rating carries an **escalation** that recommends a stronger model and **names `COMMIT_WHISPER_PROVIDER`/`COMMIT_WHISPER_LLM_MODEL`** (+ the current provider/model); present **iff** low (now enforced bidirectionally at read-back). AC3: the showpiece renders a **prominent, color-coded confidence band** right after the heading, with the escalation on its own `⚠` line when low — so a low-confidence narrative is never silently confident; the `analysis` subtree stays byte-stable and the **exit code is unchanged** (a low-confidence run is a clean showpiece, exit 0).
- **Coverage as the runtime signal (not provider identity).** Judging confidence by provider name (“ollama is weak”) would be unfair/brittle; the honest deterministic signal is the **output** — did generation actually explain every metric and stay grounded? The provider/model name is used only in the **escalation text**.
- **Consumes the 3.4 seam.** The grounding report (`{ totalClaims, ungroundedClaims }`), left unconsumed in 3.4, is now read for the pass rate. No grounding change.
- **Optional-in-schema, always-produced (the 3.2 pattern).** `confidence?` is optional in the read-back schema (existing NARRATIVE fixtures keep passing; the renderer guards `undefined`), but `createNarrate` always sets it on a narrated run. The read-back `.refine()` enforces the escalation-iff-low invariant at the trust boundary.
- **449 tests** (+18, +1 file); typecheck / lint / build clean. Substrate (`--no-ai`) path verified unchanged — no confidence band (it is a narrative-only feature).
- **New module flagged:** `src/narrate/confidence.ts` (pure, at the narrate boundary, consuming the grounding report + analysis). **No** engine/model/metric/select/config/generate/grounding change; the `analysis` subtree and determinism harness are untouched. **No new dependencies.** gemini-only slice holds.

### File List

**Added (source):**
- `src/narrate/confidence.ts` — the pure `assessConfidence` + `buildEscalation` + the threshold constants

**Added (tests, co-located):**
- `src/narrate/confidence.test.ts` — the four buckets (incl. the availability gate → medium), exact thresholds, escalation presence/absence + config naming, edge cases (zero claims/metrics), determinism

**Modified (source):**
- `src/narrate/schema.ts` — `CONFIDENCE_LEVELS`/`ConfidenceLevel`/`ConfidenceSchema`/`Confidence`; `FullNarrativeSchema` gains `confidence?`
- `src/narrate/narrate.port.ts` — re-export `Confidence`/`ConfidenceLevel`
- `src/narrate/narrate.ts` — compute + carry `confidence` after grounding (consume the grounding report)
- `src/assemble/report-schema.ts` — read-back `confidence` (`.strict()` + the escalation-iff-low `.refine()`)
- `src/render/terminal/terminal-renderer.ts` — the prominent confidence band (color-coded level + rationale + low-only `⚠` escalation)

**Modified (tests):**
- `src/narrate/narrate.test.ts` — the narrated outcome carries `confidence` (high happy-path; low + escalation when generation fabricates)
- `src/render/terminal/terminal-renderer.test.ts` — the band (high; low + escalation; absent → no band)
- `src/assemble/report-schema.test.ts` — confidence accepted; bad level / unknown key / escalation-iff-low rejected
- `src/assemble/report.test.ts` — confidence carried verbatim + round-trips

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 3-5 → in-progress → done
- `docs/implementation-artifacts/3-5-confidence-self-assessment-and-escalation.md` — this story (record filled, status → done)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 3.5 drafted via create-story (ultimate context engine). Status → in-progress. |
| 2026-06-14 | Story 3.5 implemented (TDD): a pure `assessConfidence` yielding high/medium/low from the grounding pass rate + `not_available` share (gates high) + explanation coverage (runtime signal); a low-only escalation naming `COMMIT_WHISPER_PROVIDER`/`COMMIT_WHISPER_LLM_MODEL`; carried under `narrative.confidence` (read-back strict) and rendered as a prominent terminal band; consumes the 3.4 grounding report. No exit-code/analysis change. 43 files / 447 tests green; substrate e2e verified. Status → review. |
| 2026-06-14 | Code review (3 parallel layers) → Acceptance Auditor all 3 ACs MET 0-patch (all 3 signals independent, no scope creep). 1 patch (convergent Blind Hunter + Edge Case): enforce the escalation-iff-low invariant at the read-back boundary via `.refine()`; +1 read-back test, +2 exact-threshold boundary tests. 449 tests green; typecheck/lint/build clean. Status → done. |
