---
epic: 6
story: 4
title: Operational flags
baseline_commit: 6f6535d
---

# Story 6.4: Operational flags

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user and CI author,
I want operational flags for config inspection and output control,
so that I can verify and tune behavior precisely.

## Acceptance Criteria

1. **`--show-config` prints the resolved configuration with per-field provenance, renders every secret as `***`, and exits without running (AC1).** **Given** `--show-config`, **when** it runs, **then** it prints the resolved configuration with **per-field provenance**, renders **every secret as `***`**, and **exits without running** the pipeline (exit 0, no retrieve/analyze/narrate/render).

2. **The behavior modifiers work: `--non-interactive` forces strict single-shot from a TTY; `--verbose`/`--quiet` adjust stderr only; `--version` prints and exits; color honors `NO_COLOR`/`FORCE_COLOR` alongside TTY detection (AC2).** **Given** `--non-interactive`, `--verbose`/`--quiet`, `--version`, and `NO_COLOR`/`FORCE_COLOR`, **when** each is used, **then** `--non-interactive` forces strict single-shot (the capability gate closed even in a TTY), **verbosity adjusts stderr only** (never stdout data), `--version` **prints and exits** (0), and color honors `NO_COLOR`/`FORCE_COLOR` **alongside TTY detection** (`NO_COLOR` wins).

3. **The `aiMode` flags behave, and the headless default is metrics-only with a one-line nudge (AC3).** **Given** the `aiMode` flags `--ai` / `--no-ai`, **when** a run is invoked, **then** `--no-ai` forces metrics-only (no LLM call, clean substrate, exit 0) and `--ai` forces narration-required (hard-fail with the narration exit code if the provider is unreachable), **and** with **neither** flag the default is `auto` interactively (AI-first, fail-open) and `off` in headless/CI (metrics-only) — and when it **defaults** to `off` headless, a **one-line nudge** notes the narrative is available interactively or by setting a provider key.

## Tasks / Subtasks

