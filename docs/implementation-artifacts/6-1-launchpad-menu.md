---
epic: 6
story: 1
title: Launchpad menu
baseline_commit: f904d37
---

# Story 6.1: Launchpad menu

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a newcomer in my repo,
I want a discovery menu when I run the bare command,
so that I can find what the tool does without reading docs.

## Acceptance Criteria

1. **The bare zero-arg command in an interactive TTY opens a calm, line-oriented launchpad (AC1).** **Given** zero arguments in an interactive terminal, **when** `commit-sage` runs, **then** a calm, line-oriented launchpad opens led by **"Analyze this repository"** (the cwd default), then **"Analyze a remote repository"**, **"Settings"**, **"Status / doctor"**, and **"Help / show all flags"** — in that order, grouped ACT → ORIENT → LICENSE — and a **"Quit"** affordance is always present. (Zero args in a non-TTY / CI context is **not** interactive: it fails fast with a typed usage error + non-zero exit, naming the fix — per the STRICT truth table.)

2. **A persistent header readiness line tops the screen (AC2).** **Given** the launchpad opens, **when** it is rendered, **then** it is topped by the product tagline and a single dim **readiness line** — `<tier> · AI: <provider (model) | ⚠ not configured> · cwd: <path> (<branch>) | — (not a git repo)` — so the user always knows their tier, whether AI is configured, and what "this repo" means without opening Status/doctor.

3. **License actions appear by effective state (AC3).** **Given** the effective license state, **when** the menu is built, **then** the LICENSE group shows **Activate**, **Buy / Restore**, and **Buy Me a Coffee** when **unlicensed**, and shows **Deactivate** (only) when **licensed** — the unlicensed-only support/onboarding rows retire once licensed. (Until the Epic 7 license gate lands, the effective state is Free / unlicensed.)

4. **The menu is keyboard-navigable, never color-alone, and exits cleanly with a flags cheatsheet (AC4).** **Given** the launchpad is open, **when** the user navigates, **then** every row is selectable by keyboard and carries a **text label** (identity/selection never depends on color alone), and **Esc / Quit exits cleanly (exit 0) printing a short flags cheatsheet** on the way out; **Help / show all flags** prints the full flag reference and returns to the menu. All of this chrome is written to **stderr** (stdout stays clean for machine data).

## Tasks / Subtasks

- [ ] **Task 1 — The pure launchpad model: readiness line + state-aware options (AC1, AC2, AC3) [src/cli/interactive.ts] (new).** [Source: architecture.md `cli/interactive.ts`; MENUS.md "Launchpad", "The Header Spine"; EXPERIENCE.md "launchpad action set"]
  - [ ] `export type LaunchpadAction = "analyze-cwd" | "analyze-remote" | "settings" | "status" | "help" | "activate" | "buy-restore" | "coffee" | "deactivate" | "quit"`.
  - [ ] `export interface LaunchpadState { tier: Tier; licensed: boolean; provider?: Provider; llmModel?: string; cwdLabel: string; isRepo: boolean; branch?: string }` — a fully-resolved presentation snapshot (no I/O inside the module).
  - [ ] `export function formatReadinessLine(state): string` — pure. Tier label (`free`→`Free`, `single-device`→`Single-device`, `unlimited`→`Unlimited`); AI segment = `<provider> (<model>)` when `provider` set (model appended only when present), else `⚠ not configured`; cwd segment = `<cwdLabel> (<branch>)` when `isRepo` (branch falls back to a dim `detached`/`no branch` only if missing), else `— (not a git repo)`. One line, ` · `-joined.
  - [ ] `export function buildLaunchpadOptions(state): LaunchpadOption[]` — pure, ordered, grouped. ACT: `analyze-cwd` ("Analyze this repository"), `analyze-remote` ("Analyze a remote repository"); ORIENT: `settings` ("Settings"), `status` ("Status / doctor"), `help` ("Help / show all flags"); LICENSE by state — unlicensed: `activate`, `buy-restore`, `coffee`; licensed: `deactivate`; then `quit` ("Quit") always last. Each option carries `{ value, label, hint? }`; **every option has a non-empty `label`** (the never-color-alone guarantee at the data layer). Static, inferable hints only (e.g. Settings → "provider, model, default format"); no hint that would require extra I/O (no commit counts).

