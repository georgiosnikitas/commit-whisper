---
baseline_commit: fea784b7d75b6e359af50c7096f90f78c3fddc07
---

# Story 1.7: Canonical Report JSON assembly

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a single canonical Report JSON assembled from metrics and narrative,
so that all outputs derive from one source of truth and trends diff cleanly.

## Acceptance Criteria

1. **(AC1 — Two-subtree Report JSON, joined by id, schema-validated)** Given computed metrics and the generated narrative, when assembly runs, then it produces a well-formed Report JSON with `schemaVersion: "1.0.0"` structured into two top-level subtrees — **`analysis`** (deterministic: all metric values/status from the engine, no AI) and **`narrative`** (AI: Summary + per-metric explanations keyed by metric id under `narrative.explanations[metricId]`) — **and** the deterministic metric envelope is **not** welded to its AI explanation (joined by metric `id` across the subtrees), **and** the `analysis` subtree is **byte-stable** for identical input while `narrative` may vary, **and** the JSON **validates against its Zod schema on read-back**.

2. **(AC2 — Optional narrative + `degraded` marker)** Given a metrics-only or fail-open run with no narration, when assembly runs, then the `narrative` subtree is **absent** (optional) and a top-level **`degraded: boolean`** marker records whether the run completed degraded (`true`) or by intent (`false`), so JSON consumers detect the state without parsing exit codes, **and** the `analysis` subtree is **always present**, so trend diffs never depend on the AI layer.

## Tasks / Subtasks

- [x] **Task 1 — Report JSON Zod schema (`src/assemble/report-schema.ts`) (AC: 1, 2)**
  - [x] Define the canonical schema with **standard `zod`** (the same dep introduced in 1.6): `ReportSchema` = `{ schemaVersion: z.literal("1.0.0"); degraded: z.boolean(); analysis: AnalysisSchema; narrative: NarrativeSchema.optional() }`.
  - [x] `MetricSchema` mirrors the 1.5 envelope exactly: `{ id: string; group: enum(A..F); title: string; status: enum("computed","not_available"); value?: <JSON value>; reason?: string }`. Use a recursive `z.lazy` JSON-value schema (or `z.unknown()` with a comment) for `value` — keep it permissive but JSON-serializable. `AnalysisSchema = { metrics: z.array(MetricSchema) }`.
  - [x] `NarrativeSchema` = `{ summary: SummarySchema; explanations: z.record(z.string(), ExplanationSchema).optional() }` — **reuse** `SummarySchema` from `narrate/schema.ts` (single source). For 1.7, `explanations` is the **forward-compatible keyed-by-metric-id shape** but is **optional/absent** (per-metric explanations are Epic 3) — define a minimal `ExplanationSchema` placeholder (or omit `explanations` from the produced object entirely and note it). Prefer: include the `explanations?` field in the **type/schema** (so the contract is pinned at 1.0.0) but never populate it yet.
  - [x] `export type Report = z.infer<typeof ReportSchema>` and the sub-types. Named exports only (P2). **No secrets** ever appear (the narrative is Summary text only; `Secret` never reaches here).
  - [x] Co-locate `report-schema.test.ts`: a full report (with narrative) parses; a substrate report (no narrative) parses; `schemaVersion` must be exactly `"1.0.0"` (a wrong version fails); `degraded` is required; an extra/unknown top-level key is rejected if the schema is `.strict()` (decide strict vs passthrough — recommend strict on the top level for contract tightness; note the choice).
