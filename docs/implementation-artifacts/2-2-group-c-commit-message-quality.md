---
epic: 2
story: 2
title: Group C — Commit Message Quality
baseline_commit: 86b7b4c312f7c464570b17bd52792e6717599c16
---

# Story 2.2: Group C — Commit Message Quality

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want commit-message quality metrics,
so that I can assess communication hygiene.

## Acceptance Criteria

1. **Six Group C metrics, deterministic, uniform envelope (AC1).** **Given** retrieved history, **when** the engine runs, **then** Group C metrics — **message-length distribution**, **Conventional Commits adherence**, **imperative-mood / style signal**, **low-information message rate**, **issue/ticket reference rate**, **revert/fixup signal** — are computed **deterministically** as pure functions over the shared `RepoModel`, each returning the uniform `Metric` envelope (`computed` with a value, or `not_available` with a reason — never thrown, never omitted).

2. **Heuristics document their rule and degrade honestly (AC2).** **Given** metrics that rest on heuristics (imperative-mood, issue-reference, Conventional-Commits, revert/fixup), **when** they run, **then** each **documents the exact rule it applies** (the matching regex / token set, as a commented module constant) **and** emits `not_available` with a reason where the data is insufficient to compute it (e.g. no non-empty commit messages).

## Tasks / Subtasks