- [ ] **Task 2 — The launchpad driver: render header + menu loop + clean exit (AC1, AC4) [src/cli/interactive.ts].** [Source: MENUS.md "Escape & cancel"; EXPERIENCE.md "Escape hatch"; @clack/prompts `select`/`isCancel`]
  - [ ] `export async function runLaunchpad(deps: LaunchpadDeps): Promise<number>` where `LaunchpadDeps = { state; helpText: string; output?: NodeJS.WritableStream; select?: LaunchpadSelect }`. `output` defaults to `process.stderr` (all chrome → stderr). `select` defaults to a `@clack/prompts` `select` adapter (wired to `output`) that returns the chosen `LaunchpadAction` or `null` on cancel (Esc/Ctrl-C → `isCancel`); injectable so the loop is unit-testable with **no TTY**.
  - [ ] Write the tagline + `formatReadinessLine(state)` to `output` once, then loop: `select({ message: "What would you like to do?", options })`; a `null` (cancel) result is treated as `quit`. Dispatch (low cognitive-complexity switch): `quit` → write the **short flags cheatsheet**, return `ExitCode.Success` (0); `help` → write the **full flag reference** (`deps.helpText`), continue; every other (not-yet-built) action → write a calm "coming soon" note (the two Analyze rows include the headless bridge — `commit-sage .` / `commit-sage <url>`), continue. The loop only ever terminates on quit/cancel.
  - [ ] Constants: `LAUNCHPAD_TAGLINE = "commit-sage · I know what you did last commit"` (the locked product tagline) and `FLAGS_CHEATSHEET` (a short, copyable list: `commit-sage .`, `commit-sage <path|url>`, `--no-ai`, `--format html,json`, `--help`). No color codes (calm, line-oriented; never color-as-meaning).

- [ ] **Task 3 — Repo context for the header (AC2) [src/cli/repo-context.ts] (new).**
  - [ ] `export async function readRepoContext(runner: GitRunner, cwd: string): Promise<{ isRepo: boolean; branch?: string }>` — read-only git via the injected `GitRunner` (reuse `retrieve/git.ts`): `git rev-parse --is-inside-work-tree` (repo? — a throw or non-`true` → `{ isRepo: false }`) then `git branch --show-current` (the current branch; empty string for detached/unborn HEAD → `branch: undefined`). Never throws — a non-repo cwd is a normal header state, not an error (the menu must still open). `execFile`, array args, no shell (inherits the 1.4 injection-safety posture).

- [ ] **Task 4 — Wire the 0-arg path in the CLI shell (AC1, AC2, AC4) [src/cli/cli.ts].**
  - [ ] Hoist the `env` / `stdinIsTTY` / `stdoutIsTTY` / `cwd` reads above the `argv.length === 0` branch (both branches need them). Replace the "not yet available" stub: compute `detectCapability({ nonInteractive: false, stdinIsTTY, stdoutIsTTY, env })`. If **not interactive** → `ui.error(...)` naming the fix (pass a repo / use `--help`) and return `ExitCode.Usage` (the non-TTY/CI fail-fast row). If **interactive** → build the `LaunchpadState` (tier `free` + `licensed: false` until Epic 7; `provider`/`llmModel` from `readEnvLayer(env)` — the live "configured AI" source today, config-file is 6.5; `cwdLabel` via `collapseHome(cwd, env.HOME)`; `isRepo`/`branch` via `readRepoContext(gitRunner, cwd)`), then `return (deps.launchpad ?? runLaunchpad)({ state, helpText: buildProgram().helpInformation() })`.
  - [ ] `CliDeps` gains `gitRunner?: GitRunner` (default `execFileGitRunner`) and `launchpad?: typeof runLaunchpad` (default `runLaunchpad`) — the two new injectable seams so `main`'s 0-arg branch is testable without a real git or a real TTY. `collapseHome(cwd, home?)` is a tiny pure helper (prefix-replace `home` → `~`; passthrough when `home` is unset or not a prefix).

