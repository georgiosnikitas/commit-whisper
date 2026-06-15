---
epic: 6
story: 3
title: Status/doctor view and first-run-no-AI guidance
baseline_commit: ae930fb
---

# Story 6.3: Status/doctor view and first-run-no-AI guidance

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user who isn't sure my setup is right,
I want a status view that tells me where I stand,
so that I can fix configuration before running.

## Acceptance Criteria

1. **The Status/doctor action shows tier, configured provider/model, REACHABILITY (probed), and required env vars set vs missing — read-only, never collecting a secret (AC1).** **Given** the Status/doctor action, **when** it runs, **then** it shows the current license tier, the configured provider/model, **whether the provider is reachable (probed, not merely configured)**, and which required environment variables are set vs missing (**named, never their values**), **and** it is read-only and never collects a secret.

2. **A first run with no AI provider configured names the fix and surfaces Ollama as the zero-cost local path (AC2).** **Given** a first run with **no AI provider configured**, **when** the Status/doctor view renders, **then** it names the fix (**"set `OPENAI_API_KEY`, or use a local Ollama provider"**) and surfaces **Ollama** as the zero-cost local path.

3. **Choosing an Analyze action with no provider shows a calm no-AI interstitial (teach, never wall), and the Ollama path notes it must be running (AC3).** **Given** a user chooses an Analyze action **while no provider is configured**, **when** the choice is made, **then** the Analyze row is **not disabled** — a calm no-AI interstitial appears that names the env var / points to the zero-cost Ollama path (**teach, never wall**) instead of proceeding to a doomed run, **and** the Ollama path is accompanied by a note that it must be **running** (`ollama serve` / `ollama pull <model>`), since selection alone is not reachability.

## Tasks / Subtasks

