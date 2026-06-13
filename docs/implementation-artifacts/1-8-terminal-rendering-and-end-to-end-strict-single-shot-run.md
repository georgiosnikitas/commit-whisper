---
epic: 1
story: 8
title: Terminal rendering and end-to-end strict single-shot run
baseline_commit: 46497a12bc59b6733a51eba7dc6df329fc1218f9
---

# Story 1.8: Terminal rendering and end-to-end strict single-shot run

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `commit-sage` invoked with arguments to print a terminal report end-to-end,
so that the full pipeline is demonstrably working on the walking skeleton.

## Acceptance Criteria

1. **End-to-end strict single-shot (AC1).** **Given** a local repo and a configured provider, **when** `commit-sage` is invoked with at least one argument, **then** it runs strict single-shot (no menu, no prompts) through `retrieve → analyze → narrate → assemble → render` and prints a terminal report to **stdout**, **and** the run exits **0** on success.

2. **Showpiece vs substrate, with the right exit code + banner (AC2).** **Given** the narrated showpiece versus the analysis substrate, **when** rendering runs, **then** the full narrated **showpiece** render **requires** the `narrative` subtree (it cannot be produced without AI) while a **substrate** render (fail-open or `--no-ai`) uses a plainer functional layout that carries the metric analysis but omits the narrative bands and **cannot masquerade** as the showpiece, **and** a fail-open substrate carries a loud **`⚠ Narrative unavailable`** banner (**exit 9**) while an intentional `--no-ai` substrate is clean (**exit 0**, no banner).

3. **Headless-safe / hexagonal (AC3).** **Given** the same invocation in a non-TTY context, **when** it runs, **then** behavior is identical (headless-safe), confirming the hexagonal boundary.

4. **Hard-fail names the gap + redirects (AC4).** **Given** a strict single-shot run that hard-fails on a missing required input, **when** the typed error is shown, **then** it names what is missing **and** points the user to the bare `commit-sage` command for guided setup — the redirect that keeps the failure from being a hostile cliff.

## Tasks / Subtasks

