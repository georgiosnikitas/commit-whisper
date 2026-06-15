---
epic: 6
story: 5
title: Settings — configure AI and defaults
baseline_commit: dd2ef9f
---

# Story 6.5: Settings — configure AI and defaults

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a Settings screen to choose my AI provider and defaults once,
so that I don't re-specify them every run and the first-run "no AI" state has a clear cure.

## Acceptance Criteria

1. **Settings writes the non-secret choices to `~/.commit-sage` via an atomic write and remembers them across runs; no secret is ever collected or written (AC1).** **Given** the Settings menu action, **when** the user configures provider (**closed enum**), model, base URL, default output format, timezone, and/or max-commits, **then** the **non-secret** choices are written to the config home (`~/.commit-sage`) via an **atomic write (temp + rename)** and remembered across runs, **and** **no secret is ever collected or written** — a cloud provider's API key remains environment-variable-only and is **named, never entered**.

2. **The resolver precedence holds (config < env < flags), and choosing Ollama in Settings cures the first-run no-AI state at zero cost (AC2).** **Given** a saved Setting and an overriding environment variable or flag, **when** the next run resolves config, **then** the resolver precedence holds (**config < env < flags**) so the explicit override wins, **and** choosing the local **Ollama** provider in Settings resolves the first-run "no AI provider" state at zero cost.

## Tasks / Subtasks

- [ ] **Task 1 — The config-store: home path + non-secret schema parse/serialize (AC1) [src/config/config-store.ts] (new).** [Source: architecture.md "Config Persistence — the `Settings` Write Path"; config/env.ts parse helpers]
  - [ ] `export function configHome(env): string` — `${COMMIT_SAGE_CONFIG ?? <home>/.commit-sage}`; `<home>` from `env.HOME ?? env.USERPROFILE` (cross-platform). `export function configFilePath(env): string` = `join(configHome(env), "config.json")`. (`--config <path>`/`COMMIT_SAGE_CONFIG` selecting an explicit FILE path is a later refinement; 6.5 honours `COMMIT_SAGE_CONFIG` as the HOME override only if it is given — keep it simple: env override → that dir; else `~/.commit-sage`.)
  - [ ] `export interface SettingsData { provider?; llmModel?; llmBaseUrl?; outputFormats?; timezone?; maxCommits? }` — the closed allow-list of NON-SECRET, persistable keys (a strict subset of `ConfigData`; NO `repoTarget`/dates/aiMode/secrets). `export const SETTINGS_KEYS` (the allow-list).
  - [ ] `export function parseSettings(raw: string): PartialRunConfig` — parse the JSON text → a sanitised `PartialRunConfig` carrying ONLY the allow-listed keys, each validated/coerced with the SAME rules as `env.ts` (provider ∈ closed enum else dropped; `outputFormats` filtered to the closed enum, ≥1 else dropped; `maxCommits` positive int else dropped; `llmModel`/`llmBaseUrl`/`timezone` trimmed-non-empty strings). A malformed JSON or a non-object → `{}` (never throws — a corrupt config must not break a run). Unknown keys are ignored (forward-compat). A secret-looking key (`aiKey`, `gitPat`, anything not allow-listed) is structurally dropped.
  - [ ] `export function serializeSettings(data: SettingsData): string` — stable, pretty JSON (sorted keys) of ONLY the allow-listed present fields, so a write is deterministic and diff-friendly.

- [ ] **Task 2 — The config-store I/O: read + atomic write (AC1) [src/config/config-store.ts].** [Source: architecture.md "Atomic write — write-to-temp + rename"]
  - [ ] `export interface ConfigStoreIo { readFile(path): Promise<string>; writeFile(path, data): Promise<void>; mkdir(path): Promise<void>; rename(from, to): Promise<void> }` + `defaultConfigStoreIo` (node:fs/promises). The injectable seam so the store is unit-tested with an in-memory fake (no real disk).
  - [ ] `export async function readSettings(env, io = defaultConfigStoreIo): Promise<PartialRunConfig>` — read `configFilePath(env)` → `parseSettings`; an ENOENT/any read error → `{}` (absence is normal, never an error). This is the function `cli/` injects as the resolver's `configFile` layer.
  - [ ] `export async function writeSettings(env, data, io = defaultConfigStoreIo): Promise<string>` — `mkdir(configHome, { recursive })`, write `serializeSettings(data)` to a temp path (`config.json.<rand>.tmp` in the SAME dir, so `rename` is same-volume/atomic), then `rename(tmp → config.json)`. Returns the final path (for the "✓ Saved to …" confirmation). The writer accepts ONLY `SettingsData` — there is no code path that serialises a secret.