- [ ] **Task 1 — Env-var diagnostics reader (AC1) [src/config/env.ts].** [Source: env.ts is the single `process.env` reader; MENUS.md "Status / doctor" Environment block]
  - [ ] `export interface EnvVarStatus { name: string; set: boolean; note?: string }`.
  - [ ] `export function readEnvDiagnostics(env: NodeJS.ProcessEnv, provider: Provider | undefined): EnvVarStatus[]` — pure over the injected `env`. The AI key var for the configured provider (`OPENAI_API_KEY` for openai / openai-compatible · `ANTHROPIC_API_KEY` · `GOOGLE_GENERATIVE_AI_API_KEY` for gemini · **none** for ollama · `OPENAI_API_KEY` as the canonical example when **no provider** is configured), with `set` derived from the SAME single-source logic as `readAiKey` (so the gemini `GEMINI_API_KEY` alias is honored and the two can't drift — `set: readAiKey(env, provider ?? "openai") !== undefined`, but skip the row entirely for ollama); plus always `COMMIT_SAGE_GIT_TOKEN` with `set: readGitToken(env) !== undefined` and `note: "only needed for private remotes"`. **NAMES only — never a value.**

- [ ] **Task 2 — Pure Status/doctor formatter + the no-AI fix copy (AC1, AC2, AC3) [src/cli/interactive.ts].** [Source: MENUS.md "Status / doctor", "No-AI interstitial"; narrate/preflight.ts `PreflightResult`]
  - [ ] `export type Reachability = { kind: "not-configured" } | { kind: "reachable" } | { kind: "unreachable"; reason: string }` and `export type ProbeReachability = () => Promise<Reachability>`.
  - [ ] `export function formatStatusReport(state: LaunchpadState, envVars: EnvVarStatus[], reachability: Reachability): string` — pure, line-oriented (no `@clack` box — the calm posture from 6.1/6.2). Blocks: **License** (`<Tier>` + the Free `100-commit cap` note only for free); **AI** (`<provider> (<model>)` or `⚠ not configured`, then a `status` line: `✓ reachable` / `⚠ unreachable — <reason>` / `⚠ not configured`); **Environment** (each `EnvVarStatus` as `✓ <NAME> set` / `✗ <NAME> missing` + optional `note` — glyph + word, never color alone); **Repository** (`✓ <cwdLabel> (<branch>)` or `— not a git repo`). When `reachability.kind === "not-configured"`, append the **fix line** (Task 2's shared `NO_AI_FIX`).
  - [ ] `export const NO_AI_FIX` (shared lines, used by Status AC2 + the interstitial AC3): names `set OPENAI_API_KEY` (cloud) AND the zero-cost **Ollama** local path WITH the must-be-running note (`ollama serve`, then `ollama pull <model>`) — "commit-sage never stores keys".
  - [ ] `export const NO_AI_INTERSTITIAL` — the calm teach-don't-wall screen text for AC3 (a one-line lede "Analysis needs an AI provider — every run narrates with an LLM." then `NO_AI_FIX`).

- [ ] **Task 3 — Wire the Status row + the no-AI interstitial into the driver (AC1, AC3) [src/cli/interactive.ts].**
  - [ ] `LaunchpadDeps` gains `envDiagnostics?: EnvVarStatus[]` and `probeReachability?: ProbeReachability` (both injected by `cli/`).
  - [ ] `async function runStatusDoctor(deps, output): Promise<void>` — `reachability = state.provider === undefined ? { kind: "not-configured" } : (deps.probeReachability ? await deps.probeReachability() : { kind: "not-configured" })`; then `writeLine(output, formatStatusReport(deps.state, deps.envDiagnostics ?? [], reachability))`. Read-only; no prompt, no secret.
  - [ ] In `runLaunchpad`, dispatch `status` → `await runStatusDoctor(deps, output)` (then `continue`); remove `status` from `COMING_SOON` (narrow its `Exclude` to also exclude `"status"`).
  - [ ] In `runGuidedAnalyze`, **gate at the very top**: `if (deps.state.provider === undefined) { writeLine(output, NO_AI_INTERSTITIAL); return; }` — the AC3 teach-don't-wall (short-circuits BEFORE the remote URL prompt and before `collectGuidedInputs`/`runAnalysis`, so a no-provider Analyze never reaches the doomed exit-3 run).

- [ ] **Task 4 — Wire the probe + diagnostics in the CLI shell (AC1, AC2) [src/cli/cli.ts].**
  - [ ] In `runZeroArg`, build `envDiagnostics = readEnvDiagnostics(ctx.env, aiLayer.provider)` and a `probeReachability` closure = run `(ctx.deps.preflight ?? preflightProvider)(narrateConfig, {})` and map `PreflightResult` → `Reachability` (`reachable` → `{ kind: "reachable" }`; else `{ kind: "unreachable", reason }`). `narrateConfig` = `{ aiMode: "auto" /* force a real probe */, provider: aiLayer.provider, llmModel: aiLayer.llmModel, llmBaseUrl: aiLayer.llmBaseUrl, aiKey: readAiKey(ctx.env, aiLayer.provider) }`. Pass both into the launchpad deps.
  - [ ] `CliDeps` gains `preflight?: typeof preflightProvider` (default `preflightProvider`) — the injectable seam so a cli test exercises the probe closure offline (mirrors `RunDeps.preflight`).

- [ ] **Task 5 — Tests (AC1–AC3).**
  - [ ] **`env.test.ts` (extend):** `readEnvDiagnostics` — openai provider + `OPENAI_API_KEY` set → `{ name: "OPENAI_API_KEY", set: true }`; gemini honors the `GEMINI_API_KEY` alias; ollama omits the key row; no provider → names `OPENAI_API_KEY` with its real presence; `COMMIT_SAGE_GIT_TOKEN` row always present with the note and `set` reflecting any git token (incl. the `GITHUB_TOKEN` fallback); **no value ever appears** in the output (names + booleans only).
  - [ ] **`interactive.test.ts` (extend):** `formatStatusReport` — configured + reachable; configured + unreachable shows the reason; not-configured shows `⚠ not configured` + the `NO_AI_FIX` (names `OPENAI_API_KEY` + Ollama + `ollama serve`); env rows render `✓ set` / `✗ missing` by name; the Free tier shows the cap note; a non-repo shows `— not a git repo`; the paid tiers omit the cap note. `runStatusDoctor` (injected fake `probeReachability` + `envDiagnostics` + fake `output`) — provider set → probe called, the reachability line reflects it; provider undefined → probe NOT called, `not-configured` + fix shown; the `status` launchpad action routes here and loops back (a scripted `["status","quit"]` writes the report then returns to the menu). `runGuidedAnalyze` no-AI gate — with `state.provider: undefined`, choosing `analyze-cwd`/`analyze-remote` writes `NO_AI_INTERSTITIAL` (names the env var + the must-be-running Ollama note) and does NOT call `runAnalysis` and does NOT prompt a URL; with a provider set the 6.2 flow is unchanged.
  - [ ] **`cli.test.ts` (extend):** the launchpad receives `envDiagnostics` (an array naming `OPENAI_API_KEY` / `COMMIT_SAGE_GIT_TOKEN`) and a `probeReachability` function; an injected fake `preflight` is invoked by the closure and its result maps to the `Reachability` the launchpad gets (run the closure offline and assert `reachable` → `{ kind: "reachable" }`, an unreachable result → `{ kind: "unreachable", reason }`).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the read-only **Status/doctor** screen (tier · configured provider/model · **probed reachability** · env-var presence by name) wired into the launchpad's `status` row; the **first-run-no-AI** guidance (the shared fix copy naming `OPENAI_API_KEY` + the zero-cost Ollama path with its must-be-running note) shown both in Status (AC2) and as the **no-AI interstitial** that pre-empts a no-provider Analyze (AC3, teach-don't-wall); the `config/env.ts` `readEnvDiagnostics` reader; the cli wiring (the `preflightProvider` reachability probe + the diagnostics injection). Reuses the existing `preflightProvider` (Story 1.6) verbatim — no new probe logic. All offline-testable (injected `probeReachability` / `preflight` / `envDiagnostics`).

**Out of scope / deferred (do NOT build here):**
- **The Settings screen + live "→ open Settings" navigation** — Story **6.5**. The Status view and the interstitial name the **env-only** fix (`OPENAI_API_KEY` / configure Ollama), not a working jump to Settings (that row is still a `COMING_SOON` placeholder). Mentioning a future Settings screen in copy is avoided to prevent a dead link. [Source: epics.md Story 6.5; MENUS.md "Settings"]
- **A boxed `@clack` Status layout / spinner during the probe** — UX polish. 6.3 stays line-oriented via `writeLine` (the calm 6.1/6.2 posture), which is also what keeps it unit-testable with a fake stream. The MENUS box sketch is the aspiration. [Source: MENUS.md]
- **The repository commit-count on the Status repo line** — deferred (it needs a history read; the 6.1 header deliberately omitted counts). 6.3 shows repo label + branch only (the AC requires neither). [Source: Story 6.1 Dev Notes]
- **Operational flags (`--show-config` etc.)** — Story **6.4**. A `--show-config`-style provenance dump is a separate, non-interactive surface. [Source: epics.md Story 6.4]
- **Real license tier / probing a paid entitlement** — **Epic 7**. Tier stays hardcoded `free` (from the 6.1 `LaunchpadState`); the cap note is the Free-tier literal. [Source: epics.md Epic 7]
- **Changing the headless / executor behavior** — the guided executor's existing exit-3 guard for a no-provider `auto` run (6.2) is unchanged; 6.3 only adds the interactive interstitial that pre-empts reaching it. The `--no-ai` metrics-only interactive path is **not** added (that is 6.4's flag). [Source: 6.2; epics.md Story 6.4]
- **Collecting or displaying ANY secret value** — forbidden by AC1 + the architecture secret rule; the Status view shows env-var **names + set/missing booleans** only. [Source: architecture.md secret handling]

