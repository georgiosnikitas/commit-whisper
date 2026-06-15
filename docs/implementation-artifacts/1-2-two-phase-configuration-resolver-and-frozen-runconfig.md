---
baseline_commit: 30c63fec3f8400aef7df5db22cc9e50a952e2998
---

# Story 1.2: Two-phase configuration resolver and frozen RunConfig

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a deterministic config resolver that produces a single frozen `RunConfig`,
so that the pipeline runs from one immutable, provenance-tracked input with no access to argv/env/prompts.

## Acceptance Criteria

1. **(AC1 — Phase 1 pure merge + provenance)** Given defaults, a config file, environment variables, and flags supplying overlapping values, when Phase 1 resolution runs, then values merge by precedence `defaults → config file → env → flags` (low→high) into a `PartialRunConfig` carrying per-field provenance, **and** the merge is a pure function with no I/O (table-testable).

2. **(AC2 — Frozen RunConfig + capability gate)** Given a resolved configuration, when the `RunConfig` is constructed, then it is frozen (deeply immutable) and the capability gate is computed as `interactive = stdin.isTTY && stdout.isTTY && !isCI && !flags.nonInteractive`, **failing closed** when a TTY cannot be proven.

3. **(AC3 — Phase 2 gap handling, never a prompt)** Given a non-interactive context with a required field missing, when Phase 2 gap handling runs, then it produces a **typed error** (never a prompt) carrying a machine-readable exit code and a stable machine `code`.

## Tasks / Subtasks

- [x] **Task 1 — `RunConfig` contract + provenance types (`src/config/run-config.ts`) (AC: 1, 2)**
  - [x] Define the supporting types: `Provider = "ollama" | "openai" | "gemini" | "anthropic" | "openai-compatible"`, `OutputFormat = "html" | "markdown" | "terminal" | "json"`, `IsoDate` (branded or `string` alias — keep simple), and the `Branch` sentinel union (see Dev Notes "Branch sentinel" — recommend `{ kind: "named"; name: string } | { kind: "all" } | { kind: "head" }`; **never** the empty string).
  - [x] Define `Source` (provenance) as a closed union: `"default" | "configFile" | "env" | "flag" | "interactive"`.
  - [x] Define `interface RunConfig` with the **non-secret** config-data fields + `aiMode` + the injected fields (`analysisTimestamp`, `entitlement`, `provenance`). Use the contract block in Dev Notes verbatim for field names/types. **Do NOT** add the secret fields (`gitPat`, `aiKey`) — they require `Secret<string>` (Story 1.3) and are deferred (see Dev Notes "Deferred — secret fields").
  - [x] Define `PartialRunConfig` = the config-data fields all optional (the Phase-1 output before gap handling); the injected fields (`analysisTimestamp`, `entitlement`, `provenance`) are NOT part of `PartialRunConfig`.
  - [x] Define the provenance map type `Provenance = Partial<Record<keyof ConfigData, Source>>` (one entry per resolved config-data field).
  - [x] Implement `deepFreeze<T>(value: T): Readonly<T>` (recursively freezes nested objects incl. the `branch` object and the `provenance`/`outputFormats` containers). Named export only (P2).
  - [x] Co-locate `run-config.test.ts`: a `deepFreeze`d object rejects mutation (assignment is a no-op or throws in strict mode — assert the value is unchanged) and nested objects (`branch`, `outputFormats`) are also frozen.
- [x] **Task 2 — Source matrix + defaults (`src/config/sources.ts`) (AC: 1, 3)**
  - [x] Encode the **config-data field inventory** (non-secret only) as a typed table: for each field → `{ envVar, requiredness, layers }`. Use the Input Source Matrix in Dev Notes as the single source of truth (field names, env vars, defaults, requiredness, conditional rules).
  - [x] Implement `buildDefaults(input: { interactive: boolean; cwd: string }): PartialRunConfig` — the **defaults layer**. Channel-aware: `aiMode = interactive ? "auto" : "off"`; `repoTarget = cwd`; `timezone = "UTC"`; `outputFormats = ["terminal"]`; `noMerges = false`; `branch = { kind: "head" }`. Optional/unbounded fields (`startDate`, `endDate`, `authorFilter`, `maxCommits`, `outputPath`, `provider`, `llmBaseUrl`, `llmModel`) are left unset (genuinely absent). **Pure** — `cwd` and `interactive` are injected (no `process.cwd()`/TTY reads here).
  - [x] Express conditional requiredness as data the gap handler can consume: `provider` + `llmModel` required **iff** `aiMode !== "off"`; `llmBaseUrl` required **iff** `aiMode !== "off"` **and** provider ∈ `{ ollama, openai-compatible }`; `repoTarget` always required (but always defaulted to cwd, so never missing); all other fields optional.
  - [x] Co-locate `sources.test.ts`: defaults differ correctly by channel (`interactive` ⇒ `aiMode: "auto"`, headless ⇒ `aiMode: "off"`); defaults set exactly the expected fields and leave optionals unset; the requiredness table matches the matrix.
- [x] **Task 3 — Phase 1 pure merge + provenance (`src/config/resolver.ts`) (AC: 1)**
  - [x] Implement `mergeLayers(layers: { defaults: PartialRunConfig; configFile: PartialRunConfig; env: PartialRunConfig; flags: PartialRunConfig }): { config: PartialRunConfig; provenance: Provenance }`.
  - [x] Apply precedence **low→high** = `defaults → configFile → env → flags`; for each field the **highest layer that supplied a value wins**, and its layer name is recorded in `provenance` (`defaults`→`"default"`, `configFile`→`"configFile"`, `env`→`"env"`, `flags`→`"flag"`).
  - [x] **Pure function — no I/O, no globals, no `Date.now()`, no `process` access.** Only non-secret config-data fields participate. Treat `undefined` as "not supplied" (a layer setting a field to `undefined` does not override a lower layer). Iterate a fixed field key list (from the source matrix) so the result is deterministic and exhaustive.
  - [x] Co-locate `resolver.test.ts` (table-driven): each field overridden at each successive layer resolves to the highest layer's value with correct provenance; non-overlapping fields keep their origin layer; an all-empty merge yields an empty config + empty provenance; `flags` beats `env` beats `configFile` beats `defaults`; a higher layer's `undefined` does NOT clobber a lower layer's value.