- [ ] **Task 3 — The Settings screen (AC1, AC2) [src/cli/interactive.ts].** [Source: MENUS.md "Settings"; the 6.1/6.2 injected-prompt pattern]
  - [ ] `LaunchpadDeps` gains `loadSettings?: () => Promise<SettingsData>` and `saveSettings?: (data: SettingsData) => Promise<string>` (injected by `cli/`; the screen does NO disk I/O itself). `GuidedPrompts` gains a `selectOne<T>(opts: { message; options: { value: T; label: string }[]; initialValue?: T }): Promise<T | null>` primitive (a typed single-select for the provider enum + the default-format choice), with a `@clack` `select` adapter.
  - [ ] `async function runSettings(deps, output): Promise<void>` — load current settings; prompt provider (closed enum, including "Ollama (local, free)"); model (text, optional); base URL **only when provider ∈ {ollama, openai-compatible}** (text); default output format (single-select of the closed enum); timezone (text, optional); max-commits (text via the 6.2 `interpretLimit`). Any cancel → return to the menu (save nothing). Assemble a `SettingsData` from the non-empty answers, `await deps.saveSettings(data)`, then write `✓ Saved to <path>` + the Ollama/secret note (`NO_AI_FIX`-style: a cloud provider's key stays env-only, NAMED — never entered; Ollama must be running). Dispatch `settings` in `runLaunchpad` → `runStatusDoctor`-style; remove `settings` from `COMING_SOON`.

- [ ] **Task 4 — Wire the config-file layer + Settings into the shell (AC1, AC2) [src/cli/cli.ts].**
  - [ ] Read the persisted settings ONCE at the top of `main` (`const configFile = deps.configFile ?? (await readSettings(env))`) and thread it into EVERY `resolveRunConfig({ … configFile })` call site (the single-shot run, the `--show-config` lenient resolve, and the guided `resolveAndRun`). So a saved Setting re-enters at the config-file layer and the existing precedence (`defaults < configFile < env < flags`) holds unchanged. `CliDeps` gains `configFile?: PartialRunConfig` (the injectable seam for tests).
  - [ ] In `runZeroArg`, pass `loadSettings: () => readSettings(ctx.env)` and `saveSettings: (data) => writeSettings(ctx.env, data)` into the launchpad deps (the real disk seam; tests inject fakes). The header's `provider`/`llmModel` now read from the RESOLVED config-file+env layer (so a saved Ollama provider shows in the header + cures the no-AI state) — fold `readSettings` into the `aiLayer` used for the launchpad state.

- [ ] **Task 5 — Tests (AC1, AC2).**
  - [ ] **`config-store.test.ts` (new):** `parseSettings` — a valid JSON with all allow-listed keys → the coerced `PartialRunConfig`; an invalid provider/format/maxCommits → that field dropped; malformed JSON / a JSON array / `null` → `{}`; an INJECTED secret-looking key (`aiKey`, `gitPat`) → dropped (never in the result). `serializeSettings` → stable sorted JSON of only the present allow-listed fields; round-trips through `parseSettings`. `writeSettings` (in-memory `io`) — mkdir called, the temp path is in the same dir + ends `.tmp`, `rename(tmp → config.json)` called in order (atomicity), the returned path is the final file, and the serialised bytes contain NO secret even if a secret-shaped extra is forced in (type + runtime guard). `readSettings` — a present file → parsed settings; ENOENT/throw → `{}`.
  - [ ] **`interactive.test.ts` (extend):** `runSettings` (scripted `selectOne`/`text` + a fake `saveSettings` recorder) — collecting provider+model+format saves a `SettingsData` with exactly those fields and writes `✓ Saved`; base URL is prompted for ollama/openai-compatible and NOT for a cloud provider; a cancel at any prompt saves NOTHING (saveSettings not called) and returns to the menu; NO prompt ever collects a secret (no message matches /key|token|secret/ as an input); the `settings` launchpad action routes here and loops back.
  - [ ] **`cli.test.ts` (extend):** a saved provider/format (injected `configFile`) flows into the resolved config at `configFile` provenance; an env var overrides it (env provenance wins); a flag overrides both (flag provenance wins) — the precedence lock. The launchpad receives `loadSettings`/`saveSettings` functions. A saved `provider: "ollama"` makes the launchpad header show the configured provider (cures the no-AI state).
  - [ ] **`config-store` ↔ resolver integration:** a `writeSettings` then `readSettings` round-trip (in-memory io) yields a `PartialRunConfig` that, injected as `configFile` into `resolveRunConfig`, lands each field with `configFile` provenance (and is still overridden by env/flags).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the config-store (`config/config-store.ts`) — the home-path resolver, the NON-SECRET closed-allow-list schema (`parseSettings`/`serializeSettings`), the read (`readSettings`, the resolver's `configFile` layer) and the ATOMIC write (`writeSettings`, temp + rename); the interactive **Settings** screen (provider/model/base-URL + default format/timezone/max-commits, base-URL conditional on provider, the secret-naming note); wiring the config-file layer into every `resolveRunConfig` call (so the precedence `config < env < flags` holds) and the Settings load/save into the launchpad. Completes Epic 6. All offline-testable (in-memory `io`, injected `loadSettings`/`saveSettings`/prompts).

**Out of scope / deferred (do NOT build here):**
- **`--config <path>` selecting an explicit config FILE (vs the home dir)** — the architecture's full `--config <path>` provenance edge case (a file that names itself) is a refinement; 6.5 honours `COMMIT_SAGE_CONFIG` as the config-HOME override and otherwise uses `~/.commit-sage`. The flag form can land with Epic 7 packaging if needed. [Source: architecture.md `--config <path>`]
- **The cached license `instance id` in `~/.commit-sage`** — that is **Epic 7** (licensing). 6.5 writes ONLY the non-secret config file; the config home may later also hold the license cache, but 6.5 adds none of it. [Source: architecture.md "Config home"; epics.md Epic 7]
- **A live reachability re-probe inside Settings** — Settings SELECTS a provider; the Status/doctor reachability probe (6.3) and the analyze-time preflight remain the place reachability is verified. Settings only names the "Ollama must be running" note (selection ≠ reachability). [Source: MENUS.md Settings; 6.3]
- **Persisting `aiMode`/`repoTarget`/dates/author/noMerges/outputPath** — the allow-list is the everyday-defaults subset the AC names (provider, model, base URL, default format, timezone, max-commits). Run-scoped inputs (target, date range, author) stay per-run; `aiMode` stays env/flag-driven (so Settings never silently turns AI off). [Source: epics.md Story 6.5 AC1]
- **Collecting/writing ANY secret** — forbidden by AC1; the writer's type is the non-secret allow-list and there is no serialise-a-secret path. The cloud key stays env-only and is NAMED. [Source: architecture.md Secrets; "Non-secret only — by construction"]
- **A migration/versioning scheme for the config file** — the on-disk shape is the documented non-secret schema (camelCase); unknown keys are ignored for forward-compat, but no explicit `version` field / migration is added. [Source: architecture.md "on-disk format … the same shape the reader already parses"]

### Architecture decisions (read first)

- **The resolver already HAS a `configFile` layer** — `mergeLayers` merges `defaults → configFile → env → flags` and `resolveRunConfig` takes a `configFile?: PartialRunConfig` (today injected as `{}`). 6.5 supplies the REAL value via `readSettings(env)`; the precedence is unchanged by construction, so the AC2 "config < env < flags" lock is mostly about WIRING the read in (and a test proving env/flags still override). No resolver-core change. [Source: config/resolver.ts; config/resolve-run-config.ts]
- **Non-secret by construction.** `writeSettings` accepts only `SettingsData` (the closed allow-list — no secret field exists in the type), and `parseSettings` drops anything not allow-listed on read. So neither the write nor a hand-edited file can introduce a key/token into the resolver's config-file layer — the architecture's "no code path that can serialize a secret" + "secrets bypass the config-file layer" hold structurally. Secrets remain env-only (`readAiKey`/`readGitToken` unchanged). [Source: architecture.md "Non-secret only"; "Secrets"]
- **Atomic write = temp + rename in the SAME dir.** Write the serialised bytes to `config.json.<rand>.tmp` alongside the target, then `rename` (atomic on one volume) — a crash/interrupt or a racing second writer can never leave a torn `config.json`. `mkdir(..., { recursive: true })` first so a fresh machine works. The `io` seam (readFile/writeFile/mkdir/rename) is injected so the suite never touches real disk. [Source: architecture.md "Atomic write"]
- **Corrupt config never breaks a run.** `parseSettings` returns `{}` on malformed JSON / wrong-typed values, and `readSettings` swallows a read error → `{}`. A bad `~/.commit-sage/config.json` degrades to "no saved settings", never an exception — the run proceeds on defaults/env/flags. [Source: C1 robustness; architecture resolver "pure, table-testable"]
- **Settings is a pre-pipeline `cli`/`config` act.** The screen lives in `cli/interactive.ts` (interactive only) and calls the injected `saveSettings` (→ `config/config-store.ts`); the pipeline still consumes only the frozen `RunConfig` and never writes config — the hexagonal boundary holds. The store reads `process.env` only via the injected `env` (it lives in `config/`, the one layer allowed to, but takes `env` as a parameter to stay pure/testable). [Source: architecture.md "Stays a cli / config concern"]
- **Ollama cures the no-AI state at zero cost (AC2).** Saving `provider: "ollama"` (+ optional model/base-URL) means the next run's resolved config HAS a provider, so the 6.3 no-AI interstitial no longer fires and the guided run proceeds (local, free — the user is reminded it must be running). The header (6.1) now shows the configured provider because `aiLayer` folds in `readSettings`. [Source: epics.md Story 6.5 AC2; 6.3 no-AI gate]
- **Cognitive-complexity ≤ 15 (SonarQube).** `parseSettings` is a sequence of small per-field coercions (reuse the `env.ts` shapes); `runSettings` delegates each prompt + the base-URL conditional to tiny helpers; the `io` write is a 4-line sequence. [Source: repo lint conventions]

### References

- epics.md → Epic 6 / **Story 6.5: Settings — configure AI and defaults** (the two ACs).
- architecture.md → "Config Persistence — the `Settings` Write Path" (non-secret allow-list, unchanged read precedence, atomic temp+rename, cli/config concern), "Two-Phase Configuration Resolver", "Secrets", "Config home = `~/.commit-sage`".
- MENUS.md → "Settings" (the field set, base-URL conditional, the "✓ Saved" + Ollama/secret note).
- EXPERIENCE.md → "AI-first by default" (the Ollama zero-cost cure), the secret rule.
- Reuse: `config/resolve-run-config.ts` (`configFile` layer), `config/resolver.ts` (`mergeLayers` precedence), `config/env.ts` (the `str`/`parsePositiveInt`/`parseFormats`/provider-enum shapes), `config/run-config.ts` (`PartialRunConfig`, `Provider`, `OutputFormat`), `cli/interactive.ts` (6.1/6.2/6.3 `LaunchpadDeps`/`GuidedPrompts`/`runLaunchpad`/`COMING_SOON`/`interpretLimit`/`NO_AI_FIX`), `cli/cli.ts` (the `resolveRunConfig` call sites).

## Dev Agent Record

### Summary

The product's one config WRITE path + the `~/.commit-sage` reader — completing Epic 6. The interactive Settings screen persists the user's NON-SECRET everyday choices (provider/model/base-URL + default format/timezone/max-commits) via an ATOMIC write, and those choices re-enter the resolver at the `configFile` layer so they are remembered (and still overridden by env/flags). Choosing Ollama in Settings cures the first-run no-AI state at zero cost. No secret is ever collected or written.

### Approach

- **`config/config-store.ts`** (new) — `configHome`/`configFilePath` (`COMMIT_SAGE_CONFIG` override, else `<HOME|USERPROFILE>/.commit-sage`); a closed NON-SECRET allow-list (`SettingsData` + `SETTINGS_KEYS`); `parseSettings` (per-field coercion mirroring `env.ts`, drops anything not allow-listed incl. `aiKey`/`gitPat`, corrupt JSON → `{}`) + `serializeSettings` (sorted, stable, allow-list-only); `readSettings` (the resolver's `configFile` layer; ENOENT/error → `{}`) + `writeSettings` (ATOMIC: `mkdir` → write a same-dir `.tmp` → `rename`; cleans up the temp on a rename failure). All I/O via an injected `ConfigStoreIo` seam.
- **`cli/interactive.ts`** — `runSettings` over a new injected `selectOne` primitive (provider enum + default-format) + the existing `text`/`interpretLimit`; base-URL prompted only for ollama/openai-compatible; a cancel at any prompt saves nothing; a load/save failure degrades gracefully (never ends the session); the `SETTINGS_SAVED_NOTE` names the env-only key path + the Ollama must-be-running caveat. `settings` dispatched in `runLaunchpad` (removed from `COMING_SOON`).
- **`cli/cli.ts`** — reads the persisted `configFile` once and threads it into EVERY `resolveRunConfig` call (single-shot run, `--show-config`, guided `resolveAndRun`); the launchpad header's `aiLayer` folds in `readSettings` (config < env) so a saved provider shows + cures no-AI; passes `loadSettings`/`saveSettings` into the launchpad.

### Review — 3-layer adversarial (Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor:** both ACs **MET**, scope **HELD** (provider is a closed enum; the write is atomic temp+rename; non-secret by construction — the writer's type has no secret field AND `parseSettings` drops secret-looking keys; no prompt collects a secret; the cloud key is NAMED; precedence config<env<flags proven; Ollama-cures-no-AI wired + tested). The deferred `--config <path>` file-selector, the Epic-7 license cache, and a migration scheme correctly NOT built.
- **Edge Case Hunter:** 52 cases, **3 PATCHED** (a `saveSettings` throw + a `loadSettings` throw were unguarded — would crash the interactive menu, unlike 6.3's probe guard — now both caught: save → `⚠ Could not save settings`, load → start blank; a `rename` failure leaked the `.tmp` → now cleaned up via an `unlink` in the io seam), **2 dismissed** (no `readSettings` size guard — the file is the user's own home, not attacker-controlled, out of scope; the mkdir/write failures are subsumed by the save-throw guard).
- **Blind Hunter:** **0 defects** (all invariants verified — parse guards, serialize allow-list, write atomicity, precedence wiring, type-safety of `PartialRunConfig` → `SettingsData`).

**Patches applied:** 3 (save-throw guard, load-throw guard, temp cleanup). **Tests added:** 3 (the two throw-guards + the temp-cleanup lock-in). **Dismissed:** 2. Re-ran all gates green.

### Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm test` ✓ **824 passed** (+32: config-store +20, interactive +8, cli +6, minus 2 re-pointed; +3 patch lock-ins) · `npm run build` ✓ (177.24 KB). Smoke-tested the real binary: a hand-written `~/.commit-sage/config.json` (incl. a secret-shaped `aiKey`) is read at `configFile` provenance, the secret key is DROPPED (`aiKey = (unset)`), 0 leaks; env still overrides a saved value.

### File List

- `src/config/config-store.ts` (new) · `src/config/config-store.test.ts` (new)
- `src/cli/interactive.ts` (`selectOne` + `runSettings` + dispatch + throw-guards) · `src/cli/interactive.test.ts` (extended)
- `src/cli/cli.ts` (configFile read + threaded into all resolves + header merge + Settings load/save wiring) · `src/cli/cli.test.ts` (extended — the precedence lock)