### Architecture decisions (read first)

- **Reachability reuses `preflightProvider` (Story 1.6) verbatim.** It already does exactly the cheap, key-in-header, timeout-bounded round-trip the AC's "probed, not merely configured" wants (Ollama `/api/tags` ping; cloud `/models` low-cost auth check), and it already scrubs the secret from any failure reason. 6.3 wraps it (`PreflightResult` → `Reachability`) and forces a probe by passing `aiMode: "auto"` in the status `NarrateConfig` (so the probe runs regardless of the user's resolved aiMode). No new network code. [Source: narrate/preflight.ts; run.ts gate band]
- **Pure model + injected impure seams** (the 6.1/6.2 pattern). `formatStatusReport` is pure; `readEnvDiagnostics` is pure over the injected `env`; the network probe and the env read are injected into the launchpad as `probeReachability` + `envDiagnostics`, wired by `cli/`. So the whole Status flow is unit-testable with no network and no real env, and the hexagonal boundary holds (`interactive.ts` reads neither `process.env` nor the network). [Source: architecture.md hexagonal layering; cli/interactive.ts]
- **`readEnvDiagnostics` lives in `config/env.ts`** — the single intended `process.env` reader — and derives `set` from the SAME `readAiKey`/`readGitToken` logic it already owns, so the displayed presence can never drift from the real key resolution (e.g. the gemini `GEMINI_API_KEY` alias, the git-token host fallbacks). It returns NAMES + booleans only — the secret rule is structural (the value never enters the type). [Source: config/env.ts readAiKey/readGitToken]
- **The no-AI interstitial pre-empts the exit-3 path (teach, never wall).** Today (6.2) a no-provider guided run resolves `aiMode: auto`, which makes provider/model required, so config resolution throws `MissingRequiredConfigError` (exit 3) — caught and returned by the executor closure. 6.3 gates `runGuidedAnalyze` at the top on `state.provider === undefined` and shows the calm teaching screen INSTEAD of starting the doomed run — the row stays enabled (discovery preserved), the user is taught the concrete fix, and the executor's exit-3 guard remains as defense-in-depth for the headless path. [Source: 6.2 runGuidedAnalyze; config/gaps.ts]
- **`provider` configured = read from the env layer** (the 6.1 decision). `aiLayer = readEnvLayer(env)` is the live source of `provider`/`llmModel`/`llmBaseUrl` in 0-arg mode; the config-file layer is 6.5. So "no provider configured" honestly means the env has no `COMMIT_SAGE_PROVIDER`. [Source: 6.1 Dev Notes; config/env.ts]
- **Cognitive-complexity ≤ 15 (SonarQube).** Keep `formatStatusReport` a sequence of small block-builders (license / ai / env / repo / fix) joined, not one deep function; `runStatusDoctor` stays thin (decide reachability, format, write). [Source: repo lint conventions]

