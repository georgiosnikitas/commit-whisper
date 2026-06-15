---
baseline_commit: 633dc8af64f01535bc81fdea57bf3980b11811ff
---

# Story 1.3: Error model, exit codes, and stream discipline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a typed error hierarchy mapped to machine-readable exit codes and disciplined output streams,
so that every failure is scriptable and machine data never mixes with human chrome.

## Acceptance Criteria

1. **(AC1 — Typed error hierarchy → exit codes)** Given any failure in the pipeline, when it propagates to the CLI shell, then it is a `CommitWhisperError` subclass carrying an `exitCode` (0 success · 1 internal · 2 usage/validation · 3 missing input · 4 git/retrieve · 5 metrics · 6 narration/LLM · 7 render · 8 license · 9 completed-degraded) and a stable machine `code`, **and** the process exits with that code, emitting the human message to stderr, **and** code `9` (analysis rendered, narrative unavailable) is the one code NOT thrown as an error — the CLI shell sets it when the substrate render completes after a narration failure; codes 1–8 mean no output, 0 and 9 mean output produced.

2. **(AC2 — Stream discipline)** Given a run that produces machine output, when output is written, then stdout carries only machine data and stderr carries all human chrome (via a single `ui` module).

3. **(AC3 — Secret redaction)** A secret wrapped in `Secret<string>` redacts to `***` in any `toString`/`toJSON`.

## Tasks / Subtasks

- [x] **Task 1 — Canonical exit-code enum (`src/cli/exit-codes.ts`) (AC: 1)**
  - [x] Define `ExitCode` as a frozen `const` object mapping the C4 names to their numbers: `Success: 0, Internal: 1, Usage: 2, MissingInput: 3, Retrieve: 4, Metrics: 5, Narration: 6, Render: 7, License: 8, Degraded: 9`, plus `export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]`. Named exports only (P2).
  - [x] Implement `exitCodeForError(err: unknown): number` — `err instanceof CommitWhisperError` ⇒ `err.exitCode`; any other throwable ⇒ `ExitCode.Internal` (1). This is the shell's "unknown failure = internal error" mapping. (`cli/` may import `shared/` — correct layering direction.)
  - [x] Implement `messageForError(err: unknown): string` — `CommitWhisperError` ⇒ `err.message`; otherwise a generic `"An unexpected internal error occurred."` (never leak a raw stack/`Error.message` from an unknown throwable to the user surface).
  - [x] Co-locate `exit-codes.test.ts`: `ExitCode` has all 10 members with the exact numbers; `exitCodeForError` maps each `CommitWhisperError` subclass to its code and any non-error (string, plain `Error`, `undefined`) to `1`; `messageForError` returns the typed message for `CommitWhisperError` and the generic message otherwise; **a consistency check** asserts every stage error subclass's `.exitCode` equals the matching `ExitCode` member (guards the literal-vs-enum duplication — see Dev Notes "Exit-code single source").
- [x] **Task 2 — Expand the typed error hierarchy (`src/shared/errors.ts`) (AC: 1)**
  - [x] Keep the existing `CommitWhisperError` base (`message`, `readonly code`, `readonly exitCode`, `name = new.target.name`, `Error.captureStackTrace` guard) and the existing `MissingRequiredConfigError` (exit 3, `code "CONFIG_REQUIRED_MISSING"`) **unchanged** — Story 1.2 depends on them.
  - [x] Add one stage subclass per remaining failure code, each carrying its numeric `exitCode` literal + a stable `code` string and a single `message` constructor arg: `InternalError` (1, `"INTERNAL"`), `UsageError` (2, `"USAGE"`), `RetrieveError` (4, `"RETRIEVE"`), `MetricsError` (5, `"METRICS"`), `NarrationError` (6, `"NARRATION"`), `RenderError` (7, `"RENDER"`), `LicenseError` (8, `"LICENSE"`). Named exports only (P2). **No `console`** (`shared/**` is lint-blocked).
  - [x] Do NOT create an error class for codes `0` (success) or `9` (degraded) — they are terminal **states the CLI shell sets**, never thrown (AC1). Document this in the file header.
  - [x] Keep the header seam note accurate: this file is now the full hierarchy (1.3); `Secret<string>` lives in `shared/secret.ts`, the enum in `cli/exit-codes.ts`.
  - [x] Extend `errors.test.ts`: each new subclass is `instanceof Error` + `instanceof CommitWhisperError`, carries the right `exitCode` + `code` + `name`, and preserves its `message`. (Leave the existing 1.2 cases intact.)