- [x] **Task 4 — Capability gate (`src/config/capability.ts`) (AC: 2)**
  - [x] Implement the **pure** gate `computeCapability(snapshot: { stdinIsTTY: boolean; stdoutIsTTY: boolean; isCI: boolean; nonInteractive: boolean }): { interactive: boolean; aiModeDefault: "auto" | "off" }` = `interactive = stdinIsTTY && stdoutIsTTY && !isCI && !nonInteractive`; `aiModeDefault = interactive ? "auto" : "off"`. **Fails closed**: any non-true TTY input, CI, or `nonInteractive` ⇒ `interactive: false`.
  - [x] Implement `detectCI(env: NodeJS.ProcessEnv): boolean` — lightweight env sniff (truthy `CI`, plus a couple of common explicit markers — see Dev Notes "CI detection"). Reads env values passed in (the caller is `config/`, which is allowed `process.env`). **Do not** add the `ci-info` dependency now (noted as an optional future hardening).
  - [x] Implement the thin adapter `detectCapability(input: { nonInteractive: boolean; stdinIsTTY?: boolean; stdoutIsTTY?: boolean; env: NodeJS.ProcessEnv })` that coerces `process.stdin.isTTY`/`process.stdout.isTTY` (which are `true | undefined`) to booleans via `!!`, derives `isCI` from `detectCI`, and delegates to `computeCapability`. (The actual `process.stdin.isTTY` reads happen at the call site / orchestrator; keep this function injectable for tests.)
  - [x] Co-locate `capability.test.ts`: the full truth table — (0/≥1 arg is the orchestrator's concern, here just the gate) `TTY+!CI+!nonInteractive ⇒ interactive`; `isTTY undefined/false ⇒ fails closed`; `isCI ⇒ closed`; `nonInteractive ⇒ closed`; `aiModeDefault` maps `interactive→auto`, else `off`; `detectCI` true for `CI=true`/`CI=1`, false for unset/empty.
- [x] **Task 5 — Phase 2 gap handling + freeze (`src/config/gaps.ts`) (AC: 2, 3)**
  - [x] Implement `finalizeRunConfig(partial: PartialRunConfig, provenance: Provenance, ctx: { interactive: boolean; analysisTimestamp: IsoDate; entitlement: RunConfig["entitlement"] }): RunConfig`.
  - [x] **Non-interactive required-missing ⇒ typed error, never a prompt.** Using the requiredness rules (Task 2), for every required field that is unset, throw `MissingRequiredConfigError` (Task 6) naming the field + how to supply it (env var from the matrix and/or flag). Honor the `aiMode: "off"` short-circuit — the AI cluster (`provider`/`llmModel`/`llmBaseUrl`) is **not required** when `aiMode === "off"`.
  - [x] **Interactive gap-filling (prompting) is OUT OF SCOPE** (Epic 6 owns the 0-arg-TTY guided prompts). For this story, `finalizeRunConfig` validates + freezes only; document that Epic 6 inserts a prompt step **before** `finalize` for the 0-arg TTY case. (Under STRICT, the only prompting entry is 0-arg TTY; every Epic-1 run is non-interactive, so the typed-error branch is the one exercised.)
  - [x] Construct the `RunConfig`: copy the resolved config-data fields, attach the injected `analysisTimestamp`, `entitlement`, and `provenance`, then `deepFreeze` the whole object before returning.
  - [x] Co-locate `gaps.test.ts`: required-missing (headless) ⇒ `MissingRequiredConfigError` with `exitCode === 3`, stable `code`, and a message naming the field/env var; `aiMode: "off"` relaxes the AI cluster (no throw); `aiMode: "auto"`/`"required"` enforces `provider` + `llmModel`; `provider: "ollama"`/`"openai-compatible"` additionally enforces `llmBaseUrl`; the success path returns a **frozen** `RunConfig` (mutation rejected) carrying `provenance`, `analysisTimestamp`, and `entitlement`.
- [x] **Task 6 — Minimal typed-error seam (`src/shared/errors.ts`) (AC: 3)**
  - [x] Implement `CommitWhisperError extends Error` with `readonly code: string` and `readonly exitCode: number`; set `this.name = new.target.name` and call `Error.captureStackTrace` when available. Named export (P2). **No `console`** (this is `shared/`, P5 lint-enforced).
  - [x] Implement `MissingRequiredConfigError extends CommitWhisperError` with `exitCode = 3` (the locked "Required input missing (non-interactive)" code — see Dev Notes "Exit-code enum") and a stable `code = "CONFIG_REQUIRED_MISSING"`; the constructor takes the field name (+ optional env var) and composes an actionable message.
  - [x] Add the seam note in this file's header comment: **Story 1.3 expands this into the full `CommitWhisperError` hierarchy, the `cli/exit-codes.ts` C4 enum (0–9), stream discipline, and `Secret<string>`.** Story 1.2 plants only the base + the exit-code-3 subclass it needs.
  - [x] Co-locate `errors.test.ts`: `MissingRequiredConfigError` is `instanceof Error` and `instanceof CommitWhisperError`; `exitCode === 3`; `code === "CONFIG_REQUIRED_MISSING"`; message contains the field name and the env var when supplied.
- [x] **Task 7 — Minimal non-secret env reader (`src/config/env.ts`) (AC: 1)**
  - [x] Implement `readEnvLayer(env: NodeJS.ProcessEnv): PartialRunConfig` — parse the **non-secret** `COMMIT_WHISPER_*` variables into an env layer: `repoTarget`(`COMMIT_WHISPER_REPO`), `branch`(`COMMIT_WHISPER_BRANCH`, `all`⇒`{kind:"all"}` else `{kind:"named",name}`), `startDate`/`endDate`, `timezone`(`COMMIT_WHISPER_TZ`), `authorFilter`(`COMMIT_WHISPER_AUTHOR`), `maxCommits`(`COMMIT_WHISPER_MAX_COMMITS`→positive int), `noMerges`(`COMMIT_WHISPER_NO_MERGES`→bool), `outputFormats`(`COMMIT_WHISPER_FORMAT`→split/validate), `outputPath`(`COMMIT_WHISPER_OUT`), `aiMode`(`COMMIT_WHISPER_AI_MODE` tri-state; alias `COMMIT_WHISPER_NO_AI` truthy ⇒ `"off"`), `provider`(`COMMIT_WHISPER_PROVIDER`), `llmBaseUrl`(`COMMIT_WHISPER_LLM_BASE_URL`), `llmModel`(`COMMIT_WHISPER_LLM_MODEL`). Unset vars ⇒ field absent (not `undefined`-valued, just omitted).
  - [x] This is the **single intended reader of `process.env`** (architecture: env-isolation, lint-enforced). **Secret env vars are explicitly deferred** — do NOT read `OPENAI_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY`/`GEMINI_API_KEY`/`COMMIT_WHISPER_GIT_TOKEN`/host tokens here yet (Story 1.6 wires `aiKey`; Epic 5 wires `gitPat`). Leave a comment marking that extension point.
  - [x] Keep parsing pure/total: pass `env` in (don't read `process.env` inside — the orchestrator passes `process.env`), so it's table-testable. Invalid coercions (e.g. non-numeric `MAX_COMMITS`) ⇒ omit the field (do not throw here; value validation is deferred to the Zod story — see Dev Notes "Deferred — Zod schema validation").
  - [x] Co-locate `env.test.ts`: each var maps to the right field with correct coercion; `COMMIT_WHISPER_NO_AI=1` ⇒ `aiMode: "off"`; `branch=all` ⇒ `{kind:"all"}`; empty env ⇒ `{}`; non-numeric `MAX_COMMITS` omitted.
- [x] **Task 8 — Orchestration entry (`src/config/resolve-run-config.ts`) (AC: 1, 2, 3)**
  - [x] Implement `resolveRunConfig(input)` composing the pure pieces: `detectCapability` → `buildDefaults({ interactive, cwd })` → gather the four layers `{ defaults, configFile, env, flags }` → `mergeLayers` → `finalizeRunConfig`. Return the frozen `RunConfig`.
  - [x] **Inject all I/O at the boundary** so the orchestrator stays thin and testable: `cwd` (from `process.cwd()`), `env` (from `process.env`, passed to `readEnvLayer`), TTY snapshot (`process.stdin.isTTY`/`process.stdout.isTTY`), `analysisTimestamp` (injected ISO string — **never `Date.now()`** inside the pipeline; see Dev Notes "Injected fields"), `flags` (the parsed-CLI non-secret layer — **injected by the caller**; real flag parsing is `cli/` Story 1.8), and `configFile` (**defaults to `{}`** — real config-file reading is Epic 6; see Dev Notes "Deferred — config-file read").
  - [x] Apply the channel `aiMode` default correctly: it enters via the **defaults layer** (`buildDefaults`), so an explicit `--ai`/`--no-ai`/`COMMIT_WHISPER_AI_MODE`/config value still overrides it through normal precedence; provenance reflects the true source.
  - [x] Co-locate `resolve-run-config.test.ts` (pure via injected I/O): end-to-end precedence across all four layers; channel default `aiMode` applied when no layer sets it and overridden when a layer does; headless + required-missing (AI requested, no provider) ⇒ `MissingRequiredConfigError` (exit 3); a fully-specified headless metrics-only input ⇒ frozen `RunConfig` with expected `provenance`.
- [x] **Task 9 — Verify gates (AC: 1, 2, 3)**
  - [x] `npm run typecheck` clean (strict).
  - [x] `npm run lint` clean — confirm the env-isolation guardrail still passes (only `src/config/**` reads `process.env`; `readEnvLayer` receives `env` as a param, and the single `process.env` read lives in the orchestrator under `src/config/`).
  - [x] `npm test` green (all new co-located suites).
  - [x] `npm run build` clean (tsup) — the new modules are reachable/compilable (no unused-export build break).

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The Acceptance Auditor (spec-aware) independently **verified all 3 ACs are met** and the suite green; findings below are hardening/forward-scope, with one decision item. Triage: **1 decision-needed · 3 patch · 6 defer · 8 dismissed.**

**Decision-needed:** _(resolved 2026-06-13 — George chose **(a) keep as-is**: the resolver enforces `provider`/`llmModel` for `aiMode: "auto"`, matching the story's Input Source Matrix. Story 1.6's narrate stage owns the fail-open/degrade behavior; the resolver's job is to require a configured provider when AI is not explicitly off. No code change.)_

- [x] [Review][Decision] `aiMode: "auto"` with no provider configured hard-fails at resolve time (exit 3) instead of being allowed through to fail-open — `isFieldRequired` makes `provider`/`llmModel` required whenever `aiMode !== "off"` [src/config/gaps.ts, src/config/sources.ts]. This matches the story's Input Source Matrix ("provider required iff `aiMode !== off`"), but the architecture's fail-open ruling says `auto` should **degrade** to the substrate on a missing/unreachable provider, not block. Low practical urgency (headless defaults to `off`; interactive `auto` gets `provider` via Epic 6 prompts before finalize; `required`/`--ai` correctly hard-fails), but it sets the resolver's contract for Story 1.6. Options: **(a)** keep as-is (resolver enforces provider for `auto`, matches matrix); **(b)** relax so only `aiMode: "required"` enforces provider presence, letting `auto` defer to the narrate stage's fail-open. **→ Resolved (a).**

**Patch:** _(all 3 applied & verified 2026-06-13 — suite green, 58 tests)_

- [x] [Review][Patch] `deepFreeze` recurses into children before freezing the parent → unbounded recursion on a cyclic reference (a reusable primitive should be cycle-safe; RunConfig itself is acyclic, so no current impact) [src/config/run-config.ts] — **Fixed:** freeze the parent **before** descending, so a cycle short-circuits on the `Object.isFrozen` guard. Added a self-referential-graph regression test in `run-config.test.ts`.
- [x] [Review][Patch] `resolveRunConfig` freezes the shared module-level `FREE_ENTITLEMENT` constant as a side effect of `deepFreeze`; construct the default Free entitlement fresh per call instead [src/config/resolve-run-config.ts] — **Fixed:** removed the module constant; the default is now `input.entitlement ?? { tier: "free" }` (a fresh object per call).
- [x] [Review][Patch] Completion-Notes env-isolation wording diverges from the implemented design (the single `process.env` touchpoint is `readEnvLayer`'s `= process.env` default param, not the orchestrator — which is fully injected); correct the note [docs/implementation-artifacts/1-2-two-phase-configuration-resolver-and-frozen-runconfig.md] — **Fixed:** corrected the Completion Notes to state the orchestrator is fully injected and the lone `process.env` touchpoint is `readEnvLayer`'s default param.

**Defer (tracked in deferred-work.md, not actioned now):**

- [x] [Review][Defer] Env value validation/normalization bundle — decimal + safe-integer `maxCommits` (reject hex/exponent/overflow), case-insensitive enum parsing (`aiMode`/`provider`/`branch`/`format`), IANA `timezone` validation, ISO date validation + `startDate ≤ endDate`, `llmBaseUrl` URL validation (SSRF-relevant once narrate calls it), `outputFormats` dedup + reject-invalid + enforce ≥1 [src/config/env.ts] — deferred: the story's Dev Notes explicitly scope value validation to the Zod schema story; 1.2's AC bar is merge+provenance+gate+gap-error.
- [x] [Review][Defer] Treat JSON `null` as "not supplied" in `mergeLayers` + `finalizeRunConfig` [src/config/resolver.ts, src/config/gaps.ts] — deferred: not reachable in 1.2 (types forbid null; `configFile` injected `{}`); matters when Epic 6 feeds real JSON config.
- [x] [Review][Defer] Broaden + normalize CI detection (`CONTINUOUS_INTEGRATION` / provider markers / `ci-info`; trim + lowercase the value) [src/config/capability.ts] — deferred: current behavior fails closed; Task 4 mentioned "a couple of common explicit markers" as a nice-to-have.
- [x] [Review][Defer] Single-source-of-truth for the `provider`/`format`/`aiMode` enums (derive runtime `Set` + union from one `as const satisfies` array) to prevent set/union drift [src/config/env.ts, src/config/run-config.ts] — deferred: sets and unions are currently in sync; fold into the Zod schema story.
- [x] [Review][Defer] Enforce `entitlement.commitCap` against `maxCommits` [src/config/resolve-run-config.ts] — deferred: the Free 100-commit cap mechanics are Epic 2 by design.
- [x] [Review][Defer] Replace the `as RunConfig` cast in `finalizeRunConfig` with an explicit mandatory-field invariant assertion (close the soundness gap where defaulted-mandatory fields are unvalidated) [src/config/gaps.ts] — deferred: precondition is documented + guaranteed by the sole caller and can't fire today.

**Dismissed (8):** "interactive" source / interactive resolution unimplemented (sanctioned Epic 6 seam); `isFieldRequired` lacks exhaustiveness guard (false positive — TS 2366 "lacks ending return" already enforces it); `CommitWhisperError` needs `Object.setPrototypeOf` / `instanceof` breaks in ES5 (false positive — target es2023/node22, `errors.test.ts` verifies `instanceof`); CI "contradicts fails closed" (mischaracterized — unknown values → treated as CI → headless **is** failing closed); `aiModeDefault` unused / two sources of truth (both derive `interactive ? "auto" : "off"` from the same boolean, cannot drift; part of capability.ts's tested API); `deepFreeze` freezes caller-owned nested refs (by design — resolver owns its per-invocation inputs; the one real shared-constant smell is the Patch above); stringly-typed error `code` (typed-union + full hierarchy is Story 1.3 scope; errors.ts is a documented seam); `ctx.interactive` dead param (sanctioned seam — validate+freeze only, prompting is Epic 6 upstream).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope (the two-phase resolver core — pure + table-testable is the AC bar):**
- The `RunConfig`/`PartialRunConfig`/`Source` **types** + a `deepFreeze` helper (`config/run-config.ts`).
- The **source matrix + channel-aware defaults** (`config/sources.ts`).
- The **Phase-1 pure merge with provenance** (`config/resolver.ts`).
- The **capability gate** (pure gate + thin TTY/CI adapter) (`config/capability.ts`).
- The **Phase-2 gap handler** (non-interactive required-missing ⇒ typed error; freeze) (`config/gaps.ts`).
- A **minimal typed-error seam** (`shared/errors.ts`: `CommitWhisperError` base + `MissingRequiredConfigError` exit 3).
- A **minimal non-secret env reader** (`config/env.ts`) and a **thin orchestrator** (`config/resolve-run-config.ts`) that composes the pure pieces with injected I/O.

**Out of scope / deferred (do NOT build here — they belong to their own stories):**
- **Secret fields + `Secret<string>`** (`shared/secret.ts`, `gitPat`, `aiKey`): Story 1.3 introduces `Secret<string>`; `aiKey` is wired in Story 1.6, `gitPat` in Epic 5. Secrets are **env-only and bypass the merge**, so the resolver is unaffected by their absence. Do not add secret fields to `RunConfig` yet. [Source: docs/planning-artifacts/architecture.md#Secrets]
- **Full error hierarchy + exit-code enum + stream discipline** (`cli/exit-codes.ts`, `shared/ui.ts`): Story 1.3. This story plants only the `CommitWhisperError` base + the exit-3 subclass it needs. [Source: docs/planning-artifacts/epics.md#Story 1.3: Error model, exit codes, and stream discipline]
- **Zod schema validation** (`config/schema.ts`) + adding the `zod` dependency: deferred. The 1.2 ACs require a pure **merge** + provenance + gate + gap-error, not value validation. Value validation (positive-int `maxCommits`, IANA `timezone`, ISO dates, ≥1 `outputFormats`) lands with the config-file/env validation story; for now `env.ts` coerces leniently and omits invalid values. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- **Config-file read** (`config/config-home.ts`, `config/config-store.ts`, `~/.commit-whisper`): Epic 6 (Settings + config home). For 1.2 the `configFile` layer is an **injected plain object defaulting to `{}`** — the merge already supports it. [Source: docs/planning-artifacts/architecture.md#Config Persistence — the `Settings` Write Path]
- **Real flag parsing** (commander wiring, `--ai`/`--no-ai`→`aiMode`, positional `repoTarget`): `cli/` (Story 1.8). For 1.2 the `flags` layer is **injected by the caller**.
- **License `entitlement` resolution**: Epic 7 (license gate). For 1.2, inject a **Free-tier default** `{ tier: "free" }` (see "Injected fields").

### The frozen `RunConfig` contract (1.2 subset — copy field names/types exactly)

This is the architecture's full contract with the **two secret fields removed** (deferred — see scope). Keep field names/types identical so later stories layer the secret fields on without reshaping anything.

```ts
type Provider = "ollama" | "openai" | "gemini" | "anthropic" | "openai-compatible";
type OutputFormat = "html" | "markdown" | "terminal" | "json";
type IsoDate = string; // ISO-8601; brand later if desired
type Source = "default" | "configFile" | "env" | "flag" | "interactive";
type Branch =
  | { kind: "named"; name: string }
  | { kind: "all" }
  | { kind: "head" };            // unset ⇒ repo HEAD default (resolved at retrieve, Story 1.4)

interface RunConfig {
  // — repository —
  repoTarget: string;              // local path | remote HTTPS URL; defaults to cwd
  // gitPat?: Secret<string>;      // DEFERRED (Story 1.3 Secret / Epic 5 wiring) — env-only, bypasses merge
  branch: Branch;                  // sentinel, never ""
  // — scope / filters (optional ⇒ unbounded) —
  startDate?: IsoDate;             // unset = no lower bound
  endDate?: IsoDate;               // unset = no upper bound
  timezone: string;                // IANA tz; default "UTC"; governs filters + buckets
  authorFilter?: string;
  maxCommits?: number;             // positive int; interacts with the Free 100-cap
  noMerges: boolean;               // default false; CHANGES the analyzed commit set
  // — output —
  outputFormats: OutputFormat[];   // multi-select, ≥ 1; default ["terminal"]
  outputPath?: string;             // file formats only; "-" = stdout
  // — AI (runs per aiMode) —
  aiMode: "required" | "auto" | "off";  // default: interactive→"auto", headless/CI→"off"
  provider?: Provider;             // required unless aiMode==="off"
  // aiKey?: Secret<string>;       // DEFERRED (Story 1.6) — env-only, bypasses merge
  llmBaseUrl?: string;             // required for ollama / openai-compatible (when AI runs)
  llmModel?: string;               // required when AI runs; defaulted per provider later
  // — injected by the config / license layer, NOT user inputs / NOT merged —
  analysisTimestamp: IsoDate;      // C2 determinism anchor (never Date.now())
  entitlement: { tier: "free" | "single-device" | "unlimited"; commitCap?: number };
  provenance: Provenance;          // P7: which layer set each config-data field
}
```

> **Note on `provider`/`llmModel` optionality:** the architecture types these as required, but they are only required **when AI runs** (`aiMode !== "off"`). Because the Epic-1 headless default is `aiMode: "off"`, model them as **optional on the type** and enforce their presence **conditionally in the gap handler** (Task 5). This keeps the type honest for the metrics-only walking skeleton while the gap handler enforces the real rule. [Source: docs/planning-artifacts/architecture.md#The Frozen RunConfig Contract] [Source: docs/planning-artifacts/architecture.md#Input Source Matrix (config-data)]

### Input Source Matrix (config-data — non-secret only; 1.2 builds these)

Precedence is uniform: **defaults → config file → env → flags** (low → high). Secrets bypass the config/flag layers entirely (env-only) and are deferred.

| Field | Env var | Default | Requiredness |
|---|---|---|---|
| `repoTarget` | `COMMIT_WHISPER_REPO` | **cwd** | required (always defaulted ⇒ never missing) |
| `branch` | `COMMIT_WHISPER_BRANCH` | `{ kind: "head" }` | optional; `all` ⇒ `{kind:"all"}` |
| `startDate` | `COMMIT_WHISPER_START_DATE` | — (unbounded) | optional |
| `endDate` | `COMMIT_WHISPER_END_DATE` | — (unbounded) | optional |
| `timezone` | `COMMIT_WHISPER_TZ` | `"UTC"` | optional (defaulted) |
| `authorFilter` | `COMMIT_WHISPER_AUTHOR` | — | optional |
| `maxCommits` | `COMMIT_WHISPER_MAX_COMMITS` | — | optional (positive int) |
| `noMerges` | `COMMIT_WHISPER_NO_MERGES` | `false` | optional (defaulted) |
| `outputFormats` | `COMMIT_WHISPER_FORMAT` | `["terminal"]` | optional (defaulted; ≥1) |
| `outputPath` | `COMMIT_WHISPER_OUT` | — (`-` = stdout) | optional |
| `aiMode` | `COMMIT_WHISPER_AI_MODE` (alias `COMMIT_WHISPER_NO_AI`) | channel: interactive→`auto`, headless/CI→`off` | optional (defaulted) |
| `provider` | `COMMIT_WHISPER_PROVIDER` | — | **required iff `aiMode !== "off"`** |
| `llmBaseUrl` | `COMMIT_WHISPER_LLM_BASE_URL` | — (ollama→`http://localhost:11434` later) | **required iff `aiMode !== "off"` and provider ∈ {ollama, openai-compatible}** |
| `llmModel` | `COMMIT_WHISPER_LLM_MODEL` | — (per-provider default later) | **required iff `aiMode !== "off"`** |

[Source: docs/planning-artifacts/architecture.md#Input Source Matrix (config-data)]

> **Flags layer mapping (injected by `cli/` later, but the matrix the resolver honors):** `--ai` ⇒ `aiMode: "required"`, `--no-ai` ⇒ `aiMode: "off"`, `--non-interactive` is a **capability** input (forces the gate closed), **not** a `RunConfig` field. Action/mode flags (`--show-config`, `--config`, `--help`, `--version`, license subcommands) **short-circuit and never enter `RunConfig`** — out of scope here. [Source: docs/planning-artifacts/architecture.md#Action / Mode Flags (short-circuit — never enter RunConfig)]

### Capability gate (AC2)

```ts
interactive = stdin.isTTY && stdout.isTTY && !isCI && !flags.nonInteractive
```

- **Fails closed toward non-interactive:** in Node, `process.stdin.isTTY`/`process.stdout.isTTY` are `true` **or `undefined`** (never `false`) — coerce with `!!`. If a usable TTY cannot be proven, behave headlessly. [Source: docs/planning-artifacts/architecture.md#Trigger Rule & Capability Gate]
- The gate **also sets the `aiMode` channel default**: `interactive ⇒ "auto"`, headless/CI ⇒ `"off"`. Feed this into `buildDefaults` so it enters the merge at the **defaults layer** (overridable by config/env/flags). [Source: docs/planning-artifacts/architecture.md#Key Architecture Rulings]
- **STRICT single-shot** (George's ruling): arg-count → mode is a `cli/` concern (Story 1.8); the **only** row that ever prompts is **0 args + TTY** (Epic 6). For 1.2, gap-filling is always the non-interactive typed-error path. [Source: docs/planning-artifacts/architecture.md#STRICT Single-Shot (George's ruling)]

**CI detection:** the architecture allows "`ci-info` **or** env sniffing." Use lightweight env sniffing now — treat CI as truthy when `env.CI` is set to a non-empty, non-`"0"`/non-`"false"` value (this covers GitHub Actions, GitLab CI, CircleCI, Travis, etc., which all set `CI`). Keep it injectable (`detectCI(env)`); do **not** add `ci-info` (lean-dependency posture — note it as an optional future hardening). [Source: docs/planning-artifacts/architecture.md#Trigger Rule & Capability Gate]

### Branch sentinel (decision to confirm at review)

The contract says `branch` "carries an explicit sentinel rather than a magic empty string" with **default = repo HEAD**, but the union the architecture lists is `{kind:"named"} | {kind:"all"}` — which has no way to say "the repo's default branch (HEAD)" before git runs. **Recommended resolution:** add a third variant `{ kind: "head" }` as the default sentinel; `retrieve/` (Story 1.4) resolves it to the actual HEAD. This keeps `branch` non-optional and provenance-trackable and honors "explicit sentinel, never empty string." Flag this in Completion Notes as a deliberate, documented refinement of the contract. [Source: docs/planning-artifacts/architecture.md#The Frozen RunConfig Contract]

### Injected fields (`analysisTimestamp`, `entitlement`) — not merged

These ride **inside** `RunConfig` but are **not** user inputs and do **not** flow through the merge:
- **`analysisTimestamp`** (C2 determinism anchor) — inject an ISO string at the orchestrator boundary; **never call `Date.now()` inside the pipeline**. For 1.2 the orchestrator accepts it as an injected parameter (a test passes a fixed value; the real entrypoint will pass a single captured timestamp). The analyze engine (Story 1.5) consumes it. [Source: docs/planning-artifacts/architecture.md#The Frozen RunConfig Contract]
- **`entitlement`** — resolved by the license gate (Epic 7). For 1.2 inject a **Free-tier default** `{ tier: "free" }` (leave `commitCap` unset — the Free 100-cap mechanics are Epic 2). This keeps the frozen contract whole without pulling licensing forward. [Source: docs/planning-artifacts/architecture.md#The Frozen RunConfig Contract]

### Hexagonal boundary (why this story matters)

The pipeline (`retrieve → analyze → narrate → assemble → render`) receives the **frozen `RunConfig`** and has **no access to `argv`, `env`, or prompts** — guaranteeing headless safety, determinism (identical `RunConfig` ⇒ identical `analysis` subtree), and direct testability (construct a `RunConfig` directly, no TTY needed). Only `cli/` and `config/` read `argv`/`env`/prompts; **`config/env.ts` is the single reader of `process.env`** (lint-enforced — see Previous Story Intelligence). [Source: docs/planning-artifacts/architecture.md#Hexagonal Boundary] [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]

### Exit-code enum (only code 3 is needed here)

The full enum is Story 1.3; this story uses exactly one value: **`3` = "Required input missing (non-interactive)."** Hard-code `exitCode = 3` on `MissingRequiredConfigError` with a comment pointing to the future `cli/exit-codes.ts`. (Codes `1`–`8` mean "no output produced"; `3` localizes the missing-required-input failure.) [Source: docs/planning-artifacts/architecture.md#Exit-Code Enum (FR-15)]

### Implementation patterns this story must follow (P-rules — lint-enforced)

- **P2 · Modules & files:** `kebab-case.ts` filenames; **named exports only** (no `export default` — ESLint errors on it). Shared primitives (`errors.ts`) under `src/shared/`. [Source: docs/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- **P5 · Streams & logging:** **no `console`** anywhere this story touches — `src/shared/**` is under the `no-console` ESLint rule, and the pipeline/config code must stay quiet (human chrome is the future `ui` module's job, Story 1.3). Throw typed errors; do not log. [Source: docs/planning-artifacts/architecture.md#Stream Discipline]
- **Env isolation (anti-pattern):** `process.env` may be read **only** within `src/config/**`. `readEnvLayer` takes `env` as a parameter; the **single** real `process.env` read lives in the orchestrator (`config/resolve-run-config.ts`, which is under `config/`). Do not destructure `env` off `process` or import `env` from `node:process` (both bypasses are lint-caught). [Source: docs/planning-artifacts/architecture.md#Anti-Patterns (forbidden)]
- **P3 · Source layout:** unit tests **co-located** as `*.test.ts` next to the module. `tests/` is reserved for shared fixtures + the determinism harness (Story 1.5) — not used here. [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#Testing standards]
- **Purity:** `resolver.ts`, `capability.ts` (the `computeCapability` gate), `sources.ts` (`buildDefaults`), and `env.ts` (`readEnvLayer`) are **pure functions over injected inputs** — no `process`, no clock, no filesystem. All I/O is gathered in the one thin orchestrator. This is what makes AC1's "pure function, table-testable" literally true.

### Previous story intelligence (1.1 — scaffold)

- **Toolchain (locked, do not change):** TypeScript `6.0.3` (strict, `nodenext`, `es2023`), ESM (`"type": "module"`), tsup `8.5.1`, vitest `4.1.8`, `@types/node@22`. Node ≥22. No new runtime deps for this story (no `zod`, no `ci-info`). [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#Completion Notes List]
- **ESLint guardrails are live and fail the build** (proven via probes in 1.1): named-exports-only (`no-restricted-syntax` on `ExportDefaultDeclaration`), `no-console` in pipeline + `src/index.ts` + `src/shared/**`, and `process.env` only under `src/config/**` (static member, destructure, and `node:process` import forms all caught). Write code that satisfies these from the start. [Source: eslint.config.js]
- **`src/config/` and `src/shared/` currently hold only `.gitkeep`** — this story adds the first real modules to both. Leave the `.gitkeep` files or remove them once real files exist (either is fine; removing is cleaner once a folder has content). [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#File List]
- **ESM import note:** with `module: nodenext`, relative imports in emitted ESM need explicit extensions in source — use `./run-config.js`-style specifiers in `import` statements (TypeScript resolves the `.ts`, emits `.js`). Match whatever 1.1's `src/index.ts`/`index.test.ts` already do; mirror that convention. [Source: docs/planning-artifacts/architecture.md#Initialization (first implementation story)]
- **`tsconfig` is `noEmit` + `isolatedModules` + `strict`** (hardened in 1.1 review) — write isolated-modules-safe code (e.g. `import type` for type-only imports). [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#Review Findings]

### Testing standards

- **Framework:** vitest 4.1.8, TS-native. **Co-locate** `*.test.ts` next to each module (P3). Prefer **table-driven** tests for the merge (AC1), the capability truth table (AC2), and the env parser. [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#Testing standards]
- **Determinism/purity assertions:** the merge and gate tests must pass **only injected inputs** (no `process`, no clock) — this is the executable proof of AC1's "no I/O." For freeze tests, assert post-`deepFreeze` mutation does not change the value (and, under `"use strict"` ESM, throws `TypeError`).
- **The DoD for this story:** `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all green, with the new suites covering all three ACs.

### Project Structure Notes

- New files land exactly where the architecture's directory map places them — `src/config/{run-config,sources,resolver,capability,gaps,env,resolve-run-config}.ts` and `src/shared/errors.ts` — with co-located `*.test.ts` siblings. No deviation from the documented tree. (`config/resolve-run-config.ts` is the one filename not explicitly in the architecture map; it's the thin composition entry — the architecture splits resolver/gaps/capability but doesn't name the composer. Named per P2 kebab-case; flag in Completion Notes.) [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- **No conflicts** between the architecture structure and this scaffold — `config/` and `shared/` exist (empty) and are the correct homes.
- Several architecture-listed `config/` files are **intentionally not created here** (`schema.ts`, `config-home.ts`, `config-store.ts`, `sources.ts` is created, `gaps.ts` is created) — see scope deferrals. Their absence does not break the slice; the orchestrator injects `{}`/defaults where they'd plug in.

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.2: Two-phase configuration resolver and frozen RunConfig]
- [Source: docs/planning-artifacts/epics.md#Epic 1: Foundation & Walking Skeleton]
- [Source: docs/planning-artifacts/architecture.md#Decision: CLI Interaction Model & Configuration Resolution]
- [Source: docs/planning-artifacts/architecture.md#Trigger Rule & Capability Gate]
- [Source: docs/planning-artifacts/architecture.md#STRICT Single-Shot (George's ruling)]
- [Source: docs/planning-artifacts/architecture.md#Two-Phase Configuration Resolver]
- [Source: docs/planning-artifacts/architecture.md#Hexagonal Boundary]
- [Source: docs/planning-artifacts/architecture.md#Stream Discipline]
- [Source: docs/planning-artifacts/architecture.md#Secrets]
- [Source: docs/planning-artifacts/architecture.md#Exit-Code Enum (FR-15)]
- [Source: docs/planning-artifacts/architecture.md#RunConfig Contract & Input Source Matrix]
- [Source: docs/planning-artifacts/architecture.md#The Frozen RunConfig Contract]
- [Source: docs/planning-artifacts/architecture.md#Input Source Matrix (config-data)]
- [Source: docs/planning-artifacts/architecture.md#Action / Mode Flags (short-circuit — never enter RunConfig)]
- [Source: docs/planning-artifacts/architecture.md#Key Architecture Rulings]
- [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-15: Headless / CI execution]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-2: Authenticate to private repositories]
- [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#Dev Notes]
- [Source: eslint.config.js]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean after adding `"types": ["node"]` to `tsconfig.json` (the scaffold deferred Node types; this is the first story to use Node globals — `process`, `NodeJS.ProcessEnv`, `Error.captureStackTrace`).
- `npm run lint` → ESLint clean (exit 0); env-isolation guardrail satisfied — the only `process.env` reference is the `= process.env` default in `src/config/env.ts` (exempt under `src/config/**`).
- `npm test` → vitest: **9 files / 57 tests passed**.
- `npm run build` → tsup ESM build success (entry `src/index.ts`; the new config modules compile under typecheck and are consumed by later stories' wiring).

### Completion Notes List

- **All 3 ACs satisfied.** AC1: `mergeLayers` is a pure, no-I/O, table-tested merge producing `PartialRunConfig` + per-field `provenance` over `defaults → configFile → env → flags`. AC2: `RunConfig` is deep-frozen via `deepFreeze`, and `computeCapability` implements `interactive = stdin.isTTY && stdout.isTTY && !isCI && !nonInteractive`, failing closed (undefined/false TTY, CI, or `--non-interactive` ⇒ headless). AC3: `finalizeRunConfig` throws the typed `MissingRequiredConfigError` (exit code 3) for a required-missing field in non-interactive context — never a prompt.
- **Branch sentinel refinement (review-relevant):** added `{ kind: "head" }` to the `Branch` union as the default sentinel for "repo HEAD" (the architecture's `named | all` had no way to express the documented "default = repo HEAD" without a magic empty string). `retrieve/` (Story 1.4) resolves it. Deliberate, documented refinement of the contract.
- **`tsconfig.json` change (refines Story 1.1):** added `"types": ["node"]`. Story 1.1's `index.ts` used no Node globals so `@types/node` was never exercised by `tsc`; this story needs `process` / `NodeJS.ProcessEnv` / `Error.captureStackTrace`. Minimal, in-scope toolchain enablement. Did not touch any other 1.1-locked compiler option.
- **New filename not in the architecture map:** `config/resolve-run-config.ts` — the thin composition entry that wires capability → defaults → merge → finalize. The architecture splits `resolver.ts`/`gaps.ts`/`capability.ts` but does not name the composer; named per P2 kebab-case. Flagged for review.
- **Scope deferrals honored (see story Dev Notes):** secret fields (`gitPat`/`aiKey` + `Secret<string>`) → 1.3/1.6/Epic 5; full error hierarchy + `cli/exit-codes.ts` enum + stream discipline → 1.3; Zod value validation (`config/schema.ts` + the `zod` dep) → later; config-file read (`~/.commit-whisper`) → Epic 6; real flag parsing → 1.8; license `entitlement` resolution → Epic 7. No new runtime/dev dependencies were added.
- **`shared/errors.ts` is a seam, not the final hierarchy.** It plants `CommitWhisperError` (base: `code` + `exitCode`) and the single `MissingRequiredConfigError` (exit 3) the gap handler needs; Story 1.3 expands it (full subclass set, exit-code enum module, `Secret<string>`).
- **`process.env` is read in exactly one place** — the `= process.env` default parameter of `readEnvLayer` (`config/env.ts`), honoring the architecture's "single reader" rule while keeping parsing injectable/pure for tests. The orchestrator (`resolve-run-config.ts`) is **fully injected** — it takes `env` as a required input and reads nothing from `process` itself — so the lone `process.env` touchpoint in the slice is that default param, both under `src/config/**` as the lint rule requires.
- **SonarQube advisory intentionally not actioned:** `type IsoDate = string` is flagged "redundant alias," but it is the architecture's contract type for `analysisTimestamp` / `startDate` / `endDate` ("ISO-8601; brand later if desired"). Kept for domain clarity. The four other initial advisories (Set membership ×3, `readEnvLayer` cognitive complexity) were resolved by refactor; the project's real gates (tsc/eslint/vitest/tsup) are all green.
- **`.gitkeep` placeholders** in `src/config/` and `src/shared/` left in place (harmless now that real modules exist; removable in a later cleanup).

### File List

**Added (source):**
- `src/config/run-config.ts` — `RunConfig`/`PartialRunConfig`/`ConfigData`/`Provenance`/`Source`/`Branch`/`Provider`/`OutputFormat`/`AiMode`/`Entitlement` types + `deepFreeze`
- `src/config/sources.ts` — `FIELD_SPECS` source/requiredness matrix, `CONFIG_FIELD_KEYS`, `buildDefaults`
- `src/config/resolver.ts` — `mergeLayers` (Phase-1 pure merge + provenance)
- `src/config/capability.ts` — `computeCapability` gate, `detectCI`, `detectCapability`
- `src/config/env.ts` — `readEnvLayer` (single `process.env` reader; non-secret `COMMIT_WHISPER_*`)
- `src/config/gaps.ts` — `finalizeRunConfig` (Phase-2 gap handling + freeze)
- `src/config/resolve-run-config.ts` — `resolveRunConfig` orchestrator
- `src/shared/errors.ts` — `CommitWhisperError` base + `MissingRequiredConfigError`

**Added (tests, co-located):**
- `src/config/run-config.test.ts`, `src/config/sources.test.ts`, `src/config/resolver.test.ts`, `src/config/capability.test.ts`, `src/config/env.test.ts`, `src/config/gaps.test.ts`, `src/config/resolve-run-config.test.ts`, `src/shared/errors.test.ts`

**Modified:**
- `tsconfig.json` — added `"types": ["node"]`
- `docs/implementation-artifacts/sprint-status.yaml` — 1-2 → in-progress → review → done
- `docs/implementation-artifacts/1-2-two-phase-configuration-resolver-and-frozen-runconfig.md` — this story (baseline_commit, tasks checked, record filled, review findings, status → done)

**Patched during code review (2026-06-13):**
- `src/config/run-config.ts` — cycle-safe `deepFreeze` (freeze parent before descending)
- `src/config/run-config.test.ts` — added self-referential-graph regression test
- `src/config/resolve-run-config.ts` — drop shared `FREE_ENTITLEMENT` constant; build the Free default fresh per call
- `docs/implementation-artifacts/deferred-work.md` — 6 deferred review items appended

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 1.2 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 1.2 implemented (TDD): two-phase resolver (`run-config`, `sources`, `resolver`, `capability`, `env`, `gaps`, `resolve-run-config`) + `shared/errors` seam, 8 co-located suites (57 tests). Added `"types": ["node"]` to tsconfig. typecheck/lint/test/build green. Status → review. |
| 2026-06-13 | Code review (3 layers). All 3 ACs confirmed met by the spec-aware auditor. Decision item resolved **(a) keep-as-is** (resolver enforces provider for `aiMode: auto`). Applied 3 patches: cycle-safe `deepFreeze` (+ regression test), per-call Free entitlement (drop shared frozen constant), corrected env-isolation Completion Note. 6 items deferred to `deferred-work.md`, 8 dismissed. Suite green (58 tests). Status → done. |
