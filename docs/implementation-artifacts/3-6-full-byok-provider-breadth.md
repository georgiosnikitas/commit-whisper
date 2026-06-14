---
epic: 3
story: 6
title: Full BYOK provider breadth
baseline_commit: 7e282ef
---

# Story 3.6: Full BYOK provider breadth

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to choose among all supported providers,
so that I can bring my own key and endpoint.

## Acceptance Criteria

1. **Narration works against each provider in the closed enum via the unified client (AC1).** **Given** the provider enum `{ollama, openai, gemini, anthropic, openai-compatible}` and a configured provider + model, **when** the model is resolved, **then** `resolveModel` returns a working `LanguageModel` for **each** provider through the Vercel AI SDK (`@ai-sdk/google` for `gemini`, `@ai-sdk/openai` for `openai`, `@ai-sdk/anthropic` for `anthropic`, `@ai-sdk/openai-compatible` for both `openai-compatible` and `ollama`), so the single `generateObject`/`generateText` interface drives all of them; a missing **model** is a typed `NarrationError` (exit 6) for any provider.

2. **Base URL required for `ollama` + `openai-compatible`, optional for hosted (AC2).** **Given** a provider, **when** the model is resolved, **then** a **base URL** is **required** for `ollama` (defaulting to `http://localhost:11434`, the local endpoint) and for `openai-compatible` (no default — a missing base URL is a typed `NarrationError` naming `COMMIT_SAGE_LLM_BASE_URL`), and **optional** for the hosted providers (`openai`/`anthropic`/`gemini`, which default to the vendor endpoint); `ollama` targets the OpenAI-compatible `{baseUrl}/v1` surface and needs **no key**.

3. **API key from the provider's native env var only — never flag/config/prompt (AC3).** **Given** a provider that needs a key, **when** the key is read, **then** it comes **only** from that provider's **native** environment variable — `OPENAI_API_KEY` (`openai`), `ANTHROPIC_API_KEY` (`anthropic`), `GOOGLE_GENERATIVE_AI_API_KEY` (+ `GEMINI_API_KEY` alias, `gemini`), and `OPENAI_API_KEY` (optional, `openai-compatible`) — wrapped in `Secret`, env-only (it bypasses the config/flag/prompt merge); `ollama` needs none; a key-requiring provider with no key is a typed `NarrationError` (exit 6) naming the exact variable; the key is `reveal()`ed only at client construction (never a prompt, log, URL, or serialized output).

## Tasks / Subtasks

- [ ] **Task 1 — The unified provider factory (AC1, AC2, AC3) [src/narrate/provider.ts].** Replace the gemini-only `resolveModel` with a closed switch over all five providers, each returning a `LanguageModel`:
  - [ ] **`gemini`** (unchanged): `createGoogleGenerativeAI({ apiKey })(llmModel)` — key required (`reveal()` at construction).
  - [ ] **`openai`**: `createOpenAI({ apiKey, baseURL? })(llmModel)` — key required; base URL optional (vendor default).
  - [ ] **`anthropic`**: `createAnthropic({ apiKey, baseURL? })(llmModel)` — key required; base URL optional.
  - [ ] **`openai-compatible`**: `createOpenAICompatible({ baseURL, name: "openai-compatible", apiKey? })(llmModel)` — **base URL required** (throw `NarrationError` naming `COMMIT_SAGE_LLM_BASE_URL` if absent); key **optional** (a custom endpoint may need none).
  - [ ] **`ollama`**: `createOpenAICompatible({ baseURL: `${baseUrl}/v1`, name: "ollama" })(llmModel)` — base URL defaults to `http://localhost:11434`; **no key**.
  - [ ] **Shared validation:** `llmModel` required for **every** provider (typed `NarrationError`); a key-requiring provider with `aiKey === undefined` → `NarrationError` naming the provider's env var. A closed `switch` with an exhaustive `assertNever` default (a new enum value becomes a compile error). Normalize a trailing slash on the base URL (reuse the 1.6 ollama-baseurl trim).
  - [ ] Factor small helpers: `requireKey(config, envVarName)`, `requireModel(config)`, `requireBaseUrl(config)` / `ollamaBaseUrl(config)` — each throwing a precise `NarrationError`.