### References

- epics.md → Epic 6 / **Story 6.3: Status/doctor view and first-run-no-AI guidance** (the three ACs).
- MENUS.md → "Status / doctor" (License / AI / Environment / Repository blocks; `✓ set` / `✗ missing` by name only; the configured-vs-reachable distinction + the reachability line), "No-AI interstitial".
- EXPERIENCE.md → "AI-first by default" (the concrete name-the-variable + offer-Ollama guidance), "Accessibility Floor".
- architecture.md → exit-code enum, the gate band (preflight), hexagonal layering.
- Reuse: `narrate/preflight.ts` (`preflightProvider`, `PreflightResult`), `narrate/narrate.port.ts` (`NarrateConfig`), `config/env.ts` (`readEnvLayer`, `readAiKey`, `readGitToken`), `cli/interactive.ts` (6.1/6.2 `LaunchpadDeps`/`runLaunchpad`/`runGuidedAnalyze`/`COMING_SOON`/`writeLine`), `config/run-config.ts` (`Tier`, `Provider`).

## Dev Agent Record

### Summary

The launchpad's `status` row is now the live, read-only Status/doctor view: license tier, the configured provider/model, **probed reachability** (configured ≠ reachable), and the relevant env vars by **name + set/missing** (never a value). A first run with no provider names the concrete fix (`OPENAI_API_KEY` or a local Ollama) and surfaces the zero-cost Ollama path with its must-be-running note. Choosing an Analyze action with no provider now shows a calm no-AI **interstitial** that pre-empts the doomed run (teach, never wall) — the row stays enabled.