- [ ] **Task 1 — `render/render.port.ts`: the format-agnostic showpiece-vs-substrate render-path branch (AC1, AC2).**
  - [ ] Define `ShowpieceReport` as a `Report` whose `narrative` is **required, non-optional** (`Report & { narrative: ReportNarrative }`) — the type-level constraint that makes a substrate Report (no `narrative`) **un-passable** to the showpiece renderer (C3 / Fail-Open #4).
  - [ ] Define `SubstrateFraming = "metrics-only" | "degraded"` (drives the neutral note vs the loud `⚠` banner) and a pure `classifyReport(report: Report): { kind: "showpiece"; report: ShowpieceReport } | { kind: "substrate"; analysis: ReportAnalysis; framing: SubstrateFraming }`.
  - [ ] Routing rule (pure, no I/O): `narrative` present ⇒ `showpiece`; `narrative` absent + `degraded: true` ⇒ `substrate` `"degraded"`; `narrative` absent + `degraded: false` ⇒ `substrate` `"metrics-only"`. Co-locate `render.port.test.ts` (each branch + the type-narrowing that hands the showpiece a `narrative`-guaranteed report).

- [ ] **Task 2 — `render/terminal/terminal-renderer.ts`: terminal render of both paths (AC1, AC2).**
  - [ ] `renderTerminal(report: Report, opts?: { color?: boolean }): string` — calls `classifyReport`, then `renderShowpieceTerminal(report: ShowpieceReport)` (narrative bands: headline · overview · key findings, then the metrics table) or `renderSubstrateTerminal(analysis, framing)` (banner/note + metrics table only — **no** narrative bands).
  - [ ] Banner copy is **exact**: `degraded` ⇒ a loud **`⚠ Narrative unavailable — raw analysis below`**; `metrics-only` ⇒ a **neutral** `Metrics-only run — no AI narrative requested`. The showpiece carries **no** banner.
  - [ ] Color via **picocolors** (`createColors(enabled)`); honor `opts.color` (default: picocolors auto-detect — `NO_COLOR` / non-TTY ⇒ off). Metrics rendered with a **hand-rolled** table (id · title · status · compact value / reason); reuse string-width discipline, no `cli-table3`. Co-locate `terminal-renderer.test.ts`: showpiece contains the narrative text + metrics; both substrate framings contain the correct banner/note + metrics and **omit** the narrative; `{ color: false }` output is plain (no ANSI).

- [ ] **Task 3 — `cli/run.ts`: pre-pipeline gate band + pipeline orchestration + 0/9 mapping (AC1, AC2, AC3).**
  - [ ] `runPipeline(config: RunConfig, deps: RunDeps): Promise<number>` where `RunDeps` injects everything impure: `{ retrieve: RetrievePort; narrate: NarratePort; aiKey?: Secret<string>; preflight?: typeof preflightProvider; fetchImpl?: typeof fetch; writeStdout: (s: string) => void; ui: Ui }`. Defaults wire the real adapters (`createLocalRetrieve()`, `createNarrate()`, `preflightProvider`, `process.stdout.write`, the default `ui`).
  - [ ] **Gate band, `aiMode`-gated** (license gate slot is Epic 7 — entitlement already resolves to Free upstream, so it is a no-op pass here; document it): build `NarrateConfig` from the frozen `config` + injected `aiKey`; then **preflight** — `off` ⇒ skip; `required` ⇒ a non-reachable provider **throws `NarrationError` (exit 6) before retrieve**; `auto` ⇒ a non-reachable provider does **not** block — `ui.warn` the degraded reason up front and mark narration non-viable (skip the doomed `narrate` call, synthesize a `degraded` outcome later).
  - [ ] Pipeline: `retrieve(config)` → `analyze(history, ctx)` (build `AnalysisContext` from `config.analysisTimestamp` + `config.timezone` + `emptyMailmap()` — real `.mailmap` reading is deferred) → narrate outcome (`off`/non-viable-auto handled per above; else `await narrate(analysis, narrateConfig)`) → `reportFromOutcome(analysis, outcome)` → `renderTerminal(report)` (wrap render in try/catch → `RenderError` exit 7) → `writeStdout`.
  - [ ] Return **0** for `narrated`/`skipped`, **9** for `degraded`. Let `RetrieveError`(4)/`MetricsError`(5)/`NarrationError`(6)/`RenderError`(7) **propagate** (mapped at the shell). Co-locate `run.test.ts`: the four terminal rows (narrated→0+showpiece, skipped→0+neutral substrate, degraded→9+⚠ substrate, required-fail→throws 6 before retrieve) using fake `retrieve`/`narrate`/`preflight` deps; assert the report lands on the injected `writeStdout` and chrome on `ui` (stderr).

- [ ] **Task 4 — `cli/cli.ts`: commander strict single-shot wiring + error→exit mapping + AC4 redirect (AC1, AC4).**
  - [ ] `main(argv: string[], deps?: CliDeps): Promise<number>` (`argv` = `process.argv.slice(2)`). Commander wiring: positional `[repoTarget]`; `--ai` ⇒ `aiMode: "required"`, `--no-ai` ⇒ `aiMode: "off"`; `--format <format>` (default `terminal`); `--provider`/`--model`/`--base-url`/`--timezone`/`--no-merges` projected into a `flags: PartialRunConfig`. **STRICT:** any `argv.length >= 1` is non-interactive (`nonInteractive: true`).
  - [ ] Read the env-only key with `readAiKey(env, provider)` at the **shell** (cli/ may touch env), then `resolveRunConfig({ cwd, env, stdin/stdoutIsTTY, nonInteractive: true, analysisTimestamp, flags })` (the **one** real clock read — `new Date().toISOString()` — injected so the pipeline stays pure; injectable via `deps` for tests). Call `runPipeline(config, { aiKey, writeStdout, ui, ... })` and return its code.
  - [ ] Wrap in try/catch: map a thrown value with `exitCodeForError` + `ui.error(messageForError(err))`; a bad flag ⇒ `UsageError` (exit 2). **AC4:** when the error is a `MissingRequiredConfigError` (exit 3), append the redirect — `Run \`commit-sage\` with no arguments for guided setup.` — to stderr (a **shell** concern; `shared/errors.ts` stays redirect-free). `0` args ⇒ guided/interactive setup is **Epic 6**; for the walking skeleton emit a typed message and the same redirect (document the limitation). Co-locate `cli.test.ts`: `--no-ai` ⇒ exit 0; missing-required ⇒ exit 3 + names the field + carries the redirect; bad flag ⇒ exit 2.

- [ ] **Task 5 — `index.ts` bootstrap + dependency + scaffold cleanup (AC1, AC3).**
  - [ ] Rewrite `src/index.ts` to the **only top-level await**: `process.exit(await main(process.argv.slice(2)))` (import `main` from `./cli/cli.js`). Remove the `APP_NAME` placeholder export and delete the obsolete `src/index.test.ts` scaffold smoke test (its job is now covered by `cli.test.ts`); `index.ts` is a 2-line entry with no co-located test (importing it runs the CLI).
  - [ ] Add **`picocolors` `1.1.1`** to `dependencies` (exact-pinned via `.npmrc save-exact`); `npm install picocolors@1.1.1`.

- [ ] **Task 6 — End-to-end walking-skeleton proof + headless parity (AC1, AC2, AC3).**
  - [ ] An e2e test (co-located, e.g. `cli/cli.e2e.test.ts`) that drives `main()` with injected fake `retrieve` + `narrate` deps over a small synthetic history and asserts the **four terminal outcomes** end-to-end: showpiece (exit 0, narrative on stdout), metrics-only `--no-ai` (exit 0, neutral substrate, no banner), fail-open (exit 9, `⚠` banner), required-fail (exit 6, typed error, nothing on stdout).
  - [ ] **AC3 headless parity:** the same `main()` invocation + deps yields **identical report text** with `stdoutIsTTY` true vs false (assert on color-stripped output) — proving the pipeline never branches on TTY for ≥1 arg.

## Dev Notes

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The spec-aware **Acceptance Auditor independently verified all four ACs genuinely MET (4/4), scope discipline held, and architecture fidelity confirmed — 0 gaps, 0 over-build.** The two hunters converged on robustness edges; almost all were unreachable-by-contract or correct-as-designed. Triage: **1 patch · 2 defer · 8 dismissed · 0 decision-needed.**

**Patch:**

- [x] [Review][Patch] `RenderError` discards the underlying exception — `run.ts` wraps a render failure but `RenderError`'s constructor took only a message (no `cause`), inconsistent with `RetrieveError`/`NarrationError`. Add `options?: ErrorOptions` to `RenderError` and pass `{ cause }` so the originating error chains [src/shared/errors.ts, src/cli/run.ts] — **Fixed:** `RenderError` now accepts `ErrorOptions`; `run.ts` passes `{ cause }`; added a `RenderError carries an underlying cause` test (mirrors the `RetrieveError` cause test). 233 tests green.

**Defer (tracked in deferred-work.md, not actioned now):**

- [x] [Review][Defer] Process-shell stream lifecycle + SIGPIPE/EPIPE hardening (`writeStdout`/`ui` ignore backpressure + have no `error`/`EPIPE` listener, so `… | head` can crash → exit 1) [src/cli/run.ts, src/cli/cli.ts, src/shared/ui.ts] — consolidates the 1.3 `ui`-robustness + 1.4/1.6 run-timeout defers into one dedicated process-shell hardening pass; the walking skeleton's bar is the happy path + four outcomes + AC4.
- [x] [Review][Defer] Grapheme-/width-aware truncation in the terminal table (`formatValue`'s `slice(0,59)` can split a surrogate pair → `�`; `pad`/`maxWidth` count UTF-16 units, not display columns) [src/render/terminal/terminal-renderer.ts] — Epic 4 render polish owns terminal string-width; engine metric values are numeric/structural today, so the preview is cosmetic.

**Dismissed (8):** "color uses picocolors auto-detect, not the injected `stdoutIsTTY`" (this is **correct** — color must follow the *actual* output stream per I2 `NO_COLOR`-aware, so a TTY user piping to a file gets plain output; `RunConfig` deliberately omits `stdoutIsTTY`, and the AC3 parity test validly proves report-*text* invariance by stripping ANSI); "circular `JSON.stringify` in `formatValue` crashes the render" (unreachable — a metric `value` is the 1.5 `MetricValue` pure-JSON type, which cannot be circular, and the renderer only ever receives an engine-produced Report); "required-mode narrate throwing a non-`NarrationError` exits 1 not 6" **and** "auto-mode narrate throwing bypasses fail-open → exit 1 not 9" (both precluded by the 1.6 `createNarrate` contract — it wraps *any* throw into `NarrationError` in `required`, and catches *all* errors → `degraded` in `auto`; `run.ts` correctly trusts the `NarratePort` contract rather than duplicating its fail-open logic); "`--ai --no-ai` silently last-wins" (conventional CLI semantics, not an AC; deferred as an optional UX guard); "Ollama preflight URL leak" / "Gemini auth message" (1.6 code, not in this diff, and already key-scrubbed); "`formatValue` redundant `undefined` check" (harmless defensive guard); "commander help flow double-output" (self-dismissed by the hunter — help is written once, exit 0 returned cleanly).

### Scope discipline — what this story does and does NOT include

This is the **walking-skeleton integration** story: it wires the already-built stages (config 1.2 · retrieve 1.4 · analyze 1.5 · narrate 1.6 · assemble 1.7) behind a real CLI shell and the **terminal** renderer, end-to-end, strict single-shot. It is the last story of Epic 1.

**In scope:**
- `render/render.port.ts` — the **format-agnostic** showpiece-vs-substrate render-path branch (`classifyReport` + `ShowpieceReport` type) reused by every later renderer.
- `render/terminal/terminal-renderer.ts` — the **terminal** render of both paths (picocolors + hand-rolled table), with the exact degraded/metrics-only framing.
- `cli/run.ts` — the pre-pipeline gate band (`aiMode`-gated preflight) + pipeline orchestration from the frozen `RunConfig`, mapping clean→`0` / substrate-fallback→`9`.
- `cli/cli.ts` — commander strict single-shot wiring, config resolution, env-key read, and the error→exit/stderr mapping (incl. the AC4 redirect).
- `src/index.ts` — the thin bootstrap (the only top-level await), `process.exit(await main(...))`.
- Add the **picocolors 1.1.1** dependency (architecture I2).

**Out of scope / deferred (do NOT build here):**
- **Interactive menu / 0-arg TTY guided prompts** (`cli/interactive.ts`, `@clack` menu, Settings write path) — **Epic 6**. STRICT single-shot means the **only** interactive entry point in the product is bare `commit-sage` in a TTY, and that menu is Epic 6. 1.8 handles `argv.length >= 1`; `0` args emits a typed message + the AC4 redirect (the guided path it points to lands in Epic 6). [Source: docs/planning-artifacts/architecture.md#STRICT Single-Shot (George's ruling)]
- **HTML / Markdown / JSON renderers** + `render/charts.ts`/`sparkline.ts`/`data-table.ts`/`inline.ts` + `render/health-band.ts` — **Epic 4**. 1.8 ships the **terminal** path only; `render.port.ts` is built format-agnostic so Epic 4 reuses the same branch. The health-band classifier (a presentational `ok/watch/risk/na` consumer of the PRD §4.2 catalog thresholds) is **not** invented here. [Source: docs/planning-artifacts/architecture.md#I2 / #Complete Project Directory Structure]
- **License gate (I3, Epic 7).** The gate band is `license → preflight → retrieve`; for the walking skeleton `entitlement` already resolves to **Free** upstream (1.2), so the license slot is a **no-op pass** — `license/` modules are not built. Document the slot; do not stub a fake gate. [Source: docs/planning-artifacts/architecture.md#runtime pre-pipeline gate band]
- **`--show-config`** action flag (`cli/show-config.ts`), **multi-format** output, **file** output (`outputPath` / `-`), and the **JSON error object** on `--format json` — later stories (1.8 prints the terminal report to stdout; the `json-renderer` write-to-file is Epic 4). [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- **Grounding / per-metric explanations / coaching** (Epic 3); **retrieval filters** (author/date/max/no-merges actually narrowing the set — Story 2.6); **remote clone** (`git-clone.ts`/`temp-workspace.ts` — Epic 5). 1.8 consumes the **local** retrieve (1.4) over the current repo's HEAD and the **single-provider** narrate slice (1.6). [Source: docs/planning-artifacts/epics.md]

### The exact modules to wire (verified signatures — do NOT redefine)

- **Config (1.2):** `resolveRunConfig(input: ResolveInput): RunConfig` — `ResolveInput = { cwd, env, stdinIsTTY, stdoutIsTTY, nonInteractive, analysisTimestamp, flags?, configFile?, entitlement? }`. For STRICT single-shot pass `nonInteractive: true`. `flags` is the parsed-CLI `PartialRunConfig` (highest precedence). `RunConfig` is **frozen** and carries **no secrets** (`aiKey`/`gitPat` absent by design). [Source: src/config/resolve-run-config.ts, src/config/run-config.ts]
- **Env key (1.6):** `readAiKey(env, provider): Secret<string> | undefined` — gemini reads `GOOGLE_GENERATIVE_AI_API_KEY` then the `GEMINI_API_KEY` alias; others `undefined` (3.6 seam). Called at the **shell** and passed **into** `runPipeline` as a separate injected secret (keeps `RunConfig` secret-free). [Source: src/config/env.ts]
- **Retrieve (1.4):** `createLocalRetrieve(runner?): RetrievePort`; `RetrievePort = (config: RunConfig) => Promise<RepoHistory>`. A non-repo / git failure throws `RetrieveError` (exit 4). [Source: src/retrieve/local.ts, src/retrieve/retrieve.port.ts]
- **Analyze (1.5):** `analyze(history: RepoHistory, ctx: AnalysisContext): Analysis` where `AnalysisContext = { analysisTimestamp: string; timezone: string; mailmap: MailmapIndex }`. Build `ctx` from `config.analysisTimestamp`, `config.timezone`, and `emptyMailmap()` (real `.mailmap` ingestion is deferred). `Analysis = { metrics: Metric[] }`. [Source: src/analyze/engine.ts, src/analyze/model.ts, src/analyze/identity.ts]
- **Narrate (1.6):** `createNarrate(deps?): NarratePort`; `NarratePort = (analysis, config: NarrateConfig) => Promise<NarrateOutcome>`. `NarrateConfig = { aiMode, provider?, llmModel?, llmBaseUrl?, aiKey? }` (project it from the frozen `RunConfig` + injected `aiKey`). `NarrateOutcome = { kind:"narrated"; narrative } | { kind:"skipped" } | { kind:"degraded"; reason }`; a `required`-mode failure **throws** `NarrationError` (exit 6). [Source: src/narrate/narrate.ts, src/narrate/narrate.port.ts]
- **Preflight (1.6):** `preflightProvider(config: NarrateConfig, deps?): Promise<PreflightResult>` → `{ reachable: true } | { reachable: false; reason }`. `fetchImpl` + `timeoutMs` injectable (offline tests). `off` returns reachable (the shell skips it anyway). [Source: src/narrate/preflight.ts]
- **Assemble (1.7):** `reportFromOutcome(analysis: Analysis, outcome: NarrateOutcome): Report` — `narrated`⇒narrative present + `degraded:false`; `skipped`⇒no narrative + `degraded:false`; `degraded`⇒no narrative + `degraded:true`. `Report`/`ReportAnalysis`/`ReportNarrative` types from `assemble/report-schema.ts`. [Source: src/assemble/report.ts, src/assemble/report-schema.ts]
- **Shell utilities (1.3):** `ExitCode` enum + `exitCodeForError(err)` (CommitSageError⇒its `exitCode`, else 1) + `messageForError(err)` (actionable msg or `GENERIC_INTERNAL_MESSAGE`). `ui`/`createUi(stream)` → **stderr** writer (no `console`). `Secret<string>` (redacts). [Source: src/cli/exit-codes.ts, src/shared/ui.ts, src/shared/secret.ts]

### The terminal-outcome contract (AC2 — the heart of the story)

| Run | `aiMode` | `NarrateOutcome` | `report.degraded` | Render | Exit |
|---|---|---|---|---|---|
| Full narrated showpiece | `auto`/`required`, narration OK | `narrated` | `false` | **showpiece** (narrative bands + metrics) | **0** |
| Intentional metrics-only | `off` (`--no-ai`) | `skipped` | `false` | substrate + **neutral** note | **0** |
| Fail-open degraded | `auto`, provider unreachable/failed | `degraded` | `true` | substrate + **`⚠` banner** | **9** |
| Forced-AI hard fail | `required` (`--ai`), unreachable/failed | *(throws)* | — | none (typed error) | **6** |

[Source: docs/planning-artifacts/architecture.md#Fail-Open & Metrics-Only — Terminal outcomes]

- **Exit `9` is NOT a thrown error** — it is a degraded-**success** the shell sets when the render completed on the substrate. `runPipeline` returns `9`; it does not throw for fail-open. (P4 / C4: shell maps *thrown `CommitSageError`→1–8*, *clean→0*, *substrate-fallback→9*.) [Source: docs/planning-artifacts/architecture.md#C4 / #P4]
- **`6` vs `9` are mutually exclusive by `aiMode`:** the same underlying narration failure is **exit 6** under `required` (hard fail, no substrate masquerading) and **exit 9** under `auto` (fail open). [Source: docs/planning-artifacts/architecture.md#Exit-Code Enum]
- **Showpiece bound to AI by construction:** the showpiece renderer's input type **requires** `narrative`; a substrate `Report` (no `narrative`) **cannot** type-check into it and routes to the substrate render — it can never *masquerade* as the showpiece. This is the type-level encoding of "the report needs AI." [Source: docs/planning-artifacts/architecture.md#Fail-Open & Metrics-Only #4 / #C3]

### Stream discipline (P5) — stdout vs stderr

- **The rendered report → `stdout`** (it is the requested artifact; `commit-sage --format json > report.json` must stay clean — by analogy the terminal report is the product output). The **substrate banner / metrics-only note is part of the rendered string**, so a redirected report still announces itself as degraded — this is what makes "cannot masquerade" hold in the saved artifact.
- **All human chrome → `stderr`** via the single `ui` module: the up-front degraded warning (`auto` preflight miss), errors, the AC4 redirect, later spinner/notices. **No `console.*`** anywhere in `cli/`, `render/`, or the pipeline (lint-enforced). `runPipeline` writes the report via an injected `writeStdout`; everything else via injected `ui`. [Source: docs/planning-artifacts/architecture.md#Stream Discipline / #P5, eslint.config.js]

### Headless safety (AC3) & the hexagonal boundary

- STRICT single-shot forces `nonInteractive: true` for any `argv.length >= 1`, so the **capability gate never goes interactive** regardless of TTY — the `≥1 arg` rows of the truth table are identical (TTY vs non-TTY/CI). [Source: docs/planning-artifacts/architecture.md#Truth Table]
- `runPipeline` receives only the **frozen `RunConfig` + injected deps** — no `argv`, no `env`, no prompts, no `process.stdout.isTTY` branching. The **only** TTY-sensitive surface is picocolors color auto-detect; the **report text is identical** headless vs TTY (color codes are the sole difference) — assert AC3 on color-stripped output. [Source: docs/planning-artifacts/architecture.md#Hexagonal Boundary]
- Determinism: the shell reads the real clock **once** (`new Date().toISOString()`) and injects it as `analysisTimestamp`; the pipeline never calls `Date.now()`. Inject a fixed timestamp in tests. [Source: docs/planning-artifacts/architecture.md#C2]

### AC4 — the redirect is a shell concern

`MissingRequiredConfigError` (1.3) already names the field + its env var (exit 3). 1.8 adds the **"points to bare `commit-sage` for guided setup"** redirect **at the CLI shell** (when mapping exit-3 / `MissingRequiredConfigError` to stderr) — `shared/errors.ts` stays pure (the redirect references a CLI/UX concept, not an error-model one). Keep the redirect copy in `cli/cli.ts`. [Source: src/shared/errors.ts, docs/planning-artifacts/architecture.md#Secrets (first-run redirect)]

### Latest tech specifics

- **picocolors 1.1.1** — `import pc from "picocolors"` (default export is the colors object) **or** `import { createColors } from "picocolors"`. Use `createColors(enabled?: boolean)` to **force** color on/off for deterministic tests (`createColors(false)` ⇒ identity functions, no ANSI). With no arg it auto-detects (`isTTY`, `NO_COLOR`, `FORCE_COLOR`). It is a CJS module with an ESM-friendly default + named exports; under `nodenext` import the default (`import pc from "picocolors"`) and read `pc.createColors`. Zero dependencies, ~2 KB. [Source: docs/planning-artifacts/architecture.md#I2]
- **commander 15.0.0** (already a dep) — ESM. Build the program, register options, `program.parse(argv, { from: "user" })` so `argv` is the post-`slice(2)` user array. Capture parse/usage errors and map to `UsageError` (exit 2); use `exitOverride()` so commander does not call `process.exit` itself (the shell owns exit). [Source: package.json]

### Previous-story intelligence (1.2–1.7)

- **TS 6.0.3 strict, ESM `.js` import specifiers in source**, `nodenext`, `"types":["node"]`, `import type` for type-only (isolatedModules). **Named exports only** (no `export default` for our modules — but a third-party default import like `picocolors` is fine). vitest 4.1.8 co-located `*.test.ts`. [Source: tsconfig.json, eslint.config.js]
- **ESLint guardrails:** `no-console` in pipeline + `shared/` + `index.ts` (and now `cli/`/`render/`); `process.env` only in `src/config/**`. The shell reads env via `config/env.ts` helpers (`readAiKey`) + `resolveRunConfig` — **`cli/` must not read `process.env` directly** except by handing `process.env` into those config readers. Verify the lint config's `process.env` rule treats `cli/` correctly; if `cli/` may not name `process.env`, pass it through from `index.ts`. **Confirm during dev** and adjust the wiring (not the rule) to comply. [Source: eslint.config.js]
- **`src/render/` holds only `.gitkeep`** — first real modules; remove it (as for `cli/` 1.3 … `assemble/` 1.7). [Source: src/render/.gitkeep]
- **`reportFromOutcome` already encodes the intentional-vs-degraded split** (1.7) — 1.8 consumes it directly; do not re-derive `degraded` in `cli/run.ts`. [Source: src/assemble/report.ts]
- **`createNarrate` is fail-open by construction** (1.6) — in `auto` a failure returns `degraded`; only `required` throws. So `run.ts`'s `auto`-preflight-miss short-circuit (synthesize `degraded`, skip the doomed call) is an **optimization**, not the safety net — narrate itself still fails open if the call is made. [Source: src/narrate/narrate.ts]

### Project Structure Notes

- New files exactly per the architecture map: `src/render/render.port.ts`, `src/render/terminal/terminal-renderer.ts`, `src/cli/run.ts`, `src/cli/cli.ts`; rewrite `src/index.ts`. Co-located `*.test.ts`. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- `classifyReport` is an **additional named export** in `render.port.ts` (the port file owns the pure render-path branch the architecture's `render.port.ts` description implies — "showpiece (requires narrative) vs substrate"). Flag in Completion Notes.
- `src/index.test.ts` is **deleted** (placeholder scaffold smoke test); its coverage moves to `cli.test.ts`. `APP_NAME` export is removed. Flag in Completion Notes + File List.

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.8: Terminal rendering and end-to-end strict single-shot run]
- [Source: docs/planning-artifacts/architecture.md#Decision: CLI Interaction Model & Configuration Resolution] (STRICT single-shot, truth table, hexagonal boundary, stream discipline)
- [Source: docs/planning-artifacts/architecture.md#Exit-Code Enum (FR-15)] · [Source: docs/planning-artifacts/architecture.md#C4 — Error & Exit-Code Model] · [Source: docs/planning-artifacts/architecture.md#P4 / #P5]
- [Source: docs/planning-artifacts/architecture.md#Fail-Open & Metrics-Only (2026-06-13)] (terminal-outcome table, showpiece-bound-to-AI, exit 9)
- [Source: docs/planning-artifacts/architecture.md#C3 — AI / Narration Layer] (preflight gate band, fail-open) · [Source: docs/planning-artifacts/architecture.md#I1 / #I2] (showpiece-vs-substrate render branch, terminal = picocolors + hand-rolled tables)
- [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure] (cli/, render/, index.ts)
- [Source: src/config/resolve-run-config.ts] · [Source: src/config/env.ts] · [Source: src/retrieve/local.ts] · [Source: src/analyze/engine.ts] · [Source: src/narrate/narrate.ts] · [Source: src/narrate/preflight.ts] · [Source: src/assemble/report.ts] · [Source: src/cli/exit-codes.ts] · [Source: src/shared/ui.ts]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean (picocolors default-import under `esModuleInterop`; the showpiece `ShowpieceReport` narrowing; commander tri-state opts all resolve).
- `npm run lint` → ESLint clean: no `console`/`process.env` outside `config/`; named-exports-only; the `cli/` shell reads env only via `config/readProcessEnv`.
- `npm test` → vitest: **34 files / 232 tests passed** (was 30/201; +4 files, +31 tests).
- `npm run build` → tsup ESM build success; `dist/index.js` 40.82 KB (real CLI; top-level await bundles cleanly for node22).
- **Real e2e on this repo:** `node dist/index.js . --no-ai` → renders the substrate (neutral metrics-only note + the 6 Group A metrics over real git history), **exit 0**. `node dist/index.js --ai` (no provider) → names `provider` + the redirect, **exit 3**. `node dist/index.js` (0 args) → guidance, **exit 2**. `node dist/index.js --bogus` → **exit 2**.

### Completion Notes List

- **All four ACs satisfied + verified on the real binary.** AC1: `commit-sage . --no-ai` runs strict single-shot through `retrieve → analyze → narrate(skipped) → assemble → render`, prints the terminal report to **stdout**, exit 0. AC2: the showpiece-vs-substrate branch is **type-enforced** — `ShowpieceReport` (narrative non-optional) is the only thing the showpiece renderer accepts, so a substrate `Report` cannot masquerade; a fail-open substrate carries the loud `⚠ Narrative unavailable — raw analysis below` banner (exit **9**), an intentional `--no-ai` substrate the neutral `Metrics-only run` note (exit **0**), and a forced `--ai` provider miss is a hard **exit 6** before any clone. AC3: `runPipeline` takes only the frozen `RunConfig` + injected deps (no argv/env/TTY); the e2e parity test proves identical report text TTY vs non-TTY. AC4: a missing required input names the field + env var (from 1.3) and the shell appends the bare-`commit-sage` redirect.
- **Gate band (`cli/run.ts`), `aiMode`-gated:** license slot is a Free no-op (Epic 7); preflight `off`⇒skip · `required`⇒hard-fail (6) before retrieve · `auto`⇒never blocks, warns up front, **skips the doomed narrate call** and fails open to the substrate (9). Exit 9 is a returned degraded-**success**, not a thrown error (P4/C4); stage failures (`Retrieve` 4 · `Metrics` 5 · `Narration` 6 · `Render` 7) throw and are mapped to an exit code + stderr **only at the shell** (`cli.ts`).
- **`aiMode: auto` is reachable in single-shot via `COMMIT_SAGE_AI_MODE=auto`** (env overrides the headless `off` default the capability gate sets under STRICT `nonInteractive`). The fail-open e2e uses this; `--ai`/`--no-ai` give required/off, env/config gives auto.
- **Stream discipline:** the rendered report (incl. its substrate banner/note) → **stdout** (so a redirected artifact still announces itself as degraded); all chrome (up-front degraded warning, errors, AC4 redirect, 0-arg guidance, commander help) → **stderr** via the injected `ui`. No `console.*` anywhere.
- **`render.port.ts` is format-agnostic** (`classifyReport` + `ShowpieceReport`/`SubstrateFraming`) so Epic 4's HTML/Markdown/JSON renderers reuse the same branch; `terminal-renderer.ts` is the only format wired now (picocolors `createColors`, hand-rolled table).
- **New shell-env accessor:** `config/readProcessEnv()` is the single ambient `process.env` site for the shell (which the hexagonal lint boundary forbids from naming `process.env`); `cli.ts` captures env through it and injects it into `resolveRunConfig`/`readAiKey`. **Additional named exports flagged:** `classifyReport` (in `render.port.ts`), `runPipeline`/`RunDeps` (in `run.ts`), `main`/`CliDeps` (in `cli.ts`), `readProcessEnv` (in `config/env.ts`).
- **Scope deferrals honored:** no interactive 0-arg menu (Epic 6 — 0-args emits guidance + the redirect, exit 2); no HTML/Markdown/JSON renderers or `health-band.ts` (Epic 4); no license gate (Epic 7 — Free no-op); no `--show-config`/multi-format/file output; no remote clone / retrieval filters. Added **picocolors 1.1.1** (architecture I2, exact-pinned, user-approved) — the only new dependency.
- **Scaffold cleanup:** `src/index.ts` rewritten to the only top-level await (`process.exit(await main(process.argv.slice(2)))`); the `APP_NAME` placeholder + `src/index.test.ts` smoke test removed (coverage moved to `cli.test.ts`); `src/render/.gitkeep` removed.
- **SonarQube advisory** (unchanged): `type IsoDate = string` — intentional. No new advisories; tsc/eslint/vitest/tsup all green.

### File List

**Added (source):**
- `src/render/render.port.ts` — `classifyReport`, `ShowpieceReport`, `SubstrateFraming`, `RenderRoute`
- `src/render/terminal/terminal-renderer.ts` — `renderTerminal`, `DEGRADED_BANNER`, `METRICS_ONLY_NOTE`
- `src/cli/run.ts` — `runPipeline`, `RunDeps` (gate band + 0/9 mapping)
- `src/cli/cli.ts` — `main`, `CliDeps` (commander strict single-shot + error→exit mapping + AC4 redirect)

**Added (tests, co-located):**
- `src/render/render.port.test.ts`, `src/render/terminal/terminal-renderer.test.ts`, `src/cli/run.test.ts`, `src/cli/cli.test.ts`, `src/cli/cli.e2e.test.ts`

**Modified (source):**
- `src/index.ts` — rewritten to the top-level-await bootstrap (`main`); `APP_NAME` removed
- `src/config/env.ts` — added `readProcessEnv()` (the shell's single ambient-env accessor)
- `package.json` / `package-lock.json` — added `picocolors` `1.1.1`

**Modified (review patches):**
- `src/shared/errors.ts` — `RenderError` now accepts `ErrorOptions` for `cause` chaining (consistent with `RetrieveError`/`NarrationError`)
- `src/cli/run.ts` — render-failure wrap passes `{ cause }`
- `src/shared/errors.test.ts` — `RenderError` cause-chaining test

**Removed:**
- `src/index.test.ts` (obsolete scaffold smoke test), `src/render/.gitkeep`

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 1-8 → in-progress → review
- `docs/implementation-artifacts/1-8-terminal-rendering-and-end-to-end-strict-single-shot-run.md` — this story (record filled, status → review)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 1.8 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 1.8 implemented (TDD): `render.port.ts` (showpiece-vs-substrate branch, type-enforced), `terminal-renderer.ts` (picocolors + hand-rolled table, banners), `cli/run.ts` (aiMode-gated gate band + pipeline + 0/9), `cli/cli.ts` (commander STRICT single-shot + error→exit + AC4 redirect), `index.ts` top-level-await bootstrap; added picocolors 1.1.1 + `config/readProcessEnv`. 5 new suites; 34 files / 232 tests green; typecheck/lint/build clean; real e2e on this repo verified across exits 0/2/3. Status → review. |
| 2026-06-13 | Code review (3 parallel layers) → Acceptance Auditor verified all 4 ACs genuinely met + scope held + architecture fidelity (0 gaps). 1 patch / 2 defer / 8 dismissed. Applied: `RenderError` `cause` chaining (+test); 2 defers logged (process-shell SIGPIPE/EPIPE hardening; grapheme-aware truncation → Epic 4). 233 tests green; typecheck/lint/build clean. Status → done. |
