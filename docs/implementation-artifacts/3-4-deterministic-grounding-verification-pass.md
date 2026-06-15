---
epic: 3
story: 4
title: Deterministic grounding verification pass
baseline_commit: 8b67ac2
---

# Story 3.4: Deterministic grounding verification pass

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want every factual claim checked against the metrics,
so that the narrative never invents history.

## Acceptance Criteria

1. **Deterministic check, no second LLM call (AC1).** **Given** the generated narrative and explanations, **when** the grounding pass runs, **then** it is a **purely deterministic** check (no second LLM call, no clock, no I/O) that verifies every **numeric/factual claim** in the prose traces to a value present in the Report JSON `analysis` — a numeric token in the narrative is **grounded** iff that number appears among the analysis's metric values (the catalog is the ground truth); the pass is reproducible and cannot itself hallucinate.

2. **Unsupported claims removed before render (AC2).** **Given** an **ungrounded** numeric claim (a number that appears nowhere in the metrics), **when** the pass runs, **then** the claim is **removed** (the sentence/bullet carrying it is dropped) **before** the narrative is assembled/rendered — so a fabricated figure never reaches the report; a claim whose number **is** present in the metrics is **kept verbatim** (the pass is conservative — it never removes a grounded claim).

3. **Where metrics are insufficient, the narrative says so — never fabricates (AC3).** **Given** removal empties a field that must stay non-empty (the narrative/coaching/explanation schema's `.min(1)` parts), **when** the grounded narrative is built, **then** that field is filled with an **honest placeholder** stating the metrics do not support a specific claim (rather than left blank or back-filled with invention), and the grounded narrative still satisfies the Report read-back schema; the pass also yields a **grounding report** (total vs. ungrounded claim counts) that Story 3.5 consumes for confidence.

## Tasks / Subtasks

- [ ] **Task 1 — The pure grounding module (AC1, AC2, AC3) [src/narrate/grounding.ts] (new).**
  - [ ] `collectGroundedNumbers(analysis): Set<number>` — recursively walk every metric envelope (value + `id`/`title`/`reason` strings); for each **number** add `n` and its `round`/`floor`/`ceil`; for each **string/key** extract numeric tokens (`/\d+(?:\.\d+)?/g`, commas stripped) and add each parsed number + rounded forms. A **generous** ground-truth set (date buckets like `"2024-01"` → `2024`, `1`; shares; counts) so the pass only flags numbers truly absent — minimizing false-positive removals.
  - [ ] `extractNumericTokens(text): number[]` — pull number-like tokens from prose (`\d[\d,]*(?:\.\d+)?`, commas stripped, `%`/ordinals ignored as suffix); parse to numbers.
  - [ ] `isGrounded(n, set): boolean` — `set.has(n) || set.has(round/floor/ceil(n))` (doubly generous against rounding drift, e.g. a `62.5` share rendered as `62%`/`63%`).
  - [ ] `groundProse(text, set, counter): string` — split into sentences (`/(?<=[.!?])\s+/`); count every numeric token (into `counter.total`); a sentence containing **any** ungrounded token is **dropped** (its tokens added to `counter.ungrounded`); rejoin the kept sentences. (For multi-sentence strings + paragraphs — precise, doesn't nuke a whole paragraph for one bad figure.)
  - [ ] `groundBullets(items, set, counter): string[]` — entry-level: drop a bullet/step that contains any ungrounded token (short single-claim entries); count tokens.
  - [ ] `groundNarrative(narrative, analysis): GroundingResult` — the orchestrating walk over **every** prose field: `summary.{headline,overview}` (prose) + `summary.keyFindings` (bullets); `explanation.paragraphs` (prose per paragraph, drop emptied, **placeholder if all removed** — `.min(1)`); `coaching.{introduction,closingSummary}` (prose, **placeholder if emptied** — `.min(1)`), each `chapter.theme` (prose, placeholder if emptied) + `chapter.steps` (bullets; **drop a chapter whose steps all removed**; **placeholder chapter if all chapters removed** — `.min(1)`); each `explanations[id]` facet — `explanation` (prose, placeholder if emptied — `.min(1)`) + `goodBehaviours`/`needsImprovement`/`suggestions` (bullets; may legitimately empty). Returns `GroundingResult = { narrative: Narrative; report: GroundingReport }`, `GroundingReport = { totalClaims: number; ungroundedClaims: number }`. **Pure** — a local mutable counter, no module/global state, no clock.
  - [ ] `GROUNDING_PLACEHOLDER` (+ `GROUNDING_PLACEHOLDER_THEME`) — the honest "the available metrics do not support a specific claim here" text (AC3 "says so rather than fabricating"). `.min(1)`-safe (non-empty).

- [ ] **Task 2 — Wire the pass into the orchestrator (AC1, AC2) [src/narrate/narrate.ts].** After composing `{ ...parts, explanations }`, run `const grounded = groundNarrative(rawNarrative, analysis)` and return `{ kind: "narrated", narrative: grounded.narrative }` — so the **grounded** narrative (unsupported claims removed, placeholders inserted) is what reaches assemble/render. The pass sits **inside** the existing try (fail-open: a thrown grounding error → degrade in `auto` / throw in `required`, per the architecture's "grounding is fail-open"). `grounded.report` is computed here for Story 3.5 (confidence) — left unconsumed in 3.4 (no schema/outcome change). Update the comment that says grounding is "3.4" to "implemented here."

- [ ] **Task 3 — Tests (AC1, AC2, AC3) [src/narrate/grounding.test.ts + narrate.test.ts].**
  - [ ] **`collectGroundedNumbers`:** collects nested value numbers (objects/arrays), rounded forms, and integers embedded in date-bucket keys/strings; a number absent everywhere is not in the set.
  - [ ] **`groundNarrative` — keeps grounded, removes ungrounded (AC1, AC2):** a narrative whose prose cites a number **present** in the metrics is returned **verbatim** (conservative — no removal); a narrative citing a **fabricated** number (absent everywhere) has that sentence/bullet **removed**; a sentence mixing a grounded + an ungrounded number is dropped (the ungrounded one taints it). Determinism: two runs byte-identical; key order preserved.
  - [ ] **Rounding tolerance:** a metric share `62.5` grounds a prose `"62%"` and `"63%"` (round/floor/ceil) — no false-positive removal.
  - [ ] **Placeholders (AC3):** removing the only paragraph → `explanation.paragraphs` is `[PLACEHOLDER]` (not empty); emptying `coaching.introduction`/`closingSummary`/a chapter's only step / all chapters → the honest placeholder, and the grounded narrative **still parses** `ReportSchema`/`NarrativeSchema` (read-back). A facet array (`goodBehaviours`) may legitimately empty (no placeholder forced).
  - [ ] **Grounding report:** `report.totalClaims` counts every numeric token; `report.ungroundedClaims` counts the fabricated ones; an all-grounded narrative → `ungroundedClaims === 0`.
  - [ ] **`narrate.test.ts` (integration):** `createNarrate` with injected `generate`/`generateExplanations` returning a narrative containing a fabricated number over a controlled `analysis` → the `narrated` outcome's narrative has the fabricated claim **removed** (proves the orchestrator applies grounding before returning); the off/degraded/required branches are unchanged.

## Dev Notes

### Review Findings

**Code review — 2026-06-14** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The spec-aware Acceptance Auditor cleared all 3 ACs MET (0 patches)** — explicitly endorsing the numeric-grounding interpretation as "defensible and intended" (a deterministic no-LLM check can only verify falsifiable digit claims; qualitative prose is governed by the 3.1/3.2 prompt constraints), confirming conservative keep + removal-before-render + honest placeholders + strict read-back validity, and finding no scope creep. The **Blind Hunter cleared the core logic 0-patch** (verified the set construction, sentence split, rounding symmetry, counter, fail-open wiring). The Edge Case Hunter found a real, coherent **false-positive class**. Triage: **1 patch (the false-positive class) · 3 actioned coverage tests · ~4 dismissed.**

**Patch:**

- [x] [Review][Patch] **Multi-component numbers caused false-positive removals** — a date (`2024-01-15`), time (`10:30`), version (`v2.3.5`), or range (`3-5`) was split into components, and an ungrounded component (e.g. the `15`) removed an otherwise-valid sentence; a negative metric (`-5`) also mis-grounded a sign-stripped prose `5` [src/narrate/grounding.ts] — **Fixed (the whole class):** the ground-truth set keeps the **generous** `SET_NUMBER_TOKEN` (over-collect), but **prose extraction** now uses a **conservative** `CLAIM_NUMBER_TOKEN` with boundary lookarounds — a numeric token is a claim **only** when standalone, NOT when glued to another digit by `- : / .` (date/time/version/range), while a hyphen-compound like `999-contributor` (dash not followed by a digit) **is** still flagged; the token also stays maximal (no backtracking into a partial number like `2024`→`202`). `addNumber` also collects `Math.abs(n)` so a negative metric grounds a sign-stripped prose number. Both directions strictly **reduce** false positives (the stated design priority). Added 6 tests (date/time/version/range skipped, hyphen-compound flagged, negative grounded, a valid-date sentence kept).

**Actioned (non-blocking coverage):**

- [x] Added a `groundNarrative` test for the **`explanations === undefined`** three-part-only branch (Blind Hunter nit).

**Dismissed:**
- **Edge Case Hunter — scientific notation `1e3` false-negative**: a fabricated figure written as `1e3` survives. Near-impossible in LLM narrative prose (models write `1,000`/`1000`), and the conservative design explicitly tolerates false negatives over false positives. Not worth the regex risk.
- **Edge Case Hunter — double-space `join(" ")` normalization** (nit): collapsing `"First.  Second."` → single space is correct sentence spacing, not a defect.
- **Acceptance Auditor / Edge Case — abbreviation sentence-splitting** (`"e.g. 999"`): LLM prose rarely opens a sentence with an abbreviation; a mis-split would at worst drop a clause, never fabricate. Deferred as a low-value heuristic.
- **Blind Hunter — grounding `report` computed-but-unconsumed**: intentional — the report (claim counts) is the seam Story 3.5 reads for the confidence verification-pass-rate; surfacing it is a 3.5 schema/outcome concern, not 3.4's.

### Architecture decision — a conservative, number-anchored deterministic check (read first)

The authoritative design is explicit: **"Grounding (FR-9): deterministic post-generation check, not a second LLM call. Every numeric/fact claim must reference a metric `id` present in the assembled model; unreferenced claims fail the confidence check and trigger the FR-10 low-confidence escalation. Cheaper, reproducible, cannot itself hallucinate."** And FR-9: *"prompt constraints **and** a post-generation verification pass against Report JSON; unsupported factual claims are removed or rewritten before render; where the Metrics are insufficient … the Narrative says so instead of fabricating."* [Source: architecture.md#Grounding, prd.md#FR-9]

- **Numbers are the verifiable claims.** A deterministic, no-LLM check cannot judge qualitative prose ("ownership is concentrated") — that's interpretation the **prompt constraints** (3.1/3.2) already govern. What it **can** check reproducibly is **numeric/factual claims**: a figure in the prose ("62% of commits", "3 contributors", "since 2021") is grounded **iff that number is present in the analysis** (the catalog is the ground truth). This is the concrete, testable reading of "every numeric claim must reference a metric present in the Report JSON." [Source: prd.md#FR-9, architecture.md#Grounding]
- **Conservative by construction — false positives are the real risk.** Wrongly removing a *valid* claim is worse than missing a borderline one. So the ground-truth number set is **generous** (every number anywhere in the metric envelopes + rounded forms + integers inside date-bucket strings/keys), and a prose number matches on exact **or** rounded forms. The pass therefore removes **only** numbers that appear **nowhere** in the metrics — unambiguous fabrications. Spelled-out numbers ("one", "first") are not digit-tokens and are left untouched (conservative). [Source: architecture.md#Grounding "cannot itself hallucinate"]
- **Remove (not rewrite) — the safe deterministic action.** "Removed **or** rewritten" — removal is the faithful, non-fabricating choice: drop the sentence/bullet carrying the ungrounded number. Rewriting prose deterministically is fragile and risks inventing; removal cannot. Where removal would empty a `.min(1)` field, an **honest placeholder** ("the available metrics do not support a specific claim here") is the literal "**says so** rather than fabricating" (AC3) — and keeps the grounded narrative valid against the strict Report read-back schema. [Source: prd.md#FR-9, src/assemble/report-schema.ts]
- **A pure post-generation stage, after generate, before assemble.** `groundNarrative(narrative, analysis)` is a pure function of the generated narrative + the deterministic analysis — no LLM, no clock, no I/O (AC1). It runs inside `createNarrate`'s try, so a (defensive) failure is **fail-open** like the rest of narration (degrade in `auto`, throw in `required`). It also yields a **grounding report** (claim counts) — the architecture's "unreferenced claims fail the confidence check": Story 3.5 reads that report for the verification-pass-rate signal. [Source: architecture.md#Fail-open narration, #Grounding → FR-10]

### Scope discipline — what this story does and does NOT include

**In scope:** the pure `grounding.ts` (collect grounded numbers, extract prose numbers, remove ungrounded sentences/bullets, honest placeholders on emptied `.min(1)` fields, a grounding report), wired into `createNarrate` after generation so the **grounded** narrative is assembled/rendered.

**Out of scope / deferred (do NOT build here):**
- **Confidence self-assessment + escalation** (`high`/`medium`/`low` from the verification pass rate + `not_available` share + provider signals; the "re-run with a stronger provider" advice) — **Story 3.5**. 3.4 **produces** the grounding report (claim counts) that 3.5 consumes; it does **not** compute or surface confidence, and makes **no** schema/outcome change to carry it (3.5 owns that). [Source: epics.md#Story 3.5, prd.md#FR-10]
- **LLM-based re-grounding / rewriting** — explicitly excluded: the pass is **deterministic, no second LLM call** (AC1). Removal + honest placeholder is the whole action. [Source: architecture.md#Grounding]
- **Qualitative/semantic claim checking** (judging non-numeric prose) — not deterministically checkable; governed by the generation prompt constraints (3.1/3.2). 3.4 targets numeric/factual (digit) claims. [Source: prd.md#FR-9]
- **Full BYOK provider breadth** — **Story 3.6** (gemini-only slice holds). **Rendering** changes — none; the grounded narrative flows through the existing assemble/render unchanged (Epic 4 renders the facets). [Source: epics.md#Story 3.6, #Epic 4]
- **Surfacing "N claims removed" to the user** — a confidence/UX concern (3.5 / Epic 6). 3.4 removes silently-but-honestly (placeholders where needed); the report is internal until 3.5. [Source: epics.md#Story 3.5]

### The exact contracts to build on (do NOT redefine)

- **`Narrative` (3.1/3.2):** `{ summary: { headline, overview, keyFindings[] }, explanation: { paragraphs[] }, coaching: { introduction, chapters[{ theme, steps[] }], closingSummary }, explanations?: Record<id, { explanation, goodBehaviours[], needsImprovement[], suggestions[] }> }`. The grounding pass returns the **same shape** (grounded). The schema `.min(1)` constraints (paragraphs, chapters, steps, theme/intro/closing/explanation strings) are exactly what the **placeholder** logic protects. [Source: src/narrate/schema.ts]
- **`Analysis` (1.5):** `{ metrics: Metric[] }`, each `{ id, group, title, status, value?, reason? }`; `value` is JSON (number | string | bool | null | array | object). `collectGroundedNumbers` walks it. Privacy is irrelevant here (no prompt) — grounding is local computation. [Source: src/analyze/metric.ts]
- **`createNarrate` orchestrator (3.1–3.3):** `off → skipped`; success → `narrated`; `auto`+fail → `degraded`; `required`+fail → throw `NarrationError`. 3.4 inserts `groundNarrative` between composition and the `narrated` return, **inside** the try (fail-open). No signature change; no new dep needed (the pure function is imported and the integration is proven via a fabricated-number fixture in `narrate.test`). [Source: src/narrate/narrate.ts]
- **Report read-back schema (`assemble/report-schema.ts`, `.strict()`, `.min(1)`):** the grounded narrative must still parse it — the placeholder logic guarantees non-empty required fields. A grounding test round-trips `ReportSchema`. [Source: src/assemble/report-schema.ts]

### Determinism, fail-open posture (unchanged)

- **Fully deterministic, no LLM/clock/I/O.** `groundNarrative` is a pure function of `(narrative, analysis)` — reproducible, "cannot itself hallucinate" (AC1). No `Date`, no `Math.random`, no `Map`/`Set` in the **emitted** narrative (a `Set<number>` is an internal lookup only). Stable iteration: object keys preserved, arrays filtered in order. [Source: architecture.md#Grounding, C2 determinism rules]
- **Fail-open preserved:** grounding runs inside `createNarrate`'s try; a defensive throw degrades (`auto`, exit 9) / throws `NarrationError` (`required`, exit 6) — the architecture lists grounding among the fail-open narrate steps. (In practice the pure pass does not throw; it always yields a valid grounded narrative.) [Source: src/narrate/narrate.ts, architecture.md#Fail-open]
- **No new dependencies.** Pure TS + the existing types. gemini-only slice holds.

### Previous-story intelligence

- **The 3.2 anchoring already did the id-level grounding for explanations** (drop a `metricId` not in the analysis). 3.4 is the **claim-level** numeric grounding **inside** the prose of every part + facet — complementary, not redundant. [Source: src/narrate/generate.ts buildExplanationsRecord, 3-2 story]
- **`.min(1)` everywhere is the constraint to respect.** 3.1's review patch added `.min(1)` to the narrative/coaching content strings + arrays; 3.4's removal must therefore **never** leave a required field empty → the placeholder path. A grounding test asserts the grounded narrative re-parses the strict Report schema (the same lenient-generate/strict-read-back boundary). [Source: 3-1 review patch, src/assemble/report-schema.ts]
- **Conservative number matching avoids the "share rounding" trap.** Group B/C/F emit `*SharePct` values that may be fractional (e.g. `62.5`); a model rendering `62%` or `63%` must **not** be flagged — hence exact-or-rounded matching against a set that also stores rounded metric numbers. [Source: src/analyze/groups/*.ts]
- **Pure-stage testability (2.6/3.3 lesson):** a pure function over `(narrative, analysis)` is table-testable with crafted fixtures; the orchestrator integration is proven by one fabricated-number case (the 3.3 pattern of testing the seam in isolation + one integration assertion). [Source: 3-3 tests]

### Project Structure Notes

- New file: `src/narrate/grounding.ts` (+ `grounding.test.ts`). Modified: `src/narrate/narrate.ts` (insert the pass + comment), `src/narrate/narrate.test.ts` (one integration case). **No** schema/prompt/generate change; **no** engine/model/metric/select/config/render/assemble change. The `analysis` subtree, the Report schema, and the renderer are untouched. [Source: architecture.md#Complete Project Directory Structure]
- `grounding.ts` is a new pure module in `narrate/` (the natural home — it operates on the generated narrative + the analysis, at the narrate boundary, before assemble). Flag the addition in Completion Notes (the architecture's directory map implies grounding under narration but does not name the file).

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.4: Deterministic grounding verification pass] (the ACs)
- [Source: docs/planning-artifacts/architecture.md#Grounding (FR-9): deterministic post-generation check] (no second LLM call; numeric/fact claim must reference a metric present in the model; cannot itself hallucinate; feeds FR-10) · [Source: …#Fail-open narration] (grounding is fail-open)
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-9] (prompt constraints + post-gen verification; removed or rewritten before render; says so where insufficient) · [Source: …#FR-10] (the pass rate feeds confidence — 3.5)
- [Source: src/narrate/schema.ts] (the `Narrative` shape + `.min(1)` constraints the placeholders protect) · [Source: src/narrate/narrate.ts] (the orchestrator to wire) · [Source: src/analyze/metric.ts] (`Metric`/`MetricValue` to walk) · [Source: src/assemble/report-schema.ts] (the strict read-back the grounded narrative must still satisfy)

### Completion Notes

- **All three ACs satisfied.** AC1: `groundNarrative(narrative, analysis)` is a **pure, deterministic, no-LLM/no-clock/no-I/O** post-generation check — a prose number is grounded iff it (or a rounded/abs form) appears in the analysis's metric values; run inside `createNarrate` after generation, before the narrated outcome. AC2: a sentence/bullet carrying an **ungrounded** number is **removed** before assemble/render (a grounded claim is kept **verbatim** — conservative). AC3: where removal empties a `.min(1)` field, an **honest placeholder** ("the available metrics do not support a specific claim here") is inserted — the grounded narrative still parses the strict Report read-back schema (tested).
- **Conservative by construction — false positives are the worst outcome.** The ground-truth set is generous (every number anywhere in the metric envelopes + rounded/abs forms + integers inside date-bucket strings/keys); prose extraction is conservative (standalone figures only — a date/time/version/range component glued to another digit is NOT flagged); matching is exact-or-rounded. So the pass removes **only** numbers that appear **nowhere** in the metrics. Spelled-out numbers and multi-component dates/times are left untouched.
- **Remove (not rewrite) + honest placeholder.** Removal is the faithful, non-fabricating action; the placeholder is the literal "says so rather than fabricating" and keeps required fields non-empty (schema-valid). The pass also yields a `GroundingReport` (total vs. ungrounded claim counts) — the seam Story 3.5 consumes for the confidence verification-pass-rate; 3.4 leaves it unconsumed (no schema/outcome change).
- **Grounds the explanations too.** Every per-metric facet (`explanation` meaning + the three bullet arrays) is grounded alongside the three narrative parts (FR-9 covers "every Metric Explanation"); a facet bullet array may legitimately empty (no forced placeholder), but the `.min(1)` meaning facet gets a placeholder when emptied.
- **Fail-open preserved.** The pass sits inside `createNarrate`'s try; a (defensive) throw degrades in `auto` / throws in `required` — the architecture lists grounding among the fail-open narrate steps. In practice the pure pass always yields a valid grounded narrative.
- **431 tests** (+23, +1 file); typecheck / lint / build clean. Substrate (`--no-ai`) path verified unchanged (grounding only runs on the narrated path).
- **New module flagged:** `src/narrate/grounding.ts` is a new pure module at the narrate boundary (the architecture's directory map implies grounding under narration but does not name the file). **No** schema/prompt/generate change; **no** engine/model/metric/select/config/render/assemble change. **No new dependencies.** gemini-only slice holds.

### File List

**Added (source):**
- `src/narrate/grounding.ts` — the pure deterministic grounding pass (`collectGroundedNumbers`, `extractNumericTokens`, `isGrounded`, `groundNarrative`, `GROUNDING_PLACEHOLDER`/`_THEME`, `GroundingReport`/`GroundingResult`)

**Added (tests, co-located):**
- `src/narrate/grounding.test.ts` — set construction, conservative extraction (date/time/version/range skipped, hyphen-compound flagged, negatives), keep-grounded, remove-ungrounded, placeholders + strict read-back, determinism, report counts, no-explanations branch

**Modified (source):**
- `src/narrate/narrate.ts` — run `groundNarrative` after composition, return the grounded narrative (inside the fail-open try); comment update

**Modified (tests):**
- `src/narrate/narrate.test.ts` — integration case: a fabricated numeric claim is removed before the narrated outcome is returned

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 3-4 → in-progress → done
- `docs/implementation-artifacts/3-4-deterministic-grounding-verification-pass.md` — this story (record filled, status → done)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 3.4 drafted via create-story (ultimate context engine). Status → in-progress. |
| 2026-06-14 | Story 3.4 implemented (TDD): a pure deterministic grounding pass (`grounding.ts`) that removes prose sentences/bullets whose numeric tokens are absent from the analysis's metric values, inserts honest placeholders on emptied `.min(1)` fields, and reports claim counts; wired into `createNarrate` after generation so the grounded narrative is assembled/rendered. No LLM/clock/I/O. 42 files / 426 tests green; substrate e2e verified. Status → review. |
| 2026-06-14 | Code review (3 parallel layers) → Acceptance Auditor all ACs MET 0-patch (numeric-grounding interpretation endorsed) + Blind Hunter 0-patch (core logic verified). 1 patch from the Edge Case Hunter: a multi-component false-positive class (dates/times/versions/ranges + negatives) — fixed by a conservative `CLAIM_NUMBER_TOKEN` (standalone figures only, maximal, hyphen-compounds still flagged) + `Math.abs` in the ground set; +6 robustness tests, +1 branch-coverage test. 431 tests green; typecheck/lint/build clean. Status → done. |