- [x] **Task 2 — Report assembler (`src/assemble/report.ts`) (AC: 1, 2)**
  - [x] `assembleReport(input: { analysis: Analysis; narrative?: Narrative; degraded: boolean }): Report` — a **pure** function. Produces `{ schemaVersion: "1.0.0", degraded, analysis, narrative? }`: `analysis` is the 1.5 engine output **passed through unchanged** (byte-stable); `narrative` is included **iff** provided (the optional subtree). Never mutates inputs.
  - [x] **The metric envelope is not welded to its explanation:** the `analysis.metrics[]` carry only the deterministic envelope; per-metric explanations (when they exist, Epic 3) live under `narrative.explanations[id]`, joined by `id`. For 1.7 the join is structural (no explanations populated yet) — assert the envelope is copied verbatim, no `explanation`/`value`-welding.
  - [x] **Map the narrate outcome → assembly inputs** with a tiny adapter `reportFromOutcome(analysis: Analysis, outcome: NarrateOutcome): Report`: `narrated` ⇒ `{ analysis, narrative: outcome.narrative, degraded: false }`; `skipped` ⇒ `{ analysis, degraded: false }` (intentional metrics-only, **not** degraded); `degraded` ⇒ `{ analysis, degraded: true }` (fail-open, narrative absent). This is the bridge the CLI shell (1.8) uses; it encodes the AC2 "intentional vs degraded" distinction precisely.
  - [x] Co-locate `report.test.ts`: full report from a `narrated` outcome (narrative present, `degraded:false`); substrate from `skipped` (narrative absent, `degraded:false`); substrate from `degraded` (narrative absent, `degraded:true`); the `analysis` subtree is the **same object content** as the engine output (deep-equal, not welded); `schemaVersion === "1.0.0"`.
- [x] **Task 3 — Byte-stability + read-back validation harness (AC: 1)**
  - [x] Add a determinism assertion for the **`analysis` subtree**: serializing the assembled report's `analysis` twice from identical engine input is byte-identical (reuse the `tests/determinism` approach — the `analysis` is already byte-stable from 1.5; this proves assembly doesn't perturb it). Co-locate or extend `tests/determinism/` — prefer a co-located `report.test.ts` case that asserts `JSON.stringify(report.analysis)` is stable and **independent of whether `narrative` is present** (same `analysis` bytes with and without narrative).
  - [x] **Read-back validation (AC1 "validates against its Zod schema on read-back"):** `parseReport(json: string): Report` — `JSON.parse` then `ReportSchema.parse` (throws a typed error on a malformed report; for 1.7 a `RenderError`? **no** — assembly/parse is not render. Use a plain schema parse that throws the Zod error, or wrap in a typed assembly error. Recommend: a thin `parseReport` that returns `ReportSchema.parse(JSON.parse(json))`; the CLI/json-renderer story decides error mapping). Round-trip test: `assembleReport(...)` → `JSON.stringify` → `parseReport` → deep-equals the original (proves the schema accepts what the assembler emits).
  - [x] Co-locate the round-trip + byte-stability cases in `report.test.ts` (or a dedicated `report-roundtrip.test.ts`).
- [x] **Task 4 — Verify gates (AC: 1, 2)**
  - [x] `npm run typecheck` clean; `npm run lint` clean (no `console` in `assemble/`; named-exports-only; no `process.env`); `npm test` green; `npm run build` clean.
  - [x] Remove the now-redundant `src/assemble/.gitkeep`.

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The spec-aware **Acceptance Auditor verified both ACs genuinely met and scope clean** (schema mirrors the 1.5 envelope field-exact, `.strict()` rejects welding, read-back validation real, `degraded` intentional-vs-fail-open distinction real, `SummarySchema` reused). The hunters converged on the `analysis` aliasing risk and `NaN`-round-trip corruption. Triage: **3 patch · 6 defer · 7 dismissed · 0 decision-needed.**

**Patch:**