### Approach

- **`config/env.ts`** — `readEnvDiagnostics(env, provider): EnvVarStatus[]` (the new `EnvVarStatus` = `{ name; set; note? }`). The displayed AI-key var is provider-specific (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`; none for ollama; `OPENAI_API_KEY` as the first-run example when unconfigured), and `set` is derived from the SAME `readAiKey`/`readGitToken` logic so presence can't drift from real resolution (gemini alias, git-token fallbacks honored). NAMES + booleans only — the secret value is structurally absent from the type.
- **`cli/interactive.ts`** — pure `formatStatusReport(state, envVars, reachability)` (License / AI+reachability / Environment / Repository blocks, line-oriented; appends `NO_AI_FIX` when not-configured); `Reachability` + `ProbeReachability` types; `NO_AI_FIX` / `NO_AI_INTERSTITIAL` shared copy. `runStatusDoctor` probes only when a provider is set and **catches a probe throw** (degrades to `unreachable`, never ends the session). `runGuidedAnalyze` gates at the top on `state.provider === undefined` → writes the interstitial and returns (pre-empts the URL prompt + the exit-3 run). `status` dispatched in `runLaunchpad`; `COMING_SOON` narrowed to also exclude `status`.
- **`cli/cli.ts`** — wires `envDiagnostics = readEnvDiagnostics(env, provider)` + a `probeReachability` closure (a `NarrateConfig` with `aiMode: "auto"` to force the probe, mapping `preflightProvider`'s `PreflightResult` → `Reachability`). `CliDeps` gains an injectable `preflight?` seam.

### Review — 3-layer adversarial (Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor:** all 3 ACs **MET**, scope **HELD**, **0 must-fix** (reachability is probed not merely configured; env vars by name with no value; the interstitial pre-empts the run and the row stays enabled; the Ollama must-be-running note present).
- **Edge Case Hunter:** 83 cases examined, **1 real** → **PATCHED** (a `probeReachability()` throw was uncaught in `runStatusDoctor` → would end the session; now caught → `unreachable` verdict, menu continues — the never-dead-end posture). 82 safe-by-construction.
- **Blind Hunter:** 3 findings → **0 patched / 3 dismissed** (`PreflightResult.reason` is type-guaranteed `string` when `reachable:false` — false positive; the name-vs-`set` "drift" is the intended single-source design; the provider-set-but-no-probe path is wiring-only and locked by a cli test).

**Patches applied:** 1 (probe-throw guard in `runStatusDoctor`). **Tests added:** 1 (the throwing-probe lock-in). **Dismissed:** 3. Re-ran all gates green.

### Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm test` ✓ **761 passed** (+19: env +7, interactive +12 incl. the patch lock-in, cli +2) · `npm run build` ✓ (164.90 KB). The Status/doctor + interstitial are interactive (need a PTY), so they are covered by the injected-seam unit tests (probe + diagnostics + select), not a live smoke run; reachability itself reuses the already-tested `preflightProvider`.

### File List

- `src/config/env.ts` (`readEnvDiagnostics` + `EnvVarStatus`) · `src/config/env.test.ts` (extended)
- `src/cli/interactive.ts` (status formatter + `runStatusDoctor` + no-AI interstitial + dispatch) · `src/cli/interactive.test.ts` (extended)
- `src/cli/cli.ts` (probe + diagnostics wiring + `preflight?` seam) · `src/cli/cli.test.ts` (extended)
