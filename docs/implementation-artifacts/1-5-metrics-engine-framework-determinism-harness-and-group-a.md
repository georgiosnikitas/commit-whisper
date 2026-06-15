---
baseline_commit: 3978984af33a028f5c50cd3c53d8b289a57eef5f
---

# Story 1.5: Metrics-engine framework, determinism harness, and Group A

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want deterministic Activity & Cadence metrics computed from my history,
so that I get a reproducible first analysis and the engine pattern is proven.

## Acceptance Criteria

1. **(AC1 — Shared model + pure-function metrics + uniform envelope)** Given retrieved history, when the engine runs, then a single shared normalized model is built **once**, and each Group A metric is a **pure function** over it returning the uniform envelope `{ id, group, title, status, value?, reason? }`.

2. **(AC2 — Byte-identical determinism)** Given the same input history analyzed twice, when results are compared, then they are **byte-identical**, enforced by a determinism harness using an injected `analysisTimestamp`, total ordering `[committerDate, sha]`, `.mailmap`-aware author canonicalization, and UTC computation.

3. **(AC3 — `not_available`, never silently omitted)** Given a metric that cannot be computed, when the engine runs, then it is emitted with `status: "not_available"` and a reason, never silently omitted.

## Tasks / Subtasks

- [x] **Task 1 — Metric envelope contract (`src/analyze/metric.ts`) (AC: 1, 3)**
  - [x] Define the uniform envelope **exactly** per C2: `MetricStatus = "computed" | "not_available"`; `MetricGroup = "A" | "B" | "C" | "D" | "E" | "F"`; `MetricValue` (JSON-serializable: `number | string | boolean | null | MetricValue[] | { [k: string]: MetricValue }`); `Metric { id: string; group: MetricGroup; title: string; status: MetricStatus; value?: MetricValue; reason?: string }`. Named exports only (P2). **No health band in the envelope** — that's a render-time classifier (deferred, see Dev Notes).
  - [x] Provide two tiny constructors so metric fns never hand-roll envelopes inconsistently: `computed(spec, value): Metric` (sets `status:"computed"`, attaches `value`, no `reason`) and `notAvailable(spec, reason): Metric` (sets `status:"not_available"`, attaches `reason`, no `value`), where `spec = { id, group, title }`. This enforces AC3's "reason present when not_available, value present when computed" by construction.
  - [x] Co-locate `metric.test.ts`: `computed`/`notAvailable` set the right `status` and never carry the other's field; the envelope shape is exactly the 6 keys.
- [x] **Task 2 — Author identity canonicalization (`src/analyze/identity.ts`) (AC: 2)**
  - [x] Implement `.mailmap`-aware canonicalization as a **pure function over injected mailmap data** (no file I/O here — see Dev Notes "Mailmap source"). `CanonicalIdentity { name: string; email: string }`; `canonicalizeIdentity(raw: Identity, mailmap: MailmapIndex): CanonicalIdentity`.
  - [x] Normalize the fallback (no mailmap hit): lowercase + trim the email (email is the identity key); keep the name as-is but trimmed. A `MailmapIndex` maps a raw email (and optional name+email pair) → canonical `{name,email}`.
  - [x] Implement `parseMailmap(text: string): MailmapIndex` — parse the standard `.mailmap` grammar (`Proper Name <proper@email> Commit Name <commit@email>`, plus the email-only and name-rewrite forms; `#` comments; blank lines). Keep it a pure string→index function (table-testable). Document the supported subset; note unsupported exotic forms.
  - [x] Co-locate `identity.test.ts`: canonical mapping via a full mailmap line; email-only rewrite; comment/blank-line handling; fallback lowercases/trims the email; two raw identities that mailmap-collapse to one canonical identity compare equal.