- [ ] **Task 5 — Tests (AC1–AC4).**
  - [ ] **`interactive.test.ts` (new):** `formatReadinessLine` — Free + configured (`ollama (llama3)`) + repo+branch; Free + `⚠ not configured`; not-a-repo → `— (not a git repo)`; single-device/unlimited tier labels. `buildLaunchpadOptions` — unlicensed shows Activate/Buy-Restore/Coffee + no Deactivate; licensed shows Deactivate + none of the unlicensed-only rows; the ACT/ORIENT leading order is exact (`analyze-cwd` first, then `analyze-remote`, `settings`, `status`, `help`); `quit` always last; **every option has a non-empty label** (never-color-alone). `runLaunchpad` (injected `select` + fake `output`) — a scripted `["help","quit"]` writes the full help then the cheatsheet and returns 0; a `null` (cancel) first result exits 0 with the cheatsheet (Esc); a not-yet-built action (`settings`) writes a coming-soon note and loops back to the menu (select called again); the header tagline + readiness line are written once before the first select; **nothing is written to stdout** (assert the fake `output` is the only sink).
  - [ ] **`repo-context.test.ts` (new):** a runner returning `true` + `main` → `{ isRepo: true, branch: "main" }`; a runner whose `rev-parse` throws → `{ isRepo: false }` (never throws); `is-inside-work-tree` returning `false`/non-`true` → `{ isRepo: false }`; an empty `branch --show-current` (detached/unborn) → `{ isRepo: true, branch: undefined }`.
  - [ ] **`cli.test.ts` (extend):** 0 args + non-interactive (the `BASE` non-TTY) → `ExitCode.Usage` and an `ui.error` naming the fix, and the (injected) `launchpad` is **never** called; 0 args + interactive (`stdinIsTTY/stdoutIsTTY: true`, non-CI env) → calls the injected `launchpad` exactly once and returns its code, with the built `state` carrying the env-configured provider/model and the repo branch (inject a fake `gitRunner`); the `helpText` passed is non-empty.

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the **launchpad menu only** — the pure model (`formatReadinessLine` + `buildLaunchpadOptions`), the menu **driver/loop** (`runLaunchpad` over an injectable `@clack` `select`), the **header readiness line**, **state-aware license rows**, the **repo-context** read for the header (branch), the 0-arg CLI wiring (interactive → launchpad; non-TTY/CI → fail-fast), and the **clean-exit + flags cheatsheet**. `Help` and `Quit` are the only **functional** actions in 6.1; every other row is **present** (discovery is the point) but routes to a calm "coming soon" placeholder. All offline-testable (injected `select`, `output`, `gitRunner`).