- [x] **Task 3 — Single human-output module (`src/shared/ui.ts`) (AC: 2)**
  - [x] Implement the `ui` module that writes **all human chrome to stderr** — **never stdout** (stdout is reserved for machine data, written by the renderers in later stories). Because `src/shared/**` is under the `no-console` ESLint rule, write via `process.stderr.write`, **not** `console.*` (this resolves the 1.1 deferred-work note about `ui.ts` colliding with `no-console`).
  - [x] Provide a small, testable surface: `createUi(stream: NodeJS.WritableStream = process.stderr)` returning `{ error, warn, info, plain }`, each appending a trailing newline; plus a default `export const ui = createUi()`. Injecting the stream is what makes it unit-testable (capture writes to a fake stream).
  - [x] Keep it minimal — **no color/`NO_COLOR`/`FORCE_COLOR`, no spinner, no prompts** (those are Epic 6 and a later `ui` expansion; leave a header note). Color policy and the picocolors integration are explicitly out of scope here.
  - [x] Co-locate `ui.test.ts`: each method writes its message + newline to the injected stream; nothing is written to stdout (assert via a fake stream, not the real `process.stdout`); `error`/`warn`/`info`/`plain` are distinguishable if a prefix/level is applied (if no prefix is used, assert the raw message round-trips).
- [x] **Task 4 — `Secret<string>` redaction primitive (`src/shared/secret.ts`) (AC: 3)**
  - [x] Implement `class Secret<T = string>` wrapping a value in a **true private field** (`#value`) so it never enumerates (spreading `{...secret}` yields `{}`) and cannot be read except via an explicit accessor.
  - [x] `reveal(): T` returns the underlying value — the single intended read path, called only at the point of use (e.g., handing the key to the LLM SDK in 1.6, or git auth in Epic 5).
  - [x] Redact in **every** stringification path: `toString()` ⇒ `"***"`, `toJSON()` ⇒ `"***"`, and `[Symbol.for("nodejs.util.inspect.custom")]()` ⇒ `"***"` (so `console.log(secret)` / `util.inspect` also redact — defense in depth, the whole point of the type). Named export only (P2).
  - [x] Add a `wrapSecret`/factory only if it reads cleanly; otherwise the class constructor is the API. Keep it lean. — **class constructor is the API (no factory needed)**
  - [x] Co-locate `secret.test.ts`: `String(s)` / `` `${s}` `` / `s.toString()` ⇒ `"***"`; `JSON.stringify(s)` ⇒ `"\"***\""`; `JSON.stringify({ k: s })` ⇒ `{"k":"***"}`; `util.inspect(s)` ⇒ contains `"***"` and **never** the real value; `s.reveal()` returns the original; spreading/`Object.keys` never exposes the value.