- [x] **Task 3 — Shared normalized model, built once (`src/analyze/model.ts`) (AC: 1, 2)**
  - [x] Implement `buildModel(history: RepoHistory, ctx: AnalysisContext): RepoModel` — the **single shared pass** (AC1's "built once"). `AnalysisContext = { analysisTimestamp: IsoDate; timezone: string; mailmap: MailmapIndex }` (all injected — determinism).
  - [x] `RepoModel` carries the normalized, **deterministically ordered** data each metric reads: `commits: NormalizedCommit[]` sorted by the **total order `[committerDate, sha]`** (committer date ascending, sha as tiebreaker); `authors: AuthorSummary[]` sorted by canonical identity; per-commit derived fields needed by Group A (canonical author/committer identity, parsed `committedAt`/`authoredAt` as epoch-ms for ordering, `parents`, total `additions`/`deletions`/`changedFileCount` with binary files excluded from line sums). Compute nothing AI- or render-specific.
  - [x] **Determinism baked in:** UTC computation; never call `Date.now()` (use `ctx.analysisTimestamp`); no reliance on `Map`/`Set` insertion order in any output array — always sort by the documented total order. A model built twice from identical input is deeply equal.
  - [x] Co-locate `model.test.ts`: commits are reordered into `[committerDate, sha]` regardless of input order; identities are canonicalized via the injected mailmap; binary files (`additions:null`) are excluded from line totals but counted in `changedFileCount`; an empty `RepoHistory` ⇒ a model with `commits: []`, `authors: []`.
- [x] **Task 4 — Group A metrics as pure functions (`src/analyze/groups/a-cadence.ts`) (AC: 1, 2, 3)**
  - [x] Implement the **6 Group A metrics** (PRD §4.2) each as `(model: RepoModel, ctx: AnalysisContext) => Metric`, pure over the model:
    - `a-commit-volume` — commits bucketed per day/week/month (UTC + `ctx.timezone`-aware day boundaries); `value` = `{ perDay, perWeek, perMonth }` count maps keyed by ISO bucket (deterministically ordered).
    - `a-commit-cadence` — average + median interval (seconds) between consecutive commits in committer-date order; `not_available` when `< 2` commits (no interval).
    - `a-active-dormant` — contiguous active vs. dormant stretches with start/end dates (define "dormant" by a documented gap threshold; note the `[ASSUMPTION]`).
    - `a-project-age` — first commit date, latest commit date, total elapsed (computed against the **injected `analysisTimestamp`**, not `Date.now()`); `not_available` on empty history.
    - `a-commit-size-distribution` — distribution of changed lines per commit (min/median/p90/max/mean stats); binary-only commits contribute 0 lines (documented). _(Review note: the catalog table + PRD §4.2 require the summary stats only; an explicit bucketed histogram is **not** required and was intentionally not added.)_
    - `a-time-of-day-day-of-week` — commit counts bucketed by hour-of-day and day-of-week in `ctx.timezone` (default UTC).
  - [x] Every metric returns the **envelope** via the Task 1 constructors. A metric that cannot compute (e.g. empty history, `< 2` commits) returns `notAvailable(spec, reason)` — **never** throws, **never** omitted (AC3).
  - [x] Co-locate `a-cadence.test.ts` (table-driven, deterministic, fixture commits): each metric's happy path on a known fixture; each metric's `not_available` path (empty / insufficient data) with a reason; timezone bucketing differs correctly between `UTC` and a non-UTC `ctx.timezone`.
- [x] **Task 5 — Metric registry + engine (`src/analyze/registry.ts`, `src/analyze/engine.ts`) (AC: 1, 3)**
  - [x] `registry.ts` — assemble the ordered list of all registered metric functions (Group A now; B–F appended in Epic 2). Export `GROUP_A_METRICS: MetricFn[]` and an aggregate `ALL_METRICS: MetricFn[]` so Epic 2 extends one place. `type MetricFn = (model: RepoModel, ctx: AnalysisContext) => Metric`.
  - [x] `engine.ts` — `analyze(history: RepoHistory, ctx: AnalysisContext): Analysis` where `Analysis = { metrics: Metric[] }`: build the model **once** (Task 3), then map every registered metric fn over it, collecting envelopes in **registry order** (stable). Any metric fn that throws is caught and converted to a `not_available` envelope with the error message as reason (AC3 — a bug in one metric never sinks the run or silently drops the metric). Engine output order is deterministic.
  - [x] **Determinism guard:** the engine reads time only from `ctx.analysisTimestamp`. It does not read `process.env`, the clock, or the filesystem (the mailmap arrives in `ctx`). It is a pure function of `(history, ctx)`.
  - [x] Co-locate `engine.test.ts`: the model is built once even with many metrics (spy/captured-call count = 1 if `buildModel` is injectable, or assert via a counting fixture); all Group A metric ids are present in output; a deliberately throwing metric fn surfaces as `not_available` (not a crash, not omitted); output ids are in registry order.
- [x] **Task 6 — Determinism harness (`tests/determinism/harness.ts` + `tests/determinism/analysis-determinism.test.ts`) (AC: 2)**
  - [x] Create the `tests/` top-level dir (first use — architecture reserves `tests/` for shared fixtures + the determinism harness, distinct from co-located unit tests). Add a shared **synthetic-history fixture** (`tests/fixtures/synthetic-history.ts`) — a hand-built `RepoHistory` with enough variety to exercise all 6 Group A metrics (multiple authors incl. a mailmap-collapsible pair, merge + root commits, binary + text files, commits across several days/timezones).
  - [x] `harness.ts` — `assertDeterministic(run: () => Analysis): void`: run twice and assert the two `Analysis` objects are **byte-identical** via `JSON.stringify` deep equality (the AC2 "byte-identical" bar — serialize both, compare strings). Also assert input-order independence: shuffle the fixture commits, run, and assert the serialized `Analysis` is unchanged (proves the `[committerDate, sha]` total order).
  - [x] `analysis-determinism.test.ts` — run the **real** engine over the synthetic fixture through the harness: (a) identical input twice ⇒ byte-identical serialized `Analysis`; (b) shuffled-input ⇒ identical serialized `Analysis`; (c) the injected `analysisTimestamp` is the only time source (two runs with the **same** injected timestamp match; a run that illegally used `Date.now()` would be caught by re-running — document this is the guardrail).
  - [x] Ensure `tests/**/*.test.ts` is picked up — confirm `vitest.config.ts` `include` covers it (it is `src/**/*.test.ts` today; **widen to also include `tests/**/*.test.ts`** — minimal config change, note it).
- [x] **Task 7 — Verify gates (AC: 1, 2, 3)**
  - [x] `npm run typecheck` clean; `npm run lint` clean (no `console`/`process.env` in `analyze/`; named-exports-only); `npm test` green (unit + determinism); `npm run build` clean.
  - [x] Remove the now-redundant `src/analyze/.gitkeep`.

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The spec-aware **Acceptance Auditor verified all 3 ACs genuinely met with real proofs** (model built once — same reference asserted; harness proves byte-identical + order-independent; `not_available` never omitted incl. the throwing-metric path). The hunters converged on determinism-integrity (`Date.parse`/NaN) and two correctness bugs. Triage: **4 patch · 8 defer · 5 dismissed · 0 decision-needed.**

> Context for severity: every timestamp the engine sees comes from git's strict `%cI`/`%aI` (ISO-8601 **with offset**, Story 1.4), so the NaN / local-time-parse scenarios cannot occur in the real pipeline — but the engine should fail **loud** rather than silently corrupt, and two of the bugs are real today.

**Patch:** _(all 4 applied & verified 2026-06-13 — suite green, 146 tests)_

- [x] [Review][Patch] `activeDormantPeriods` labels period days in **UTC** (`new Date(ms).toISOString().slice(0,10)`) while every sibling metric honors `ctx.timezone` — internally inconsistent report for any non-UTC tz. Use the tz-aware `dayBucket(ms, ctx.timezone)` [src/analyze/groups/a-cadence.ts] — **Fixed:** the metric now takes `ctx` and labels days via `dayBucket(ms, ctx.timezone)`; added a `Asia/Tokyo` test proving the dormant start shifts to `2024-01-04`.
- [x] [Review][Patch] `commitSizeDistribution` uses `Math.min(...sizes)` / `Math.max(...sizes)` — argument-spread on a per-commit array `RangeError`s on very large repos, and the engine's catch then silently drops the whole metric. Replace with a reduce-based min/max [src/analyze/groups/a-cadence.ts] — **Fixed:** added reduce-based `minOf`/`maxOf` (the SonarQube "prefer Math.min" advisory is the exact overflow bug being fixed — deliberately dismissed).
- [x] [Review][Patch] `buildModel` does no timestamp validation — a non-ISO / offset-less / garbage `committedAt`/`authoredAt`/`analysisTimestamp` yields `NaN`, which corrupts the `[committerDate, sha]` sort and propagates `NaN → null` through every metric **silently**. Parse once and throw a typed `MetricsError` (exit 5) on a non-finite parse, turning silent corruption into a loud, scriptable failure (determinism integrity) [src/analyze/model.ts] — **Fixed:** `parseInstant(iso, label)` throws `MetricsError` on a non-finite `Date.parse`; tests cover a bad commit timestamp and a bad `analysisTimestamp`.
- [x] [Review][Patch] Reconcile Task 4's `a-commit-size-distribution` parenthetical ("+ bucketed histogram") with the authoritative catalog table + PRD §4.2 ("distribution of changed lines per commit"), which require only the stats already emitted (min/median/p90/max/mean) — correct the over-specified Task wording rather than add an unrequired field [docs/implementation-artifacts/1-5-...md] — **Fixed:** Task 4 reworded to the summary stats with a review note; no code change.

**Defer (tracked in deferred-work.md, not actioned now):**

- [x] [Review][Defer] Strict ISO-8601-with-offset **format** validation (beyond the non-finite guard) — assert each timestamp carries a `Z`/`±hh:mm` offset so a future non-git input source can't introduce host-local-time parsing [src/analyze/model.ts] — deferred: git always emits offsets; full format validation belongs with the config/input Zod story.
- [x] [Review][Defer] `Intl` ICU/tzdata variance across runtimes — bucket labels for historical/future instants can differ between Node builds with different bundled ICU; document the "same-runtime" determinism boundary and consider pinning/`full-icu` [src/analyze/time.ts] — deferred: inherent to dependency-free tz; Node 22 ships full ICU; same-runtime determinism (the CI trend-diff target) holds.
- [x] [Review][Defer] Invalid / unknown IANA timezone + small-ICU build — `formatterFor` throws `RangeError` (3 metrics degrade to `not_available`); add a `try/catch` fallback to UTC, or validate `timezone` upstream [src/analyze/time.ts] — deferred: tz validation belongs with the config Zod story; current behavior degrades gracefully, not a crash.
- [x] [Review][Defer] Unicode NFC/NFD identity normalization — visually-identical names/emails in different normal forms fragment into separate authors [src/analyze/identity.ts] — deferred: rare; fold into a mailmap/identity hardening pass when real `.mailmap` reading lands (1.8).
- [x] [Review][Defer] `parseMailmap` hardening — `#` inside a quoted segment, `≥3` segments, an empty canonical name [src/analyze/identity.ts] — deferred: parses the documented common forms; exotic mailmaps are rare and currently skipped safely.
- [x] [Review][Defer] Author summary keyed by `email\x00name` fragments one author across differing commit names (no mailmap) — consider keying author grouping by canonical **email** alone (the documented identity key) [src/analyze/model.ts] — deferred: this is an author-identity **semantics** decision (git's own default groups by name+email; mailmap is the canonicalizer), not a clear bug; revisit with Group B (Contribution & Ownership, Epic 2) which owns author analytics.
- [x] [Review][Defer] `stats` NaN/Infinity guards + `percentile` p-clamping — return `null` on non-finite input / clamp `p` to 0..100 [src/analyze/stats.ts] — deferred: once `buildModel` guards timestamps (Patch 3) the metric inputs are finite, so this is belt-and-suspenders; add with the next stats consumer (Group E churn).
- [x] [Review][Defer] DST / calendar-day vs absolute-duration: `gapDays`/`lifespanDays` divide elapsed seconds by a flat `86400` and ISO-week is Monday-based while `byWeekday` is Sunday=0 — document the conventions and decide whether durations should be calendar-day-aware [src/analyze/groups/a-cadence.ts, src/analyze/time.ts] — deferred: conventional and deterministic today; a presentation/clarity refinement, not a correctness defect.

**Dismissed (5):** "blanket `try/catch` converts bugs to `not_available`" (that **is** AC3 by design — a bug in one metric must not sink the run; the throwing-metric test asserts it); `formatterCache` module mutation (referentially-transparent memoization — deterministic, reads no clock/env); `err.message` text in `reason` is "engine-specific" (only on a thrown bug, which Patch 3 removes for valid input; two runs on the same runtime produce identical text — cross-engine error-text portability is out of scope, and `reason` is recomputed each run); `AnalysisContext.analysisTimestamp: string` vs `IsoDate` (`type IsoDate = string` — identical, and `IsoDate` is the intentionally-kept alias); identity fallback "doesn't normalize name casing, contradicting the file comment" (misread — the comment refers to **email** casing, which **is** normalized; name canonicalization is mailmap's job).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope (the metrics-engine keystone + Group A only):**
- The **metric envelope** (`metric.ts`) + constructors.
- **`.mailmap` canonicalization** (`identity.ts`, pure over injected mailmap text).
- The **shared normalized model built once** (`model.ts`).
- **Group A's 6 metrics** as pure functions (`groups/a-cadence.ts`).
- The **registry + engine** (`registry.ts`, `engine.ts`).
- The **determinism harness** + synthetic fixture (`tests/determinism/`, `tests/fixtures/`).

**Out of scope / deferred (do NOT build here):**
- **Groups B–F (~24 metrics)** — Story 2.1–2.5. This story proves the **engine pattern** on Group A; B–F append to `registry.ts` later. [Source: docs/planning-artifacts/epics.md#Epic 2: Complete Metrics Catalog]
- **Commit-selection filters + Free 100-cap** — `authorFilter`/`maxCommits`/`noMerges`/dates (Story 2.6), cap (2.7). The engine analyzes the **full** `RepoHistory` it's given; filtering happens upstream later. [Source: docs/planning-artifacts/epics.md#Story 2.6]
- **Reading `.mailmap` from disk** — `identity.ts` is pure over injected mailmap **text**; the actual `.mailmap` file read (from the repo via `retrieve/`) is wired when the pipeline composes (Story 1.8) or as a small retrieve add-on. For 1.5, `AnalysisContext.mailmap` is injected (tests pass a parsed index; an empty index = no canonicalization beyond email-normalization). Note this seam. [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]
- **Health band (`ok`/`watch`/`risk`/`n/a`)** — `render/health-band.ts`, a **render-time** presentational classifier (Epic 4). The metric envelope deliberately **does not** carry a band; thresholds are catalog domain knowledge consumed at render. Do NOT add a band field. [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]
- **Report JSON assembly** (the `analysis` subtree wrapper, `schemaVersion`, `degraded` marker) — Story 1.7. 1.5 emits the in-memory `Analysis { metrics }`; 1.7 wraps it into canonical Report JSON. [Source: docs/planning-artifacts/epics.md#Story 1.7]
- **AI Metric Explanations** — the per-metric `narrative.explanations[id]` is the AI layer (Story 1.6/Epic 3), **joined by id**, never welded into the envelope. The envelope stays pure. [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]
- **Zod validation of the envelope** — C1 says metrics-engine output is **internally typed only** (no external input ⇒ trust the types, no runtime cost). Do NOT add Zod here. [Source: docs/planning-artifacts/architecture.md#C1 — Data Contracts & Runtime Validation]

### The uniform metric envelope (C2 — copy exactly)

```ts
type MetricStatus = "computed" | "not_available";
type MetricGroup = "A" | "B" | "C" | "D" | "E" | "F";
type MetricValue = number | string | boolean | null | MetricValue[] | { [k: string]: MetricValue };

interface Metric {
  id: string;          // stable, kebab e.g. "a-commit-cadence"
  group: MetricGroup;
  title: string;
  status: MetricStatus;
  value?: MetricValue;  // present iff status === "computed"
  reason?: string;      // present iff status === "not_available"
}
```

This envelope is **the whole of what lands in the Report JSON `analysis` subtree** (C1) — keep it pure (no AI explanation welded in, no health band). The AI explanation is joined later by `id` under `narrative.explanations[id]`. [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]

### Determinism rules (AC2 — all four, baked in)

1. **Injected `analysisTimestamp`** — every age/recency computation reads `ctx.analysisTimestamp` (sourced from the frozen `RunConfig`, Story 1.2), **never `Date.now()`**. (`Date.now()` anywhere in `analyze/` is the determinism bug the harness exists to catch.)
2. **Total stable ordering** — commits by `[committerDate, sha]` (committer date asc, sha tiebreaker); authors by canonical identity; files lexically. **Never** rely on `Map`/`Set` insertion order in any emitted array — sort explicitly.
3. **`.mailmap` author canonicalization** — honored via `identity.ts`; else normalized (lowercased/trimmed) email.
4. **UTC computation** — metrics compute in UTC; the user `timezone` governs **bucketing display** for the time-of-day/day-of-week and volume metrics, applied deterministically. Author-local time is a display detail.

The **byte-identical** bar (AC2) is met by serializing two `Analysis` runs with `JSON.stringify` and comparing — so every value must be a stable, JSON-serializable, deterministically-ordered structure (no `Map`, no `Set`, no `Date` objects in `value`; use ISO strings / plain objects with sorted keys). [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]

### Mailmap source (the injection seam)

`identity.ts` is a **pure** `(rawIdentity, mailmapIndex) → canonicalIdentity` + a pure `parseMailmap(text) → index`. Where the `.mailmap` **text** comes from (reading `<repo>/.mailmap`, or `git check-mailmap`) is a **retrieve/pipeline** concern wired later; for 1.5 the engine takes a parsed `MailmapIndex` in `AnalysisContext`. Tests inject it directly. An **empty** index means "no rewrites" — canonicalization still lowercases/trims emails (rule 3's fallback). This keeps `analyze/` pure and free of I/O (and of the env-isolation/`process` concerns). [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]

### Timezone handling without a new dependency

The user `timezone` (IANA, default `UTC`) governs day/week/month and hour/day-of-week bucketing. Node's built-in `Intl.DateTimeFormat` with `timeZone` (and `formatToParts`) gives deterministic, dependency-free tz-correct bucketing — **prefer it over adding a date library** (lean/SEA posture; no new deps without approval). Compute the underlying metric in UTC; apply the tz only to derive bucket labels. If a robust tz approach proves to need a library, **HALT and ask** rather than adding one silently. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.1] [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#Scope discipline]

### Group A metric catalog (PRD §4.2 — the 6 to implement)

| id (kebab) | title | notes |
|---|---|---|
| `a-commit-volume` | Commit volume over time | per day/week/month counts; tz-bucketed |
| `a-commit-cadence` | Commit frequency / cadence | avg + median interval; `not_available` if < 2 commits |
| `a-active-dormant` | Active vs. dormant periods | contiguous stretches + start/end dates; documented gap threshold `[ASSUMPTION]` |
| `a-project-age` | Project age & lifespan | first/latest commit + elapsed vs **injected** `analysisTimestamp`; `not_available` on empty |
| `a-commit-size-distribution` | Commit size distribution | changed-lines-per-commit stats; binary files contribute 0 lines |
| `a-time-of-day-day-of-week` | Time-of-day / day-of-week pattern | hour + weekday buckets in `ctx.timezone` (default UTC) |

[Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 History Analysis — Metrics Catalog]

### Architecture topology (hybrid — one read, pure fns)

One shared pass builds the normalized model (`model.ts`); each metric is a **pure function** over it (`groups/a-cadence.ts`). One expensive normalization; isolated, table-testable, deterministic-by-design computations. `not_available` is just a function returning that status. The engine (`engine.ts`) builds the model once and maps the registry over it. [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]

### Implementation patterns this story must follow (P-rules — lint-enforced)

- **P2:** `kebab-case.ts`; **named exports only**; metric ids are stable kebab strings. [Source: architecture#Implementation Patterns]
- **P5:** **no `console`** in `analyze/` (pipeline folder). Surface an uncomputable metric as `not_available`; surface a true engine fault as `MetricsError` (exit 5, already in `shared/errors.ts` from 1.3) — but per AC3 a single metric's failure becomes `not_available`, not a thrown error. [Source: architecture#Stream Discipline]
- **Env isolation:** `analyze/` must **not** read `process.env`, the clock, or the filesystem — all inputs arrive via `history` + `ctx`. This is what makes determinism enforceable. [Source: eslint.config.js]
- **P3:** unit tests **co-located**; `tests/` holds **only** shared fixtures + the determinism harness (this story creates that dir). [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#Testing standards]

### Previous story intelligence (1.1–1.4)

- **Consumes 1.4's raw model:** `import type { RepoHistory, RawCommit, Identity, ChangedFile } from "../retrieve/retrieve.port.js"`. `RawCommit` has `sha`, `author`/`committer` `Identity`, `authoredAt`/`committedAt` (ISO strings), `message`, `parents: string[]`, `files: ChangedFile[]` (`additions`/`deletions` `null` ⇒ binary). [Source: src/retrieve/retrieve.port.ts]
- **`analysisTimestamp` lives on `RunConfig`** (1.2) as an `IsoDate` (string). The engine takes it via `ctx` (don't reach into `RunConfig` directly in metric fns — keep them pure over `model`+`ctx`). [Source: src/config/run-config.ts]
- **`MetricsError` (exit 5) exists** (1.3). Use only for a genuine engine-level fault; per-metric failures are `not_available`. [Source: src/shared/errors.ts]
- **Toolchain:** TS 6.0.3 strict, ESM `.js` specifiers in source, `nodenext`, `"types":["node"]`, vitest 4.1.8. `import type` for type-only. **No new deps** (tz via `Intl`). [Source: docs/implementation-artifacts/1-2-...#Completion Notes]
- **`src/analyze/` holds only `.gitkeep`** — first real modules; remove it (as for `cli/` 1.3, `retrieve/` 1.4). [Source: src/analyze/.gitkeep]
- **Recursive `JSON.stringify` equality** is the established "byte-identical" test technique (cf. the frozen-config tests). Keep all metric `value`s plain-JSON + sorted-key for stable serialization.

### Testing standards

- vitest 4.1.8, **co-located** `*.test.ts` for units; `tests/determinism/` for the harness; `tests/fixtures/` for the shared synthetic history. **Widen `vitest.config.ts` `include`** to `["src/**/*.test.ts", "tests/**/*.test.ts"]`.
- The **determinism harness is the AC2 proof** — identical input twice ⇒ byte-identical serialized `Analysis`, and shuffled input ⇒ identical (total-order proof). Table-driven metric tests for happy + `not_available` paths.
- DoD: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.

### Project Structure Notes

- New files land under `src/analyze/` per the architecture map: `metric.ts`, `identity.ts`, `model.ts`, `registry.ts`, `groups/a-cadence.ts`. **Naming note:** the architecture map lists `groups/a-contribution.ts` and `groups/b-cadence.ts` — that mapping is **mislabeled** (it swaps Group A "Activity & Cadence" with Group B "Contribution & Ownership"). PRD §4.2 is authoritative: **Group A = Activity & Cadence**, so this story creates `groups/a-cadence.ts`. Flag in Completion Notes; B lands as `groups/b-contribution.ts` in Epic 2. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure] [Source: docs/planning-artifacts/prds/...#4.2]
- `engine.ts` is **not** explicitly in the architecture map (which lists `model.ts`/`registry.ts`); it's the thin "build model once + map registry" composer. Named per P2; flag in Completion Notes (same pattern as 1.2's `resolve-run-config.ts`).
- `tests/` top-level dir is created here for the first time (architecture reserves it).

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.5: Metrics-engine framework, determinism harness, and Group A]
- [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]
- [Source: docs/planning-artifacts/architecture.md#C1 — Data Contracts & Runtime Validation]
- [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 History Analysis — Metrics Catalog]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.1 Repository Retrieval] (timezone input)
- [Source: src/retrieve/retrieve.port.ts] · [Source: src/config/run-config.ts] · [Source: src/shared/errors.ts] · [Source: eslint.config.js] · [Source: vitest.config.ts]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean. Hit one `rootDir` violation when `src/` co-located tests imported the fixture from `tests/fixtures/` (a non-`src` file dragged into the `rootDir:"src"` program); resolved by relocating the shared fixture to `src/analyze/sample-history.ts` (tests import downward from `src`).
- `npm run lint` → ESLint clean: no `console`/`process.env`/`Date.now()` in `analyze/`; named-exports-only; deterministic `compareCodeUnits` used instead of locale-sensitive `localeCompare`.
- `npm test` → vitest: **22 files / 143 tests passed** (was 16/113; +6 files, +30 tests) — incl. the determinism harness proving byte-identical + order-independent analysis.
- `npm run build` → tsup ESM build success (the analyze modules + the fixture are not reachable from the entrypoint, so the bundle is unchanged).

### Completion Notes List

- **All 3 ACs satisfied.** AC1: `buildModel` runs the single normalized pass (proven by an engine test asserting all metrics receive the **same** model reference), and each of the 6 Group A metrics is a pure `(model, ctx) => Metric` returning the uniform envelope. AC2: the determinism harness serializes two `Analysis` runs with `JSON.stringify` and asserts byte-identical, plus an order-independence check (seeded shuffles of the input commits ⇒ identical serialization, proving the `[committerDate, sha]` total order); determinism is built on the injected `analysisTimestamp` (never `Date.now()`), `.mailmap` canonicalization, and UTC compute. AC3: an uncomputable metric returns `notAvailable(spec, reason)` and a **throwing** metric is converted by the engine to `not_available` using its registered spec — never omitted, never a crash.
- **Self-describing registry (design decision, review-relevant):** rather than recovering a thrown metric's identity from `fn.name` (hacky, hardcodes group), the registry holds `RegisteredMetric { spec, fn }` descriptors, so the engine always knows a metric's `id/group/title` even when its computation throws. `MetricFn`/`RegisteredMetric` live in `model.ts` (the analysis-core types home).
- **Determinism guardrail — `compareCodeUnits`, not `localeCompare`:** all string sorts (sha tiebreaker, author identity, bucket keys) use a code-unit comparator. `localeCompare` was deliberately **rejected** — its order depends on the runtime locale and would silently break byte-identical determinism (AC2). The SonarQube "use localeCompare" advisory is wrong in this context and was dismissed (kept a `localeCompare` only in a non-determinism-critical test assertion).
- **Timezone bucketing with zero new deps:** `time.ts` uses the built-in `Intl.DateTimeFormat` (`formatToParts`, cached per tz) to derive tz-aware day/week/month/hour/weekday labels, honoring the lean/SEA posture. The metric is computed in UTC; the tz only labels buckets. Proven by a UTC-vs-`Asia/Tokyo` test where the 23:15 UTC commit shifts buckets.
- **Mailmap is injected, pure:** `identity.ts` is `parseMailmap(text)` + `canonicalizeIdentity(raw, index)` — no file I/O in `analyze/`. The actual `.mailmap` read is a pipeline concern (Story 1.8); for now `AnalysisContext.mailmap` is injected and an empty index still normalizes (lowercases/trims) emails so cosmetic casing collapses.
- **Naming corrections vs the architecture map (flagged):** the architecture directory map mislabels the group files (it swaps Group A "Activity & Cadence" with Group B "Contribution"); PRD §4.2 is authoritative, so Group A lives in `groups/a-cadence.ts`. `engine.ts` (the "build once + map registry" composer) and `time.ts`/`stats.ts` (pure helpers) are not in the map — named per P2; same documented pattern as 1.2's `resolve-run-config.ts`.
- **Fixture location (deviation, flagged):** the architecture reserves `tests/fixtures/` for shared fixtures, but `rootDir:"src"` forbids `src/` unit tests from importing a `tests/` file. The shared synthetic history lives in `src/analyze/sample-history.ts` instead; the `tests/determinism/` harness imports it downward from `src/`. `tests/` now holds only the determinism harness + its test. Noted for review (an alternative is a dedicated tests `tsconfig`, deferred).
- **`tests/` is not `tsc`-typechecked** (the `tsconfig` `include` is `["src"]`), so the determinism harness/test are checked only by vitest/esbuild at run time — the same gap as the 1.1-deferred "root config files escape tsc". Acceptable; the suites run green.
- **Scope deferrals honored:** Groups B–F (append to `registry.ts`, Epic 2); commit-selection filters + Free cap (2.6/2.7); health band (`render/health-band.ts`, Epic 4 — the envelope deliberately carries no band); Report JSON assembly (1.7 wraps `Analysis`); AI explanations (joined by id later); Zod validation (C1 says engine output is internally-typed only). No new dependencies.
- **SonarQube advisory** (unchanged): `type IsoDate = string` in `config/run-config.ts` — intentional. New-file advisories (nested ternaries, `.at(-1)`, unnecessary cast) were resolved during implementation; tsc/eslint/vitest/tsup all green.

### File List

**Added (source):**
- `src/analyze/metric.ts` — `Metric` envelope + `computed`/`notAvailable` constructors
- `src/analyze/identity.ts` — `parseMailmap`/`canonicalizeIdentity`/`emptyMailmap`
- `src/analyze/model.ts` — `buildModel`, `RepoModel`/`NormalizedCommit`/`AuthorSummary`/`AnalysisContext`, `MetricFn`/`RegisteredMetric`, `compareCodeUnits`
- `src/analyze/time.ts` — `Intl`-based tz bucketing (`dayBucket`/`isoWeekBucket`/`monthBucket`/`zonedParts`)
- `src/analyze/stats.ts` — `mean`/`median`/`percentile`/`round`
- `src/analyze/groups/a-cadence.ts` — the 6 Group A metrics + `GROUP_A_METRICS`
- `src/analyze/registry.ts` — `ALL_METRICS`
- `src/analyze/engine.ts` — `analyze` (build once + map registry; throw → `not_available`)
- `src/analyze/sample-history.ts` — shared synthetic fixture (`SYNTHETIC_HISTORY`/`SYNTHETIC_MAILMAP`)

**Added (tests):**
- co-located: `metric.test.ts`, `identity.test.ts`, `model.test.ts`, `groups/a-cadence.test.ts`, `engine.test.ts`
- `tests/determinism/harness.ts` (+ `assertDeterministic`/`assertOrderIndependent`/`serializeAnalysis`), `tests/determinism/analysis-determinism.test.ts`

**Modified:**
- `vitest.config.ts` — `include` widened to `["src/**/*.test.ts", "tests/**/*.test.ts"]`

**Removed:**
- `src/analyze/.gitkeep`

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 1-5 → in-progress → review → done
- `docs/implementation-artifacts/1-5-metrics-engine-framework-determinism-harness-and-group-a.md` — this story (baseline_commit, tasks checked, record filled, review findings, status → done)

**Patched during code review (2026-06-13):**
- `src/analyze/groups/a-cadence.ts` — tz-aware dormant day labels (`dayBucket(ms, ctx.timezone)`); reduce-based `minOf`/`maxOf` (no spread overflow)
- `src/analyze/model.ts` — `parseInstant` throws `MetricsError` (exit 5) on a non-finite timestamp (fail loud, not silent `NaN`)
- `src/analyze/model.test.ts`, `src/analyze/groups/a-cadence.test.ts` — added timestamp-validation + tz-dormant regression tests
- `docs/implementation-artifacts/deferred-work.md` — 8 deferred review items appended

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 1.5 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 1.5 implemented (TDD): metric envelope + constructors, `.mailmap` canonicalization, shared normalized model (built once, `[committerDate, sha]` order), 6 Group A metrics (pure fns, `Intl` tz bucketing), self-describing registry + engine (throw → `not_available`), and the determinism harness (byte-identical + order-independent proof). 6 new suites; 22 files / 143 tests green; typecheck/lint/build clean. Status → review. |
| 2026-06-13 | Code review (3 layers). All 3 ACs confirmed met by the spec-aware auditor with real proofs. Applied 4 patches: tz-aware dormant day labels, reduce-based min/max (large-repo overflow), fail-loud timestamp validation (`MetricsError`, determinism integrity), and a Task-wording reconcile. 8 items deferred, 5 dismissed. Suite green (146 tests). Status → done. |