- [ ] **Task 1 — `analyze/groups/c-message-quality.ts`: message-parsing helpers (AC1, AC2).** Pure, local helpers (mirroring Group A's local `countByBucket`), each a named const/function:
  - [ ] `subjectOf(message)` = the first line, trimmed (`""` for an empty/whitespace message). `bodyOf(message)` = everything after the first line with a leading blank-line separator collapsed, trimmed (`""` when there is no body). `wordCount(text)` = count of whitespace-separated non-empty tokens.
  - [ ] The documented rule constants (commented, `[ASSUMPTION]` where the catalog tags them): `CONVENTIONAL_TYPES` (the Angular set: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert), `CONVENTIONAL_RE`, `ISSUE_REF_RES` (the issue/ticket patterns), `BOILERPLATE_SUBJECTS` (the closed low-information token set), and the revert/fixup/squash prefixes.

- [ ] **Task 2 — The six metric functions + specs + `GROUP_C_METRICS` (AC1, AC2).** Mirror `a-cadence.ts`/`b-contribution.ts` exactly (exported `MetricSpec` consts, `MetricFn`s, a `GROUP_C_METRICS: RegisteredMetric[]` in stable order). All operate over `model.commits[].message`; **empty history ⇒ `not_available`** for every metric; a metric whose denominator is "non-empty messages" emits `not_available` when there are none:
  - [ ] **`c-message-length-distribution` "Message length distribution"** — `{ subjectLength: { min, median, p90, max, mean }, emptyMessageCount, withBodySharePct, commitCount }`. Subject length in characters over all commits; `emptyMessageCount` = commits whose subject is `""`; `withBodySharePct` = share with a non-empty body. (Flags the "chronically terse / absent" signal the PRD names.) `not_available` only on empty history.
  - [ ] **`c-conventional-commits` "Conventional Commits adherence"** — `{ adherentCount, adherenceSharePct, byType: Record<type, count> }`. A subject matches `CONVENTIONAL_RE` = `^(<type>)(\(scope\))?!?: .+`; `byType` is a **key-sorted** object counting adherent commits per type (deterministic). `not_available` when there are no non-empty subjects.
  - [ ] **`c-imperative-mood` "Imperative-mood / style signal"** `[ASSUMPTION]` — `{ subjectsConsidered, imperativeMoodSharePct, capitalizedSubjectSharePct, noTrailingPeriodSharePct }`. Strip any Conventional-Commits prefix, then the **documented heuristic**: a description is counted **non-imperative** when its first word ends in `ed` or `ing` (past tense / gerund) — the two reliable signals; `capitalized` = description's first char is an uppercase letter; `noTrailingPeriod` = subject doesn't end in `.`. `not_available` when there are no non-empty subjects.
  - [ ] **`c-low-information-rate` "Low-information message rate"** — `{ lowInfoCount, lowInfoSharePct, emptyCount, singleWordCount, boilerplateCount, commitCount }`. Low-info = empty subject **or** a single-word subject **or** a subject whose lowercased single token is in `BOILERPLATE_SUBJECTS` (`wip`, `fix`, `update`, `changes`, `stuff`, `misc`, `tmp`, `temp`, `test`, `minor`, `cleanup`, `.` …). `not_available` only on empty history.
  - [ ] **`c-issue-reference-rate` "Issue/ticket reference rate"** `[ASSUMPTION]` — `{ withReferenceCount, referenceSharePct, commitCount }`. A **full message** (subject + body) references an issue when it matches any of `ISSUE_REF_RES`: `#\d+` (GitHub/GitLab), `\b[A-Z][A-Z0-9]+-\d+\b` (JIRA-style key, e.g. `PROJ-123`), or a URL path `/(issues|pull|merge_requests)/\d+`. `not_available` only on empty history.
  - [ ] **`c-revert-fixup-signal` "Revert / fixup / amend signal"** — `{ revertCount, fixupCount, squashCount, churnOfIntentCount, churnOfIntentSharePct, commitCount }`. revert = subject starts with `Revert "` or `revert:` or `Revert `; fixup = subject starts with `fixup!`; squash = subject starts with `squash!`; `churnOfIntent` = their sum. (Note in a comment: a pure `--amend` rewrites in place and leaves **no** message marker, so it is intentionally not message-detectable.) `not_available` only on empty history.

- [ ] **Task 3 — Register Group C in the engine (AC1).** In [src/analyze/registry.ts](src/analyze/registry.ts), append `...GROUP_C_METRICS` to `ALL_METRICS` after Group B (stable order A→B→C). The engine does not change.

- [ ] **Task 4 — Tests: per-metric correctness + heuristic-rule + determinism (AC1, AC2).**
  - [ ] Co-locate `c-message-quality.test.ts`: each metric's `computed` value on a purpose-built fixture exercising every branch — Conventional + non-conventional subjects, past-tense vs imperative subjects, an empty message, a single-word/boilerplate (`wip`) subject, an issue-referencing message (`#42`, `PROJ-7`, a URL), and a `Revert "…"` / `fixup!` subject — plus each metric's `not_available` on empty history (and the no-non-empty-subject path for the subject-denominator metrics).
  - [ ] **Heuristic-rule assertions (AC2):** test the documented edge of each heuristic — e.g. `"Fixed the bug"` (past tense) is non-imperative while `"Fix the bug"` is imperative; `feat(scope)!: x` is adherent and bucketed under `feat`; `wip` is low-info but `"add login"` is not; `PROJ-123` matches issue-ref but `ABC` (no number) does not.
  - [ ] Confirm `tests/determinism/analysis-determinism.test.ts` stays green with Group C appended (it runs `analyze` over `ALL_METRICS` — byte-identical + order-independent). If a `SYNTHETIC_HISTORY` message needs a tweak to exercise a Group C branch in the harness, do it **without** changing Group A/B asserted values (those groups don't depend on message text beyond the co-author trailer added in 2.1).

## Dev Notes

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **Both hunters and the spec-aware Auditor independently cleared the implementation: Blind Hunter 0 patches, Auditor 0 patches (both ACs MET, all six PRD §4.2 metrics faithful, scope "perfect", determinism compliant).** The Edge Case Hunter found one defensive-hardening item. Triage: **1 patch · 1 defer · ~13 dismissed · 0 decision-needed.**

**Patch:**

- [x] [Review][Patch] `minOf`/`maxOf` had an implicit non-empty precondition (`values[0]` as the seed) — safe in context (every caller guards `commits.length === 0` first) but fragile if a future caller forgets [src/analyze/groups/c-message-quality.ts] — **Fixed:** both helpers now return `0` for an empty array (matching how callers already coerce via `round(… ?? 0)`), so they hold their own precondition with no behavior change. 273 tests green.

**Defer (tracked in deferred-work.md):**

- [x] [Review][Defer] The JIRA issue-key pattern `\b[A-Z][A-Z0-9]+-\d+\b` requires ≥2 leading caps, so a single-letter project key (`A-456`) is not matched [src/analyze/groups/c-message-quality.ts] — deferred: ≥2 caps is the common, false-positive-resistant default (a lone `X-1` is highly ambiguous with ranges/hyphenation); widen with a configurable issue-key pattern if a real single-letter-project need surfaces (issue-tracker integration is well beyond Epic 2).

**Dismissed (highlights):** "`revert:` is counted by both `c-conventional-commits` (type `revert`) and `c-revert-fixup-signal`" — **intentional and documented** (they measure different things: convention adherence vs. churn-of-intent; the module comment states it); "imperative heuristic counts 3-letter `ed` words like `Bed`/`Fed` as imperative" — **correct**: the `length > 3` guard is deliberate, and `Bed`/`Fed`/`Add` *are* valid imperatives; "unicode subject length counts UTF-16 code units not graphemes" — documented limitation, deterministic, grapheme-aware counting is Epic 4 render polish territory; "`feat:nospace` rejected / `feat(scope)): x` rejected" — both **correct** per the Conventional grammar; plus the full set of zero-commit / single-commit / all-empty-subject / CRLF / empty-description-after-prefix paths all verified correct by both hunters.

### Scope discipline — what this story does and does NOT include

This is the **second Epic 2 metrics story** — it adds **Group C** to the catalog using the Story 1.5 engine/model machinery unchanged. Group C reads only `model.commits[].message`, so — unlike Story 2.1 — **no shared-model change is needed**.

**In scope:**
- The six Group C metric functions (`c-message-quality.ts`), each a pure `MetricFn` returning the uniform envelope, registered into `ALL_METRICS`.
- Local message-parsing helpers + the **documented heuristic rules** as commented module constants (AC2).

**Out of scope / deferred (do NOT build here):**
- **Groups D, E, F** — Stories 2.3–2.5. (Group F's hygiene score weights "Commit Message Quality 35%"; it will *consume the computed Group C values*, not re-parse messages — Story 2.5.)
- **Commit-selection inputs** (author filter / max-commits / no-merges / dates / timezone narrowing the set) — **Story 2.6**. Group C computes over whatever commit set the model holds; in particular it does **not** exclude merge commits (a `Merge branch …` subject is just a normal subject here) — `--no-merges` is a 2.6 selection input. [Source: docs/planning-artifacts/epics.md#Story 2.6]
- **Free-tier 100-commit cap** — **Story 2.7**.
- **AI Metric Explanations** (the four-facet per-metric LLM text) — **Epic 3, Story 3.2**. Group C emits only the deterministic envelope. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2]
- **Health bands** (`ok`/`watch`/`risk`/`n/a`) — render-time classifier (Epic 4), **not** stored in the envelope. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#Metric health bands]
- **The Group C overview chart** (stacked bar of message-quality categories) — Epic 4 render; 2.2 produces the *data* it consumes. [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-6]

### PRD §4.2 Group C catalog — the authoritative metric definitions

| id | Title (PRD) | What it represents (static description) |
|---|---|---|
| `c-message-length-distribution` | Message length distribution | subject/body length; flags chronically terse (`fix`, `wip`) or absent messages |
| `c-conventional-commits` | Conventional Commits adherence | share of messages matching the Conventional Commits standard (`feat:`, `fix:`, …) |
| `c-imperative-mood` | Imperative-mood / style signal | heuristic on subject style + capitalization/punctuation consistency `[ASSUMPTION]` |
| `c-low-information-rate` | Low-information message rate | proportion of messages that are empty, single-word, or boilerplate |
| `c-issue-reference-rate` | Issue/ticket reference rate | share of messages linking an issue/ticket ID `[ASSUMPTION]` |
| `c-revert-fixup-signal` | Revert / fixup / amend signal | frequency of reverts and `fixup!`/`squash!`-style messages; churn-of-intent indicator |

[Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 Group C] — IDs follow the `a-…`/`b-…` kebab convention; titles are verbatim. The static one-line description is **not** stored in the envelope (it surfaces via the catalog / Epic 3 explanations).

### AC2 — "document the heuristic" is a hard requirement (what the reviewer will check)

The epics AC explicitly requires heuristic metrics to **document their rule** and emit `not_available` where data is insufficient. Encode each rule as a **named, commented module constant** so the rule is self-evidencing in the source (not buried in inline logic):
- `CONVENTIONAL_RE` + `CONVENTIONAL_TYPES` — the exact Conventional-Commits grammar matched.
- The imperative heuristic — a commented description of the "first word ends in `ed`/`ing` ⇒ non-imperative" rule (it is a deliberate, documented approximation, `[ASSUMPTION]`).
- `ISSUE_REF_RES` — the array of issue/ticket regexes, each commented with what it matches (`#123`, `PROJ-123`, `/issues/123`).
- `BOILERPLATE_SUBJECTS` — the closed low-information token set.
- The revert/fixup/squash prefixes, with the amend-not-detectable note.

`not_available` reasons must be specific (e.g. `"No commits in the analyzed history."` vs `"No non-empty commit subjects to assess."`). A heuristic metric must **never throw** — the engine would convert a throw to `not_available`, but Group C should return `not_available` *deliberately* with a precise reason.

### The exact engine/model contracts to build on (do NOT redefine)

- **`MetricFn = (model: RepoModel, ctx: AnalysisContext) => Metric`**; return `computed(spec, value)` / `notAvailable(spec, reason)`; a throw is converted to `not_available` by the engine via the spec. [Source: src/analyze/engine.ts]
- **`Metric` envelope** = `{ id, group, title, status, value?, reason? }`; `value` must be `MetricValue` (JSON: number/string/boolean/null/array/object — **no `Date`/`Map`/`Set`/`bigint`**). The `MetricGroup` union and the Report-JSON `MetricSchema` enum **already include `"C"`** — no type/schema change. [Source: src/analyze/metric.ts, src/assemble/report-schema.ts]
- **`RepoModel.commits: NormalizedCommit[]`**, each with **`message: string`** (the full raw `%B` body from 1.4 — subject + blank line + body, CRLF already normalized by the parser). Group C reads only `message`. [Source: src/analyze/model.ts, src/retrieve/git-log.ts]
- **Determinism rules (C2):** pure function of the model; emit map-like values as **key-sorted plain objects** (see Group A's `countByBucket`, Group B's share arrays); use **`compareCodeUnits`** for any string ordering (never `localeCompare`); round non-integers with `round(...)` for stable JSON. [Source: src/analyze/model.ts, src/analyze/stats.ts]
- **Stats helpers available:** `mean`, `median`, `percentile`, `round`, `gini` (the last added in 2.1). Use `median`/`percentile`/`mean`/`round` for the subject-length distribution (mirror Group A's `commitSizeDistribution`, incl. the reduce-based `minOf`/`maxOf` idiom — never `Math.min(...arr)`). [Source: src/analyze/stats.ts, src/analyze/groups/a-cadence.ts]

### Implementation patterns this story must follow (mirror Groups A & B)

- **P2/P3:** `kebab-case.ts`, **named exports only**, co-located `*.test.ts` under `src/analyze/groups/`. New file `c-message-quality.ts` (the architecture map's name for Group C — for Group C the map and the PRD agree). [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure, eslint.config.js]
- **P5:** `analyze/` is under `no-console` and reads no env/clock/fs — pure functions of `(model, ctx)`. [Source: eslint.config.js]
- **Determinism / anti-spread:** reduce-based `minOf`/`maxOf` (Group A), key-sorted objects for `byType`, shares as `round(...)`-ed percentages, no `Map`/`Set`/`Date` in emitted values. **Regexes with the `/g` flag must be used carefully** — prefer `re.test(str)` on a **non-global** regex for boolean checks (a global regex's `lastIndex` is stateful across calls), or construct a fresh regex / use `String.matchAll` for counting. This is the single most common determinism/correctness footgun in this story. [Source: src/analyze/groups/a-cadence.ts, src/analyze/groups/b-contribution.ts]
- **`[ASSUMPTION]` rules** are named module consts with comments, exactly like Group A's `DORMANT_GAP_SECONDS` and Group B's window thresholds. [Source: src/analyze/groups/a-cadence.ts, src/analyze/groups/b-contribution.ts]

### Determinism harness — free coverage, must stay green

`tests/determinism/analysis-determinism.test.ts` runs `analyze(SYNTHETIC_HISTORY, ctx())` over **`ALL_METRICS`**, so appending Group C automatically subjects it to byte-identical + order-independent + no-`Date.now()` + fully-serializable checks. Every Group C value is an order-independent count/share/distribution over message text — which satisfies this by construction. `SYNTHETIC_HISTORY` already has varied messages (`Initial commit`, `Add feature`, `Fix bug\n\nDetailed body.`, `Merge branch 'x'`, and the `Co-authored-by` trailer added in 2.1); if a Group C branch needs an extra message shape exercised **inside the harness**, add it without disturbing Group A/B expectations. [Source: tests/determinism/analysis-determinism.test.ts, src/analyze/sample-history.ts]

### Previous-story intelligence (2.1, 1.5)

- **Group A & B are the exact template:** specs as exported consts, `MetricFn`s, a `GROUP_x_METRICS` array, `computed`/`notAvailable`, local pure helpers, named-const thresholds. Copy the structure. [Source: src/analyze/groups/a-cadence.ts, src/analyze/groups/b-contribution.ts]
- **Type gotcha from 2.1:** an emitted object-array element type must be a **`type` alias, not an `interface`** — TS interfaces are not assignable to `MetricValue`'s index-signature (`Record`-like) shape. If a Group C metric emits an array of objects (none currently do — `byType` is a record, distributions are flat), use a `type`. [Source: 2.1 Debug Log]
- **The model already carries `message`** verbatim (no extension needed) — Group C is the cleanest group: read-only over a field that already exists. [Source: src/analyze/model.ts]
- **CRLF already normalized** by `parseGitLog` (`/\r?\n/`), so `subjectOf`/`bodyOf` can split on `\n` safely. [Source: src/retrieve/git-log.ts]

### Project Structure Notes

- New file: `src/analyze/groups/c-message-quality.ts` (+ `c-message-quality.test.ts`). Modified: `src/analyze/registry.ts` (+Group C). **No model change, no stats change, no schema change.** [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- For Group C the architecture directory map and the PRD agree on the filename (`c-message-quality.ts`); no transposition to correct (unlike A/B in Story 1.5). [Source: 1-5 Project Structure Notes]

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.2: Group C — Commit Message Quality]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#4.2 History Analysis — Metrics Catalog (Group C)] · [Source: …#FR-4 Compute the metrics catalog] · [Source: …#FR-5]
- [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture] (hybrid topology, determinism rules, uniform envelope)
- [Source: src/analyze/groups/a-cadence.ts] · [Source: src/analyze/groups/b-contribution.ts] (the patterns) · [Source: src/analyze/model.ts] · [Source: src/analyze/metric.ts] · [Source: src/analyze/stats.ts] · [Source: src/analyze/registry.ts] · [Source: tests/determinism/analysis-determinism.test.ts]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean. (Two dev fixes: a duplicate `../model.js` import merged; the two `new RegExp` strings switched to `String.raw` template literals so the backslashes don't need double-escaping.)
- `npm run lint` → ESLint clean: no `console`/`process.env` in `analyze/`; named-exports-only. (The editor's SonarQube `Math.min/max` nudge on the reduce-based `minOf`/`maxOf` is **intentional** — the reduce form is Group A's anti-spread idiom; not an ESLint error.)
- `npm test` → vitest: **37 files / 273 tests passed** (was 36/255; +1 file, +18 tests). The determinism harness covers Group C via `ALL_METRICS` — byte-identical + order-independent green.
- `npm run build` → tsup ESM build success (`dist/index.js` 56.34 KB).
- **Real e2e on this repo:** `node dist/index.js . --no-ai` renders all six Group C metrics (this repo: 55% Conventional adherence, 100% imperative, 0 low-info).

### Completion Notes List

- **Both ACs satisfied.** AC1: six Group C metrics (`c-message-length-distribution`, `c-conventional-commits`, `c-imperative-mood`, `c-low-information-rate`, `c-issue-reference-rate`, `c-revert-fixup-signal`) are pure `MetricFn`s over `model.commits[].message`, each returning the uniform envelope, registered into `ALL_METRICS` after Group B (stable A→B→C). AC2: every heuristic metric **documents its rule** as a commented module constant (`CONVENTIONAL_RE`/`CONVENTIONAL_TYPES`, the imperative `ed`/`ing` rule, `ISSUE_REF_RES` with per-pattern comments, `BOILERPLATE_SUBJECTS`, the revert/fixup/squash prefixes) **and** emits `not_available` with a *specific* reason where data is insufficient (empty history → "No commits…"; no non-empty subjects → "No non-empty commit subjects to assess.").
- **No model/stats/schema change** — Group C is the cleanest group: read-only over the `message` field that already exists, and the `"C"` group enum is already in `metric.ts` + `report-schema.ts`. Only `c-message-quality.ts` (new) + the registry line changed in source.
- **Regex determinism footgun avoided (flagged in the story):** all boolean-check regexes are **non-global** (a `/g` regex carries a stateful `lastIndex` across `.test()` calls, which would make results depend on call order); Conventional bucketing uses `.exec` on a non-global regex; nothing relies on `lastIndex`. Verified by the cross-run stability test.
- **Documented heuristics (the reviewer's AC2 focus):** Conventional grammar `^(type)(\(scope\))?!?: .+` (accepts `feat(scope)!: x`); imperative = first description word does **not** end in `ed`/`ing` (a deliberate, documented `[ASSUMPTION]` approximation — `"Fixed…"`/`"Refactoring…"` → non-imperative, `"Fix…"` → imperative); issue-ref = `#123` ∪ JIRA `PROJ-123` ∪ forge URL `/issues|pull|merge_requests/123` (so `PROJ-123` matches, bare `ABC` does not); low-info = empty ∪ single-word ∪ closed boilerplate set; revert/fixup/squash by subject prefix, with a comment that a pure `--amend` leaves no marker and is intentionally not detectable.
- **Determinism idioms followed:** key-sorted `byType` object (`compareCodeUnits`), reduce-based `minOf`/`maxOf` (no argument-spread), rounded shares (2 dp) + rounded distribution stats, no `Map`/`Set`/`Date` in emitted values. Subject-denominator metrics (`conventional`, `imperative`) emit `not_available` when no non-empty subjects exist; count/rate metrics use the full commit count.
- **Scope deferrals honored:** no Groups D–F (2.3–2.5; Group F will *consume* the computed Group C value, not re-parse); no commit-selection inputs (2.6 — Group C does not exclude merge commits, a `Merge branch …` subject is a normal subject here); no Free-tier cap (2.7); no AI explanations (Epic 3); no health bands (render-time, Epic 4); no Group C overview chart (Epic 4). No new dependencies.
- **Test update (not a behavior change):** `engine.test.ts`'s metric-id-order assertion extended from 12 (A+B) to the full 18-id A→B→C catalog.
- **SonarQube advisory** (unchanged): `type IsoDate = string` — intentional. No new gate-failing advisories.

### File List

**Added (source):**
- `src/analyze/groups/c-message-quality.ts` — six Group C `MetricFn`s + specs + `GROUP_C_METRICS` + documented heuristic-rule constants

**Added (tests, co-located):**
- `src/analyze/groups/c-message-quality.test.ts` (per-metric correctness + documented-heuristic edges + cross-run stability)

**Modified (source):**
- `src/analyze/registry.ts` — append `GROUP_C_METRICS` to `ALL_METRICS`

**Modified (tests):**
- `src/analyze/engine.test.ts` — metric-id-order assertion extended to the A→B→C catalog

**Modified (review patch):**
- `src/analyze/groups/c-message-quality.ts` — `minOf`/`maxOf` self-safe on an empty array (return `0`)

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 2-2 → in-progress → review
- `docs/implementation-artifacts/2-2-group-c-commit-message-quality.md` — this story (record filled, status → review)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 2.2 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 2.2 implemented (TDD): six deterministic Group C message-quality metrics (`c-message-quality.ts`) over `commit.message`, each heuristic documenting its rule as a commented constant (AC2); non-global regexes avoid `/g` statefulness; registered into `ALL_METRICS`. No model/stats/schema change. 1 new suite; 37 files / 273 tests green; typecheck/lint/build clean; real e2e on this repo verified. Status → review. |
| 2026-06-13 | Code review (3 parallel layers) → Blind Hunter 0 / Acceptance Auditor 0 (both ACs MET, all six PRD metrics faithful, scope perfect, determinism compliant). 1 patch / 1 defer / ~13 dismissed. Applied: `minOf`/`maxOf` self-safe on empty array (defensive). Deferred: single-letter JIRA keys. Dismissed: revert dual-count (intentional), 3-letter `ed` imperative (correct), unicode code-unit length (documented). 273 tests green; typecheck/lint/build clean. Status → done. |