- [ ] **Task 2 — Native per-provider key reading (AC3) [src/config/env.ts].** Extend `readAiKey(env, provider)` to the full enum:
  - [ ] `openai` → `OPENAI_API_KEY`; `anthropic` → `ANTHROPIC_API_KEY`; `gemini` → `GOOGLE_GENERATIVE_AI_API_KEY` ?? `GEMINI_API_KEY` (unchanged); `openai-compatible` → `OPENAI_API_KEY` (the OpenAI-native var, **optional**); `ollama` → `undefined` (no key). Each wrapped in `Secret`, returning `undefined` when unset. Keep it the **only** reader of `process.env` (hexagonal boundary); the key never flows through the config/flag/prompt merge.

- [ ] **Task 3 — Reachability preflight for every provider (AC1) [src/narrate/preflight.ts].** Extend the `aiMode`-gated preflight so `auto`/`required` mode works for all providers (today non-gemini/ollama returns a "Story 3.6" not-configured reason):
  - [ ] **`openai`**: `GET {baseUrl ?? https://api.openai.com/v1}/models` with `Authorization: Bearer {key}` (key in the **header**, never the URL); 401/403 ⇒ auth-failed reason.
  - [ ] **`anthropic`**: `GET {baseUrl ?? https://api.anthropic.com/v1}/models` with `x-api-key: {key}` + `anthropic-version: 2023-06-01`; 401/403 ⇒ auth-failed.
  - [ ] **`openai-compatible`**: `GET {baseUrl}/models` with an **optional** `Authorization: Bearer {key}` (only when a key is set); base URL required (its absence is a clear not-reachable reason).
  - [ ] **`ollama`** / **`gemini`**: unchanged. Reuse `reachFailureReason` (scrubs the secret from any error text) and `AbortSignal.timeout(timeoutMs)`. A closed switch with an exhaustive default.

