---
epic: 6
story: 2
title: Guided prompts and command echo
baseline_commit: 8734d0c
---

# Story 6.2: Guided prompts and command echo

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a newcomer,
I want to be asked only for what's missing and shown the equivalent command,
so that the run is easy now and I learn the headless form for next time.

## Acceptance Criteria

1. **Only the missing/inferable inputs are asked; the inferable are defaulted; prompt styling never bleeds into the report (AC1).** **Given** a guided run (the launchpad's "Analyze this repository" or "Analyze a remote repository"), **when** prompts are collected, **then** the required target is **inferred** (cwd `.` for the local action; a single URL prompt for the remote action) and the optional scoping inputs are offered with **defaults** (limit = all history, date range = all, output format = the `terminal` default) so the user mostly confirms; **and** all prompt chrome is written to **stderr**, so the machine report on **stdout** is never contaminated by prompt styling.

2. **On completion the equivalent non-interactive command is echoed (AC2).** **Given** a completed guided run, **when** it finishes, **then** the equivalent strict-single-shot command is echoed as a self-teaching bridge (e.g. `Next time: commit-whisper . --max-commits 500 --format markdown`), emitting **only flags that actually exist** (`--max-commits`, `--since`, `--until`, `--format`) and the inferred positional target — never a flag the CLI does not have (no `--branch`).

3. **A required secret's environment variable is named, never collected (AC3).** **Given** a guided run that may need a secret, **when** the flow runs, **then** it **names the environment variable** (for a remote target with no git token in the environment: `COMMIT_WHISPER_GIT_TOKEN`) and **never** presents a field that collects the secret — the secret stays env-only, consistent with the resolver's secret rule.

## Tasks / Subtasks

- [ ] **Task 1 — Pure command echo + input interpreters (AC1, AC2) [src/cli/interactive.ts].** [Source: MENUS.md "Analyze — guided run" (self-teaching echo); cli.ts `applySelectionFlags`/`parseFormats` for the real flag surface]
  - [ ] `export function formatEquivalentCommand(target: string, flags: PartialRunConfig): string` — pure. Build `commit-whisper <target>` then append ONLY the real flags present in `flags`: `--max-commits <n>`, `--since <date>`, `--until <date>`, `--format <a,b>` (comma-joined, emitted only when the selection differs from the default `["terminal"]`). The positional `target` is `.` for cwd or the URL for remote; quote it only if it contains whitespace. No `--branch` (the CLI has no such flag — Epic 2 deferred named-branch selection). [Source: cli.ts buildProgram — the authoritative flag list]
  - [ ] `export function interpretLimit(raw: string): { error: string } | { maxCommits?: number }` — dual-purpose (a `@clack` validator AND the parser). Trim; `""` → `{}` (all history); a decimal positive integer → `{ maxCommits: n }`; anything else → `{ error: "Enter a positive whole number, or leave blank for all history." }`. Mirror `applySelectionFlags`'s `/^\d+$/ && > 0` rule (reject `1.5`, `0x10`, `1e3`, `-3`, `0`).
  - [ ] `export function interpretDateRange(raw: string): { error: string } | { startDate?: string; endDate?: string }` — dual-purpose. Trim; `""` → `{}`; split on `..` → `since..until` (either side may be empty: `A..`, `..B`, `A..B`); a bare value with no `..` → treated as `since`. Each non-empty side must match `YYYY-MM-DD` (a full ISO timestamp tail allowed, mirroring `validateDateFlag`); else `{ error: "Use YYYY-MM-DD..YYYY-MM-DD (either side optional), or leave blank for all history." }`.

- [ ] **Task 2 — The injected guided-prompt seam + default `@clack` adapters (AC1) [src/cli/interactive.ts].** [Source: @clack/prompts `text`/`multiselect`; the 6.1 `LaunchpadSelect` seam pattern]
  - [ ] `export interface GuidedPrompts { text(opts: GuidedTextOptions): Promise<string | null>; multiselect(opts: GuidedMultiselectOptions): Promise<OutputFormat[] | null>; }` (cancel → `null`, mirroring `LaunchpadSelect`). `GuidedTextOptions = { message; placeholder?; defaultValue?; validate?: (v: string) => string | undefined }`; `GuidedMultiselectOptions = { message; options: { value: OutputFormat; label: string }[]; initialValues?: OutputFormat[] }`.
  - [ ] A default adapter factory `clackGuidedPrompts(output)` wiring `@clack` `text`/`multiselect` to the same stderr `output` as the menu, mapping `isCancel` → `null` and `validate`'s `undefined`/string through. Untested seam (like `clackLaunchpadSelect`).

- [ ] **Task 3 — The guided Analyze driver + launchpad wiring (AC1, AC2, AC3) [src/cli/interactive.ts].**
  - [ ] `LaunchpadDeps` gains: `prompts?: GuidedPrompts` (default `clackGuidedPrompts(output)`), `runAnalysis?: (flags: PartialRunConfig) => Promise<number>` (the injected pipeline executor — cli wires it; absence degrades gracefully to echo-only), and `gitTokenConfigured?: boolean` (default `false`, for the AC3 hint).
  - [ ] `async function runGuidedAnalyze(deps, mode: "cwd" | "remote", output): Promise<void>` — (remote) `url = await prompts.text({ message: "Repository URL", validate: httpsUrl })`; `null` → return to menu. For remote, if `!deps.gitTokenConfigured`, write the AC3 hint naming `COMMIT_WHISPER_GIT_TOKEN` (never a collect field). Then `inputs = await collectGuidedInputs(deps.prompts, …)` (limit → date range → output multiselect, each `null` → return to menu). `flags = { repoTarget: target, ...inputs }`. `code = deps.runAnalysis ? await deps.runAnalysis(flags) : undefined`. On completion echo `▸ Next time: ${formatEquivalentCommand(target, flags)}` to `output`. Return (caller loops back to the menu — never a dead-end).
  - [ ] `collectGuidedInputs(prompts, output): Promise<PartialRunConfig | null>` — the three scoping prompts using `interpretLimit`/`interpretDateRange` as the validators, and an output `multiselect` over `terminal,html,markdown,json` (default `["terminal"]`; an empty pick → the default). Returns the assembled flags (no `repoTarget`), or `null` if any prompt cancelled. Branch is NOT prompted (no flag).
  - [ ] In `runLaunchpad`, dispatch `analyze-cwd` → `runGuidedAnalyze(deps, "cwd", output)` and `analyze-remote` → `runGuidedAnalyze(deps, "remote", output)` (both `continue` back to the menu). Remove these two from `COMING_SOON` and narrow its type to `Record<Exclude<LaunchpadAction, "help" | "quit" | "analyze-cwd" | "analyze-remote">, string>` (the remaining placeholders stay exhaustive by construction).

- [ ] **Task 4 — Wire the pipeline executor in the CLI shell (AC1, AC2) [src/cli/cli.ts].**
  - [ ] Extract a shared `resolveAndRun({ flags, env, cwd, stdinIsTTY, stdoutIsTTY, analysisTimestamp, nonInteractive, openAllowed, deps, ui }): Promise<number>` from `main`'s single-shot tail (resolve `RunConfig` → read `aiKey`/`gitToken` → `autoOpen = interactive && openAllowed` → `(deps.run ?? runPipeline)(config, …)`), and call it from `main` with `nonInteractive: true, openAllowed: opts.open !== false` (behavior-preserving — `interactive` is `false` there, so `autoOpen` stays `false`).
  - [ ] In `runZeroArg`, build a `runAnalysis` closure = `resolveAndRun({ …ctx, flags, nonInteractive: false, openAllowed: true, analysisTimestamp: deps.analysisTimestamp ?? new Date().toISOString() })` wrapped in `try/catch` → `ui.error(messageForError(err))` + `return exitCodeForError(err)` (a pipeline failure surfaces calmly and returns to the menu, never crashing the interactive session). Pass `runAnalysis` + `gitTokenConfigured: readGitToken(ctx.env) !== undefined` into the launchpad deps. (Per-run `new Date()` so each guided run gets its own determinism anchor.)

- [ ] **Task 5 — Tests (AC1–AC3).**
  - [ ] **`interactive.test.ts` (extend):** `formatEquivalentCommand` — cwd target `.` + max-commits + format → `commit-whisper . --max-commits 500 --format markdown`; remote URL target; `["terminal"]` selection omits `--format`; multi-format → comma-joined; since/until emitted; NO `--branch` ever. `interpretLimit` — `""`→`{}`; `"500"`→`{maxCommits:500}`; `"0"`/`"-3"`/`"1.5"`/`"abc"`→`{error}`. `interpretDateRange` — `""`→`{}`; `"2024-01-01..2024-06-30"`→both; `"2024-01-01.."`→since; `"..2024-06-30"`→until; `"2024-01-01"`→since; `"nope"`/`"2024-1-1"`→`{error}`.
  - [ ] **`interactive.test.ts` (guided flow):** a scripted `GuidedPrompts` (returns limit, date range, formats in turn) + a fake `runAnalysis` (records the flags, returns 0) + a scripted `select` `["analyze-cwd","quit"]`: asserts `runAnalysis` is called once with `{ repoTarget: ".", maxCommits, startDate?, endDate?, outputFormats }`, the `▸ Next time:` echo is written to the stderr `output` and contains the expected flags, and the loop returns to the menu (select called twice). A `null` from a guided prompt (cancel) → `runAnalysis` NOT called, back to the menu. Remote mode: a `text`-prompted URL becomes the target; with `gitTokenConfigured: false` the `COMMIT_WHISPER_GIT_TOKEN` hint is written; the secret is never prompted (no prompt message contains "key"/"token" as a collect field). Stream discipline: nothing the guided flow writes lands on a stdout sink (it all goes to the injected `output`).
  - [ ] **`cli.test.ts` (extend):** 0-arg interactive with an injected `launchpad` already asserts wiring; add a case that the launchpad receives a `runAnalysis` and `gitTokenConfigured` (capture the deps) — `gitTokenConfigured` is `true` when `COMMIT_WHISPER_GIT_TOKEN` is set, `false` otherwise. Optionally exercise `runAnalysis` end-to-end via an injected `run` (fake pipeline) to confirm `nonInteractive:false` resolves `aiMode:auto` and the flags reach the config. The existing single-shot tests must stay green (the `resolveAndRun` refactor is behavior-preserving).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the guided Analyze flow behind the launchpad's two Analyze rows — inferring the target (cwd `.` / a remote URL prompt), prompting ONLY the optional scoping inputs with defaults (limit, date range, output format), executing the run through the existing `runPipeline` (via a shared `resolveAndRun` helper), the **on-completion command echo** (`formatEquivalentCommand`, real flags only), and the **secret-naming** hint (`COMMIT_WHISPER_GIT_TOKEN` for a tokenless remote, never collected). All prompt chrome to stderr; the stdout report stays clean. Pure interpreters (`interpretLimit`/`interpretDateRange`) + the injected `GuidedPrompts`/`runAnalysis` seams keep it fully offline-testable with no PTY and no real pipeline.

**Out of scope / deferred (do NOT build here):**
- **A `--branch` flag / named-branch selection** — the CLI has no branch flag and the retrieve layer reads HEAD only (Epic 2 deferred named/all-branch selection + its Group-D wiring). 6.2 does NOT prompt branch and the echo never emits `--branch`. The MENUS "Branch" field is an aspirational wireframe. [Source: cli.ts buildProgram; run-config.ts Branch comment; epics.md Epic 2]
- **The live-updating `▸ Next time:` line during prompt editing** — the AC requires the echo **on completion**; a custom live-rendering prompt is polish. 6.2 echoes after the run. [Source: epics.md Story 6.2 AC2]
- **The boxed phase-log spinner + run-summary screen + degraded banner** — UX polish (MENUS "Phase log"/"Run summary"). The functional substance (the run + its existing stderr chrome: "Analyzed N of M", "Wrote X → path", the fail-open warning, auto-open) is delivered by the existing `runPipeline`; the decorative boxes are deferred. [Source: MENUS.md]
- **The no-AI interstitial + reachability probe** — Story **6.3**. A guided run with **no provider configured** resolves `aiMode: auto` (the interactive default), which makes `provider`/`llmModel` required — so config resolution throws a typed `MissingRequiredConfigError` (exit 3) that the `runAnalysis` closure catches, names, and returns from (back to the menu, never a dead-end). The calm "set OPENAI_API_KEY / use Ollama" teaching screen that pre-empts this is 6.3. (When a provider IS configured but unreachable, the pipeline's existing fail-open path renders the metrics substrate at exit 9.) [Source: epics.md Story 6.3; config/gaps.ts; run.ts runPreflight]
- **Settings / config-file defaults** — Story **6.5**; the guided defaults are the resolver defaults (terminal, all history), not yet read from `~/.commit-whisper`. [Source: epics.md Story 6.5]
- **`--no-open` / `--non-interactive` parity in guided mode** — operational flags are Story **6.4**; the guided run auto-opens the HTML showpiece (interactive, like 4.5) with no suppression flag. [Source: epics.md Story 6.4]
- **Collecting ANY secret** — forbidden by AC3 and the architecture's secret rule; the flow only ever NAMES env vars. [Source: architecture.md secret handling; PRD FR-2/FR-11]

### Architecture decisions (read first)

- **The guided flow lives in `cli/interactive.ts`** (architecture's home for "@clack menu … + guided prompts"). It is pure model + a loop over INJECTED prompt primitives (`GuidedPrompts`, mirroring 6.1's `LaunchpadSelect`), plus an INJECTED `runAnalysis` executor — so the whole flow is unit-testable with no PTY and no real pipeline. cli.ts owns the impure wiring (env/clock/keys → `resolveAndRun` → `runPipeline`). [Source: architecture.md cli/interactive.ts]
- **Execution reuses `runPipeline` verbatim** via a new shared `resolveAndRun` helper extracted from `main`'s single-shot tail. The single-shot path keeps `nonInteractive: true` (so `interactive` is false and `autoOpen` stays false — the existing tests still pass); the guided path passes `nonInteractive: false` so the resolver yields the interactive defaults (`aiMode: auto`) and `autoOpen` is enabled. The extraction is behavior-preserving for single-shot. [Source: cli.ts main; run.ts runPipeline; config/capability.ts]
- **Stream discipline = the AC1 "no bleed" guarantee.** Every guided prompt and the echo write to the launchpad `output` (default `process.stderr`); `@clack` is wired to the same stream via its `output` option; the report is written by `runPipeline` to **stdout** (`writeStdout`). So prompt styling physically cannot reach the report. A test asserts the guided sink is stderr-only. [Source: MENUS.md "Stream discipline"; shared/ui.ts; run.ts writeStdout]
- **Real flags only in the echo.** The authoritative flag surface is `buildProgram()` in cli.ts: the selection flags are `--max-commits`, `--since`, `--until`, plus `--format`. The guided flow collects exactly the inputs that map to these, so the echoed command is always runnable. `--format` uses the resolver token (`markdown`, not the `md` file extension) so the echo is copy-paste-runnable. [Source: cli.ts buildProgram/parseFormats]
- **`auto` aiMode handles "no provider configured" without a dead-end.** In the interactive guided path, `aiMode` resolves to `auto`; `runPipeline`'s gate band fails open to the deterministic substrate (exit 9) when the provider is unreachable or unset, so a first-run user still gets a report. The calm teaching about configuring a provider is 6.3. [Source: run.ts runPreflight/narrateOutcome]
- **Cancel is never a dead-end.** A `null` from any guided prompt (Esc/Ctrl-C) returns to the launchpad; a pipeline throw in the `runAnalysis` closure is caught (ui.error + the typed exit code) and also returns to the menu. The interactive session only ends on the launchpad's Quit. [Source: MENUS.md "Escape & cancel"; 6.1 runLaunchpad loop]
- **Cognitive-complexity ≤ 15 (SonarQube).** Keep `runGuidedAnalyze` thin (delegate prompting to `collectGuidedInputs`, parsing to the interpreters, execution to `runAnalysis`); the `interpretDateRange` split stays a small helper. Split further if a function approaches the limit. [Source: repo lint conventions]

### References

- epics.md → Epic 6 / **Story 6.2: Guided prompts and command echo** (the three ACs).
- MENUS.md → "Analyze — guided run" (fields + the `▸ Next time:` self-teaching echo + the private-remote token rule), "Stream discipline".
- EXPERIENCE.md → "Self-teaching" + "Escape hatch".
- architecture.md → `cli/interactive.ts`, the STRICT resolver, exit-code enum (9 = degraded).
- Reuse: `cli/interactive.ts` (6.1 `runLaunchpad`/`LaunchpadDeps`/`COMING_SOON`), `cli/cli.ts` (`buildProgram`, `applySelectionFlags`/`parseFormats` flag surface, `resolveRunConfig`, `readAiKey`/`readGitToken`), `cli/run.ts` (`runPipeline`), `config/run-config.ts` (`PartialRunConfig`, `OutputFormat`), `cli/exit-codes.ts` (`messageForError`/`exitCodeForError`).

## Dev Agent Record

### Summary

The launchpad's two Analyze rows are now live guided runs. A guided run infers the target (cwd `.` or a prompted remote URL), asks only the optional scoping inputs (limit · date range · output format) with defaults, executes the pipeline through an injected `runAnalysis`, then echoes the equivalent strict single-shot command (`▸ Next time: …`). All prompt chrome is stderr, so the stdout report never bleeds. A tokenless remote names `COMMIT_WHISPER_GIT_TOKEN` (never collects it). The model is pure + injectable, so the whole flow is unit-tested with no PTY and no real pipeline.

### Approach

- **`interactive.ts`** — pure core: `formatEquivalentCommand(target, flags)` (real flags only: `--max-commits`/`--since`/`--until`/`--format`; never `--branch`; `markdown` token so the echo is runnable; shell-safe `quoteArg`), and the dual-purpose interpreters `interpretLimit`/`interpretDateRange` (used as `@clack` validators AND parsers). Driver: `runGuidedAnalyze` + `collectGuidedInputs` over an injected `GuidedPrompts` (text/multiselect, cancel→null), wired into `runLaunchpad`'s dispatch (the two Analyze rows left `COMING_SOON`, which narrowed its `Exclude` type accordingly). Default `@clack` adapters route to the same stderr `output`.
- **`cli.ts`** — extracted a shared `resolveAndRun` (resolve → read keys → `autoOpen = interactive && openAllowed` → `runPipeline`) used by BOTH single-shot (`nonInteractive: true`, behaviour-preserving — `interactive` is false so `autoOpen` stays false) and the guided closure (`nonInteractive: false` → `aiMode: auto`, autoOpen on). The guided `runAnalysis` closure catches pipeline throws (ui.error + the typed exit code) so a failure returns to the menu, never a dead-end. Passes `runAnalysis` + `gitTokenConfigured` into the launchpad.

### Review — 3-layer adversarial (Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor:** all 3 ACs **MET**, scope **HELD**, **0 must-fix** (no `--branch`; `markdown` token correct vs the AC's illustrative `md`; stream discipline verified; `COMMIT_WHISPER_GIT_TOKEN` named, secret never prompted; `resolveAndRun` behaviour-preserving for single-shot).
- **Edge Case Hunter:** 3 findings → **2 PATCHED** (a number > `MAX_SAFE_INTEGER` echoed as `1e+21` and broke re-runnability → `interpretLimit` now rejects it; `quoteArg` only quoted on whitespace → now POSIX single-quote-escapes spaces/metacharacters so the pasted command is faithful + safe), **1 DISMISSED** (shape-only date regex accepting `2024-13-45` — deliberately mirrors cli.ts `validateDateFlag`; semantic date validation is out of scope and would diverge from single-shot).
- **Blind Hunter:** 1 finding → **1 PATCHED** (`interpretDateRange` triple-split `a..b..c` silently dropped the third part → now rejected). 

**Patches applied:** 3 (all in `interactive.ts` pure functions). **Tests added:** 3 lock-ins (huge-limit reject, triple-split reject, shell-quote faithfulness). Re-ran all gates green.

### Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm test` ✓ **742 passed** (+26: interactive +18, cli +5, plus the 3 patch lock-ins) · `npm run build` ✓ (161.24 KB — `@clack` `text`/`multiselect` pulled in). The interactive guided flow needs a PTY, so it is covered by the injected-prompt unit tests, not a live smoke test; the non-TTY 0-arg fail-fast (6.1) is unchanged.

### File List

- `src/cli/interactive.ts` (guided model + driver + `@clack` adapters) · `src/cli/interactive.test.ts` (extended)
- `src/cli/cli.ts` (`resolveAndRun` extraction + `runAnalysis`/`gitTokenConfigured` wiring) · `src/cli/cli.test.ts` (extended)