- [ ] **Task 1 — Verbosity + color policy in the `ui` module (AC2) [src/shared/ui.ts].** [Source: architecture.md "Behavior Modifiers"; ui.ts]
  - [ ] `export type LogLevel = "quiet" | "normal" | "verbose"`; add an OPTIONAL `debug?(message): void` to `Ui` (optional ⇒ existing test recorders that omit it still typecheck; the pipeline calls it via `ui.debug?.(…)`).
  - [ ] `createUi(stream, opts?: { level?: LogLevel; color?: boolean })` — gate by level: `error`/`warn` ALWAYS; `info`/`plain` only when `level !== "quiet"`; `debug` only when `level === "verbose"`. Color (via `picocolors` `createColors(opts.color ?? false)`): `error` red, `warn` yellow; `info`/`plain`/`debug` uncoloured (calm). All output stays on the injected stream (stderr) — verbosity/color NEVER touch stdout. Default `createUi()` = `{ level: "normal", color: false }` (back-compatible: today's callers pass no opts and still get error/warn/info/plain).
  - [ ] `export function resolveLogLevel(input: { verbose?: boolean; quiet?: boolean; env: NodeJS.ProcessEnv }): LogLevel` — pure: `quiet` flag → `"quiet"`; else `verbose` flag → `"verbose"`; else `COMMIT_SAGE_LOG_LEVEL` (∈ quiet|verbose|normal, trimmed) ; else `"normal"`. (A flag beats the env var.)
  - [ ] `export function resolveColor(input: { env: NodeJS.ProcessEnv; isTTY: boolean }): boolean` — pure: a non-empty `NO_COLOR` → `false` (wins); else a non-empty `FORCE_COLOR` → `true` unless it is `"0"`/`"false"`; else `isTTY`. [Source: no-color.org; architecture "NO_COLOR wins"]

- [ ] **Task 2 — The version constant (AC2) [src/cli/version.ts] (new).**
  - [ ] `export const VERSION = "1.0.0"` (the `package.json` version). A co-located test reads `package.json` (via `node:fs`) and asserts they match, so the constant can never silently drift.

- [ ] **Task 3 — The `--show-config` formatter (AC1) [src/cli/show-config.ts] (new).** [Source: architecture.md "`--show-config` dump resolved values + per-field provenance; secrets ⇒ `***`"; run-config.ts `Provenance`/`Source`]
  - [ ] `export function formatShowConfig(config: RunConfig, secrets: { aiKey?: Secret<string>; gitToken?: Secret<string> }): string` — pure, deterministic. One line per `ConfigData` field in the stable `CONFIG_FIELD_KEYS` order: `  <field> = <value>  (<provenance source | "default">)`. `branch` renders by kind (`head` / `all` / `named:<name>`); arrays comma-joined; `undefined` → `(unset)`. Then the injected fields (`analysisTimestamp`, `entitlement.tier` + `commitCap`) without provenance. Then a **Secrets** block: `aiKey` / `gitPat` rendered through the `Secret` (⇒ `***`) when present, `(unset)` when absent — the value is NEVER revealed (use `String(secret)` / the `***` literal, never `.reveal()`). A short header line. This is the requested inspection artifact ⇒ written to **stdout**.

- [ ] **Task 4 — Wire the flags into the shell (AC1, AC2) [src/cli/cli.ts].**
  - [ ] `buildProgram`: add `.version(VERSION, "--version", "print the version and exit")` (commander throws `commander.version`, already mapped to exit 0 by `resolveCommanderError`); `.option("--show-config", "print the resolved configuration (with provenance) and exit")`; `.option("--non-interactive", "force strict single-shot even in a TTY")`; `.option("--verbose", "more detailed stderr logging")`; `.option("--quiet", "errors and warnings only on stderr")`. Extend `CliOptions` accordingly.
  - [ ] Read `stderrIsTTY` (`deps.stderrIsTTY ?? process.stderr.isTTY`) alongside the existing TTY reads. Build the run `ui`: `deps.ui ?? createUi(process.stderr, { level: resolveLogLevel({ verbose: opts.verbose, quiet: opts.quiet, env }), color: resolveColor({ env, isTTY: stderrIsTTY }) })`. (The 0-arg launchpad + early parse-error path use a bootstrap `ui` resolved from env only — no flags parsed yet.)
  - [ ] `--show-config`: after `buildFlags` + `resolveRunConfig` (passing `nonInteractive: true`), write `formatShowConfig(config, { aiKey: readAiKey(env, config.provider), gitToken: readGitToken(env) })` to stdout and `return ExitCode.Success` — BEFORE any pipeline call.
  - [ ] `--non-interactive`: thread into the single-shot resolve as `nonInteractive: true` (already the case ⇒ behaviour-preserving; the flag is the explicit, documented lever and is accepted without error). It never reaches `runZeroArg` (passing it makes the invocation ≥1-arg ⇒ strict single-shot).

- [ ] **Task 5 — The headless metrics-only nudge (AC3) [src/cli/run.ts].**
  - [ ] In `runPipeline`, when `config.aiMode === "off"` AND `config.provenance.aiMode === "default"` (i.e. it DEFAULTED to off in headless/CI, NOT an explicit `--no-ai`/env opt-out), emit ONE `ui.info(…)` line noting the narrative is available interactively or by setting a provider key. Gated so an explicit `--no-ai` (provenance `flag`) or `COMMIT_SAGE_NO_AI` (provenance `env`) stays silent. Stderr chrome only — never stdout, and suppressed by `--quiet` (it is `info`-level).

- [ ] **Task 6 — Tests (AC1–AC3).**
  - [ ] **`ui.test.ts` (extend):** `createUi` level gating — quiet suppresses info/plain/debug (keeps error/warn); normal suppresses debug (keeps error/warn/info/plain); verbose emits all; color=true wraps error/warn in ANSI (and info stays plain); color=false emits no ANSI; everything stays on the injected stream (never stdout). `resolveLogLevel` — quiet flag wins, verbose flag, `COMMIT_SAGE_LOG_LEVEL` fallback, flag-beats-env, default normal. `resolveColor` — non-empty `NO_COLOR` → false (even with FORCE_COLOR set: NO_COLOR wins); `FORCE_COLOR=1`/`true` → true, `FORCE_COLOR=0`/`false` → false; no vars → mirrors `isTTY`.
  - [ ] **`version.test.ts` (new):** `VERSION` equals `package.json`'s `version`.
  - [ ] **`show-config.test.ts` (new):** `formatShowConfig` includes each resolved field with its value + provenance source; a flag-sourced field shows `(flag)`, a default shows `(default)`; `branch` renders by kind; the secrets block shows `***` for a present `aiKey`/`gitToken` and `(unset)` when absent; the raw secret value NEVER appears in the output; the output is deterministic (stable order).
  - [ ] **`cli.test.ts` (extend):** `--show-config` writes the dump to **stdout** and returns 0 WITHOUT calling the injected `run` (pipeline never invoked); a `--show-config` with a secret env (`OPENAI_API_KEY`) shows `***`, never the value; `--version` returns 0 (clean exit) and does not run; `--non-interactive .` parses and runs headless (the injected `run` sees `aiMode: "off"` default + a non-interactive resolve, `autoOpen: false`); `--quiet` / `--verbose` parse and the run still happens (exit 0). (The ui level/colour effects are unit-tested in `ui.test.ts`; here we assert the flags are accepted and threaded.)
  - [ ] **`run.test.ts` (extend):** a headless DEFAULT-off run (`aiMode` off via the resolver default, provenance `default`) emits the one-line nudge on `info`; an explicit `--no-ai` (provenance `flag`) emits NO nudge; the nudge is `info`-level (so `--quiet` would suppress it) and never appears on stdout.

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the operational/behaviour-modifier flag surface — `--show-config` (resolved config + per-field provenance, secrets `***`, exit without running), `--non-interactive` (accepted + forces the capability gate closed; behaviour-preserving for the already-strict single-shot), `--verbose`/`--quiet` (a `LogLevel` gating the `ui` chrome on stderr only), `--version` (commander `.version()` + a drift-proof `VERSION` const), `NO_COLOR`/`FORCE_COLOR` (a pure colour policy wired into the `ui` via `picocolors`), and the AC3 headless-default-off **nudge**. Wires the so-far-unused `picocolors` dep. All pure pieces (`resolveLogLevel`/`resolveColor`/`formatShowConfig`) + the `ui` gating are unit-tested; the cli wiring is tested via the injected `run`/`writeStdout`.

**Out of scope / deferred (do NOT build here):**
- **`--ai` / `--no-ai` themselves** — already implemented (Story 1.6 + the `applyAiFlags` mapping). 6.4 only ADDS the AC3 headless-default-off nudge; the flags' core behaviour (metrics-only exit 0 / narration-required exit 6 / auto fail-open exit 9) is unchanged and already tested. [Source: cli.ts applyAiFlags; run.ts gate band]
- **`--config <path>` / `COMMIT_SAGE_CONFIG`** — the config-file selector is part of Story **6.5** (the `~/.commit-sage` reader/writer + the config-file resolver layer). 6.4's `--show-config` dumps the CURRENT resolution (config-file layer still `{}` until 6.5). [Source: architecture.md `--config`; epics.md Story 6.5]
- **Full colour theming of every screen** — 6.4 adds the colour POLICY + minimal severity colour (error red / warn yellow) so `NO_COLOR`/`FORCE_COLOR` are honoured; rich themed launchpad/report colour is not in any AC and stays out (the calm, line-oriented posture holds). [Source: DESIGN.md; EXPERIENCE.md accessibility floor]
- **A `COMMIT_SAGE_LOG_LEVEL`-driven structured logger / log file** — verbosity is a 3-level stderr gate, not a logging framework. [Source: architecture.md "Behavior Modifiers"]
- **`--version` to stdout** — commander's version (like `--help`) routes through the shell's `configureOutput` to **stderr** for consistency; `--show-config` (the inspection artifact) goes to stdout. Not re-routing commander per-call. [Source: cli.ts buildProgram configureOutput]
- **Re-flowing existing chrome through `debug`** — only a few genuinely verbose lines move to `ui.debug?.()`; the existing `info`/`warn` call sites keep their level. No broad re-leveling. [Source: this story]

### Architecture decisions (read first)

- **`--show-config` exits BEFORE the pipeline.** It resolves the `RunConfig` (the same two-phase resolver a run uses) and dumps it + provenance, then returns 0 — no retrieve/analyze/narrate/render. Secrets are shown via the `Secret` wrapper's `***` (the value never leaves `reveal()`, which `formatShowConfig` never calls). It is the one inspection artifact a user pipes, so it goes to **stdout** (distinct from the help/version chrome on stderr). [Source: architecture.md `--show-config`; shared/secret.ts]
- **`provenance` already exists** on `RunConfig` (`Partial<Record<keyof ConfigData, Source>>`, `Source = default|configFile|env|flag|interactive`), set by the Phase-1 merge. `formatShowConfig` just renders it — no new resolver work. [Source: config/run-config.ts; config/resolver.ts]
- **Verbosity/colour are `ui`-module concerns, stderr-only.** The hexagonal stdout (machine data / Report JSON) is never touched by a log level or a colour code — the gating + colour live entirely in `createUi`, which writes to the injected stderr stream. The policy resolvers take an `env` PARAMETER (not `process.env`), so they stay pure and inside the lint boundary. `picocolors` `createColors(enabled)` gives deterministic, testable colour (no global TTY sniffing). [Source: shared/ui.ts; architecture.md stream discipline]
- **`--non-interactive` is honest about its (lack of) extra teeth.** Per the STRICT truth table, ANY ≥1-arg invocation is already fully non-interactive, and `--non-interactive` is itself an arg — so it can only CONFIRM the closed capability gate, never open it. It is wired (forces `nonInteractive: true`, already the single-shot value) and accepted without error; its value is as the explicit, documented CI lever. It never reaches the 0-arg launchpad path. [Source: architecture.md Truth Table; cli.ts main]
- **The AC3 nudge fires only on a DEFAULTED headless-off**, distinguished via `provenance.aiMode === "default"`. An explicit `--no-ai` (provenance `flag`) or `COMMIT_SAGE_NO_AI` (provenance `env`) is an intentional opt-out and stays silent. The nudge is `info`-level so `--quiet` suppresses it, and it is stderr chrome (never in the Report). [Source: config/sources.ts buildDefaults; config/resolver.ts provenance]
- **`VERSION` is a const, drift-guarded by a test** that reads `package.json`. Importing `package.json` directly (JSON module) would complicate the tsup bundle + nodenext resolution; a const + an equality test is simpler and keeps the runtime import-free. [Source: package.json; tsup.config.ts]
- **`Ui.debug` is optional** so the change is non-breaking: every existing test recorder (`{ error, warn, info, plain }`) still satisfies `Ui`, and the pipeline calls `ui.debug?.(…)`. [Source: cli.test.ts / run.test.ts recorders]
- **Cognitive-complexity ≤ 15 (SonarQube).** `createUi` stays a small factory (a gate predicate + a colour map); `formatShowConfig` is a sequence of small line-builders joined; `main`'s new branches are thin. [Source: repo lint conventions]

### References

- epics.md → Epic 6 / **Story 6.4: Operational flags** (the three ACs).
- architecture.md → "Action / Subcommand Flags" + "Behavior Modifiers" tables (`--show-config`, `--non-interactive`, `--verbose`/`--quiet`, `--version`, `NO_COLOR`/`FORCE_COLOR`), the STRICT Truth Table, the exit-code enum.
- DESIGN.md / EXPERIENCE.md → colour tokens + the accessibility floor (colour never load-bearing).
- Reuse: `shared/ui.ts` (`createUi`/`Ui`), `shared/secret.ts` (`Secret` ⇒ `***`), `config/run-config.ts` (`RunConfig`/`Provenance`/`Source`), `config/sources.ts` (`CONFIG_FIELD_KEYS`), `config/env.ts` (`readAiKey`/`readGitToken`/`readEnvLayer`), `cli/cli.ts` (`buildProgram`/`resolveAndRun`/`resolveCommanderError`), `cli/exit-codes.ts`, `picocolors` (`createColors`).

## Dev Agent Record

### Summary

The operational/behaviour-modifier flag surface: `--show-config` (resolved config + per-field provenance, secrets `***`, exit without running), `--non-interactive` (the explicit headless lever), `--verbose`/`--quiet` (a stderr-only `LogLevel`), `--version`, and `NO_COLOR`/`FORCE_COLOR` (a colour policy wired into the `ui` via the previously-unused `picocolors`). Plus the AC3 headless-default-off nudge. All chrome stays on stderr; stdout is never touched by a log level or colour.

### Approach

- **`shared/ui.ts`** — `createUi(stream, { level, color })` gates the existing methods (`error`/`warn` always; `info`/`plain` suppressed by `quiet`; new optional `debug` only on `verbose`) and colours `error` red / `warn` yellow via `pc.createColors(color)` (everything else calm). Pure `resolveLogLevel` (flag beats `COMMIT_SAGE_LOG_LEVEL`) + `resolveColor` (`NO_COLOR` wins → false; `FORCE_COLOR` non-empty unless 0/false; else TTY). `debug` is OPTIONAL so every existing `{error,warn,info,plain}` recorder still satisfies `Ui`; the pipeline calls `ui.debug?.(…)`.
- **`cli/version.ts`** (new) — `VERSION` const, drift-guarded by a test reading `package.json`.
- **`cli/show-config.ts`** (new) — pure `formatShowConfig(config, { aiKey, gitPat })`: each `ConfigData` field (stable order) with value + provenance source, the injected resolved fields, and a secrets block rendering `***` via the `Secret` wrapper (never `reveal()`); `(none)` for a genuinely-unset field.
- **`cli/cli.ts`** — `buildProgram` gains `.version()` + the four options. A bootstrap `ui` (env-only policy) serves the 0-arg launchpad + pre-parse errors; a flag-aware run `ui` serves the single-shot run. `--show-config` resolves LENIENTLY and dumps to stdout, exiting 0 before any pipeline call. `resolveAndRun` was split into `resolveAndRun` (resolve+run, for the guided path) + `runResolved` (run an already-resolved config), threading `nonInteractive` so `autoOpen` stays behaviour-preserving.
- **`cli/run.ts`** — the AC3 nudge (`info`, gated on `aiMode === "off" && provenance.aiMode === "default"`) + two `ui.debug?.()` lines so `--verbose` has a visible runtime effect.

### Review — 3-layer adversarial (Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor:** AC1/AC2/AC3 **MET**, scope **HELD** (the `--ai`/`--no-ai` core untouched — only the nudge added; the `resolveAndRun`→`runResolved` refactor behaviour-preserving; `picocolors` used only for minimal severity colour; nothing from 6.5 built).
- **Edge Case Hunter:** ~70 cases, **1 REAL** → **PATCHED** (`--show-config` threw `MissingRequiredConfigError` on a required gap — e.g. `--ai` with no provider — before it could dump, defeating its diagnostic purpose; now resolves LENIENTLY [`finalizeRunConfig` gains a `lenient` skip-the-gap-check path threaded through `resolveRunConfig`] so it ALWAYS dumps, showing missing fields as `(unset) (none)`). The `--show-config --version` precedence note dismissed (both exit 0).
- **Blind Hunter:** 5 findings → **0 patched** (all false positives: "missing `runDeps` field" is disproven by passing typecheck — `CliDeps` already declares it; #2 was truncated-diff; the two-`ui` split is by design; #4/#5 were assumptions confirmed correct).

**Patches applied:** 1 (lenient `--show-config` resolve). **Tests added:** 3 (lenient resolver, lenient cli dump, the `(none)` rendering). **Dismissed:** 6 (5 Blind + 1 Edge). Re-ran all gates green.

### Gates

`npm run typecheck` ✓ · `npm run lint` ✓ (clean, no warnings) · `npm test` ✓ **792 passed** (+31: ui +14, show-config +6, version +1, cli +6, run +2, resolver +1, plus the patch lock-ins) · `npm run build` ✓ (169.84 KB — `picocolors` now bundled). Smoke-tested the real binary: `--version` → `1.0.0` exit 0; `--show-config` → stdout-only dump with provenance + `aiKey = ***` (0 secret leaks); `--ai --show-config` (no provider) → lenient dump, exit 0.

### File List

- `src/shared/ui.ts` (LogLevel + colour + `resolveLogLevel`/`resolveColor`) · `src/shared/ui.test.ts` (extended)
- `src/cli/version.ts` (new) · `src/cli/version.test.ts` (new)
- `src/cli/show-config.ts` (new) · `src/cli/show-config.test.ts` (new)
- `src/cli/cli.ts` (flags + bootstrap/run `ui` + `--show-config` lenient branch + `runResolved` split) · `src/cli/cli.test.ts` (extended)
- `src/cli/run.ts` (AC3 nudge + `debug` lines) · `src/cli/run.test.ts` (extended)
- `src/config/gaps.ts` + `src/config/resolve-run-config.ts` (the `lenient` resolve path) · `src/config/resolve-run-config.test.ts` (extended)
