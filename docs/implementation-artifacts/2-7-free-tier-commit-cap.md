---
epic: 2
story: 7
title: Free-tier 100-commit cap and truncation notice
baseline_commit: 13b2fd61d658bdb5e1ec3d37e8563e3c0bf28a93
---

# Story 2.7: Free-tier 100-commit cap and truncation notice

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Free-tier user,
I want a clear, predictable commit cap,
so that I understand exactly what was analyzed.

## Acceptance Criteria

1. **Date-first, then cap to the most-recent `min(maxCommits, freeCap)` (AC1).** **Given** the Free tier (a resolved `entitlement.commitCap` of 100) and a repository **or date range** exceeding the cap, **when** analysis runs, **then** commits are **filtered by date first**, then **capped to the most-recent 100 within that range** (by the model's total order `[committedAtMs, sha]`), **and** where both `--max-commits` and the Free cap apply, **the smaller wins** (the cap is `min` of the defined caps) — composed at the **same final cap step** Story 2.6 established (filters → cap), so the date window is never silently reshaped.

2. **Truncation notice on stderr (AC2).** **Given** the Free cap is the **binding** cap and it **truncated** the in-scope set (post-filter count `N` strictly greater than the cap, and the Free cap won over `--max-commits`), **when** selection runs, **then** the run emits exactly `Analyzed 100 of N commits — Free tier cap` to **stderr** (operational chrome via `ui`), where `N` is the post-filter, pre-cap count — **never** written into the byte-stable Report JSON, and **never** emitted when nothing was truncated or when a smaller `--max-commits` is the winning cap.

3. **Cap is tier policy in the config layer; `select` stays policy-free (AC3).** **Given** the resolved `entitlement` is the only place the tier→cap policy lives, **when** the cap is applied, **then** the literal `100` lives in the config/license layer (a named `FREE_TIER_COMMIT_CAP`, surfaced as the Free-tier `entitlement.commitCap`) and `selectCommits` applies **whatever `commitCap` it is handed** and signals truncation generically — **so** a paid tier (no `commitCap`) caps only by `--max-commits` and emits **no** Free notice, and the metric envelopes / determinism harness are unchanged (selection remains a pure pre-`buildModel` stage).

## Tasks / Subtasks

- [ ] **Task 1 — Compose the Free cap into the pure selection stage (AC1, AC2, AC3) [src/analyze/select.ts].** Extend the Story-2.6 stage without breaking its API:
  - [ ] Add `commitCap?: number` to `SelectionCriteria` (the entitlement's resolved cap; `undefined` ⇒ no tier cap).
  - [ ] `projectSelection` maps `commitCap: config.entitlement.commitCap` (alongside the existing fields; still no env/argv access).
  - [ ] Add `TruncationNotice = { analyzed: number; total: number }` and `SelectionResult = { history: RepoHistory; truncation?: TruncationNotice }`.
  - [ ] Factor the three filters into a private `applyFilters(history, criteria): readonly RawCommit[]` (no-merges → author → date; **no cap**) reused by both the result builder and the count — **one** filter implementation, no drift.
  - [ ] New **primary** function `selectCommitsWithNotice(history, criteria): SelectionResult`: `filtered = applyFilters(...)`, `total = filtered.length`; compose the effective cap = the **smaller** of the two *real* caps (`min(maxCommits, commitCap)`, each `undefined`/`≤0`/non-finite treated as "no cap"); `capped = capMostRecent(filtered, cap)`; produce `truncation = { analyzed: cap, total }` **iff** the Free cap is the binding cap **and** `total > cap` (the cap strictly truncated) — i.e. `commitCap` is a real cap, `commitCap ≤ maxCommits` (or `maxCommits` absent), and `total > commitCap`. Return `{ history: { repoTarget, commits: capped }, truncation }`.
  - [ ] Keep `selectCommits(history, criteria): RepoHistory` as a **thin delegate** (`selectCommitsWithNotice(...).history`) so every Story-2.6 filtering test stays green unchanged (zero churn); `capMostRecent` now takes the composed `cap` (its existing `undefined`/`≤0`/`length ≤ cap` no-op guards still hold).

- [ ] **Task 2 — Surface the resolved Free-tier cap in the entitlement (AC3) [src/config/resolve-run-config.ts].** Define `export const FREE_TIER_COMMIT_CAP = 100;` and set the default entitlement to `{ tier: "free", commitCap: FREE_TIER_COMMIT_CAP }` (the license gate is still Epic 7; this is the resolved policy the pipeline consumes). Update the one assertion that pins the default shape (`resolve-run-config.test.ts` → `{ tier: "free", commitCap: 100 }`). An explicitly injected entitlement (e.g. `{ tier: "unlimited" }`) still passes through unchanged (no cap on paid tiers).

- [ ] **Task 3 — Emit the truncation notice from the shell (AC2) [src/cli/run.ts].** Swap `selectCommits` → `selectCommitsWithNotice`; pass `selection.history` to `analyze`; when `selection.truncation` is present, `ui.info(`Analyzed ${t.analyzed} of ${t.total} commits — Free tier cap`)` (stderr chrome, emitted right after selection, before analyze — does not touch stdout / the Report JSON). No other stage changes.

- [ ] **Task 4 — Tests (AC1, AC2, AC3).**
  - [ ] **`select.test.ts` (pure, exhaustive) — target `selectCommitsWithNotice`:**
    - [ ] **Free cap binds + truncates:** `commitCap` below the in-scope count → `truncation = { analyzed: cap, total }`, history capped to the **most-recent `cap`** by `[committedAtMs, sha]`.
    - [ ] **No truncation when in-scope ≤ cap** (and the **exactly-equal** boundary: `total === cap` ⇒ **no** notice — strict `>`).
    - [ ] **Smaller `--max-commits` wins ⇒ no Free notice:** `maxCommits < commitCap` → capped to `maxCommits`, `truncation === undefined`.
    - [ ] **Larger `--max-commits` ⇒ Free cap wins ⇒ notice:** `maxCommits > commitCap` (and `total > commitCap`) → capped to `commitCap`, notice present.
    - [ ] **Tie `maxCommits === commitCap`, `total > cap`** → Free binds, notice present.
    - [ ] **Date-then-cap:** a date filter narrows to a subset, **then** the Free cap applies to the subset → `total` = post-date count (proves ordering + that `N` is the in-scope count, not the repo total).
    - [ ] **Paid tier (no `commitCap`):** only `--max-commits` caps; `truncation === undefined` even when `--max-commits` truncates.
    - [ ] **`selectCommits` delegate** still returns a `RepoHistory` and matches `selectCommitsWithNotice(...).history` (the 2.6 suite already covers the filter matrix).
    - [ ] **`projectSelection`** maps `entitlement.commitCap` → `criteria.commitCap`.
  - [ ] **`run.test.ts` (wiring):** a `runPipeline` over an injected fake retrieve with > cap commits and a small injected `entitlement.commitCap` asserts `ui.info` received exactly `Analyzed {cap} of {N} commits — Free tier cap` (capture `infos` in the recorder); a sub-cap history asserts **no** such notice. Existing cases (empty history) remain notice-free.
  - [ ] **`resolve-run-config.test.ts`:** the default entitlement now carries `commitCap: 100`; the injected-entitlement passthrough stays unchanged.

## Dev Notes

### Review Findings

**Code review — 2026-06-14** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The Blind Hunter and the spec-aware Acceptance Auditor both cleared it with 0 findings** — the Auditor verified all three ACs genuinely MET (date-then-cap with `N` = the in-scope **post-date** count; the exact em-dash notice to **stderr**, not the Report JSON; `min(maxCommits, commitCap)` smaller-wins; the `100` in the config layer; paid tiers silent), the architecture ruling respected, and no scope creep. The Edge Case Hunter found a **non-integer-cap** robustness pair. Triage: **1 patch · 0 defer · 0 dismissed.**

**Patch:**

- [x] [Review][Patch] A **non-integer cap** reached `slice(-cap)`: `commitCap: 2.5` reported a fractional `analyzed` (`"Analyzed 2.5 of 6"`), and a sub-1 cap (`0.5`) made `slice(-0.5) === slice(0)` keep **all** commits while the notice **still fired** (`analyzed: 0.5`) — a silently-wrong "truncated" claim (the 2.6 lesson) [src/analyze/select.ts] — **Fixed:** `realCap` now **floors** the cap to a whole count and treats `< 1` as "no cap" (consistent with its existing `≤0`/non-finite guards), so `analyzed` is always an integer, `capMostRecent` gets a well-defined integer cap, and the `analyzed === capped.length` invariant holds. Added two select tests (`floors a non-integer cap`, `treats a sub-1 cap as no cap`). Defensive: `entitlement.commitCap` is the integer 100 today and `--max-commits` is CLI-validated, but Epic 7's license response / env / config could supply a float.

**Dismissed:** none — the Blind Hunter and Acceptance Auditor returned no findings.

### Architecture decision — the Free cap is a `min`-composition at Story 2.6's last cap step (read first)

Story 2.6 deliberately made the **most-recent-N cap the final step** of the pure `selectCommits` stage (no-merges → author → date → **cap**), precisely so the Free cap "slots in after." 2.7 does **not** add a new pass — it composes the Free cap into that same final step:

- **`cap = min(maxCommits, commitCap)`** over the *defined, positive* caps (either may be absent). Applied by the existing `capMostRecent` (keep the most-recent `cap` by `[committedAtMs, sha]`). This is **date-first, then cap** by construction (the date filter already precedes the cap), so the cap "never silently reshapes the date window" (architecture ruling). [Source: docs/planning-artifacts/architecture.md#Date × Free-Cap ordering]
- **The notice is stderr chrome, not Report data.** The architecture is explicit: *"Any truncation is surfaced on **stderr** ('showing 100 of N'); the cap never silently reshapes the date window."* So the byte-stable `analysis` envelope (the C1/C2 trend-diff target) is **untouched**; the notice goes through `ui` (the single stderr surface, Story 1.3). The AC fixes the exact wording: `Analyzed 100 of N commits — Free tier cap`. [Source: docs/planning-artifacts/architecture.md#Date × Free-Cap ordering, src/shared/ui.ts]
- **Policy lives in the config/license layer; `select` is mechanism.** *"The pipeline only ever sees the resolved `entitlement` (tier + effective `commitCap`)."* So `selectCommits` never hardcodes `100` — it caps by the `commitCap` it's handed and signals truncation generically; the `100` is the Free-tier `entitlement.commitCap`, resolved in `resolve-run-config.ts` (the license gate that will *vary* it is Epic 7). This keeps the determinism/selection layer free of license policy and makes paid tiers (no cap) fall out for free. [Source: docs/planning-artifacts/architecture.md#RunConfig contract (`entitlement`), src/config/resolve-run-config.ts]

### Why enrich the return value instead of changing `selectCommits`'s signature

`select.test.ts` overloads its `shas` helper across both a raw `RepoHistory` (`shas(HISTORY)`) and a `selectCommits(...)` result — so changing `selectCommits` to return a result object would churn ~22 call sites. Instead: **`selectCommitsWithNotice` is the new primary** (returns `{ history, truncation? }`), and **`selectCommits` becomes a one-line delegate** returning `.history`. Every 2.6 filtering test stays green verbatim; `run.ts` switches to the richer function. A **single `applyFilters`** feeds both the capped result and the `total` count, so there is **no double-filtering and no drift**. [Source: src/analyze/select.test.ts, src/analyze/select.ts]

### The exact binding/notice semantics (what the reviewer will check)

Let `N = total` (post-filter, pre-cap count), `userCap = maxCommits` (real ⇒ defined, finite, `>0`), `freeCap = commitCap` (likewise). Effective `cap = min` of the real caps.

| Case | `cap` applied | `truncation` notice |
|---|---|---|
| `freeCap` real, `N > freeCap`, `userCap` absent | `freeCap` | **yes** — `{ analyzed: freeCap, total: N }` |
| `freeCap` real, `N > freeCap`, `freeCap ≤ userCap` | `freeCap` | **yes** |
| `freeCap` real, `userCap < freeCap` (user smaller) | `userCap` | **no** (user cap won — not a Free-cap truncation) |
| `freeCap` real, `N ≤ freeCap` (incl. `N === freeCap`) | `min` | **no** (nothing truncated) |
| `freeCap` absent (paid tier) | `userCap` or none | **no** |

`analyzed === cap === capped.length` whenever the notice fires (because `N > cap` ⇒ `capMostRecent` returns exactly `cap` commits). Strict `>` at the boundary: analyzing all 100 of 100 is **not** a truncation, so **no** "Analyzed 100 of 100" noise. When a smaller `--max-commits` wins, 2.7 stays silent (the user asked for that count; no Free-cap surprise — and a `--max-commits` notice is **not** in this story's ACs). [Source: docs/planning-artifacts/epics.md#Story 2.7]

### The exact contracts to build on (do NOT redefine)

- **`entitlement: { tier; commitCap? }` (Story 1.2 / resolve-run-config):** default is currently `{ tier: "free" }` (no cap) — 2.7 adds `commitCap: FREE_TIER_COMMIT_CAP`. A fresh object is built **per call** (the config is deep-frozen, so a shared mutable constant would get frozen) — keep that pattern. [Source: src/config/resolve-run-config.ts, src/config/run-config.ts#Entitlement]
- **Story-2.6 `select.ts`:** `SelectionCriteria { authorFilter?, maxCommits?, noMerges, startDate?, endDate?, timezone }`, `selectCommits`, `projectSelection`, `capMostRecent` (most-recent-N by `[committedAtMs, sha]`, total/deterministic even on a non-finite date), `dayBound` (well-formed `YYYY-MM-DD` ⇒ bound, else unbounded), `withinDateRange`, `isMerge`, `matchesAuthor`. Reuse all of it. [Source: src/analyze/select.ts]
- **`cli/run.ts` (Story 1.8 / 2.6):** `const selected = selectCommits(history, projectSelection(config));` then `analyze(selected, ctx)`; `ui` is injected via `RunDeps.ui` (default stderr). Swap to `selectCommitsWithNotice`; emit the notice via `ui.info`. [Source: src/cli/run.ts]
- **`ui` (Story 1.3):** `Ui { error, warn, info, plain }` → all to stderr; injectable for tests. The notice is informational (analysis is complete & correct, merely scoped) ⇒ `ui.info`, not `warn`. [Source: src/shared/ui.ts]

### Determinism & ordering rules (unchanged from 2.6)

- **Pure function of `(history, criteria)`** — no clock, no env, no I/O; `analyze/` is under `no-console`. The notice text is built in `run.ts` (the shell), not in the pure stage. [Source: eslint.config.js]
- **Most-recent-N is order-independent:** `capMostRecent` sorts a copy by `[committedAtMs, sha]` and takes `slice(-cap)`; a `committedAt` tie breaks by sha — kept set identical regardless of input order. The Free cap rides this unchanged. [Source: src/analyze/select.ts, 2-3 review patch]
- **Date-then-cap:** the date filter precedes the cap (it already did in 2.6); the Free `min`-cap is applied at the same last step, so a date-filtered run and its Group A buckets still agree and the cap acts only **within** the date window. [Source: docs/planning-artifacts/architecture.md#Date × Free-Cap ordering]

### Scope discipline — what this story does and does NOT include

**In scope:**
- The Free-cap **mechanics**: `commitCap` in `SelectionCriteria`, `min(maxCommits, commitCap)` composition at the last cap step, `selectCommitsWithNotice` returning the truncation signal, the `FREE_TIER_COMMIT_CAP = 100` resolved into the Free entitlement, and the `ui.info` "Analyzed 100 of N — Free tier cap" stderr notice wired in `run.ts`.

**Out of scope / deferred (do NOT build here):**
- **License-tier enforcement / Lemon Squeezy validation (FR-16)** — Epic 7. 2.7 consumes the **already-resolved** `entitlement` (default Free); it does **not** validate a license, bind a device, or vary the tier. The default-Free `commitCap: 100` is the resolved policy a real license gate will later override (Single-device/Unlimited ⇒ no cap). [Source: docs/planning-artifacts/epics.md#FR-16, docs/planning-artifacts/architecture.md (license gate = Epic 7)]
- **Retrieving only the capped count from git (FR-3 perf)** — Epic 5 / a deferred perf optimization (retrieve the whole HEAD history, cap in memory for determinism, exactly as 2.6's filters do). 2.7 caps **in memory**; pushing the cap into `git log -n` hides behind the same `SelectionCriteria` later. [Source: docs/planning-artifacts/epics.md#FR-3 (Epic 5; Free-tier cap mechanics in Epic 2), architecture.md#NFR-4]
- **A `--max-commits` truncation notice** — not in 2.7's ACs. Only the **Free-tier** cap surfaces a notice; an explicit `--max-commits` is the user's own choice (no surprise to announce). [Source: docs/planning-artifacts/epics.md#Story 2.7]
- **Putting the cap/truncation into the Report JSON** — the architecture rules truncation is **stderr** chrome; the byte-stable `analysis` envelope stays untouched. [Source: architecture.md#Date × Free-Cap ordering]
- **Rich "Free-tier cap reached" terminal state styling (UX-DR12)** — Epic 6 polish. 2.7 emits the plain AC-specified line via `ui.info`. [Source: docs/planning-artifacts/epics.md#UX-DR12]

### Previous-story intelligence

- **2.6 built the seam on purpose:** filters → cap, cap last, `capMostRecent` total/deterministic even on a non-finite date. 2.7 only composes `min(maxCommits, commitCap)` into that step + returns the truncation signal. No engine/model/metric/schema change. [Source: src/analyze/select.ts, 2-6 story]
- **Self-safe reductions / strict boundaries (2.2, 2.4 lessons):** the binding condition uses **strict `>`** (`total > cap`) so `N === cap` is *not* a truncation; treat `≤0`/non-finite caps as "no cap" (guard before composing). [Source: 2-2 / 2-4 patches]
- **"Silently wrong" is worse than "deferred" (2.6 lesson):** the cap must never reshape the date window or fire a misleading notice — hence the precise binding semantics (notice **only** when the Free cap is the winning, truncating cap). [Source: 2-6 review]
- **Determinism harness is unaffected:** `tests/determinism/*` calls `analyze` directly on the full fixture (no selection) — selection (incl. the Free cap) is a separate pre-stage. Existing `run.test.ts` cases use empty/small histories ⇒ no truncation ⇒ stay green after the default-cap change. [Source: src/cli/run.test.ts]

### Project Structure Notes

- Modified: `src/analyze/select.ts` (+ `select.test.ts`), `src/config/resolve-run-config.ts` (+ `resolve-run-config.test.ts`), `src/cli/run.ts` (+ `run.test.ts`). **No** engine/model/metric/schema/renderer change; `Analysis`, the Report schema, and every metric are untouched. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- `FREE_TIER_COMMIT_CAP` is co-located with the entitlement default it parameterizes (`resolve-run-config.ts`) until Epic 7's license gate owns it. Flag this in Completion Notes.

### References

- [Source: docs/planning-artifacts/epics.md#Story 2.7: Free-tier 100-commit cap and truncation notice] (the ACs)
- [Source: docs/planning-artifacts/architecture.md#Date × Free-Cap ordering] (date-first, cap to 100, **stderr** "showing 100 of N", never reshape the window) · [Source: …#RunConfig contract] (`entitlement: { tier; commitCap? }`, pipeline sees the resolved cap)
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-3] (capped retrieval is reported) · [Source: …#FR-16] (license tiers — Epic 7)
- [Source: src/analyze/select.ts] (the 2.6 stage to extend) · [Source: src/config/resolve-run-config.ts] (the entitlement default) · [Source: src/cli/run.ts] (the shell that emits chrome) · [Source: src/shared/ui.ts] (the stderr surface)

### Completion Notes

- **All three ACs satisfied.** AC1: the Free cap composes as `min(maxCommits, commitCap)` at Story 2.6's **last** cap step — the date filter precedes it, so it caps the most-recent N **within the date window** (by `[committedAtMs, sha]`) and never reshapes it; a select test proves `total` is the **post-date in-scope** count (date filter → 3, cap 2 → "Analyzed 2 of 3"). AC2: `run.ts` emits exactly `Analyzed {analyzed} of {total} commits — Free tier cap` via `ui.info` (**stderr** chrome) — never into the byte-stable Report JSON (a run test asserts stdout stays clean); the strict `>` boundary suppresses a misleading "Analyzed N of N". AC3: `min` picks the smaller of `--max-commits` and the Free cap, and the notice fires **only** when the Free cap is the binding, truncating cap (a smaller `--max-commits` wins silently — no false "Free tier cap" claim).
- **Policy in the config layer; `select` is mechanism.** The literal `100` lives in `resolve-run-config.ts` as `FREE_TIER_COMMIT_CAP`, surfaced as the resolved Free-tier `entitlement.commitCap`; the pure `selectCommits` stage caps by whatever `commitCap` it's handed and signals truncation generically — so paid tiers (no `commitCap`) fall out as "cap only by `--max-commits`, no notice" for free, and Epic 7's license gate can vary the cap without touching the determinism/selection layer.
- **Zero-churn API extension.** `selectCommitsWithNotice` is the new primary (`{ history, truncation? }`); `selectCommits` is a one-line delegate returning `.history`, so every Story-2.6 filtering test stays green verbatim. A single `applyFilters` feeds both the capped result and the `total` count — no double-filtering, no drift.
- **No engine/model/metric/schema/renderer change.** `Analysis`, the Report schema, and all 32 metrics/roll-ups are untouched; selection (incl. the Free cap) remains a pure pre-`buildModel` stage, so the determinism harness is unaffected.
- **Edge Case patch:** `realCap` floors the cap to a whole count and treats `< 1` as no cap, eliminating a fractional-`analyzed` notice and a silently-wrong sub-1 "truncation."
- **Real e2e verified:** the repo (25 commits < 100) runs metrics-only with **no** notice; `--max-commits 3` narrows to 3 with **no** Free notice (user cap 3 < 100 wins). The notice-fires path is covered end-to-end through the real `runPipeline` orchestrator with an injected small cap.
- **372 tests green** (41 files); typecheck / lint / build clean.
- **Scope deferrals honored:** license-tier *enforcement* / Lemon Squeezy validation (Epic 7); git-side `-n` cap push-down (perf, Epic 5); a `--max-commits` truncation notice (not in the ACs); rich "cap reached" terminal styling (Epic 6). No new dependencies.

### File List

**Modified (source):**
- `src/analyze/select.ts` — `commitCap` in `SelectionCriteria`; `projectSelection` maps `entitlement.commitCap`; `TruncationNotice`/`SelectionResult`; `applyFilters` extracted; `realCap`/`minCap`; `selectCommitsWithNotice` (primary) + `selectCommits` (delegate); `capMostRecent` takes the composed cap
- `src/config/resolve-run-config.ts` — `FREE_TIER_COMMIT_CAP = 100`; default entitlement `{ tier: "free", commitCap: 100 }`
- `src/cli/run.ts` — `selectCommitsWithNotice`; emit the "Analyzed N of M — Free tier cap" notice via `ui.info`

**Modified (tests):**
- `src/analyze/select.test.ts` — `selectCommitsWithNotice` Free-cap suite (bind/truncate, boundary, min-wins both ways, tie, date-then-cap, paid tier, determinism, delegate, non-integer/sub-1 cap) + `projectSelection` commitCap mapping
- `src/cli/run.test.ts` — capture `infos`; injectable entitlement; notice-fires + notice-suppressed wiring tests
- `src/config/resolve-run-config.test.ts` — default entitlement now `{ tier: "free", commitCap: 100 }`

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 2-7 → in-progress → done; epic-2 → done
- `docs/implementation-artifacts/2-7-free-tier-commit-cap.md` — this story (record filled, status → done)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 2.7 drafted via create-story (ultimate context engine). Status → ready-for-dev → in-progress. |
| 2026-06-14 | Story 2.7 implemented (TDD): the Free cap composes as `min(maxCommits, entitlement.commitCap)` at Story 2.6's final cap step; `selectCommitsWithNotice` returns a `{ analyzed, total }` truncation signal (Free cap binding + strict `>`); `run.ts` emits "Analyzed N of M — Free tier cap" via `ui.info` (stderr, never the Report JSON); `FREE_TIER_COMMIT_CAP = 100` resolved into the Free entitlement. No engine/model/metric/schema change. 41 files / 370 tests green; typecheck/lint/build clean; real e2e verified. Status → review. |
| 2026-06-14 | Code review (3 parallel layers) → Blind Hunter 0 + Acceptance Auditor 0 (all 3 ACs MET, architecture ruling respected, no scope creep). 1 patch from the Edge Case Hunter: `realCap` floors a non-integer cap to a whole count and treats `< 1` as no cap (eliminates a fractional-`analyzed` notice and a silently-wrong sub-1 "truncation"). 372 tests green; typecheck/lint/build clean. Status → done. **Epic 2 complete (7/7).** |
