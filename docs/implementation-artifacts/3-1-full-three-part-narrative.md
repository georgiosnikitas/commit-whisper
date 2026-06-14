---
epic: 3
story: 1
title: Full three-part Narrative
baseline_commit: 8e2f752
---

# Story 3.1: Full three-part Narrative

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a Summary, Explanation, and structured Coaching report,
so that my history is explained and turned into a prioritized plan.

## Acceptance Criteria

1. **Exactly three labeled parts, in order (AC1).** **Given** the computed metrics, **when** narration runs, **then** the `Narrative` contains **exactly three** labeled parts **in order** — **Summary** (TL;DR of the repo's story + headline findings), **Explanation** (plain-language interpretation of what the metrics show and why), **Coaching** (the structured improvement report) — present in the `narrative` subtree of the Report JSON and rendered, labeled and ordered, in the showpiece. A narrated report **cannot** type-check or parse without all three parts (the structure is enforced at the schema seam, not merely by prompt).

2. **Coaching is a structured report, not a flat list (AC2).** **Given** narration runs, **then** the **Coaching** part is a structured report with an **introduction** (framing the repo's current state and what the plan addresses), **one or more themed chapters** (each a `theme` grouping related improvements with prescriptive, **prioritized steps**), and a **closing summary** (top priorities + recommended order) — never a flat list. The schema requires ≥1 chapter and ≥1 step per chapter, so a flat or chapterless "coaching" is rejected.

3. **Plain-language, team-level prose; grounded; privacy-safe (AC3).** **Given** narration runs, **then** all prose is **plain-language** (no unexplained jargon, evidence-first) and any **manager-facing content stays at team-level** health/risk — never per-developer ranking; every claim is grounded in the provided metrics (no invented numbers; `not_available` metrics acknowledged, not guessed); and the prompt is built from **`Analysis` only** (metric envelopes), so commit messages, file paths, raw diffs, and the API key are structurally absent from anything sent to the model.

## Tasks / Subtasks

- [ ] **Task 1 — The three-part narrative schemas (AC1, AC2) [src/narrate/schema.ts].** Keep `SummarySchema`/`Summary`; add the two new parts + the combined narrative:
  - [ ] `ExplanationSchema = z.object({ paragraphs: z.array(z.string()).min(1) })` — the repo-level **Explanation** part (plain-language interpretation), `.describe()`'d for the model. Type `Explanation`.
  - [ ] `ChapterSchema = z.object({ theme: z.string(), steps: z.array(z.string()).min(1) })` and `CoachingSchema = z.object({ introduction: z.string(), chapters: z.array(ChapterSchema).min(1), closingSummary: z.string() })` — the structured **Coaching** report. Types `Chapter`, `Coaching`. The `.min(1)` on chapters + steps is the schema-level guarantee that Coaching is **not a flat list** (AC2).
  - [ ] `NarrativeSchema = z.object({ summary: SummarySchema, explanation: ExplanationSchema, coaching: CoachingSchema })` — the AI structured-output object `generateObject` binds. Type `Narrative` (inferred). Plain `z.object` (model-output leniency), consistent with the existing non-strict `SummarySchema`.

- [ ] **Task 2 — Expand the narrate contract (AC1) [src/narrate/narrate.port.ts].** Replace the hand-written `interface Narrative { summary }` with a re-export of the inferred `Narrative` (and `Summary`/`Explanation`/`Coaching`/`Chapter`) from `schema.js` — so the zod schema is the single source of truth for the AI-output shape and `report.ts`'s `import type { Narrative }` keeps working unchanged.

- [ ] **Task 3 — Full-narrative prompt (AC2, AC3) [src/narrate/prompt.ts].** Rename `buildSummaryPrompt` → `buildNarrativePrompt`; instruct the model to produce **all three parts**: Summary (TL;DR + headline findings), Explanation (what the metrics show and why), Coaching (a structured report — introduction → themed chapters of prioritized steps → closing summary; prescriptive, prioritized, grounded in the repo's own metric values). Constraints in the instruction: plain language / no unexplained jargon / evidence-first; **manager-facing content stays team-level — never per-developer ranking**; ground every claim in the provided metrics, invent no numbers; acknowledge `not_available` metrics rather than guessing. Still serializes **only** `analysis.metrics` (privacy by construction — AC3).

- [ ] **Task 4 — Generate the full narrative (AC1) [src/narrate/generate.ts].** Rename `generateSummary` → `generateNarrative`; bind `NarrativeSchema` (not `SummarySchema`), keep `temperature: 0` (determinism posture), use `buildNarrativePrompt`, return the three-part `Narrative`. (One `generateObject` call for the whole repo-level narrative — per-group batching of the per-metric explanations + coaching-as-its-own-call is **Story 3.3**.)

- [ ] **Task 5 — Wire the orchestrator (AC1) [src/narrate/narrate.ts].** `NarrateDeps.generate` now returns `Promise<Narrative>` (not `Summary`); default to `generateNarrative`; `return { kind: "narrated", narrative }` (the whole object, not `{ summary }`). The fail-open / required-throw / off-skip branches are unchanged.

- [ ] **Task 6 — Carry all three parts in the Report JSON narrative subtree (AC1, AC2) [src/assemble/report-schema.ts].** Import `SummarySchema`, `ExplanationSchema`, `CoachingSchema` from `narrate/schema.js`; rename the per-metric `ExplanationSchema` → `MetricExplanationSchema` and `Explanation` → `MetricExplanation` (disambiguation — the narrative **Explanation** part vs the §3.2 per-metric **Metric Explanation**; the per-metric one is still pinned-but-unpopulated until 3.2). Expand `NarrativeSchema` to `z.object({ summary, explanation, coaching, explanations: z.record(z.string(), MetricExplanationSchema).optional() }).strict()` — the three required narrative parts + the optional forward-compat per-metric map. `schemaVersion` stays `1.0.0` (still pre-implementation; the narrative shape was reserved for Epic 3).

- [ ] **Task 7 — Render the three labeled parts in order (AC1, AC2) [src/render/terminal/terminal-renderer.ts].** In the showpiece path, render labeled, ordered sections: **Summary** (headline · overview · Key findings), **Explanation** (its paragraphs), **Coaching** (introduction → each chapter's theme + numbered prioritized steps → closing summary), then the metrics table. Substrate path unchanged. Pure (Report in, string out); `render/` stays `no-console`.

- [ ] **Task 8 — Tests (AC1, AC2, AC3).**
  - [ ] **`schema.test.ts`:** `NarrativeSchema` accepts a full three-part object; **rejects** a missing part (no `coaching` / no `explanation`); **rejects** chapterless coaching (`chapters: []`) and a chapter with no steps and an empty `paragraphs` (the `.min(1)` structural guards — AC2).
  - [ ] **`prompt.test.ts`:** `buildNarrativePrompt` names all three parts + the Coaching structure + the team-level/plain-language/grounding constraints; includes the metrics JSON; **excludes** anything beyond `analysis.metrics` (privacy — a probe analysis proves no commit-message/path leakage path exists).
  - [ ] **`generate.test.ts`:** `generateNarrative` binds `NarrativeSchema`, pins `temperature: 0`, sends the narrative prompt, returns the object (canned three-part narrative; `NarrativeSchema.safeParse` passes).
  - [ ] **`narrate.test.ts`:** happy path → `{ kind: "narrated", narrative: <three-part> }`; off/auto-degraded/required-throw branches still hold with the new `generate` return type.
  - [ ] **`terminal-renderer.test.ts`:** the showpiece contains "Summary", "Explanation", "Coaching" **in ascending order**, the explanation paragraph, a chapter theme, a prioritized step, and the closing summary; the metrics table still renders. Substrate tests unchanged.
  - [ ] **`report-schema.test.ts` / `report.test.ts` / `render.port.test.ts` / `cli/run.test.ts`:** expand each `NARRATIVE` fixture to the three-part shape; the read-back/assembly/classify/pipeline assertions hold; the per-metric `explanations` map test keeps the optional field (now alongside the three required parts).

## Dev Notes

### Review Findings

**Code review — 2026-06-14** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The spec-aware Acceptance Auditor cleared all three ACs MET with 0 findings** — confirming "exactly three parts" is enforced **structurally** at three checkpoints (the generation schema, the `.strict()` Report read-back schema, and the type-level `ShowpieceReport`), the render order is test-proven, AC2's "not a flat list" is a `.min(1)` validation guarantee (not just a prompt), AC3's plain-language/team-level/grounding constraints are present-and-tested with privacy by construction, and **no scope creep** (3.2 per-metric explanations, 3.3 batching, 3.4 grounding pass, 3.5 confidence, 3.6 providers all absent; `schemaVersion` stays 1.0.0). Triage: **1 patch · ~7 dismissed.**

**Patch:**

- [x] [Review][Patch] The new Explanation/Coaching content **strings accepted `""`** (`z.string()` allows empty), which would render as a blank/orphaned section or a bare `1. ` step marker — an empty step/paragraph/theme undercuts AC2's "structured, not a flat list" intent as much as a chapter with no steps [src/narrate/schema.ts] — **Fixed:** added `.min(1)` to `paragraphs` items, `theme`, `steps` items, `introduction`, and `closingSummary`, completing the structural contract (no chapterless, stepless, **or** empty-content coaching/explanation). Added schema tests rejecting an empty-string step/theme/intro/closing/paragraph. (This consolidates the Edge Case Hunter's empty-string cluster for the **new** fields.)

**Dismissed:**
- **Edge Case Hunter — empty `SummarySchema` headline/overview/keyFindings** (5 nits): out of scope — `SummarySchema` is the **1.6** contract with an explicit "accepts an empty keyFindings array" test; tightening it would regress 1.6 and isn't this story's surface. The new-field hardening above is the in-scope subset.
- **Blind Hunter — privacy test "only checks negative cases"**: the test ALSO asserts `prompt.toContain(JSON.stringify(analysis.metrics, null, 2))` — i.e. the prompt **is** the instruction + the exact metrics serialization — which, with the `Analysis`-only call signature, **is** the positive proof. Adequately handled.
- **Blind Hunter — `indexOf` order check could match a substring**: the fixture's headline/overview/findings/paragraph/steps deliberately contain **none** of the words "Summary"/"Explanation"/"Coaching", so `indexOf` finds exactly the three labels; the order assertion is sound for the fixture.
- **Blind Hunter — duplicate `NarrativeSchema` name in two modules**: intentional and documented — `narrate/schema.ts`'s `NarrativeSchema` is the lenient AI-output schema (`generateObject` binds it); `assemble/report-schema.ts`'s is the `.strict()` read-back schema (+ optional per-metric `explanations`). Two genuinely different schemas at two trust boundaries; never imported together.
- **Blind Hunter — structure test only checks substrings** (nit): adequate alongside the ordering test; the render structure (intro → theme → numbered step → closing) content is each asserted.
- **Round-trip (Edge Case) — lenient generate vs strict read-back**: `generateObject` coerces output to the bound schema (no stray keys), matching the existing 1.6 `SummarySchema`-non-strict / Report-strict pattern; no regression.

### What the three parts ARE (canonical definitions — do not re-derive)

The PRD fixes these exactly. [Source: docs/planning-artifacts/prds/prd-commit-sage-2026-06-06/prd.md#§3 Glossary + FR-8]

- **AI Narrative** — the LLM-generated text, in **three parts: Summary, Explanation, Coaching**.
- **Summary** — a short **TL;DR** of the repo's story and headline findings, for skimming. *(Already built in 1.6: `{ headline, overview, keyFindings }`.)*
- **Explanation** — **plain-language interpretation** of what the Metrics show and why. *(New — modeled as `{ paragraphs: string[] }`.)*
- **Coaching** — a structured improvement **report** (**introduction → themed chapters → closing summary**), prescriptive and prioritized, grounded in this repo's Metrics; it **consolidates and ranks** the per-metric improvement suggestions into a coherent plan. *(New — `{ introduction, chapters: [{ theme, steps }], closingSummary }`.)*

The Coaching consolidation **of the per-metric facet-4 suggestions** is a 3.2+ refinement (the per-metric Metric Explanations don't exist until Story 3.2). In 3.1, Coaching grounds **directly** in the metric values — the structure (intro → chapters → closing) is what 3.1 delivers; the cross-referencing of per-metric suggestions deepens once 3.2 lands. [Source: prd.md#FR-8, epics.md#Story 3.2]

### Scope discipline — what this story does and does NOT include

**In scope:** the repo-level three-part Narrative (Summary already exists; add Explanation + Coaching), its schema (with the structural `.min(1)` guarantees), the full-narrative prompt + single-call generation, the Report-JSON narrative subtree carrying all three parts, and the labeled+ordered showpiece render.

**Out of scope / deferred (do NOT build here):**
- **Per-metric four-facet Metric Explanations** (meaning / good behaviours / needs improvement / suggestions, keyed by metric id) — **Story 3.2**. The Report schema keeps `narrative.explanations` **optional** (pinned shape, renamed `MetricExplanationSchema`); 3.1 neither generates nor renders them. [Source: epics.md#Story 3.2]
- **Per-group batched generation** (six group batches + coaching as its own call; one failing group degrades gracefully) — **Story 3.3**. 3.1 uses **one** `generateObject` call for the whole repo-level narrative; 3.3 owns the batching refactor. [Source: epics.md#Story 3.3]
- **Deterministic grounding verification pass** (post-gen check that every claim references a metric id; remove/rewrite unsupported claims) — **Story 3.4**. 3.1 grounds via **prompt constraints only** (FR-9 explicitly pairs prompt constraints *and* a later verification pass). [Source: epics.md#Story 3.4, prd.md#FR-9]
- **Confidence self-assessment** (`high`/`medium`/`low`, escalation) — **Story 3.5**. [Source: epics.md#Story 3.5]
- **Full BYOK provider breadth** — **Story 3.6**. 3.1 stays on the gemini-only slice (`resolveModel` unchanged). [Source: epics.md#Story 3.6]
- **HTML / Markdown / JSON renderers** — **Epic 4**. 3.1 extends the **terminal** showpiece only; the Report JSON (the single source of truth) carries all three parts so Epic 4 renders them later. [Source: epics.md#Epic 4]

### Architecture decision — the schema seam enforces "exactly three parts" (read first)

AC1's "exactly three labeled parts" is made **structural**, not merely prompted:
- `narrate/schema.ts` is the **single source of truth** for the AI-output shape (`NarrativeSchema`, bound by `generateObject` — no fragile string-parsing). Inferring `Narrative` from it and re-exporting through `narrate.port.ts` means a `Narrative` value **cannot omit a part** and still type-check. [Source: src/narrate/schema.ts, architecture.md#LLM-output validation checkpoint]
- `report-schema.ts`'s `NarrativeSchema` is the **read-back trust boundary** (C1 checkpoint 3, `.strict()`): a serialized report missing a narrative part **fails `parseReport`**. The three parts are **required**; the per-metric `explanations` map stays **optional** (3.2). [Source: src/assemble/report-schema.ts, architecture.md#Three validation checkpoints]
- The `.min(1)` on `coaching.chapters` and `chapter.steps` makes "Coaching is a structured report, not a flat list" (AC2) a **validation guarantee** — a chapterless or stepless coaching is rejected at both generation (generateObject) and read-back.

This keeps the new logic small and the guarantees strong: schemas + one generation call + the part types threaded through assemble/render, with the existing fail-open / privacy / determinism posture untouched.

### The exact contracts to build on (do NOT redefine)

- **`SummarySchema` (1.6):** `{ headline, overview, keyFindings }`, `.describe()`'d, non-strict — **unchanged**. The new part schemas mirror its `.describe()` style for model guidance. [Source: src/narrate/schema.ts]
- **`Narrative` (1.6, narrate.port.ts):** currently `{ summary }`; becomes `{ summary, explanation, coaching }` (inferred from `NarrativeSchema`). `report.ts` imports `type { Narrative }` from `narrate.port.js` — keep that import path working (re-export). [Source: src/narrate/narrate.port.ts, src/assemble/report.ts]
- **`createNarrate` orchestrator (1.6):** `off → skipped`, success → `narrated`, `auto`+fail → `degraded` (fail open), `required`+fail → throw `NarrationError` (exit 6). Only the `generate` dep's **return type** and the `narrated` payload change (`{ summary }` → the full `narrative`). [Source: src/narrate/narrate.ts]
- **`generateObject` wrapper (1.6):** injectable `generateObject`, `temperature: 0` pinned, schema-bound, metrics-only prompt. Rename + rebind to `NarrativeSchema`; keep the temperature pin and injectability. [Source: src/narrate/generate.ts]
- **`assembleReport` / `reportFromOutcome` (1.7):** `structuredClone` the narrative verbatim into the report; the analysis subtree stays byte-stable and untouched. No change needed beyond the wider `Narrative` type flowing through. [Source: src/assemble/report.ts]
- **`classifyReport` / showpiece-vs-substrate (1.8):** `ShowpieceReport` REQUIRES `narrative`; the substrate path has none. The richer narrative only deepens the showpiece render; the branch logic is unchanged. [Source: src/render/render.port.ts]
- **Privacy by construction (1.6):** the narrate stage receives **only `Analysis`** — never `RepoHistory` — so the prompt cannot leak commit messages / paths / diffs / keys. Preserve this: `buildNarrativePrompt(analysis)` serializes only `analysis.metrics`. [Source: src/narrate/prompt.ts, narrate.port.ts]

### Determinism, privacy & fail-open posture (unchanged)

- **`temperature: 0`** stays pinned internally (the tightest determinism the non-deterministic narrative layer allows; not a user input). The narrative is the **one** non-deterministic subtree — the `analysis` subtree remains byte-stable, so the determinism harness is unaffected (it never narrates). [Source: architecture.md#LLM sampling determinism, src/narrate/generate.ts]
- **Fail-open** is preserved: a generation failure (incl. a schema-validation failure when a weak model can't produce a valid three-part narrative) → `degraded` in `auto` (substrate + exit 9) or `NarrationError` in `required` (exit 6). The richer schema raises the bar a model must clear, which is correct — an incomplete "narrative" is not a showpiece. 3.5 (confidence) + 3.3 (batch degradation) refine this later. [Source: src/narrate/narrate.ts, prd.md#FR-11 fail-open]
- **No new dependencies.** Reuses `ai` `generateObject` + `zod`. No provider change (gemini-only slice holds).

### Previous-story intelligence

- **Naming collision avoided:** `report-schema.ts` already exports `ExplanationSchema`/`Explanation` for the **per-metric** four-facet explanation; the narrative-level **Explanation** part needs the same name. Resolution: rename the per-metric one → `MetricExplanationSchema`/`MetricExplanation` (it is pinned-but-unpopulated until 3.2, and only `report-schema.ts` references it — verified no external importer), freeing `Explanation` for the narrative part. [Source: grep — `Explanation` used only within report-schema.ts; `ReportNarrative` is the type other modules import]
- **Fixture blast radius (mechanical):** every `NARRATIVE` test fixture is the 1.6 `{ summary }` shape — expand each to the three-part shape: `narrate.test.ts`, `generate.test.ts`, `terminal-renderer.test.ts`, `render.port.test.ts`, `assemble/report.test.ts`, `assemble/report-schema.test.ts`, `cli/run.test.ts`. Keep the fixtures compact (1 paragraph, 1 chapter/1 step). [Source: grep — NARRATIVE/summary fixtures]
- **schemaVersion stays `1.0.0`:** the narrative shape was explicitly **reserved** for Epic 3 expansion at 1.0.0 ("the SHAPE is pinned at 1.0.0; populated in Epic 3"), so adding the three parts is the planned fill-in, not a breaking bump. [Source: src/assemble/report-schema.ts comments]

### Project Structure Notes

- Modified: `src/narrate/{schema,narrate.port,prompt,generate,narrate}.ts` (+ their `.test.ts`), `src/assemble/report-schema.ts` (+ `.test.ts`, `report.test.ts`), `src/render/terminal/terminal-renderer.ts` (+ `.test.ts`), `src/render/render.port.test.ts`, `src/cli/run.test.ts`. **No** engine/model/metric/select/config change; the `analysis` subtree and determinism harness are untouched. [Source: architecture.md#Complete Project Directory Structure]
- No new files — the three parts live in the existing `narrate/schema.ts`; the render extends the existing showpiece path.

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.1: Full three-part Narrative] (the ACs)
- [Source: docs/planning-artifacts/prds/prd-commit-sage-2026-06-06/prd.md#FR-8] (the three parts + Coaching structure + plain-language) · [Source: …#FR-9] (grounding via prompt constraints + a later verification pass — 3.4) · [Source: …§3 Glossary] (Summary / Explanation / Coaching definitions)
- [Source: docs/planning-artifacts/architecture.md#Canonical Report JSON] (narrative subtree = Summary/Explanation/Coaching + per-metric explanations) · [Source: …#Three validation checkpoints] (LLM-output + Report-JSON-in)
- [Source: docs/planning-artifacts/ux-designs/ux-commit-sage-2026-06-11/EXPERIENCE.md] (Coaching = introduction, themed chapters of prioritized steps, closing summary; team-level, never per-developer ranking)
- [Source: src/narrate/schema.ts · prompt.ts · generate.ts · narrate.ts · narrate.port.ts] (the 1.6 stack to extend) · [Source: src/assemble/report-schema.ts] (the narrative subtree) · [Source: src/render/terminal/terminal-renderer.ts] (the showpiece render)

### Completion Notes

- **All three ACs satisfied.** AC1: the `Narrative` is exactly `{ summary, explanation, coaching }` — required at the **generation** schema (`narrate/schema.ts` `NarrativeSchema`, bound by `generateObject`), the **read-back** schema (`assemble/report-schema.ts` `.strict()`), and the **type** level (`ShowpieceReport` requires `narrative`); the showpiece renders the three **labeled** parts **in order** (a render test asserts `Summary` < `Explanation` < `Coaching`). AC2: Coaching is `{ introduction, chapters[{theme, steps}], closingSummary }` with `.min(1)` on chapters + steps (and, post-patch, on each content string) — a flat/chapterless/empty coaching is **rejected by validation**, not just discouraged by the prompt. AC3: the prompt instructs plain-language / no-jargon / **team-level (never per-developer ranking)** / grounded-in-metrics / acknowledge-`not_available`, each asserted by a prompt test; privacy holds by construction (the stage takes **`Analysis` only** — the prompt serializes exactly `analysis.metrics`).
- **The schema is the single source of truth.** `narrate/schema.ts` defines the three part-schemas + the combined `NarrativeSchema`; `Narrative` is **inferred** and re-exported through `narrate.port.ts`, so a `Narrative` value cannot omit a part and still type-check. `report-schema.ts` composes the same part schemas into its strict read-back `NarrativeSchema` and renamed the per-metric `ExplanationSchema`→`MetricExplanationSchema` (disambiguating the narrative **Explanation** part from the §3.2 per-metric **Metric Explanation**; only `report-schema.ts` referenced it, so the rename is contained).
- **One generation call.** `generateNarrative` binds the whole three-part `NarrativeSchema` in a single `generateObject` call (`temperature: 0` retained). Per-group batching + coaching-as-its-own-call is **Story 3.3**; this keeps 3.1 minimal.
- **Fail-open / determinism / privacy posture unchanged.** A generation or schema-validation failure (e.g. a weak model that can't produce a valid three-part narrative) still degrades to substrate in `auto` (exit 9) or throws `NarrationError` in `required` (exit 6). The `analysis` subtree stays byte-stable (the determinism harness never narrates).
- **Patch:** `.min(1)` on the new Explanation/Coaching content strings + array items, so the structural "not a flat list" guarantee extends to "no empty steps/paragraphs/themes." The 1.6 `SummarySchema` was deliberately left untouched (its "accepts empty keyFindings" contract).
- **Render:** the terminal showpiece now renders `Summary` (headline · overview · Key findings) → `Explanation` (paragraphs) → `Coaching` (introduction → each chapter's bold theme + numbered prioritized steps → closing summary) → metrics table. HTML/Markdown/JSON renderers are Epic 4 (the Report JSON already carries all three parts).
- **388 tests** (+16); typecheck / lint / build clean. Substrate (`--no-ai`) path verified unchanged on the real binary; the narrated showpiece is covered by the renderer/assemble tests (the real narrated path needs a Gemini key).
- **No new dependencies.** gemini-only slice holds (3.6 owns full BYOK breadth).

### File List

**Modified (source):**
- `src/narrate/schema.ts` — add `ExplanationSchema`/`ChapterSchema`/`CoachingSchema`/`NarrativeSchema` (+ inferred types); `.min(1)` structural guards
- `src/narrate/narrate.port.ts` — re-export the inferred `Narrative` (+ part types) from `schema.js` (drop the hand-written interface)
- `src/narrate/prompt.ts` — `buildSummaryPrompt` → `buildNarrativePrompt` (three-part instruction + team-level/plain-language/grounding constraints; still metrics-only)
- `src/narrate/generate.ts` — `generateSummary` → `generateNarrative` (binds `NarrativeSchema`; `temperature: 0` retained)
- `src/narrate/narrate.ts` — orchestrator returns the full `narrative` (the `generate` dep now returns `Narrative`)
- `src/assemble/report-schema.ts` — expand the Report `NarrativeSchema` to the three required parts + optional per-metric map; rename `ExplanationSchema`→`MetricExplanationSchema` / `Explanation`→`MetricExplanation`
- `src/render/terminal/terminal-renderer.ts` — showpiece renders the three labeled parts in order (Coaching: intro → themed chapters of numbered steps → closing)

**Modified (tests):**
- `src/narrate/schema.test.ts` — three-part + structural-rejection + empty-content-rejection tests
- `src/narrate/prompt.test.ts` — names the three parts + Coaching structure + plain-language/team-level/grounding + privacy
- `src/narrate/generate.test.ts` — binds `NarrativeSchema`, three-part canned object
- `src/narrate/narrate.test.ts` — happy path narrates the full three-part narrative
- `src/render/terminal/terminal-renderer.test.ts` — three labeled parts **in order** + Explanation/Coaching content
- `src/assemble/report-schema.test.ts` · `report.test.ts` · `render/render.port.test.ts` · `cli/run.test.ts` · `cli/cli.e2e.test.ts` — `NARRATIVE` fixtures expanded to the three-part shape; a read-back "rejects a missing required part" test

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — epic-3 → in-progress; 3-1 → in-progress → done
- `docs/implementation-artifacts/3-1-full-three-part-narrative.md` — this story (record filled, status → done)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 3.1 drafted via create-story (ultimate context engine). Status → in-progress. |
| 2026-06-14 | Story 3.1 implemented (TDD): expanded the AI Narrative from Summary-only to the full three-part `{ summary, explanation, coaching }` — new zod part-schemas with structural `.min(1)` guards, `generateNarrative` binding the combined schema (one call, `temperature: 0`), the three-part prompt (team-level/plain-language/grounded), the Report read-back schema carrying all three parts (per-metric `ExplanationSchema`→`MetricExplanationSchema`), and a showpiece render of the three labeled parts in order. 41 files / 386 tests green; typecheck/lint/build clean; substrate e2e verified. Status → review. |
| 2026-06-14 | Code review (3 parallel layers) → Acceptance Auditor 0 (all 3 ACs MET, structural enforcement at 3 checkpoints, no scope creep, schemaVersion 1.0.0) + Blind Hunter 0-patch (3 Consider/1 Nit all dismissed with rationale). 1 patch from the Edge Case Hunter: `.min(1)` on the new Explanation/Coaching content strings + items (no empty steps/paragraphs/themes — completing AC2), `SummarySchema` left untouched (1.6 contract). 388 tests green; typecheck/lint/build clean. Status → done. |