- [ ] **Task 4 — Tests (AC1, AC2, AC3).**
  - [ ] **`provider.test.ts`:** for **each** provider, `resolveModel` returns a defined `LanguageModel` with a valid config and **no network call** (openai/anthropic/openai-compatible with a key + base URL where needed; ollama with no key; gemini unchanged). Errors: missing model → `NarrationError` (exit 6) for each provider; missing key → `NarrationError` naming `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` for openai/anthropic/gemini; `openai-compatible` with **no base URL** → `NarrationError` naming `COMMIT_SAGE_LLM_BASE_URL`; `openai-compatible` with a base URL and **no key** → resolves (key optional); `ollama` with no key + default base URL → resolves. (Replaces the old "throws … Story 3.6 for openai" test.)
  - [ ] **`env.test.ts`:** `readAiKey` returns the right `Secret` for each native var (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`; gemini native + alias unchanged; `openai-compatible` ⇒ `OPENAI_API_KEY`; `ollama` ⇒ `undefined`); a key-requiring provider with the var unset ⇒ `undefined`; the secret is wrapped (not the raw string).
  - [ ] **`preflight.test.ts`:** with an injected `fetchImpl`, each provider hits the **right URL + headers** (key in header, never URL) and maps `ok`→reachable, `401/403`→auth-failed, other status→HTTP reason, network throw→unreachable (secret scrubbed); `openai-compatible` with no base URL ⇒ not-reachable; the optional-key path (openai-compatible, no key) omits the auth header. (Replaces the "single-provider slice; full breadth is Story 3.6" assertion.)
  - [ ] Confirm `narrate.test.ts` / `run.test.ts` / `cli.e2e.test.ts` stay green — they inject fakes and never resolve a real provider; the resolver/preflight breadth is unit-tested directly.

## Dev Notes

### Review Findings

**Code review — 2026-06-14** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). **The spec-aware Acceptance Auditor cleared all 3 ACs MET (0 patches, 0 consider)** — verifying the full provider→package mapping matches the architecture, the env-only key discipline (AC3 "particularly well-executed" — `readAiKey` the sole reader, never merged/flagged/prompted, `Secret`-wrapped, `reveal()` only at construction), the exhaustive `assertNever` switch, and **no scope creep** (Epic 6 onboarding + Epic 5 gitPat correctly deferred). The Blind Hunter found 1 real test-quality patch. The Edge Case Hunter found a coherent **base-URL robustness** class. Triage: **2 patch (base-URL cluster + dropped assertion) · 4 actioned tests · ~3 dismissed.**

**Patch:**

- [x] [Review][Patch] **Blank/empty base URL + `/v1` doubling** (Edge Case Hunter, 6 findings → one class) — a `llmBaseUrl` of `""`/`"   "` slipped past both `?? default` (empty string is not nullish) and the `=== undefined` presence check, producing a **relative-URL fetch / a broken openai-compatible client**; and an ollama base URL already ending in `/v1` produced a double `/v1/v1` (a 404 at generation) [src/narrate/provider.ts, src/narrate/preflight.ts] — **Fixed:** a shared `cleanBaseUrl` (trim whitespace + trailing slashes, **map blank → `undefined`**) is now used everywhere a base URL is read, so a blank value is uniformly treated as "unset" (vendor default for hosted; the `COMMIT_SAGE_LLM_BASE_URL` error for openai-compatible; the local default for ollama); the ollama `/v1` suffix is **idempotent** (`.replace(/(\/v1)+$/, "/v1")`). Added 4 tests (blank base URL → unset for openai-compatible resolve + preflight; blank → vendor default for openai preflight; idempotent ollama `/v1`).
- [x] [Review][Patch] The refactor of the missing-key test into a provider loop **dropped the `exitCode === 6` assertion** [src/narrate/provider.test.ts] — **Fixed:** restored `expect((e as NarrationError).exitCode).toBe(6)` in the loop (the missing-model loop already asserts it).

**Dismissed:**
- **Edge Case Hunter — scheme-less base URL** (`"localhost:11434"` with no `http://`) (Consider): URL *format* validation (`new URL()`) is a config-layer/Zod requiredness concern (the same deferred validation story as ISO dates / `gaps.ts`), not the narrate-resolver's job; 3.6 normalizes presence, not format.
- **Blind Hunter — anthropic-version header only in preflight, not the SDK call** (Consider): `@ai-sdk/anthropic` injects its own `anthropic-version` on generation; the preflight header is for the *probe's* own raw `fetch`. No divergence in practice.
- **Blind Hunter — `classifyModelsResponse(res, "Provider")` generic label** (Nit): the reason text is user-facing chrome; a generic "Provider responded with HTTP …" is fine and avoids leaking which provider via the message. Low value.

### Architecture decision — one SDK, a closed provider switch, base-url + native-key rules (read first)

The authoritative design names the exact client + packages: **"Client: Vercel AI SDK `ai` 6.0.203 — a single `generateObject`/`generateText` interface across all required providers via `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`, and an Ollama provider. One error model … the `provider` enum value `gemini` maps to the `@ai-sdk/google` package."** [Source: architecture.md#Narration — Client]

- **The unified client = the AI SDK; `resolveModel` is the only provider-specific seam.** Generation (`generateNarrative`/`generateExplanations`, Stories 3.1–3.3), grounding (3.4), and confidence (3.5) are **provider-agnostic** — they drive a `LanguageModel`. 3.6 only widens `resolveModel` from one provider to the closed five, so the entire downstream pipeline works against each "via the unified client" (AC1) with **zero** change to generate/ground/confidence/assemble/render. [Source: src/narrate/provider.ts, generate.ts]
- **Ollama rides `@ai-sdk/openai-compatible`, not a bespoke package.** Ollama exposes an **OpenAI-compatible** API at `{baseUrl}/v1`, so `createOpenAICompatible({ baseURL: `${baseUrl}/v1`, name: "ollama" })` is the "Ollama provider" — no separate community `ollama-ai-provider` dependency, fewer moving parts, one error model. The **preflight** still probes Ollama's **native** `{baseUrl}/api/tags` (its liveness surface), so generation uses `/v1` while reachability uses `/api/tags` — both off the same `llmBaseUrl ?? http://localhost:11434`. [Source: architecture.md#Narration (Ollama provider), src/narrate/preflight.ts]
- **Base URL: required where there is no sensible default.** `ollama` is "required" but **defaulted** to `http://localhost:11434` (the local endpoint), so it is never actually missing; `openai-compatible` has **no default** — a missing base URL is a hard `NarrationError` naming `COMMIT_SAGE_LLM_BASE_URL` (AC2). The hosted providers (`openai`/`anthropic`/`gemini`) default to the vendor endpoint (base URL optional). [Source: architecture.md#Input Source Matrix (`llmBaseUrl`), epics.md#Story 3.6]
- **Key: native env var only, env-only, revealed once.** Each provider reads its **SDK-native** variable (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` + `GEMINI_API_KEY` alias); `openai-compatible` reuses `OPENAI_API_KEY` (optional); `ollama` needs none. The key is a `Secret`, read **only** in `config/env.ts` (the hexagonal boundary — it bypasses the config/flag/prompt merge entirely, AC3), and `reveal()`ed **only** at client construction in `provider.ts` (never a prompt, log, URL, or serialized output — the 1.6 discipline). [Source: architecture.md#Env-var resolution specifics, src/config/env.ts, src/shared/secret.ts]

### Scope discipline — what this story does and does NOT include

**In scope:** widening `resolveModel` to the closed five-provider switch (the unified client), the per-provider base-url rules (required+defaulted ollama / required openai-compatible / optional hosted), the native per-provider key reading in `readAiKey`, and the per-provider reachability preflight. The 3 new dependencies (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`, exact-pinned).

**Out of scope / deferred (do NOT build here):**
- **Interactive first-run guidance / no-AI interstitial / Status·doctor "set OPENAI_API_KEY" teaching** — **Epic 6** (interactive launchpad, UX-DR2b). 3.6 makes the providers *work* headlessly; the friendly first-run onboarding that *names the variable in a menu* is Epic 6. 3.6's `NarrationError` already names the exact var (the headless equivalent). [Source: epics.md#UX-DR2b, #Epic 6]
- **Rendering / Report-JSON changes** — none; provider breadth is purely the narrate-input seam. The narrative/confidence shape is unchanged (Stories 3.1–3.5). [Source: src/assemble/report-schema.ts]
- **`gitPat` / host token env reading** — **Epic 5** (retrieval auth); a different secret, a different reader path. 3.6 touches only the **LLM** key. [Source: src/config/env.ts comment]
- **Config-layer conditional-requiredness validation** (e.g. `gaps.ts` failing a run when `openai-compatible` has no base URL at *resolve* time) — 3.6 enforces the base-url/key rules at the **narrate boundary** (`resolveModel`/preflight), exactly as the gemini key-required check is enforced today; tightening the *config-resolution* requiredness is a separate validation concern (deferred to the Zod-config story / Epic 6). [Source: src/config/gaps.ts, 1.2 deferred validation]
- **Per-provider sampling nuances / model defaults** — generation params stay pinned (`temperature: 0`, Stories 1.6/3.x); a per-provider default model is not introduced (the user sets `llmModel`). [Source: src/narrate/generate.ts]
- **Removing the esbuild/tsup advisory** — the 2 high-severity `npm audit` findings are a **pre-existing** dev-server vulnerability in `esbuild` (transitive via the `tsup` devDependency, from Story 1.1), not introduced by the new runtime provider packages, and fixing requires a breaking `tsup` downgrade — out of scope for 3.6; flagged for a toolchain story. [Source: package.json devDependencies]

### The exact contracts to build on (do NOT redefine)

- **`resolveModel(config: NarrateConfig): LanguageModel` (1.6):** the seam. Today gemini-only; 3.6 makes it the closed five-provider switch. `NarrateConfig` already carries `provider?`, `llmModel?`, `llmBaseUrl?`, `aiKey?: Secret<string>`. [Source: src/narrate/provider.ts, narrate.port.ts]
- **`Provider = "ollama" | "openai" | "gemini" | "anthropic" | "openai-compatible"` (1.2):** the closed enum — the `switch` is exhaustive (`assertNever` default). [Source: src/config/run-config.ts]
- **`readAiKey(env, provider): Secret<string> | undefined` (1.6):** extend to all natives; stays the sole `process.env` reader for the key. The existing gemini native+alias branch is unchanged. [Source: src/config/env.ts]
- **`preflightProvider(config, deps): PreflightResult` (1.6):** the `aiMode`-gated probe. `fetchImpl` injectable (offline tests); the key travels in the **header**; `reachFailureReason` scrubs the secret. Extend the provider switch; keep gemini/ollama. [Source: src/narrate/preflight.ts]
- **`Secret<string>` (1.3):** `reveal()` only at construction; never logged/serialized. [Source: src/shared/secret.ts]
- **`NarrationError` (1.3):** `exitCode === 6`; the thrown message names the precise missing input (env var / `COMMIT_SAGE_LLM_BASE_URL`). [Source: src/shared/errors.ts]
- **The new SDK factories (verified):** `createOpenAI({ apiKey, baseURL? })`, `createAnthropic({ apiKey, baseURL? })`, `createOpenAICompatible({ baseURL, name, apiKey? })` — each returns a `provider(modelId): LanguageModel`. [Source: node_modules/@ai-sdk/*]

### Determinism, privacy & fail-open posture (unchanged)

- **Constructing a model makes no network call** (the 1.6 invariant) — only `generateObject` does; so `resolveModel` is synchronous and unit-testable offline for every provider. Generation stays `temperature: 0`. [Source: src/narrate/provider.ts, generate.ts]
- **Privacy holds:** the key is `Secret`, env-only, header-only on the wire, scrubbed from error text; only metric envelopes reach the model (the prompt builders are unchanged). [Source: src/narrate/prompt.ts, preflight.ts]
- **Fail-open preserved:** a `resolveModel`/preflight failure for any provider degrades (`auto`, exit 9) / throws `NarrationError` (`required`, exit 6) exactly as gemini does today — one error model across providers (the architecture's goal). [Source: src/narrate/narrate.ts]

### Previous-story intelligence

- **1.6 left the extension points labelled.** `provider.ts`, `env.ts readAiKey`, and `preflight.ts` each carry an explicit "full BYOK breadth (Story 3.6)" comment at the exact spot to extend; 3.6 fills them in. Update those comments. [Source: src/narrate/provider.ts, src/config/env.ts, src/narrate/preflight.ts]
- **Key-in-header, not URL (1.6 review patch):** the gemini/ollama preflight puts the key in a request header (`x-goog-api-key`); replicate per provider (`Authorization: Bearer` for openai/openai-compatible, `x-api-key` for anthropic) — never in the URL (keeps it out of proxy/access logs). [Source: 1.6 review patch, src/narrate/preflight.ts]
- **Base-url trailing-slash trim (1.6 review patch):** the ollama base URL is `.replace(/\/+$/, "")`-trimmed before composing the path; reuse for every base-url provider so `{baseUrl}/models` never double-slashes. [Source: 1.6 review patch]
- **Exhaustive switch + `assertNever` (1.7 pattern):** the provider switch (resolve + preflight) ends in an `assertNever(provider)` default so adding a 6th enum value is a compile error, not a silent fallthrough. [Source: src/assemble/report.ts assertNever]

### Project Structure Notes

- Modified: `src/narrate/provider.ts` (+ `provider.test.ts`), `src/config/env.ts` (+ `env.test.ts`), `src/narrate/preflight.ts` (+ `preflight.test.ts`), `package.json` (+3 deps). **No** schema/prompt/generate/grounding/confidence/assemble/render change; the `analysis` subtree, narrative shape, and determinism harness are untouched. [Source: architecture.md#Complete Project Directory Structure]
- **New dependencies (exact-pinned, `.npmrc save-exact`):** `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible` — the architecture-named provider packages (sibling majors of the installed `@ai-sdk/google@3.0.82` / `ai@6.0.203`). Confirmed with the user before adding.

### References

- [Source: docs/planning-artifacts/epics.md#Story 3.6: Full BYOK provider breadth] (the ACs)
- [Source: docs/planning-artifacts/architecture.md#Narration — Client: Vercel AI SDK] (the SDK + the exact `@ai-sdk/*` packages; `gemini`→`@ai-sdk/google`; one error model) · [Source: …#Env-var resolution specifics] (native key vars + the `GEMINI_API_KEY` alias) · [Source: …#Input Source Matrix] (`aiKey` env-only native per provider; `llmBaseUrl` conditional-required for ollama/openai-compatible, ollama defaults to localhost:11434)
- [Source: docs/planning-artifacts/prds/prd-commit-sage-2026-06-06/prd.md#FR-11] (closed provider enum; native key env var; base URL for ollama/openai-compatible)
- [Source: src/narrate/provider.ts · preflight.ts] (the 1.6 seams to widen) · [Source: src/config/env.ts] (`readAiKey`) · [Source: src/config/run-config.ts] (`Provider` enum) · [Source: src/shared/secret.ts] (`Secret`) · [Source: src/shared/errors.ts] (`NarrationError`)

### Completion Notes

- **All three ACs satisfied.** AC1: `resolveModel` is a closed, exhaustive (`assertNever`) switch building a `LanguageModel` for **every** provider via the architecture-named packages — `@ai-sdk/google` (gemini), `@ai-sdk/openai` (openai), `@ai-sdk/anthropic` (anthropic), `@ai-sdk/openai-compatible` (openai-compatible **and** ollama via `{baseUrl}/v1`) — so the one `generateObject` interface drives all five; a missing model is a typed `NarrationError` (exit 6) for each. AC2: base URL is **required** for `openai-compatible` (a hard `NarrationError` naming `COMMIT_SAGE_LLM_BASE_URL`) and `ollama` (defaulted to `http://localhost:11434`), **optional** for the hosted providers (vendor default); ollama needs no key and targets the OpenAI-compatible `/v1` surface. AC3: the key is read **only** from the provider's native env var (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` + `GEMINI_API_KEY` alias / `OPENAI_API_KEY` for openai-compatible), `Secret`-wrapped, env-only (bypasses the config/flag/prompt merge — `readAiKey` is the sole reader), and `reveal()`ed only at client construction; a key-requiring provider with no key is a typed `NarrationError` naming the exact var.
- **The unified client is the only seam that changed.** Generation (3.1–3.3), grounding (3.4), and confidence (3.5) are provider-agnostic — they drive a `LanguageModel`. Widening `resolveModel` (+ `readAiKey` + `preflight`) makes the whole downstream pipeline work against each provider with **zero** change to generate/ground/confidence/assemble/render.
- **Secrets stay safe across the breadth.** Each preflight probe sends the key in a **header** (Bearer for openai/openai-compatible, `x-api-key` for anthropic, `x-goog-api-key` for gemini), never the URL; `reachFailureReason` scrubs the key from any error text; the openai-compatible optional-key path omits the auth header entirely when no key is set.
- **Base-URL hardening (review patch):** a shared `cleanBaseUrl` maps a blank value to "unset" (no relative-URL fetch / broken client), and the ollama `/v1` suffix is idempotent.
- **3 new dependencies** (exact-pinned, user-confirmed): `@ai-sdk/openai@3.0.71`, `@ai-sdk/anthropic@3.0.84`, `@ai-sdk/openai-compatible@2.0.50` — the architecture-named packages, sibling majors of `@ai-sdk/google@3.0.82` / `ai@6.0.203`. The binary builds (102.66 KB) and the new providers are bundled.
- **Pre-existing advisory flagged (not fixed):** `npm audit` reports 2 high-severity `esbuild` findings — a **dev-server** vulnerability transitive via the `tsup` devDependency (from Story 1.1), **not** from the new runtime provider packages, and not in the production runtime; the fix is a breaking `tsup` downgrade — out of scope for 3.6, logged for a toolchain story.
- **476 tests** (+27); typecheck / lint / build clean. Substrate (`--no-ai`) path verified unchanged.
- **No engine/model/metric/select/schema/prompt/generate/grounding/confidence/assemble/render change.** gemini path behaviorally unchanged.

### File List

**Modified (source):**
- `src/narrate/provider.ts` — `resolveModel` widened to the closed five-provider switch (the unified client); per-provider key/base-url rules; `cleanBaseUrl`; `assertNeverProvider`
- `src/config/env.ts` — `readAiKey` reads each provider's native env var (openai/anthropic/gemini+alias/openai-compatible); `ollama`/undefined → no key
- `src/narrate/preflight.ts` — per-provider reachability probes (openai/anthropic/openai-compatible models-list with header auth); `cleanBaseUrl`; closed switch

**Modified (tests):**
- `src/narrate/provider.test.ts` — every provider resolves; missing model (all, exit 6); missing key (hosted, native var); base-url rules + blank-as-unset + idempotent ollama `/v1`
- `src/config/env.test.ts` — native var per provider; `Secret`-wrapped; cross-provider isolation; blank-as-unset
- `src/narrate/preflight.test.ts` — openai/anthropic/openai-compatible probes (URL + header auth, key-not-in-URL, optional key omits header, missing/blank base URL)

**Modified (deps + tracking):**
- `package.json` — +`@ai-sdk/openai` +`@ai-sdk/anthropic` +`@ai-sdk/openai-compatible` (exact-pinned)
- `docs/implementation-artifacts/sprint-status.yaml` — 3-6 → in-progress → done; epic-3 → done
- `docs/implementation-artifacts/3-6-full-byok-provider-breadth.md` — this story (record filled, status → done)

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-14 | Story 3.6 drafted via create-story (ultimate context engine). Status → in-progress. User confirmed the 3 architecture-named provider deps. |
| 2026-06-14 | Story 3.6 implemented (TDD): widened `resolveModel` to the closed five-provider switch (the unified AI-SDK client), `readAiKey` to each native env var, and `preflight` to per-provider reachability probes (header auth, key-not-in-URL); base URL required for openai-compatible (typed error) + defaulted for ollama (`/v1`); +3 exact-pinned deps. No downstream pipeline change. 43 files / 472 tests green; substrate e2e verified; binary bundles the new providers. Status → review. |
| 2026-06-14 | Code review (3 parallel layers) → Acceptance Auditor all 3 ACs MET 0-patch (env-only key discipline "particularly well-executed", no scope creep) + Blind Hunter 1 test patch. 2 patches: a base-URL robustness class (blank → unset via shared `cleanBaseUrl`; idempotent ollama `/v1`) + restore the dropped `exitCode` assertion; +4 hardening tests. 476 tests green; typecheck/lint/build clean. Status → done. **Epic 3 complete (6/6).** |
