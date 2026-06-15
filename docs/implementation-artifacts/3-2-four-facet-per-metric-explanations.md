---
epic: 3
story: 2
title: Four-facet per-metric explanations
baseline_commit: 8d38f16
---

# Story 3.2: Four-facet per-metric explanations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want every metric explained for my repo,
so that each number means something actionable.

## Acceptance Criteria

1. **Every metric gets a four-facet Metric Explanation, keyed by id (AC1).** **Given** the full metric catalog (Groups A–F), **when** narration runs, **then** every metric receives a **Metric Explanation** covering the **four facets** — (1) **meaning** (what the value(s) mean for this repo), (2) **good behaviours** it reveals, (3) what **needs improvement**, (4) **suggestions** to improve — carried in the Report JSON `narrative.explanations` map **keyed by metric id** (never welded into the deterministic metric envelope). Given a model that returns an explanation for each metric, the assembled report covers the whole catalog with no silent gaps.

2. **`not_available` metrics still get an explanation (AC2).** **Given** a metric whose status is `not_available`, **when** narration runs, **then** it **still receives a Metric Explanation** whose meaning facet states it **could not be computed and why** (grounded in the metric's `reason`) — so the explanation set covers `computed` and `not_available` metrics alike, with no silent omission.

3. **Anchored to its own metric; grounded cross-references only (AC3).** **Given** the explanations, **when** they are built, **then** each explanation is **anchored** to its own metric (the model tags each with the metric's `id`; an explanation whose id is **not** a metric in the analysis is dropped — never invented), and any cross-reference to another metric is allowed **only where grounded** (the metric exists in the analysis); the prompt is built from **`Analysis` only**, so commit messages, paths, diffs, and the key remain structurally absent (privacy by construction, as in 3.1).

## Tasks / Subtasks

- [ ] **Task 1 — Canonical four-facet + batch schemas (AC1, AC2, AC3) [src/narrate/schema.ts].** The AI-output schema is the single source of truth:
  - [ ] `MetricExplanationSchema = z.object({ explanation: z.string().min(1), goodBehaviours: z.array(z.string().min(1)), needsImprovement: z.array(z.string().min(1)), suggestions: z.array(z.string().min(1)) })`, each `.describe()`'d. The **meaning** facet (`explanation`) is always a non-empty string; the three facet arrays hold non-empty strings but **may be empty** (an empty list is an honest "none for this facet" — e.g. a healthy metric's `needsImprovement`, or a `not_available` metric's `goodBehaviours`). Type `MetricExplanation`. (This is the canonical shape — **moved here** from `assemble/report-schema.ts`, which now imports it, mirroring the 3.1 part-schema pattern.)
  - [ ] `MetricExplanationsSchema = z.record(z.string(), MetricExplanationSchema)`; type `MetricExplanations` (the keyed-by-id map the report carries).
  - [ ] `MetricExplanationEntrySchema = MetricExplanationSchema.extend({ metricId: z.string().min(1) })` — the AI-output **entry**: a four-facet explanation **tagged with the metric id it is anchored to** (explicit id ⇒ reliable LLM output + the AC3 anchoring/grounding seam). `ExplanationBatchSchema = z.object({ explanations: z.array(MetricExplanationEntrySchema).min(1) })` — the object `generateObject` binds.
  - [ ] Keep `NarrativeSchema = z.object({ summary, explanation, coaching })` **unchanged** (the three generated parts `generateNarrative` binds — 3.1). Add `NarrativeParts = z.infer<typeof NarrativeSchema>` and `FullNarrativeSchema = NarrativeSchema.extend({ explanations: MetricExplanationsSchema.optional() })`; **redefine** `export type Narrative = z.infer<typeof FullNarrativeSchema>` (the full narrative carried in the report = three parts + the optional per-metric map). `Narrative` now structurally matches the report's `ReportNarrative`.

- [ ] **Task 2 — Re-export the new types (AC1) [src/narrate/narrate.port.ts].** Add `MetricExplanation`, `MetricExplanations` (and `NarrativeParts` if useful) to the `export type … from "./schema.js"` line; `Narrative` now resolves to the full shape (explanations optional), so `NarrateOutcome`'s `narrated` payload carries them.

- [ ] **Task 3 — Per-metric explanations prompt (AC1, AC2, AC3) [src/narrate/prompt.ts].** Add `buildExplanationsPrompt(analysis)`: instruct the model to produce a four-facet explanation for **every metric** in the provided list, **setting `metricId` to that metric's `id`** (anchoring); cover all four facets (meaning / good behaviours / needs improvement / suggestions), using an explicit "none"/"already healthy" where a facet is empty; for a `not_available` metric, the meaning facet **states it could not be computed and why** (from its `reason`); cross-reference another metric **only where grounded** (it appears in the list); plain-language, team-level (never per-developer ranking), grounded — invent no numbers. Serializes **only** `analysis.metrics` (privacy, as `buildNarrativePrompt`). Keep `buildNarrativePrompt` unchanged.

- [ ] **Task 4 — Generate + anchor the explanations (AC1, AC2, AC3) [src/narrate/generate.ts].** `generateNarrative` return type → `NarrativeParts` (the three parts; binds `NarrativeSchema` — unchanged otherwise). Add `generateExplanations(model, analysis, deps): Promise<MetricExplanations>`: bind `ExplanationBatchSchema`, `temperature: 0`, `buildExplanationsPrompt`, then `buildExplanationsRecord(object.explanations, analysis)`. Add the **pure** `buildExplanationsRecord(entries, analysis)`: key each entry by `metricId`, **keep only ids that exist in `analysis.metrics`** (drop hallucinated/ungrounded ids — AC3), **first occurrence wins** on a duplicate id (deterministic), and strip `metricId` from the stored value (the record key carries it). Exported for direct unit test.

- [ ] **Task 5 — Compose the full narrative in the orchestrator (AC1) [src/narrate/narrate.ts].** `NarrateDeps.generate` returns `Promise<NarrativeParts>`; add `NarrateDeps.generateExplanations?: (model, analysis) => Promise<MetricExplanations>` (default `generateExplanations`). On the narrated path, run both via `Promise.all([generate(model, analysis), generateExplanations(model, analysis)])` and return `{ kind: "narrated", narrative: { ...parts, explanations } }`. The fail-open (`auto` ⇒ degraded) / required-throw / off-skip branches are unchanged — **either** generation failing degrades/throws the whole narration (graceful **per-group** degradation is Story 3.3).

- [ ] **Task 6 — Source the four-facet schema from narrate (AC1) [src/assemble/report-schema.ts].** Replace the local `MetricExplanationSchema` definition with an import from `narrate/schema.js` (alongside `SummarySchema`/`ExplanationSchema`/`CoachingSchema`); the Report `NarrativeSchema` (strict read-back) keeps `explanations: z.record(z.string(), MetricExplanationSchema).optional()`. `MetricExplanation` re-export stays. No shape change — the read-back contract is identical; only the definition home moves (single source of truth).

- [ ] **Task 7 — Tests (AC1, AC2, AC3).**
  - [ ] **`schema.test.ts`:** `MetricExplanationSchema` accepts a full four-facet object and an object with **empty** facet arrays (the "none" case); **rejects** a missing facet, a non-string facet, an empty-string facet entry, and an empty `explanation`. `ExplanationBatchSchema` requires `metricId` (`.min(1)`) and ≥1 entry.
  - [ ] **`prompt.test.ts`:** `buildExplanationsPrompt` names the four facets, the anchoring (`metricId` = the metric's id), the `not_available`-still-explained rule, the grounded-cross-reference + team-level/plain-language constraints, includes the metrics JSON, and **excludes** anything beyond `analysis.metrics` (privacy probe).
  - [ ] **`generate.test.ts`:** `generateExplanations` binds `ExplanationBatchSchema`, pins `temperature: 0`, sends the explanations prompt; `buildExplanationsRecord` — (a) keys a complete canned batch by id and **covers every analysis metric** (AC1), (b) includes a `not_available` metric's explanation (AC2), (c) **drops** an entry whose `metricId` is not in the analysis (AC3 anchoring), (d) first-wins on a duplicate id, (e) strips `metricId` from the stored value. `generateNarrative` still binds `NarrativeSchema`/`temperature 0` (3.1 unchanged).
  - [ ] **`narrate.test.ts`:** happy path injects both `generate` + `generateExplanations` → `narrated` with `narrative.explanations` present and keyed by id; a throwing `generateExplanations` → `degraded` in `auto` / throws `NarrationError` in `required` (whole-narration fail-open holds); `off` still skips both.
  - [ ] **`report-schema.test.ts` / `report.test.ts`:** a narrative **with** the `explanations` map (alongside the three required parts) parses and is carried verbatim through `assembleReport` (`structuredClone`), keyed by id; the metric envelope still carries **no** welded explanation (the 1.7 invariant).

## Dev Notes

### Review Findings

**Code review — 2026-06-14** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The spec-aware Acceptance Auditor cleared all three ACs MET (0 not-met)** — confirming the four facets are schema-required and keyed by id in `narrative.explanations` (never welded into the metric — C2), the `not_available`-still-explained rule is prompt-instructed + tested, anchoring genuinely drops ungrounded ids, privacy holds (Analysis-only), the fail-open posture is correct, scope discipline is "SOUND" (3.3/3.4/3.5/3.6/Epic 4 all correctly deferred), and `schemaVersion` stays 1.0.0. Triage: **3 patch · 1 defensive test · ~5 dismissed.**

**Patch:**

- [x] [Review][Patch] The per-metric `MetricExplanationSchema` **lost `.strict()`** when moved to `narrate/schema.ts` (a plain `z.object` for model-output leniency), **loosening the read-back contract** so an explanation could carry unknown keys [src/assemble/report-schema.ts] — **Fixed:** the AI-output schema stays lenient, but the **read-back** record now uses `MetricExplanationSchema.strict()` — the correct lenient-generate / strict-read-back asymmetry (the 1.6/3.1 trust-boundary pattern). Added a read-back test rejecting an explanation with an unknown key. *(Blind Hunter + Edge Case Hunter both flagged this.)*
- [x] [Review][Patch] `buildExplanationsRecord` keyed the map in **model-output order** [src/narrate/generate.ts] — **Fixed:** refactored to index entries by id (first-wins) then **emit in analysis order** (the byte-stable metric order), so the map is deterministic and aligned with the metrics; only ids present in the analysis are emitted (anchoring), and it is definitively prototype-safe (a `Map` indexes the model output; only real registry metric ids are assigned to the plain record). *(Edge Case Hunter — key-order determinism.)*
- [x] [Review][Patch] Added a clarifying comment that an **incomplete** explanations map (a model omitting metrics) is surfaced by the grounding pass (3.4) / confidence (3.5), not fabricated here [src/narrate/narrate.ts]. *(Acceptance Auditor Gap 1.)*

**Defensive test:**

- [x] Added a **dual-rejection** test (both `generate` and `generateExplanations` reject) asserting `degraded` with **no unhandled rejection** — proving the Edge Case Hunter's "Promise.all dual-rejection → unhandled rejection" claim is a **false positive** (`Promise.all` attaches a handler to every input promise; vitest fails on an unhandled rejection, so the passing test is the proof).

**Dismissed:**
- **Blind Hunter — "report-schema NarrativeSchema not shown updated for `explanations`"**: false positive — the optional `explanations` field was already present from Story 3.1; the diff only changes its import source + comment. The round-trip read-back test passes.
- **Edge Case Hunter — empty `explanations` map when all ids hallucinated**: an empty map is **honest** ("no grounded explanations"), schema-valid, and not misleading; an all-hallucinated batch is itself a model failure that 3.4/3.5 surface.
- **Edge Case Hunter — incomplete coverage (model omits metrics)**: explicitly scoped to 3.4/3.5 (AC1 is "given a model that returns one per metric"); 3.2 trusts the model + tests a complete batch (the Auditor agreed this is the right boundary). A clarifying comment was added.
- **Blind Hunter — zero-metric analysis not guarded**: unreachable — the engine always emits the 32-metric catalog (some `not_available`); an empty analysis cannot occur in the pipeline.
- **Acceptance Auditor — "add a test that `generate` returns exactly 3 parts"**: TypeScript + the `generateObject` schema binding already enforce this; low value.

### What a Metric Explanation IS (canonical — do not re-derive)

[Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#§3 Glossary + FR-8]

- **Metric Explanation** — an LLM-generated, repo-specific assessment **paired with an individual Metric**, carried in the Report JSON `narrative` subtree **keyed to its Metric by metric id** (FR-12), **not nested inside the Metric's deterministic record** (C2 — keeps `analysis` byte-stable/diffable). It covers **four facets**: (1) **explanation** of what the value(s) mean for this repo, (2) the **good behaviours** it reveals, (3) what **needs improvement**, (4) **suggestions** to improve. **Distinct from** the repo-level AI Narrative's `explanation` **part** (Story 3.1) — same English word, different thing (hence the `MetricExplanation*` naming, disambiguated in 3.1's rename).
- **Every Metric in Groups A–F carries one** — not a restatement of its static one-line description; a `not_available` metric still receives one stating it could not be computed and why (FR-8: "the explanation set covers the full catalog with no silent gaps").
- **Anchored, grounded cross-references** — anchored in its own Metric; may reference another Metric **only where the connection is genuinely informative and that Metric exists in the Analysis** (FR-9). The cross-metric *prioritized plan* stays Coaching's job (3.1) — an explanation may note a link but is not the global roll-up.

### Architecture decision — one batched call, array-with-id → keyed record (read first)

- **One `generateObject` call for all per-metric explanations**, not one-call-per-metric. FR-8's `[NOTE FOR PM]` explicitly endorses **batching into a single request** to bound cost/latency on the BYOK budget. Story 3.3 later splits this into **six per-Group batches** (+ coaching its own call) to *survive small context windows* and degrade a single group gracefully — so `generateExplanations(model, analysis)` is the **seam** 3.3 reimplements behind the same signature. 3.2 keeps it one call. [Source: prd.md#FR-8 note, epics.md#Story 3.3]
- **Array-with-explicit-`metricId` → transformed to the keyed record.** The model emits `{ explanations: [{ metricId, …four facets }] }` (an explicit id per entry is more reliable for structured LLM output **and** is the anchoring/grounding seam), and the pure `buildExplanationsRecord` maps it to `Record<id, fourFacets>`, **dropping any `metricId` not present in the analysis** (AC3 anchoring — an ungrounded/hallucinated id is never carried). This pre-empts the *minimal* slice of grounding (id-anchoring); the full deterministic **claim-by-claim numeric verification** is Story 3.4. [Source: epics.md#Story 3.4, prd.md#FR-9]
- **Separate generation call from the narrative; composed in the orchestrator.** `generateNarrative` (3.1, three parts) and `generateExplanations` (3.2, the map) are two calls run via `Promise.all`; `createNarrate` composes `{ ...parts, explanations }`. This keeps each schema/prompt focused and gives 3.3 a clean place to add per-group batching + graceful per-batch degradation. In 3.2, **either** call failing degrades/throws the whole narration (the 3.1 fail-open posture) — graceful partial degradation is 3.3's AC.
- **Keyed by id in `narrative.explanations`, never welded into the metric.** The metric envelope stays AI-free (C2), so the `analysis` subtree remains byte-stable/diffable; the explanation map lives under `narrative` (the report read-back schema already reserved the optional `explanations` record — 3.1). [Source: architecture.md#Canonical Report JSON, src/assemble/report-schema.ts]

### Scope discipline — what this story does and does NOT include

**In scope:** the canonical four-facet `MetricExplanationSchema` (sourced from `narrate/schema.ts`), the batched `generateExplanations` (+ the pure anchoring `buildExplanationsRecord`), the explanations prompt, the orchestrator composing `narrative.explanations`, and the Report JSON carrying the keyed-by-id map. The minimal **id-anchoring** grounding guard (drop ungrounded ids).

**Out of scope / deferred (do NOT build here):**
- **Per-Group batched generation + graceful single-group degradation** — **Story 3.3**. 3.2 does **one** call for all explanations (FR-8's "single request"); 3.3 splits into six per-Group batches (+ coaching its own call) and makes a single failing batch degrade gracefully. [Source: epics.md#Story 3.3]
- **Deterministic grounding verification pass** (claim-by-claim numeric/factual check against metric ids; remove/rewrite unsupported claims) — **Story 3.4**. 3.2 anchors by id (drops hallucinated ids) but does **not** verify numeric claims inside the facet prose. [Source: epics.md#Story 3.4, prd.md#FR-9]
- **Confidence self-assessment** (`high`/`medium`/`low`; the `not_available`-share signal) — **Story 3.5**. [Source: epics.md#Story 3.5]
- **Full BYOK provider breadth** — **Story 3.6** (gemini-only slice holds). [Source: epics.md#Story 3.6]
- **Rendering the four facets in a user-facing surface (terminal/HTML/Markdown)** — **Epic 4 (rich report)**. Per the UX, metric explanations live in the **rich rendered report** ("HTML report … metric explanations"; "Metric section | Rendered report | … the four-facet explanation … in a stable layout"), while the **terminal stays a narrative summary** (Summary/Explanation/Coaching + the metrics table). 3.2 carries the explanations in the **Report JSON** (the canonical source of truth, verifiable now via the schema + assembly); the terminal renderer is **unchanged** and HTML/Markdown render them in Epic 4. [Source: docs/planning-artifacts/ux-designs/ux-commit-whisper-2026-06-11/EXPERIENCE.md, epics.md#Epic 4]
- **Completeness enforcement when a model drops metrics** (filling a placeholder or hard-failing on an incomplete set) — a **grounding/confidence** concern (3.4/3.5). 3.2 passes the full metric list + instructs full coverage, and the test proves a complete response covers the catalog; a misbehaving model that omits metrics surfaces via 3.4/3.5, not a fabricated explanation here.

### The exact contracts to build on (do NOT redefine)

- **3.1 narrative schemas (`narrate/schema.ts`):** `SummarySchema`/`ExplanationSchema`/`ChapterSchema`/`CoachingSchema`/`NarrativeSchema` (the three generated parts), each `.min(1)`-guarded. `generateNarrative` binds `NarrativeSchema`; keep it so the 3.1 generate test holds. The new `MetricExplanation*` schemas slot alongside; `Narrative` is **redefined** to the full shape (`FullNarrativeSchema`). [Source: src/narrate/schema.ts]
- **`MetricExplanationSchema` (currently in `report-schema.ts`, pinned at 1.0.0):** `{ explanation: string, goodBehaviours: string[], needsImprovement: string[], suggestions: string[] }`, `.strict()`. 3.2 **moves the canonical definition** to `narrate/schema.ts` (the AI-output home) and report-schema imports it — the read-back shape is **unchanged** (the 3.1 forward-compat explanations-map test uses non-empty facets, so it still passes). [Source: src/assemble/report-schema.ts]
- **`createNarrate` orchestrator (3.1):** `off → skipped`; success → `narrated`; `auto`+fail → `degraded` (fail open); `required`+fail → throw `NarrationError` (exit 6). 3.2 adds a second generation call inside the same try; the branch logic is unchanged. [Source: src/narrate/narrate.ts]
- **`generateObject` wrapper (1.6/3.1):** injectable `generateObject`, `temperature: 0` pinned, schema-bound, metrics-only prompt. `generateExplanations` mirrors this exactly with `ExplanationBatchSchema`. [Source: src/narrate/generate.ts]
- **`assembleReport`/`reportFromOutcome` (1.7):** `structuredClone` the narrative verbatim into the report; the `analysis` subtree is untouched and byte-stable. The wider `Narrative` (with `explanations`) flows through unchanged — no assemble change beyond the type. [Source: src/assemble/report.ts]
- **Privacy by construction (1.6/3.1):** the narrate stage receives **only `Analysis`**; `buildExplanationsPrompt(analysis)` serializes only `analysis.metrics`. No `RepoHistory`, ever. [Source: src/narrate/prompt.ts]

### Determinism, privacy & fail-open posture (unchanged)

- **`temperature: 0`** pinned for the explanations call too (the tightest determinism the narrative layer allows). The narrative/explanations subtree is the **one** non-deterministic layer; `analysis` stays byte-stable — the determinism harness never narrates. `buildExplanationsRecord` is **pure** (its mapping/drop/first-wins is deterministic given the model output). [Source: architecture.md#LLM sampling determinism]
- **Fail-open preserved:** an explanations generation or schema-validation failure → `degraded` in `auto` (substrate + exit 9) or `NarrationError` in `required` (exit 6), exactly like the narrative call. [Source: src/narrate/narrate.ts]
- **No new dependencies.** Reuses `ai` `generateObject` + `zod`. gemini-only slice holds.

### Previous-story intelligence

- **3.1 already did the rename + reserved the slot.** `report-schema.ts` carries `explanations: z.record(z.string(), MetricExplanationSchema).optional()` and the per-metric schema was renamed `MetricExplanationSchema`/`MetricExplanation` precisely so 3.2 can populate it; 3.2 only **moves the definition home** and **generates** the data. [Source: src/assemble/report-schema.ts, 3-1 story]
- **`Narrative` type widening is the one cross-cutting change.** Redefining `Narrative` = full shape (parts + optional explanations) flows through `narrate.port` → `report.ts` → the assembled `Report`; structurally it equals the report's `ReportNarrative`, so no assemble/render breakage (render ignores the new optional field). [Source: src/narrate/narrate.port.ts, src/assemble/report.ts]
- **Fixture stability:** every existing `NARRATIVE` fixture (three parts, no `explanations`) stays valid because `explanations` is **optional** — only the new narrate/generate tests add the map. `cli/run.test.ts` + `cli.e2e.test.ts` inject fake narrate outcomes and are unaffected. [Source: 3-1 fixture work]
- **Empty-content discipline (3.1 patch):** facet **strings** are `.min(1)` (no blank filler), but facet **arrays may be empty** (an honest "none") — the 3.1 lesson was "no empty content," not "force filler into every list." [Source: 3-1 review patch]

### Project Structure Notes

- Modified: `src/narrate/{schema,narrate.port,prompt,generate,narrate}.ts` (+ their `.test.ts`), `src/assemble/report-schema.ts` (+ `.test.ts`, `report.test.ts`). **No** engine/model/metric/select/config/render change; `analysis` and the determinism harness are untouched; the terminal renderer is unchanged (explanations render in Epic 4's rich report). [Source: architecture.md#Complete Project Directory Structure]
- No new files — the four-facet schema + the batch generation live in the existing `narrate/*` modules.

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.2: Four-facet per-metric explanations] (the ACs)
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-8] (four facets; every metric incl. `not_available`; anchored + grounded cross-refs; single-request batching) · [Source: …#FR-9] (grounding — id-anchoring here, verification pass in 3.4) · [Source: …#FR-12] (keyed by metric id under `narrative`, not welded into the metric)
- [Source: docs/planning-artifacts/architecture.md#Canonical Report JSON] (`narrative.explanations[metricId]`, never welded; `analysis` byte-stable) · [Source: …#LLM-output validation checkpoint]
- [Source: docs/planning-artifacts/ux-designs/ux-commit-whisper-2026-06-11/EXPERIENCE.md] (metric explanations live in the rich report; terminal stays a summary)
- [Source: src/narrate/schema.ts · prompt.ts · generate.ts · narrate.ts · narrate.port.ts] (the 3.1 stack to extend) · [Source: src/assemble/report-schema.ts] (the `explanations` slot reserved in 3.1)

### Completion Notes

- **All three ACs satisfied.** AC1: `MetricExplanationSchema` (four required facets — `explanation` always non-empty; the three facet arrays hold non-empty strings but may be empty for an honest "none") is generated for every metric and carried in `narrative.explanations` **keyed by metric id**, never welded into the metric envelope (the `analysis` subtree stays byte-stable — C2). AC2: the prompt instructs that a `not_available` metric's meaning facet states it could not be computed and why (from its `reason`); a generate test proves the `not_available` metric's explanation is carried and says so. AC3: `buildExplanationsRecord` **drops any entry whose `metricId` is not a metric in the analysis** (no invented anchors) and the prompt permits cross-references **only where the metric is in the list** — with privacy by construction (the explanations prompt serializes only `analysis.metrics`).
- **One batched call (FR-8's "single request"); array-with-id → keyed record.** `generateExplanations` makes **one** `generateObject` call returning `{ explanations: [{ metricId, …four facets }] }`; the pure `buildExplanationsRecord` indexes by id (first-wins) and **emits in analysis order** (deterministic, aligned with the byte-stable metric order), dropping ungrounded ids. Story 3.3 reimplements this as six per-Group batches behind the same seam; the deterministic claim-by-claim grounding pass is Story 3.4.
- **Two independent generations, composed.** The orchestrator runs `Promise.all([generateNarrative, generateExplanations])` and composes `{ ...parts, explanations }`; either failing degrades (`auto` → exit 9) or throws (`required` → exit 6) — the 3.1 fail-open posture, unchanged. Graceful **per-group** degradation is 3.3.
- **Canonical schema home + strict read-back.** The four-facet `MetricExplanationSchema` now lives in `narrate/schema.ts` (the AI-output single source of truth, lenient); `assemble/report-schema.ts` imports it and applies `.strict()` at the **read-back** boundary — the lenient-generate / strict-read-back asymmetry. `Narrative` widened to `FullNarrativeSchema` (three parts + optional `explanations` map); it structurally matches the report's `ReportNarrative`, so assemble/render are untouched (the terminal renderer ignores the new optional field).
- **Terminal renderer unchanged — by design.** Per the UX, per-metric four-facet explanations live in the **rich rendered report** (HTML/Markdown — Epic 4); the **terminal stays a narrative summary** (Summary/Explanation/Coaching + the metrics table). 3.2 carries the explanations in the **Report JSON** (the canonical source of truth, verified via the schema + assembly round-trip).
- **408 tests** (+20); typecheck / lint / build clean. Substrate (`--no-ai`) path verified unchanged on the real binary; the explanations carrying is proven at the narrate + assemble layers (the real narrated path needs a Gemini key).
- **No new dependencies.** Reuses `ai` `generateObject` + `zod`; gemini-only slice holds.

### File List

**Modified (source):**
- `src/narrate/schema.ts` — add `MetricExplanationSchema`/`MetricExplanationsSchema`/`MetricExplanationEntrySchema`/`ExplanationBatchSchema` + `NarrativeParts`/`FullNarrativeSchema`; redefine `Narrative` to the full shape
- `src/narrate/narrate.port.ts` — re-export `MetricExplanation`/`MetricExplanations`/`NarrativeParts`
- `src/narrate/prompt.ts` — add `buildExplanationsPrompt` (four facets + anchoring + not_available + grounded cross-refs + team-level; metrics-only)
- `src/narrate/generate.ts` — `generateNarrative` returns `NarrativeParts`; add `generateExplanations` + the pure, analysis-ordered `buildExplanationsRecord`
- `src/narrate/narrate.ts` — compose the full narrative from `Promise.all([generate, generateExplanations])`
- `src/assemble/report-schema.ts` — import the canonical `MetricExplanationSchema` from narrate; `.strict()` it at the read-back boundary

**Modified (tests):**
- `src/narrate/schema.test.ts` — `MetricExplanationSchema` (four facets, empty-array "none", empty-string/missing-facet rejection) + `ExplanationBatchSchema` (metricId required, ≥1 entry)
- `src/narrate/prompt.test.ts` — `buildExplanationsPrompt` (four facets, anchoring, not_available, grounded cross-ref, team-level, privacy)
- `src/narrate/generate.test.ts` — `generateExplanations` (binds the batch schema, temp 0, keyed-by-id incl. not_available) + `buildExplanationsRecord` (coverage, drop-hallucinated, first-wins, strip metricId, analysis order)
- `src/narrate/narrate.test.ts` — happy path composes explanations; throwing-explanations → degraded; dual-rejection → degraded (no unhandled rejection); off skips both
- `src/assemble/report-schema.test.ts` — read-back rejects an explanation with an unknown key (strict boundary)
- `src/assemble/report.test.ts` — the explanations map is carried verbatim + round-trips read-back; metric envelope still unwelded

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 3-2 → in-progress → done
- `docs/implementation-artifacts/3-2-four-facet-per-metric-explanations.md` — this story (record filled, status → done)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 3.2 drafted via create-story (ultimate context engine). Status → in-progress. |
| 2026-06-14 | Story 3.2 implemented (TDD): the canonical four-facet `MetricExplanationSchema` (sourced from `narrate/schema.ts`), a batched `generateExplanations` (one `generateObject` call, array-with-`metricId` → keyed record via the pure `buildExplanationsRecord` that drops ungrounded ids), the explanations prompt, and the orchestrator composing `narrative.explanations` from `Promise.all`. No engine/model/metric/select/config/render change. 41 files / 406 tests green; substrate e2e verified. Status → review. |
| 2026-06-14 | Code review (3 parallel layers) → Acceptance Auditor 0 not-met (all 3 ACs MET, scope SOUND, fail-open + privacy correct, schemaVersion 1.0.0). 3 patches: restore `.strict()` at the read-back boundary (lenient-generate/strict-read-back); `buildExplanationsRecord` emits in analysis order (deterministic + proto-safe); clarifying comment on incomplete-map → 3.4/3.5. +1 defensive dual-rejection test (proved the "Promise.all unhandled rejection" finding a false positive). 408 tests green; typecheck/lint/build clean. Status → done. |