- [x] [Review][Patch] `assembleReport` assigns `analysis: input.analysis` **by reference**, so a later mutation of the caller's `Analysis` would poison the already-assembled report — contradicting the "pure / byte-stable" claim. Defensively `structuredClone` the `analysis` (and `narrative`) into the report so the output owns its data [src/assemble/report.ts] — **Fixed:** `assembleReport` now `structuredClone`s both `analysis` and `narrative`; a new test (`owns a defensive copy: mutating the caller's input afterward cannot poison the report`) asserts `report.analysis`/`report.narrative` are distinct references and survive post-assembly mutation of the inputs.
- [x] [Review][Patch] `JsonValueSchema` uses bare `z.number()`, which **accepts `NaN`/`±Infinity`** — values that `JSON.stringify` rewrites to `null`, silently corrupting a metric `value` across a read-back round-trip. Use `z.number().finite()` so a non-finite value fails validation loudly [src/assemble/report-schema.ts] — **Fixed (no code change — finding was a false positive):** verified at runtime that **zod 4's `z.number()` already rejects `NaN`/`±Infinity`** (and `.finite()` is *deprecated* in zod 4, so adding it would re-introduce a lint/type advisory). Kept bare `z.number()` + a clarifying comment, and added a lock-in test (`rejects a non-finite metric value …`) covering `NaN`/`Infinity`/`-Infinity` at top level and nested — so a future zod downgrade/regression fails loudly.
- [x] [Review][Patch] `reportFromOutcome`'s `switch` has no exhaustiveness guard — a future `NarrateOutcome.kind` would fall through and return `undefined` typed as `Report`. Add a `default: assertNever(outcome)` (or equivalent) so a new variant is a **compile error**, not a silent runtime contract break [src/assemble/report.ts] — **Fixed:** added `default: return assertNever(outcome);` with a module-private `assertNever(value: never): never` guard — a new `NarrateOutcome.kind` is now a compile error at this switch.

**Defer (tracked in deferred-work.md, not actioned now):**

- [x] [Review][Defer] Typed-error wrapping for `parseReport` — `JSON.parse` throws a raw `SyntaxError` and `ReportSchema.parse` a raw `ZodError`; wrap both in a typed `CommitWhisperError` (likely `RenderError`/a new assembly code) so a malformed read-back is scriptable [src/assemble/report.ts] — deferred: the story Task 3 explicitly leaves error mapping to the CLI/json-renderer story (1.8), which owns how a bad report surfaces.
- [x] [Review][Defer] Validate on the **write** path too (`ReportSchema.parse` the assembler output, or in a dev/test assertion) so a malformed `Analysis` (bad group, non-finite value) is caught at emit, not only at a downstream read-back [src/assemble/report.ts] — deferred: the engine output is internally typed (C1 says no runtime cost on the way out); add a belt-and-suspenders emit-time check if a non-engine producer ever appears.
- [x] [Review][Defer] `schemaVersion` migration path — `z.literal("1.0.0")` hard-fails any other version; a trend-diff tool reading historical reports will eventually need a version branch / typed `MigrationError` [src/assemble/report-schema.ts] — deferred: 1.0.0 is the only version that exists; design the migration seam when the second version is introduced (Rule of Three).
- [x] [Review][Defer] `z.record(z.string(), …)` admits prototype-pollution keys (`__proto__`/`constructor`) in `value` and `explanations`; add a key guard/allow-list on the read-back path [src/assemble/report-schema.ts] — deferred: the producer is our own engine (keys are metric ids / known fields); harden when arbitrary external reports are ingested (the trend-diff read story).
- [x] [Review][Defer] `MetricSchema` status↔value/reason invariant — a `computed` envelope with no `value`, or a `not_available` with a `value`, currently passes; add a `.superRefine` to enforce the 1.5 constructor invariant at the schema level [src/assemble/report-schema.ts] — deferred: the 1.5 `computed`/`notAvailable` constructors already guarantee this by construction on the write path; the schema-level check is read-back hardening for foreign reports.
- [x] [Review][Defer] `explanations` keys not referentially tied to `analysis.metrics` ids + `z.lazy` recursion depth bound — refine `explanations` keys ⊆ metric ids, and cap the recursive `value` depth against an adversarial deeply-nested read-back [src/assemble/report-schema.ts] — deferred: explanations are unpopulated until Epic 3 (Story 3.2 owns the id-join validation); depth-bounding belongs with the external-report ingestion hardening.

**Dismissed (7):** "no canonical sorted-key serializer ⇒ byte-stability unproven" (byte-stability is inherited from the 1.5 determinism harness — the engine emits already-ordered structures; `JSON.stringify` preserves insertion order deterministically for identical input, which is the contract, and assembly passes `analysis` through unperturbed); "`bigint` value throws on stringify" (the 1.5 `MetricValue` type forbids bigint — metrics only emit number/string/boolean/null/array/object; not a reachable input); "`.strict()` is cosmetic because `value` is open recursive JSON" (intentional — a metric `value` **is** arbitrary JSON by the C2 envelope contract; `.strict()` correctly guards the envelope's *known* keys, which is what catches welding); "`summary` isn't `.strict()`" (true but it's the spec-mandated single-source reuse of `SummarySchema`; tightening it belongs in `narrate/schema.ts`, not here — and extra summary keys are impossible since we emit it); "comment-coupling: schema mirrors 1.5 envelope with no enforcement" (the Auditor confirmed the inferred `value?: unknown` is a clean supertype so `assembleReport` passes `Analysis` through with **no cast** — TS structurally enforces the mirror at the call site); "in-suite byte-stability test is tautological" (correct and intended — the story scopes the genuine proof to 1.5's harness; 1.7 only proves it doesn't perturb); "degraded carries no cause/reason" (by design — the `reason` is human chrome for stderr/exit-code, not Report JSON; FR-12 keeps the JSON to `analysis`/`narrative`/`degraded`, and a reason string in the byte-stable report would be a determinism leak).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope (the canonical Report JSON assembly):**
- The **Report JSON Zod schema** (`report-schema.ts`) at `schemaVersion: "1.0.0"`.
- The **pure assembler** (`report.ts`) joining `analysis` + optional `narrative` + the `degraded` marker.
- The **outcome→report adapter** (`reportFromOutcome`) encoding intentional-vs-degraded.
- **Read-back validation** (`parseReport`) + **`analysis` byte-stability** assertions.

**Out of scope / deferred (do NOT build here):**
- **Rendering** (terminal/HTML/Markdown/JSON renderers, showpiece-vs-substrate branch) — Story 1.8 (terminal + JSON emit) and Epic 4 (HTML/Markdown). 1.7 produces the **in-memory `Report` + its serialization/validation**; the `json-renderer.ts` that writes it to a file/stdout is the render layer. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- **Per-metric AI explanations** (`narrative.explanations[id]` populated) — Epic 3 (Story 3.2, four-facet per-metric). 1.7 **pins the keyed-by-id shape in the schema** (forward-compatible at 1.0.0) but never populates it; the `summary` is the only narrative content (from 1.6). [Source: docs/planning-artifacts/epics.md#Story 3.2]
- **Coaching / full three-part Narrative** — Epic 3 (Story 3.1). 1.7's `NarrativeSchema` carries `summary` (+ the optional `explanations` placeholder); Coaching/Explanation parts are added when Epic 3 widens the narrative (a non-breaking additive change within 1.0.0 if designed in now — but **don't** add empty Coaching fields speculatively; keep it to what 1.6 produces). [Source: docs/planning-artifacts/epics.md#Story 3.1]
- **The CLI shell wiring** (retrieve→analyze→narrate→assemble→render, exit codes) — Story 1.8. 1.7 ships `assembleReport`/`reportFromOutcome`/`parseReport`; nothing calls them yet. [Source: docs/planning-artifacts/architecture.md#Decision Impact Analysis]
- **Health band** in the Report JSON — explicitly **not** stored (render-time classifier, Epic 4). The schema is **not** widened with a band. [Source: docs/planning-artifacts/architecture.md#C2]
- **`zod/mini`** — C1 reserves `zod/mini` for SEA-lean schemas; for now standard `zod` (already a dep). A later optimization pass may switch; not here. [Source: docs/planning-artifacts/architecture.md#C1]

### The canonical Report JSON contract (C1 — pin exactly at 1.0.0)

```ts
// schemaVersion "1.0.0" — analysis REQUIRED · narrative OPTIONAL · degraded:boolean
interface Report {
  schemaVersion: "1.0.0";
  degraded: boolean;            // false = clean (full or intentional metrics-only); true = fail-open
  analysis: {                   // ALWAYS present — the deterministic, byte-stable trend-diff target
    metrics: Metric[];          // the 1.5 envelope, verbatim (no AI welded in)
  };
  narrative?: {                 // OPTIONAL — absent on metrics-only (skipped) and fail-open (degraded)
    summary: Summary;           // from 1.6 (headline/overview/keyFindings)
    explanations?: Record<string, Explanation>; // keyed by metric id — shape pinned now, populated Epic 3
  };
}
```

- **Subtree split along the determinism seam:** `analysis` is the engine's deterministic output (byte-stable for identical input — the trend-diff target, UJ-2); `narrative` is the AI layer's output (may vary, bounded by grounding later). The split is what lets trend-diffing target `analysis` alone. [Source: docs/planning-artifacts/architecture.md#C1]
- **Joined by id, never welded:** per-metric explanations (Epic 3) live under `narrative.explanations[metricId]`, joined to the metric envelope by `id` — the envelope (`analysis.metrics[]`) stays pure so the whole `analysis` subtree is cleanly diffable and independently renderable as the substrate. [Source: docs/planning-artifacts/architecture.md#C2]
- **`degraded` marker — the in-band intentional-vs-degraded signal:** `false` = a clean run (full showpiece **or** intentional `aiMode: off` metrics-only); `true` = narration was attempted and lost (fail-open). It lives **outside** the `analysis` subtree so it never perturbs trend-diffing, and lets a JSON consumer that never sees the exit code tell the two narrative-absent states apart. [Source: docs/planning-artifacts/architecture.md#C1]
- **`schemaVersion` 1.0.0 is pre-implementation but pinned now:** the subtree split, narrative-optionality, and `degraded` marker are frozen at 1.0.0 before it ossifies. Adding Coaching/Explanation parts under `narrative` later is **additive/non-breaking** within 1.0.0. [Source: docs/planning-artifacts/architecture.md#C1]

### C1 validation checkpoint (AC1 "validates on read-back")

This story realizes **C1 checkpoint 3 — Report-JSON-in:** validate on re-render of a previously emitted report. `parseReport` = `ReportSchema.parse(JSON.parse(json))`. The metrics-engine output is internally typed (no runtime cost on the way *out*); the Zod check is for the *read-back / re-render* trust boundary. The round-trip test (assemble → stringify → parseReport → deep-equal) proves the schema accepts exactly what the assembler emits. [Source: docs/planning-artifacts/architecture.md#C1]

### Previous story intelligence (1.5, 1.6)

- **`Analysis` (1.5):** `import type { Analysis } from "../analyze/engine.js"` = `{ metrics: Metric[] }`; `Metric` (1.5 `analyze/metric.ts`) = `{ id, group: "A".."F", title, status: "computed"|"not_available", value?, reason? }`. The `analysis` subtree is **already byte-stable** (proven by `tests/determinism`); 1.7 must pass it through **unchanged**. [Source: src/analyze/engine.ts, src/analyze/metric.ts]
- **`Narrative` + `NarrateOutcome` (1.6):** `import type { Narrative, NarrateOutcome } from "../narrate/narrate.port.js"`; `Narrative = { summary: Summary }`; `NarrateOutcome = { kind: "narrated"; narrative } | { kind: "skipped" } | { kind: "degraded"; reason }`. The outcome→report mapping is the precise AC2 encoding. `Summary` (1.6 `narrate/schema.ts`) = `{ headline, overview, keyFindings[] }` — **reuse `SummarySchema`** in `report-schema.ts`, don't redefine. [Source: src/narrate/narrate.port.ts, src/narrate/schema.ts]
- **`zod` is available** (1.6, exact-pinned `4.4.3`); standard `zod` is what we use (mirrors `narrate/schema.ts`). No new deps. [Source: package.json]
- **Determinism technique:** `JSON.stringify` deep-equality is the established byte-identical test (1.5 `tests/determinism/harness.ts`). The `analysis` subtree must serialize identically with and without `narrative` present. [Source: tests/determinism/harness.ts]
- **Toolchain:** TS 6.0.3 strict, ESM `.js` import specifiers, `nodenext`, `"types":["node"]`, vitest 4.1.8. `import type` for type-only. [Source: 1-2 Completion Notes]
- **`src/assemble/` holds only `.gitkeep`** — first real modules; remove it (as for `cli/` 1.3, `retrieve/` 1.4, `analyze/` 1.5, `narrate/` 1.6). [Source: src/assemble/.gitkeep]

### Implementation patterns this story must follow (P-rules — lint-enforced)

- **P2:** `kebab-case.ts`; **named exports only**; `report.ts` + `report-schema.ts` under `src/assemble/`. [Source: architecture#Implementation Patterns]
- **P5:** **no `console`** in `assemble/`. Assembly is pure; `parseReport` throws the Zod error (or a typed error) — never logs. [Source: architecture#Stream Discipline]
- **Env isolation / purity:** `assemble/` reads no `process.env`, no clock, no filesystem — `assembleReport` is a pure function of its inputs. [Source: eslint.config.js]
- **Determinism:** the assembler must not reorder, reformat, or re-key the `analysis` metrics — pass them through verbatim so byte-stability is preserved. No `Date.now()`, no `Map`/`Set` in the output. [Source: architecture#C2]
- **P3:** unit tests **co-located** `*.test.ts`. [Source: 1-1 Testing standards]

### Project Structure Notes

- New files exactly per the architecture map: `src/assemble/report.ts` and `src/assemble/report-schema.ts`, with co-located `*.test.ts`. No deviation. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- `reportFromOutcome` and `parseReport` are additional named exports within those two files (not new files) — the adapter + read-back validator the architecture's `report.ts` description implies ("builds canonical Report JSON … + degraded marker"). Flag in Completion Notes.

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.7: Canonical Report JSON assembly]
- [Source: docs/planning-artifacts/architecture.md#C1 — Data Contracts & Runtime Validation]
- [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture] (envelope not welded)
- [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure] (assemble/)
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-12: Compute the canonical Report JSON]
- [Source: src/analyze/engine.ts] · [Source: src/analyze/metric.ts] · [Source: src/narrate/narrate.port.ts] · [Source: src/narrate/schema.ts] · [Source: tests/determinism/harness.ts] · [Source: eslint.config.js]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean (the recursive `JsonValueSchema` via `z.lazy`, the reused `SummarySchema`, and the `Report` inferred type all resolve).
- `npm run lint` → ESLint clean: no `console`/`process.env` in `assemble/`; named-exports-only.
- `npm test` → vitest: **30 files / 199 tests passed** (was 28/179; +2 files, +20 tests).
- `npm run build` → tsup ESM build success.

### Completion Notes List

- **Both ACs satisfied.** AC1: `ReportSchema` (`schemaVersion: z.literal("1.0.0")`) splits into the required `analysis` subtree (the 1.5 metric envelopes, mirrored exactly) and the optional `narrative` subtree (reusing `SummarySchema` + a keyed-by-id `explanations` placeholder); `assembleReport` passes `analysis` through **verbatim** (byte-stable, deep-equal test) and the per-metric explanation is **not welded** into the envelope (the `MetricSchema` is `.strict()`, so a welded `explanation` field is rejected); `parseReport` validates on read-back and a round-trip test (assemble → `JSON.stringify` → `parseReport` → deep-equal) proves the schema accepts exactly what the assembler emits. AC2: `narrative` is omitted when absent, and the top-level `degraded` boolean distinguishes the two narrative-absent states — `reportFromOutcome` encodes it precisely (`skipped` ⇒ `degraded:false` intentional; `degraded` ⇒ `degraded:true` fail-open); `analysis` is always present.
- **Byte-stability proven two ways:** the `analysis` subtree serializes identically across two assemblies of identical input, **and** identically with vs. without a `narrative` present — so trend-diffing the `analysis` subtree never depends on the AI layer.
- **Strict schema (decision):** every object level is `.strict()` (top-level `Report`, `analysis`, `MetricSchema`, `narrative`, `explanations` entries) so an unknown/extra key is rejected — tightens the 1.0.0 contract and is what catches a welded explanation. Noted as a deliberate choice (vs. passthrough).
- **`reportFromOutcome` + `parseReport` are additional named exports** in `report.ts` (not new files) — the outcome→report bridge the CLI shell (1.8) uses, and the C1 "Report-JSON-in" read-back validator. Flagged per the architecture's two-file `assemble/` map.
- **Scope deferrals honored:** no rendering (`json-renderer.ts` / terminal / HTML — 1.8 / Epic 4); per-metric `explanations` **shape pinned but never populated** (Epic 3, Story 3.2); no Coaching / three-part Narrative (Epic 3, Story 3.1 — `NarrativeSchema` carries only the 1.6 `summary` + the optional explanations placeholder, no speculative empty fields); no CLI wiring (1.8); no health band in the JSON (render-time, Epic 4). No new dependencies (reused `zod@4.4.3` from 1.6).
- **`explanations` forward-compat:** the four-facet `ExplanationSchema` (`explanation`/`goodBehaviours`/`needsImprovement`/`suggestions`) is defined and accepted by the schema (a test feeds one), so Epic 3 can populate `narrative.explanations[id]` without a schema-version bump — an additive, non-breaking change within 1.0.0.
- **SonarQube advisory** (unchanged): `type IsoDate = string` — intentional. No new advisories; tsc/eslint/vitest/tsup all green.

### File List

**Added (source):**
- `src/assemble/report-schema.ts` — `ReportSchema` (+ `Metric`/`Analysis`/`Narrative`/`Explanation` schemas, `SCHEMA_VERSION`, inferred types)
- `src/assemble/report.ts` — `assembleReport`, `reportFromOutcome`, `parseReport`

**Added (tests, co-located):**
- `src/assemble/report-schema.test.ts`, `src/assemble/report.test.ts`

**Removed:**
- `src/assemble/.gitkeep`

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 1-7 → in-progress → review → done
- `docs/implementation-artifacts/1-7-canonical-report-json-assembly.md` — this story (record filled, status → done; review findings actioned)

**Modified (review patches):**
- `src/assemble/report.ts` — defensive `structuredClone` of `analysis`/`narrative`; `assertNever` exhaustiveness guard on `reportFromOutcome`
- `src/assemble/report.test.ts` — defensive-copy contract test
- `src/assemble/report-schema.ts` — clarifying comment (non-finite already rejected by zod 4 `z.number()`)
- `src/assemble/report-schema.test.ts` — non-finite metric-value rejection lock-in test

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 1.7 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 1.7 implemented (TDD): canonical Report JSON Zod schema (`schemaVersion 1.0.0`, strict, required `analysis` + optional `narrative` + `degraded`), pure `assembleReport`, `reportFromOutcome` bridge (intentional-vs-degraded), `parseReport` read-back validation; analysis byte-stability + round-trip proven. 2 new suites; 30 files / 199 tests green; typecheck/lint/build clean. Status → review. |
| 2026-06-13 | Code review (3 parallel layers) → 3 patch / 6 defer / 7 dismissed. Applied: defensive `structuredClone` in `assembleReport` (+contract test); `assertNever` exhaustiveness guard on `reportFromOutcome`; non-finite finding confirmed a false positive (zod 4 `z.number()` already rejects `NaN`/`±Infinity`; `.finite()` deprecated) — added a lock-in test instead. 201 tests green; typecheck/lint/build clean. Status → done. |