**Out of scope / deferred (do NOT build here):**
- **The guided Analyze run + remote-URL prompt + command echo** — Story **6.2**. 6.1's Analyze rows route to a placeholder (with the headless bridge). [Source: epics.md#Story-6.2]
- **The Settings screen + `~/.commit-sage` config-file write/read** — Story **6.5**. 6.1's header reads `provider`/`llmModel` from the **env layer only** (the live source today); the config-file layer arrives with 6.5. [Source: epics.md#Story-6.5; architecture.md "configFile defaults to {}"]
- **Status / doctor view + first-run-no-AI interstitial + reachability probe** — Story **6.3**. 6.1's Status row is a placeholder; the header reports *configured*, never *reachable*. [Source: epics.md#Story-6.3]
- **Operational flags (`--show-config`/`--non-interactive`/`--version`/`NO_COLOR`/`FORCE_COLOR`/verbosity)** — Story **6.4**. [Source: epics.md#Story-6.4]
- **Real license tier / Activate / Deactivate / Buy-Restore / Coffee actions + online validation** — **Epic 7**. 6.1 hardcodes `tier: "free"` + `licensed: false` and routes the license rows to placeholders; only their **visibility-by-state** is real. [Source: epics.md#Epic-7]
- **Color / picocolors theming + spinner** — the launchpad is calm and line-oriented; color is never load-bearing (AC4 never-color-alone). `@clack`'s built-in selection glyph + our text labels satisfy the accessibility floor; no `NO_COLOR` handling here (that is 6.4). [Source: DESIGN.md; EXPERIENCE.md "Accessibility Floor"]
- **A PTY / real-keypress integration test** — `@clack`'s interactive rendering needs a TTY; 6.1 tests the pure model + the loop via an **injected** `select` (no PTY). The default `select` adapter is the thin, unit-untested seam (exercised only at real runtime). [Source: this story]

### Architecture decisions (read first)

- **One interactive door (STRICT truth table).** The launchpad is the **only** interactive entry point in the whole product: the bare zero-arg `commit-sage` in a TTY. Any ≥1-arg invocation is strict single-shot and never reaches this code. 0-arg + non-TTY/CI fails fast (typed usage error, exit 2). The capability gate is computed with `nonInteractive: false` here (this is the one path allowed to prompt). [Source: architecture.md "STRICT Single-Shot", "Truth Table"; capability.ts]
- **Hexagonal boundary holds.** `cli/` may touch argv / TTY / cwd but NOT `process.env`; `main` already captures the env via `readProcessEnv()` and injects it. `interactive.ts` is **pure presentation + a loop over an injected `select`** — no env, no git, no clock. The git read (branch) lives in `repo-context.ts` behind the injected `GitRunner`, and the config read (provider/model) stays in `config/` (`readEnvLayer`), called by `main`. [Source: architecture.md hexagonal layering; src/config/env.ts]
- **Stream discipline.** All interactive chrome → **stderr** (the launchpad writes via the injected `output`, default `process.stderr`; `@clack` is wired to the same stream via its `output` option). stdout stays machine-only so a future `commit-sage --format json > out.json` (argument-mode) is never polluted — though note the menu only runs at a TTY where stdout is the terminal anyway. [Source: MENUS.md "Stream discipline"; shared/ui.ts]
- **Tier/entitlement is Free until Epic 7.** `resolve-run-config.ts` already defaults `entitlement` to `{ tier: "free", commitCap: 100 }`; there is no license reader yet. 6.1 presents `tier: "free"` + `licensed: false` directly (a small honest constant in `main`), with a comment that the Epic 7 license gate will supply the real entitlement. The license **rows-by-state** logic (`buildLaunchpadOptions`) is built now so Epic 7 only flips the boolean. [Source: resolve-run-config.ts; epics.md#Epic-7]
- **Provider/model = "what's configured", read from the env layer.** `buildDefaults` sets **no** default `provider`/`llmModel` (they are `whenAi`-required, never defaulted), so a Phase-1 read returns them only when the user actually configured them. Today the live non-default source in 0-arg mode is the **environment** (`readEnvLayer(env)` → `COMMIT_SAGE_PROVIDER` / `COMMIT_SAGE_LLM_MODEL`); flags don't exist in 0-arg and the config file is 6.5. So `⚠ not configured` is the correct, honest default state for a fresh user. [Source: sources.ts `buildDefaults`/`FIELD_SPECS`; resolver.ts `mergeLayers`]
- **`@clack/prompts` `select` API.** `select<T>({ message, options, output })` returns `T | symbol`; `isCancel(result)` narrows the cancel symbol (Esc/Ctrl-C). The default adapter maps a cancel → `null` so the rest of the loop is symbol-free and test-scriptable. `Option<T> = { value, label, hint?, disabled? }`. `@clack` is already a locked dep (1.5.1). [Source: node_modules/@clack/prompts types; architecture.md tech table]
- **Cognitive-complexity ≤ 15 (SonarQube).** Keep the loop body a small `switch` (quit/help/default); the per-action "coming soon" copy lives in a small lookup, not nested branches. Split `main`'s 0-arg handling into a focused helper if the function grows past the limit. [Source: repo lint conventions]

### References

- epics.md → Epic 6 / **Story 6.1: Launchpad menu** (the four ACs).
- MENUS.md → "Launchpad" (states: unlicensed+AI, unlicensed+no-AI, licensed, not-a-repo), "The Header Spine (readiness line)", "Menu item reference", "Escape & cancel".
- EXPERIENCE.md → "launchpad action set" table (fixed + state-aware), "Escape hatch", "Accessibility Floor".
- architecture.md → `cli/interactive.ts` (file layout), "STRICT Single-Shot" + "Truth Table", `@clack/prompts` (tech table).
- Reuse: `config/capability.ts` (`detectCapability`), `config/env.ts` (`readEnvLayer`, `readProcessEnv`), `config/sources.ts` (`buildDefaults`), `config/run-config.ts` (`Tier`, `Provider`), `retrieve/git.ts` (`GitRunner`, `execFileGitRunner`), `cli/exit-codes.ts` (`ExitCode`), `cli/cli.ts` (`buildProgram().helpInformation()`).

## Dev Agent Record

### Summary

The launchpad — the product's single interactive door (the bare zero-arg `commit-sage` in a TTY). A pure model (`formatReadinessLine` + `buildLaunchpadOptions`) feeds a driver (`runLaunchpad`) that loops over an INJECTED `select`, so the whole menu is unit-testable with no PTY. The header readiness line (tier · AI · cwd+branch), the state-aware license rows, and the clean Esc/Quit + flags cheatsheet are all built; `Help` and `Quit` are the live actions, every other row is shown but routes to a calm "coming soon" placeholder until its owning story lands. The 0-arg CLI path now branches: interactive TTY → launchpad; non-TTY / CI → fail fast (exit 2, named fix).

### Approach

- **`src/cli/interactive.ts` (new):** the pure model + the `@clack/prompts` `select` loop. All chrome to the injected `output` (default `process.stderr`); `@clack` wired to the same stream. `COMING_SOON` is a `Record<Exclude<LaunchpadAction, "help"|"quit">, string>` so the dispatch is exhaustive by construction (a future action without a placeholder is a compile error). Cancel (Esc/Ctrl-C) coalesces to `quit` via `?? "quit"`.
- **`src/cli/repo-context.ts` (new):** `readRepoContext` — a never-throwing git probe (`rev-parse --is-inside-work-tree`, then `branch --show-current`) over the injected `GitRunner`; every failure resolves to a calm header state so the menu always opens.
- **`src/cli/cli.ts`:** hoisted `env`/`cwd`/`stdinIsTTY`/`stdoutIsTTY`; replaced the 0-arg stub with `runZeroArg` (capability gate `nonInteractive: false` — the one prompting path). Tier is `free`/unlicensed until the Epic 7 license gate; provider/model come from `readEnvLayer(env)` (the live configured-AI source; config-file is 6.5). Added `gitRunner?` + `launchpad?` injectable seams to `CliDeps`. `collapseHome` collapses `$HOME`→`~`.

### Review — 3-layer adversarial (Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor:** all 4 ACs **MET**, scope **HELD**, **0 must-fix** (tier hardcoded Free/unlicensed with the Epic 7 comment; provider/model env-layer only; all deferred actions route to placeholders).
- **Edge Case Hunter:** 4 findings → **1 PATCHED** (`.trim()` was outside the `try` in `readRepoContext` — a misbehaving runner returning a non-string would throw past the catch and break the never-throws contract; moved the `.trim()` inside the `try` + added a defensive lock-in test), **3 dismissed** (COMING_SOON exhaustiveness = false positive, the `Record<Exclude<…>>` + control-flow narrowing already make a miss a compile error; provider-set-without-model = provider is the correct "configured" determinant; silent write errors = matches the existing `ui.ts` convention, and the suggested fix would read `process.env`, violating the hexagonal lint boundary).
- **Blind Hunter:** 2 findings → **0 patched** (writeLine backpressure = consistent with `ui.ts`, tiny TUI strings; GitRunner test-fake arity = the fakes are valid `GitRunner`s, JS ignores the extra `{ cwd }` arg).

**Patches applied:** 1 (`.trim()` inside the try). **Tests added:** 1 (the non-string-runner lock-in). **Dismissed:** 5. Re-ran all gates green.

### Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm test` ✓ **716 passed** (+25: interactive 16, repo-context 6, cli +3) · `npm run build` ✓ (154.90 KB — `@clack/prompts` now bundled). Smoke-tested the real binary: 0-arg non-TTY stdin → the fail-fast usage message on **stderr** + exit 2, stdout clean.

### File List

- `src/cli/interactive.ts` (new) · `src/cli/interactive.test.ts` (new)
- `src/cli/repo-context.ts` (new) · `src/cli/repo-context.test.ts` (new)
- `src/cli/cli.ts` (0-arg launchpad wiring + `runZeroArg`/`collapseHome` + `CliDeps` seams) · `src/cli/cli.test.ts` (modified — 0-arg launchpad cases)