- [x] **Task 5 — Verify gates (AC: 1, 2, 3)**
  - [x] `npm run typecheck` clean (strict).
  - [x] `npm run lint` clean — confirm `shared/ui.ts` passes `no-console` (uses `process.stderr.write`), and named-exports-only holds across all new files.
  - [x] `npm test` green (all new + existing co-located suites; the 1.2 `errors.test.ts` cases still pass).
  - [x] `npm run build` clean (tsup).

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The spec-aware **Acceptance Auditor verified all 3 ACs met** (AC2/AC3 fully; AC1's mapping foundation fully, with its exit/stderr *execution* clause an architecture-sanctioned deferral to Story 1.8) — suite green, `shared/` imports no `cli/`. Triage: **3 patch · 4 defer · 11 dismissed · 0 decision-needed.**

**Patch:** _(all 3 applied & verified 2026-06-13 — suite green, 89 tests)_

- [x] [Review][Patch] De-duplicate the generic internal-error message (`"An unexpected internal error occurred."` is hardcoded in both `InternalError`'s default and `messageForError`) via one shared constant, and harden `messageForError` so an empty `CommitWhisperError.message` still yields a non-blank line [src/shared/errors.ts, src/cli/exit-codes.ts] — **Fixed:** exported `GENERIC_INTERNAL_MESSAGE` from `errors.ts`, reused in `InternalError` + `messageForError`; `messageForError` now falls back to it when a typed error's message is blank/whitespace (regression test added).
- [x] [Review][Patch] Remove the now-redundant `src/cli/.gitkeep` — `cli/` has a real module (`exit-codes.ts`) [src/cli/.gitkeep] — **Fixed:** removed (`git rm`).
- [x] [Review][Patch] Correct the Completion Note: AC1's "process exits with that code, emitting to stderr" *execution* is wired in Story 1.8 — this slice ships and unit-tests the pure pieces (`exitCodeForError`/`messageForError`/`ui.error`) that 1.8 composes [docs/implementation-artifacts/1-3-error-model-exit-codes-and-stream-discipline.md] — **Fixed:** Completion Note now states AC1 is met *as decomposed*, attributing the `process.exit`/stderr execution to Story 1.8.

**Defer (tracked in deferred-work.md, not actioned now):**

- [x] [Review][Defer] Error `cause` chaining — add an optional `{ cause }` to the `CommitWhisperError` constructor and thread it through the subclasses [src/shared/errors.ts] — deferred: add when the first wrapping call site lands (Story 1.4 wrapping git/spawn errors) so the API is use-driven, not speculative.
- [x] [Review][Defer] `ui` stream robustness — handle `write()` backpressure (`false` return / `drain`), a synchronous throw, and async `EPIPE` (`| head` closing the consumer) so the CLI never crashes mid-output [src/shared/ui.ts] — deferred: belongs to the `ui` expansion + the Story 1.8 process shell where stream lifecycle lives; the minimal injected-stream writer is correct for this slice.
- [x] [Review][Defer] Tighten error typing — constrain `CommitWhisperError.code` to a string union and return `ExitCode` (not bare `number`) from `exitCodeForError`, optionally range-validating `exitCode ∈ 1..8` for thrown errors [src/shared/errors.ts, src/cli/exit-codes.ts] — deferred: type-strictness pass; the literal-vs-enum drift (the real risk) is already guarded by `exit-codes.test.ts`. The `: number` return is currently spec-exact (subclasses can't import the `cli/` enum type).
- [x] [Review][Defer] Sanitize control / ANSI characters in error + `ui` messages before writing to stderr (terminal-escape-injection hardening for any message that ever carries external content, e.g. a repo path) [src/shared/ui.ts, src/shared/errors.ts] — deferred: do at the `ui` boundary when color/formatting lands (Epic 6).

**Dismissed (11):** `ui` severity levels share one writer / "non-functional" (by design — Task 3 permits identical methods as forward seams; test asserts the round-trip); `Secret.toJSON ⇒ "***"` "corrupts" a request body (that **is** the point — `reveal()` at the point of use, never `JSON.stringify` the wrapper); missing `Degraded`(9) error class (by design — 9 is shell-set, never thrown, per AC1); exit-code literals "duplicate" the enum (documented layering decision — `shared/` can't import `cli/` — guarded by the consistency test); `Secret` mutable-aliasing / no defensive copy (strings are the real payload, immutable); `new.target.name` under minification (tsup build is not minified; consistent with the accepted 1.1/1.2 pattern); `ui` singleton eager `process.stderr` bind (`createUi(stream)` injects for tests; the production default is correct); `instanceof` across realms / duplicate module copies (single tsup/SEA bundle = one class identity; not applicable to this distribution model); `ui` `Symbol`/`null`-stderr (TS types forbid a non-string message; detached-stdio null stderr is negligible); `Secret(null/undefined)` or double-wrap (env reads are validated upstream; negligible); secrets "leaking" through error messages (the `Secret` type already redacts on interpolation — leakage requires deliberately calling `reveal()` into a message, a usage-discipline matter, not a code defect here).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope (the error/exit/stream/secret foundation the whole pipeline depends on):**
- The canonical **exit-code enum** + the pure **error→exit-code** and **error→message** resolvers (`cli/exit-codes.ts`).
- The **full typed error hierarchy** — one `CommitWhisperError` subclass per failure code 1–8 (`shared/errors.ts`, expanding the 1.2 seam).
- The single **`ui` module** writing human chrome to stderr (`shared/ui.ts`).
- The **`Secret<string>`** redaction primitive (`shared/secret.ts`).

**Out of scope / deferred (do NOT build here):**
- **The CLI shell that actually calls `process.exit()`** — wiring the top-level `try/catch` that invokes `exitCodeForError` + `ui.error` + `process.exit`, and the clean-`0`/degraded-`9` mapping, lives in `cli/run.ts` + `src/index.ts` (Story 1.8, the end-to-end run). This story builds and unit-tests the **pure mapping pieces**; it does not call `process.exit` or wire `index.ts`. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- **Exit code 9 (degraded) logic** — the substrate-render-after-narration-failure path needs `narrate/` (1.6) and `render/` (1.8). Here, `9` is only a named enum member; no code sets it yet. [Source: docs/planning-artifacts/architecture.md#C4 — Error & Exit-Code Model]
- **Wiring `Secret<string>` into `RunConfig`** — adding the `gitPat`/`aiKey` fields is Story 1.6 (`aiKey`) and Epic 5 (`gitPat`). This story builds the `Secret` primitive **standalone**; it does not touch `config/run-config.ts`. [Source: docs/planning-artifacts/architecture.md#Secrets]
- **The `--format json` structured error object** (errors emitted as JSON on stdout) — belongs with the JSON renderer (Story 1.7 / Epic 4). The typed errors here carry the `code`/`exitCode` that object will serialize later. [Source: docs/planning-artifacts/architecture.md#Exit-Code Enum (FR-15)]
- **Color / `NO_COLOR` / `FORCE_COLOR` / spinner / prompts** in `ui` — Epic 6. `ui` here is a minimal stderr writer. [Source: docs/planning-artifacts/architecture.md#Behavior Modifiers (chrome, not results)]
- **`config/env.ts` reading secret env vars into `Secret`** — Story 1.6 (`aiKey`) / Epic 5 (`gitPat`). The 1.2 `env.ts` already marks that extension point. [Source: docs/implementation-artifacts/1-2-two-phase-configuration-resolver-and-frozen-runconfig.md#Dev Notes]

### The Exit-Code Enum (C4 — copy the numbers exactly)

| Code | Name | Meaning | Thrown? |
|---|---|---|---|
| 0 | `Success` | Full showpiece **or** intentional metrics-only (`aiMode: off`) | no — clean completion |
| 1 | `Internal` | Unexpected / internal error (also the fallback for any non-`CommitWhisperError` throwable) | `InternalError` |
| 2 | `Usage` | Usage / validation error (bad flags) | `UsageError` |
| 3 | `MissingInput` | Required input missing (non-interactive) | `MissingRequiredConfigError` (from 1.2) |
| 4 | `Retrieve` | Retrieve / git failure | `RetrieveError` |
| 5 | `Metrics` | Metrics-engine failure | `MetricsError` |
| 6 | `Narration` | Narration / LLM failure — **only when `aiMode: required`** | `NarrationError` |
| 7 | `Render` | Render failure | `RenderError` |
| 8 | `License` | License-gate failure | `LicenseError` |
| 9 | `Degraded` | Completed with degraded output (substrate rendered, narrative unavailable, fail-open) | **no — the shell sets it** |

- **Codes 1–8 = "no intended output produced"** and localize the failing stage. **0 and 9 = "output produced"** (0 clean, 9 degraded). [Source: docs/planning-artifacts/architecture.md#Exit-Code Enum (FR-15)]
- **9 is not a thrown `CommitWhisperError`** — it is a degraded-success signal the CLI shell sets when the render path completes on the substrate after a narration loss in `auto` mode. **6 vs 9 are mutually exclusive by `aiMode`** (6 only in `required`). Don't model 9 as an error class. [Source: docs/planning-artifacts/architecture.md#C4 — Error & Exit-Code Model]

### Exit-code single source (layering decision to confirm at review)

The error subclasses live in `src/shared/` (the foundation layer) and the `ExitCode` enum lives in `src/cli/` (a higher layer). To respect the hexagonal layering (**`shared/` must not import `cli/`**), the error subclasses carry their exit-code as a **numeric literal** (exactly as the 1.2 `MissingRequiredConfigError` already hardcodes `3`), and `cli/exit-codes.ts` owns the named enum. To prevent the literal-vs-enum pair from drifting, **`exit-codes.test.ts` asserts each stage error's `.exitCode` equals the matching `ExitCode` member** (`cli/` may import `shared/`, so the test can see both). This is the deliberate, documented resolution of "where does the canonical number live." [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]

### Stream discipline (AC2)

- **stdout = machine data only; stderr = all human chrome** (menu, spinner, prompts, update notices, error messages). This keeps `commit-whisper --format json > report.json` clean under every condition. `ui` is the single stderr writer; renderers write machine data to stdout later. [Source: docs/planning-artifacts/architecture.md#Stream Discipline]
- **`ui.ts` must avoid `console`** — `src/shared/**` is under `no-console: error` (proven build-failing in 1.1). Use `process.stderr.write`. (`process.stderr` is **not** `process.env`, so the env-isolation rule does not apply; `shared/` may use `process.stderr`.) [Source: eslint.config.js] [Source: docs/implementation-artifacts/deferred-work.md]

### `Secret<string>` (AC3)

- Wraps a secret so it **redacts to `***`** in `toString` / `toJSON`, and is **never** written to Report JSON, logs, or any output. Use a true private field (`#value`) so it does not enumerate and cannot leak via spread/`Object.keys`/`JSON.stringify` (which calls `toJSON`). Add the `nodejs.util.inspect.custom` symbol so `console.log`/`util.inspect` also redact. The only read path is an explicit `reveal()`. [Source: docs/planning-artifacts/architecture.md#Secrets]
- Secrets are **env-only** and bypass the config-file/flag/prompt layers entirely (the 1.2 resolver already excludes them). This story builds the primitive; wiring is later. [Source: docs/planning-artifacts/architecture.md#Secrets]

### Implementation patterns this story must follow (P-rules — lint-enforced)

- **P2 · Modules & files:** `kebab-case.ts`; **named exports only** (no `export default`). Shared primitives (`errors.ts`, `ui.ts`, `secret.ts`) under `src/shared/`; the exit-code enum under `src/cli/`. [Source: docs/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- **P5 · Streams & logging:** **no `console`** in `src/shared/**` (and the pipeline) — `ui.ts` uses `process.stderr.write`; throw typed errors, never log. `cli/` is exempt from `no-console`, but `exit-codes.ts` is pure mapping and needs none. [Source: docs/planning-artifacts/architecture.md#Stream Discipline]
- **P3 · Source layout:** unit tests **co-located** as `*.test.ts`. [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#Testing standards]
- **Layering:** `cli/` may import `shared/`; **`shared/` must never import `cli/`.** [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]

### Previous story intelligence (1.1 scaffold, 1.2 resolver)

- **`shared/errors.ts` already exists** (created in 1.2) with `CommitWhisperError` + `MissingRequiredConfigError` and a header note that says "Story 1.3 expands this into the full hierarchy." This story fulfills that — **expand, don't rewrite**; keep both existing classes and the 1.2 tests passing. [Source: src/shared/errors.ts]
- **Toolchain locked:** TypeScript `6.0.3` strict, `nodenext`, `es2023`, ESM; vitest `4.1.8`; tsup `8.5.1`. `tsconfig` now has `"types": ["node"]` (added in 1.2) so `process` / `NodeJS.*` resolve. No new deps for this story. [Source: docs/implementation-artifacts/1-2-two-phase-configuration-resolver-and-frozen-runconfig.md#Completion Notes List]
- **ESLint guardrails are live and fail the build:** named-exports-only, `no-console` in `shared/**` + pipeline + `src/index.ts`, `process.env` only in `config/`. Write to satisfy them from the first pass. [Source: eslint.config.js]
- **ESM imports use `.js` specifiers in source** (e.g. `import { CommitWhisperError } from "./errors.js"`); mirror the 1.2 convention. `import type` for type-only imports (`isolatedModules`). [Source: src/config/resolver.ts]
- **`#private` fields** compile cleanly under es2023 / esbuild (tsup) — safe for `Secret`. [Source: docs/planning-artifacts/architecture.md#tsconfig]
- **`src/cli/` currently holds only `.gitkeep`** — this story adds the first real `cli/` module (`exit-codes.ts`). Leave or remove the `.gitkeep` once a real file exists. [Source: docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md#File List]

### Testing standards

- vitest 4.1.8, TS-native, **co-located** `*.test.ts`. Prefer table-driven tests for the error→exit mapping.
- **Stream tests inject a fake `WritableStream`** (capture `write` calls) — never assert against the real `process.stdout`/`process.stderr`. Assert nothing lands on stdout.
- **Secret tests must prove non-leakage** across `toString`, template interpolation, `JSON.stringify` (direct and nested), and `util.inspect` — and that `reveal()` still returns the original.
- DoD: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.

### Project Structure Notes

- New files land where the architecture's directory map places them: `src/cli/exit-codes.ts`, `src/shared/{ui,secret}.ts`, and the expanded `src/shared/errors.ts`, each with a co-located `*.test.ts`. No deviation. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- `cli/run.ts` (the shell that calls `process.exit`) is **intentionally not created here** — Story 1.8. Its absence does not break this slice; 1.3 ships the pure pieces 1.8 will wire. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.3: Error model, exit codes, and stream discipline]
- [Source: docs/planning-artifacts/architecture.md#Exit-Code Enum (FR-15)]
- [Source: docs/planning-artifacts/architecture.md#C4 — Error & Exit-Code Model]
- [Source: docs/planning-artifacts/architecture.md#Stream Discipline]
- [Source: docs/planning-artifacts/architecture.md#Secrets]
- [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-15: Headless / CI execution]
- [Source: src/shared/errors.ts]
- [Source: docs/implementation-artifacts/1-2-two-phase-configuration-resolver-and-frozen-runconfig.md#Dev Notes]
- [Source: docs/implementation-artifacts/deferred-work.md]
- [Source: eslint.config.js]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm run typecheck` → `tsc --noEmit` clean (strict; `#private` field in `Secret`, the `as const` `ExitCode` object, and `NodeJS.WritableStream` all resolve under the 1.2-added `"types": ["node"]`).
- `npm run lint` → ESLint clean (exit 0). `shared/ui.ts` uses `process.stderr.write` (not `console`), satisfying the `no-console` rule on `src/shared/**`; named-exports-only holds across all new files.
- `npm test` → vitest: **12 files / 88 tests passed** (was 9/58; +3 files, +30 tests).
- `npm run build` → tsup ESM build success.

### Completion Notes List

- **All 3 ACs satisfied (AC1 as decomposed).** AC1: full `CommitWhisperError` hierarchy (one subclass per failure code 1–8) + the canonical `ExitCode` enum (0–9) + pure `exitCodeForError`/`messageForError` resolvers (a non-`CommitWhisperError` throwable → exit 1, generic message). **The literal AC1 clause "the process exits with that code, emitting the human message to stderr" is the *execution* step wired in Story 1.8** (`cli/run.ts` + `src/index.ts`, where `catch (e) → ui.error(messageForError(e)) → process.exit(exitCodeForError(e))` composes the three pure pieces this story ships and unit-tests); 1.3 provides and proves the mapping foundation, not the `process.exit` call site. AC2: the single `ui` module writes all human chrome to **stderr** via `process.stderr.write`, never stdout (test spies on `process.stdout.write` to prove zero writes). AC3: `Secret<T>` redacts to `***` in `toString`/`toJSON`/`util.inspect` and holds its value in a true `#private` field so spread/`Object.keys`/`JSON.stringify` cannot leak it; `reveal()` is the lone read path.
- **Expanded, did not rewrite, `shared/errors.ts`** — the 1.2 `CommitWhisperError` base and `MissingRequiredConfigError` (exit 3) are untouched and their tests still pass; the file header was updated from "seam" to "full hierarchy."
- **Layering decision (review-relevant):** the `ExitCode` enum lives in `cli/exit-codes.ts` (per the architecture map) while the error subclasses in `shared/` carry their exit-code as a **numeric literal** — because `shared/` must not import `cli/`. To stop the literal/enum pair from drifting, `cli/exit-codes.test.ts` cross-checks every stage error's `.exitCode` against the matching `ExitCode` member (`cli/` may import `shared/`). Documented in Dev Notes "Exit-code single source."
- **`Secret` uses the `nodejs.util.inspect.custom` symbol** so `console.log(secret)` / `util.inspect` redact too — defense in depth beyond `toString`/`toJSON`. Verified the real value never appears in any inspect/JSON output by asserting `.not.toContain(RAW)`.
- **`ui` severity methods share one stderr writer today** (no color/level prefixes) — the four entry points (`error`/`warn`/`info`/`plain`) give callers stable, intention-revealing names that gain per-level formatting in Epic 6 without changing call sites. Color/`NO_COLOR`/spinner/prompts are explicitly deferred.
- **Scope deferrals honored:** no `process.exit()` call site / `cli/run.ts` / `index.ts` wiring (Story 1.8); no exit-9 degraded logic (needs narrate+render, 1.6/1.8); `Secret` built standalone — **not** wired into `RunConfig` (`aiKey` is 1.6, `gitPat` is Epic 5); no `--format json` structured error object (Epic 4). No new dependencies.
- **First real `src/cli/` module** (`exit-codes.ts`) — `cli/` is exempt from the `no-console` rule, but the module is pure mapping and uses no I/O.
- **SonarQube advisory** (unchanged from 1.2): `type IsoDate = string` in `config/run-config.ts` is flagged redundant; it is the architecture's contract type and is intentionally kept. No new advisories from this slice; tsc/eslint/vitest/tsup all green.

### File List

**Added (source):**
- `src/cli/exit-codes.ts` — `ExitCode` enum (0–9) + `exitCodeForError` / `messageForError` resolvers
- `src/shared/secret.ts` — `Secret<T>` redaction primitive
- `src/shared/ui.ts` — `createUi` + default `ui` (single stderr human-output module)

**Added (tests, co-located):**
- `src/cli/exit-codes.test.ts`, `src/shared/secret.test.ts`, `src/shared/ui.test.ts`

**Modified (source):**
- `src/shared/errors.ts` — expanded into the full hierarchy (`InternalError`/`UsageError`/`RetrieveError`/`MetricsError`/`NarrationError`/`RenderError`/`LicenseError`); header updated; 1.2 classes unchanged
- `src/shared/errors.test.ts` — added table-driven coverage for the new stage subclasses

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 1-3 → in-progress → review → done
- `docs/implementation-artifacts/1-3-error-model-exit-codes-and-stream-discipline.md` — this story (baseline_commit, tasks checked, record filled, review findings, status → done)

**Patched during code review (2026-06-13):**
- `src/shared/errors.ts` — extracted `GENERIC_INTERNAL_MESSAGE` shared constant (used by `InternalError` + `messageForError`)
- `src/cli/exit-codes.ts` — `messageForError` reuses the constant + falls back when a typed error's message is blank
- `src/cli/exit-codes.test.ts` — added the blank-message fallback regression test
- `src/cli/.gitkeep` — removed (redundant now that `cli/` has a real module)
- `docs/implementation-artifacts/deferred-work.md` — 4 deferred review items appended

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 1.3 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 1.3 implemented (TDD): full `CommitWhisperError` hierarchy + `cli/exit-codes.ts` enum/resolvers + `shared/ui.ts` (stderr) + `shared/secret.ts` (`Secret<T>` redaction). 3 new suites + extended `errors.test.ts`; 12 files / 88 tests green; typecheck/lint/build clean. Status → review. |
| 2026-06-13 | Code review (3 layers). All 3 ACs confirmed met by the spec-aware auditor (AC1 as decomposed — exit/stderr execution is Story 1.8). Applied 3 patches: shared `GENERIC_INTERNAL_MESSAGE` + blank-message fallback (regression test), removed redundant `cli/.gitkeep`, corrected the AC1 Completion Note. 4 items deferred, 11 dismissed. Suite green (89 tests). Status → done. |
