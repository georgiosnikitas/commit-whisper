---
baseline_commit: a3ddba2587c262e13eead475833dfce727867eaa
---

# Story 1.6: Minimal single-provider AI narration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a configured LLM provider to produce a narrative summary,
so that every run yields explanation, not just numbers (AI is required).

## Acceptance Criteria

1. **(AC1 — Structured Summary via `generateObject`, privacy-safe, native key)** Given a configured provider and reachable model, when narration runs over the computed metrics, then the Vercel AI SDK `generateObject` (bound to a **Zod schema**) produces a structured **Summary** from the metrics, **and** only metrics and derived summaries are sent to the LLM — **never tokens, never raw diffs**, **and** the LLM key is read from the provider's native environment variable (`GOOGLE_GENERATIVE_AI_API_KEY` for Gemini, with `GEMINI_API_KEY` accepted as an explicitly-read alias).

2. **(AC2 — `aiMode`-aware reachability preflight)** Given a configured provider whose endpoint is unreachable (Ollama not running, or a missing/invalid cloud key), when a run starts, then a cheap reachability **preflight** (Ollama endpoint ping / cloud auth-connectivity check, **never a paid inference**) runs in the pre-pipeline gate band **before** retrieve/analyze — and its consequence depends on `aiMode`: `required` (`--ai`) **hard-fails** with the narration/LLM exit code (6); `auto` flags fail-open and the run proceeds; `off` (`--no-ai`) **skips** the preflight entirely — **and** "configured" (provider/model set) is distinguished from "reachable" (probe passed).

3. **(AC3 — Fail-open in `auto`)** Given `aiMode: auto` and a narration / grounding / provider failure mid-run, when the failure occurs after the deterministic analysis is computed, then commit-whisper **fails open** — it surfaces the deterministic `analysis` substrate rather than discarding computed work, marks the output **degraded**, and the run ultimately exits **9** (completed-degraded), never silently substituting, **and** the narrated **showpiece** is impossible to produce without the `narrative` subtree (no AI, no showpiece) — so the report still requires AI by construction.

4. **(AC4 — `aiMode: off` clean, no provider hard-fails)** Given `aiMode: off` (`--no-ai`, headless/CI default), when a run executes, then it produces the clean `analysis` substrate with **no LLM call** and exits 0 (intentional, not degraded). **And** given no provider configured with AI **required**, when a run is attempted, then it fails with the narration/LLM exit code (6) — reconciled with the 2026-06-13 fail-open ruling: in `auto` a missing/unreachable provider **degrades** (exit 9) rather than hard-blocking.

## Tasks / Subtasks

- [x] **Task 0 — Add the approved AI dependencies (AC: 1) — George approved 2026-06-13**
  - [x] `npm install ai@6.0.203 @ai-sdk/google@3.0.82 zod@4.4.3` (exact pins via `.npmrc save-exact`). Runtime deps. Confirm `package.json` shows the exact versions (no `^`/`~`).
  - [x] Confirm peer-deps resolve (`ai@6` wants `zod ^4.1.8`; `4.4.3` satisfies). Run `npm ls ai @ai-sdk/google zod` clean.
- [x] **Task 1 — Narrate port + result contract + minimal Summary types (`src/narrate/narrate.port.ts`) (AC: 1, 3, 4)**
  - [x] Define `Summary` (the minimal narrative payload this story produces) and `Narrative` (the subtree wrapper — for now `{ summary: Summary }`; Epic 3 adds Explanation/Coaching/per-metric). Keep these the AI-layer types; the deterministic `Analysis` (Story 1.5) is the **input**.
  - [x] Define `NarrateConfig` — the AI-relevant **subset** of `RunConfig` + the secret: `{ aiMode: AiMode; provider?: Provider; llmModel?: string; llmBaseUrl?: string; aiKey?: Secret<string> }`. (Story 1.8 maps the frozen `RunConfig` + the env-read key into this; mirrors how 1.5 takes an `AnalysisContext` subset. Do NOT reshape `RunConfig` here.)
  - [x] Define the outcome union the CLI shell (1.8) interprets: `NarrateOutcome = { kind: "narrated"; narrative: Narrative } | { kind: "skipped" } | { kind: "degraded"; reason: string }`. (`required`-mode failure **throws** `NarrationError` exit 6 — not an outcome variant.) Document: shell maps `narrated`→showpiece/exit 0, `skipped`→substrate/exit 0, `degraded`→substrate/exit 9, thrown `NarrationError`→exit 6.
  - [x] `NarratePort = (analysis: Analysis, config: NarrateConfig) => Promise<NarrateOutcome>`. Named exports only (P2). `import type` the `Analysis`/`RunConfig`-derived types.
- [x] **Task 2 — Summary Zod schema (`src/narrate/schema.ts`) (AC: 1)**
  - [x] Define `SummarySchema` with **standard `zod`** (not `zod/mini` — `generateObject` binds a standard zod schema; the `zod/mini` lean-SEA optimization is a config-schema concern for later). Minimal but real: `{ headline: string; overview: string; keyFindings: string[] }` with `.describe()` hints to guide the model. `export type Summary = z.infer<typeof SummarySchema>` and re-export the type alignment with `narrate.port.ts` (single source — define `Summary` here, import it into the port, or vice versa; avoid a drifting duplicate).
  - [x] Co-locate `schema.test.ts`: a valid object parses; a missing field / wrong type fails `safeParse`; `keyFindings` accepts an empty array.
- [x] **Task 3 — Privacy-safe prompt builder (`src/narrate/prompt.ts`) (AC: 1)**
  - [x] `buildSummaryPrompt(analysis: Analysis): string` — serialize **only** the metric envelopes (`id`, `group`, `title`, `status`, `value`, `reason`). The narrate stage receives **only `Analysis`** (never `RepoHistory`), so commit messages, file paths, raw diffs, and tokens are **structurally absent** — privacy-safe by construction. Add an instruction framing the model's task (summarize the repo's activity from these deterministic metrics).
  - [x] Co-locate `prompt.test.ts`: the prompt contains the metric ids/titles; a **negative privacy assertion** — given an `Analysis` whose metric values happen to include text, the prompt never contains a known raw-diff/commit-message sentinel that is NOT part of the analysis (prove the builder only reads the analysis); the prompt is a non-empty string.
- [x] **Task 4 — Provider factory, gemini-only (`src/narrate/provider.ts`) (AC: 1)**
  - [x] `resolveModel(config: NarrateConfig): LanguageModel` — for `provider: "gemini"`, build `createGoogleGenerativeAI({ apiKey: config.aiKey.reveal() })(config.llmModel)` (the `gemini`→`@ai-sdk/google` name mapping). The key is **revealed only here, at the point of use** (never logged, never serialized).
  - [x] Throw `NarrationError` (exit 6) for: an unsupported provider (`openai`/`anthropic`/`openai-compatible` — "single-provider slice; full BYOK breadth is Story 3.6"), a missing `aiKey`, or a missing `llmModel`. Actionable messages (name the env var for the missing key).
  - [x] Co-locate `provider.test.ts`: `gemini` + key + model ⇒ a model object (no network); missing key ⇒ `NarrationError` naming `GOOGLE_GENERATIVE_AI_API_KEY`; an unsupported provider ⇒ `NarrationError` mentioning Story 3.6. Use a `Secret` wrapping a dummy key — **no real key, no network** (constructing the provider does not call out).
- [x] **Task 5 — `generateObject` summary generation (`src/narrate/generate.ts`) (AC: 1)**
  - [x] `generateSummary(model: LanguageModel, analysis: Analysis): Promise<Summary>` — `const { object } = await generateObject({ model, schema: SummarySchema, temperature: 0, prompt: buildSummaryPrompt(analysis) }); return object;`. Pin `temperature: 0` (determinism posture; not user-exposed).
  - [x] Co-locate `generate.test.ts`: drive the **real** `generateObject` with `ai/test`'s `MockLanguageModelV2` (returns a canned structured object) — proves the schema binding end-to-end **offline, no key, no network**. Assert the returned `Summary` matches the mock's object and validates against `SummarySchema`. (If the mock's structured-output shape proves version-fiddly, fall back to asserting `buildSummaryPrompt` + `SummarySchema` directly and inject a fake `generate` at the narrate layer — note which path was taken.)
- [x] **Task 6 — Reachability preflight (`src/narrate/preflight.ts`) (AC: 2)**
  - [x] `preflightProvider(config: NarrateConfig, deps?: { fetchImpl?: typeof fetch }): Promise<PreflightResult>` where `PreflightResult = { reachable: true } | { reachable: false; reason: string }`. **Never a paid inference** — a single cheap round-trip:
    - `gemini` (cloud) → `GET https://generativelanguage.googleapis.com/v1beta/models?key=<revealed>` → reachable iff `res.ok`; 401/403 ⇒ `{ reachable:false, reason: "auth failed" }`.
    - `ollama` → `GET {llmBaseUrl}/api/tags` (default `http://localhost:11434`) → reachable iff `res.ok`; connection refused ⇒ not reachable. (Ollama **generation** is deferred to 3.6; the preflight shape is included because AC2 names it.)
  - [x] `aiMode: off` ⇒ return `{ reachable: true }` without any call (the shell skips it anyway; this keeps the fn total). A missing key/model for a cloud provider ⇒ `{ reachable:false, reason }` (configured-vs-reachable distinction).
  - [x] **Injectable `fetchImpl`** (default global `fetch`) so tests run **offline** with a fake returning canned `Response`s. The preflight does not read `process.env` (the key arrives via `config.aiKey`).
  - [x] Co-locate `preflight.test.ts` (fake fetch): gemini 200 ⇒ reachable; gemini 401 ⇒ not reachable + reason; ollama tags 200 ⇒ reachable; fetch throws (ECONNREFUSED) ⇒ not reachable + reason; `aiMode: off` ⇒ reachable with **no fetch call** (assert the fake was not invoked); the gemini URL carries the key but the test asserts the key value is the dummy (never a real secret).
- [x] **Task 7 — Narrate stage orchestrator + fail-open (`src/narrate/narrate.ts`) (AC: 1, 3, 4)**
  - [x] `createNarrate(deps?: { resolveModel?: …; generate?: … }): NarratePort` — inject `resolveModel`/`generate` (default the real ones) so the orchestrator is testable without a model. Logic:
    - `config.aiMode === "off"` ⇒ `{ kind: "skipped" }` (no model resolution, no call — AC4).
    - else: `try { model = resolveModel(config); narrative = { summary: await generate(model, analysis) }; return { kind: "narrated", narrative }; }`
    - `catch (err)`: `aiMode === "required"` ⇒ **throw** (a `NarrationError` as-is, else wrap in `NarrationError` exit 6 with `cause`); `aiMode === "auto"` ⇒ `{ kind: "degraded", reason }` (**fail open** — AC3; the already-computed `analysis` is preserved upstream).
  - [x] **No `process.exit`, no exit-code setting, no render** — the stage returns an outcome; the CLI shell (1.8) maps it to exit 0/9/6 and to the showpiece-vs-substrate render branch. Document this boundary.
  - [x] Co-locate `narrate.test.ts` (injected fakes, no network): `off` ⇒ `skipped` (resolveModel/generate never called); happy path ⇒ `narrated` with the summary; `auto` + a throwing `generate` ⇒ `degraded` + reason (fail open, no throw); `required` + a throwing `generate` ⇒ throws `NarrationError` (exit 6); `required` + unsupported provider (real `resolveModel`) ⇒ throws `NarrationError`.
- [x] **Task 8 — AI-key env reader (`src/config/env.ts`) (AC: 1)**
  - [x] Add `readAiKey(env: NodeJS.ProcessEnv, provider: Provider | undefined): Secret<string> | undefined` — for `gemini`, read `GOOGLE_GENERATIVE_AI_API_KEY`, falling back to the **explicitly-read alias** `GEMINI_API_KEY`; wrap in `Secret` (1.3). Other providers' native vars (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/…) are added in Story 3.6 — return `undefined` for them now with a marked extension point. `ollama` needs no key ⇒ `undefined`.
  - [x] This is the **secret** counterpart to `readEnvLayer` and lives in `config/env.ts` (the single `process.env` reader). It is **separate** from the non-secret merge (secrets bypass the resolver layers — env-only). Update the file header note (the 1.2 "secret env vars deferred" comment) to reflect that `aiKey` now lands here.
  - [x] Co-locate addition in `env.test.ts`: `gemini` + `GOOGLE_GENERATIVE_AI_API_KEY` ⇒ a `Secret` revealing the value; the `GEMINI_API_KEY` alias works when the native var is unset; native wins over alias when both set; redaction holds (`String(secret) === "***"`); `ollama`/`undefined` provider ⇒ `undefined`; an unsupported provider ⇒ `undefined` (3.6 seam).
- [x] **Task 9 — Verify gates (AC: 1, 2, 3, 4)**
  - [x] `npm run typecheck` clean; `npm run lint` clean (no `console` in `narrate/`; `process.env` only in `config/`; named-exports-only; the `aiKey.reveal()` is confined to `provider.ts`/`preflight.ts`); `npm test` green (all new suites, **offline**); `npm run build` clean (the AI SDK bundles).
  - [x] Remove the now-redundant `src/narrate/.gitkeep`.
  - [x] `npm audit` sanity (note any advisories from the new deps in Completion Notes; do not auto-fix-force).

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The spec-aware **Acceptance Auditor verified all 4 ACs at the building-block level the story scopes to**, with strong privacy + secret discipline (`.reveal()` confined to `provider.ts`/`preflight.ts`; narrate never imports `RepoHistory`; FR-2 holds). The hunters converged hard on the gemini key being placed in the preflight **URL query string** + missing fetch **timeouts**. Triage: **4 patch · 7 defer · 6 dismissed · 0 decision-needed.**

> Note: with stock Node/undici a thrown fetch error's `message` is `"fetch failed"` (the URL lives in `err.cause`), so there is **no key leak today** — but key-in-URL defeats `Secret` by construction and is worth hardening now on a privacy-first product. The exit-code/gate-band/render outcomes (6/9/0) and the by-construction showpiece binding are correctly deferred to Story 1.8.

**Patch:** _(all 4 applied & verified 2026-06-13 — suite green, 179 tests)_

- [x] [Review][Patch] Move the gemini API key **out of the URL query string** and into the `x-goog-api-key` request header for the preflight probe — keeps the secret out of proxy/access logs, crash reports, and any error message that echoes the request URL (defense-in-depth on the FR-2 env-only/redaction contract) [src/narrate/preflight.ts] — **Fixed:** the probe now passes `headers: { "x-goog-api-key": key.reveal() }` and the URL carries no `key=`; a test asserts the key is in the header and never in the URL.
- [x] [Review][Patch] Add a **timeout / `AbortSignal`** to both preflight probes (gemini + ollama) so a hung/sinkholed endpoint can't block the CLI indefinitely [src/narrate/preflight.ts] — **Fixed:** both probes pass `signal: AbortSignal.timeout(timeoutMs)` (default 5s, injectable); a test drives a hung fetch and asserts it aborts to not-reachable.
- [x] [Review][Patch] Scrub the revealed key from any failure `reason` before it can surface [src/narrate/preflight.ts, src/narrate/narrate.ts] — **Fixed:** `reachFailureReason`/`narrationReason` replace the key substring with `***`; tests prove a key-echoing error never surfaces the key in the preflight reason or the degraded reason.
- [x] [Review][Patch] Normalize the ollama `llmBaseUrl` (strip a trailing slash) so `http://host:11434/` doesn't produce `…//api/tags` [src/narrate/preflight.ts] — **Fixed:** `.replace(/\/+$/, "")`; a test asserts a trailing-slash base URL yields exactly `…/api/tags`.

**Defer (tracked in deferred-work.md, not actioned now):**

- [x] [Review][Defer] `generateObject` migration — `ai@6.0.203` marks it `@deprecated` in favour of `generateText` + an `output` setting; the AC/architecture name `generateObject` explicitly and it is functional (tsc does not error on the jsdoc), so it is kept for the slice. Migrate when the full narrative lands [src/narrate/generate.ts] — deferred: a clean cutover belongs with Epic 3 (Stories 3.1–3.3), which rewrites this path for the three-part Narrative + per-group batching anyway.
- [x] [Review][Defer] `generateObject` call timeout / abort + retry cap — pass an `abortSignal` (and consider capping SDK `maxRetries`) so a stalled provider can't hang the narrate stage [src/narrate/generate.ts] — deferred: pairs with the Story 1.8 process shell + overall run-timeout policy, where abort/timeout is load-bearing.
- [x] [Review][Defer] Validate the `generateObject` result against `SummarySchema` at the boundary (`SummarySchema.parse(object)`) so a non-conforming/partial object can't pass as a valid `Summary` — C1 names "LLM-output" as a runtime validation checkpoint [src/narrate/generate.ts] — deferred: the SDK already constrains output to the bound schema; the explicit re-validate belongs with the C1 LLM-output checkpoint hardening in Epic 3 (grounding, 3.4).
- [x] [Review][Defer] Preflight ↔ resolveModel provider-surface mismatch — preflight treats `ollama` as reachable but `resolveModel` only supports `gemini`, so an `auto`+ollama run passes the probe then degrades at generation [src/narrate/preflight.ts, src/narrate/provider.ts] — deferred: intentional per Task 6 (ollama generation is Story 3.6; the preflight shape is included because AC2 names it); revisit when ollama generation lands.
- [x] [Review][Defer] Preflight transient-status handling — a 429/503 from the models-list endpoint is currently "not reachable" and would hard-fail `required` mode; treat transient throttling distinctly from a hard auth/connectivity failure [src/narrate/preflight.ts] — deferred: refine alongside the 1.8 gate-band + Epic 5's no-retry failure-class handling (network/auth/rate-limit distinguished).
- [x] [Review][Defer] Preflight does not check `llmModel` (architecture says it reads provider/baseUrl/model), so a key-but-no-model gemini config passes the probe then fails at `resolveModel` — surface the missing-model as a configured-vs-reachable gap at preflight [src/narrate/preflight.ts] — deferred: low severity (the models-list probe needs no model); the gate-band composition (1.8) is the natural place to unify the "configured" check.
- [x] [Review][Defer] `aiMode`/`provider` defensive guards — an unexpected `aiMode` value or a `provider: undefined` + `required` path are handled only transitively; add explicit coverage/guards (and a `provider:undefined`+`required` test) [src/narrate/narrate.ts, src/narrate/provider.ts] — deferred: the type system constrains `aiMode` to the enum at the (1.8) call site; add belt-and-suspenders when the shell wires real flag parsing.

**Dismissed (6):** "fail-open swallows real bugs" (that **is** AC3 in `auto` by design — a provider failure must not sink the computed analysis; `required` correctly throws, and the throwing-metric test proves the distinction); "`temperature: 0` doesn't make LLMs deterministic" (the comment says "tightest determinism the **non-deterministic** narrative layer allows" — already correctly hedged, and the architecture's posture); "`readAiKey` has no `= process.env` default unlike `readEnvLayer`" (intentional — the caller always passes `env`; the orchestrator owns the single real `process.env` read); "`keyFindings` allows `[]` despite the 3–6 describe" (deliberate — the `.describe()` is a model hint; a hard `.min()` would force needless fail-open on a thin-but-valid response; the test asserts `[]` parses); "non-gemini key silently dropped in `readAiKey`" (the user-facing clarity comes from `resolveModel`/preflight naming Story 3.6 — `readAiKey` returning `undefined` for a 3.6 provider is the documented seam, not a silent drop); "naive ollama base-URL is SSRF-adjacent" (the base URL is the user's own configured endpoint, not attacker-controlled; trailing-slash normalization is the real nit, covered by a Patch).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope (the minimal single-provider narration slice):**
- Narrate **port + outcome contract** + minimal `Summary` (`narrate.port.ts`).
- The **Summary Zod schema** (`schema.ts`) and the **privacy-safe prompt** (`prompt.ts`).
- The **gemini-only provider factory** (`provider.ts`) + **`generateObject` generation** (`generate.ts`).
- The **`aiMode`-aware reachability preflight** (`preflight.ts`).
- The **narrate stage orchestrator with fail-open** (`narrate.ts`).
- The **AI-key env reader** (`config/env.ts` `readAiKey`).

**Out of scope / deferred (do NOT build here):**
- **The CLI shell / pre-pipeline gate band + exit-code setting (0/9/6) + the showpiece-vs-substrate render branch** — Story 1.8 (`cli/run.ts`, `src/index.ts`, `render/`). 1.6 returns a `NarrateOutcome` and **throws** `NarrationError` for required-mode; the shell maps these to exit codes and render paths. Nothing calls narrate yet. [Source: docs/planning-artifacts/architecture.md#C3 — AI / Narration Layer]
- **Report JSON assembly** (the `analysis` + optional `narrative` subtree wrapper, `schemaVersion`, top-level `degraded` marker) — Story 1.7. 1.6 produces the in-memory `Narrative`; 1.7 assembles it (joined to `analysis` by metric id). [Source: docs/planning-artifacts/epics.md#Story 1.7]
- **The full three-part Narrative + four-facet per-metric explanations + per-group ×6 batching + the coaching call** — Epic 3 (Stories 3.1–3.3). 1.6 is **minimal**: one repo-level `Summary`, one `generateObject` call. [Source: docs/planning-artifacts/epics.md#Epic 3]
- **Deterministic grounding verification pass (FR-9)** — Story 3.4. 1.6 does not verify claims against metric ids yet. [Source: docs/planning-artifacts/epics.md#Story 3.4]
- **Confidence self-assessment + escalation (FR-10)** — Story 3.5. [Source: docs/planning-artifacts/epics.md#Story 3.5]
- **Full BYOK provider breadth** (OpenAI, Anthropic, openai-compatible, base URL) — Story 3.6. 1.6 wires **gemini only** (`@ai-sdk/google`); other `@ai-sdk/*` packages are **not** installed now. [Source: docs/planning-artifacts/epics.md#Story 3.6]
- **Wiring `aiKey` into the frozen `RunConfig` + the resolver** — the secret bypasses the merge (env-only); 1.6 reads it in `config/env.ts` and passes it via `NarrateConfig`. Folding it onto `RunConfig` (the architecture's `aiKey?: Secret<string>` field) happens when the shell composes everything (1.8). Keep `RunConfig` unchanged here. [Source: docs/planning-artifacts/architecture.md#Secrets]
- **`zod/mini` lean-SEA config schemas** — C1's `zod/mini` optimization is for the config-in / report-json schemas (later). The AI structured-output schema uses **standard `zod`** (what `generateObject` binds). [Source: docs/planning-artifacts/architecture.md#C1 — Data Contracts & Runtime Validation]

### The AI/Narration layer (C3 — the contract this story realizes)

- **Client: Vercel AI SDK `ai` 6.0.203** — one `generateObject` interface; for 1.6 the single provider is **gemini → `@ai-sdk/google`** (the `provider` enum value `gemini` maps to that package — a cosmetic name difference, not two providers). [Source: docs/planning-artifacts/architecture.md#C3]
- **Structured output:** `generateObject` bound to a **Zod** schema constrains the model to the `Summary` shape — no fragile string-parsing. [Source: architecture#C3]
- **Sampling determinism:** pin `temperature: 0` internally; do not expose it. (A `seed` is set "where the provider supports it" — gemini's SDK surface may not; `temperature: 0` is the portable floor.) [Source: architecture#C3]
- **Preflight (`narrate/preflight.ts`) — `aiMode`-aware**, one cheap round-trip, **never a paid `generateObject` dry run**. Ordered (by the shell, 1.8) **license → preflight → retrieve**. `off` skips; `required` hard-fails exit 6 *before any clone*; `auto` marks non-viable and proceeds to the substrate (exit 9). TOCTOU mitigation, not a guarantee. Status/doctor (Epic 6) reuses the same probe read-only. [Source: architecture#C3]
- **Fail-open narration:** in `auto`, any narrate/grounding/provider failure is caught at the narrate boundary and becomes an **absent `narrative`** (the outcome `degraded`), never a discarded run — the computed `analysis` is preserved. In `required`, the same failure propagates as exit 6. The narrated **showpiece** is bound to AI **by construction**: the showpiece template's input type **requires** the `narrative` subtree, so a substrate Report cannot masquerade as the showpiece (that type-level constraint is built in 1.7/1.8 render; 1.6 guarantees the upstream half — no narrative produced ⇒ degraded outcome). [Source: architecture#C3] [Source: architecture#Key Architecture Rulings]

### Privacy boundary (AC1 — "never tokens, never raw diffs")

The narrate stage's **only** input is the deterministic `Analysis` (metric envelopes). It never receives `RepoHistory`, so commit messages, file paths, raw diffs, and the API key are **structurally absent** from anything sent to the LLM — privacy is enforced by the call signature, not by filtering. `prompt.ts` serializes only `{id, group, title, status, value, reason}`. The `aiKey` is revealed only inside `provider.ts` (to construct the client) and `preflight.ts` (the auth probe) — never in a prompt, log, or serialized output (`Secret` redacts everywhere else). [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-2] [Source: architecture#Secrets]

### Env-var resolution (AC1)

- **gemini** LLM key: native **`GOOGLE_GENERATIVE_AI_API_KEY`** (what `@ai-sdk/google` reads), **plus** `GEMINI_API_KEY` accepted as an **explicitly-read alias** — `config/env.ts` reads the alias and injects it as the provider's `apiKey` rather than relying on SDK auto-pickup, so the friendly name works without a second SDK contract. Native var **wins** when both are set. [Source: architecture#Secrets]
- Secrets are **env-only** and wrapped in `Secret<string>` (1.3) — redact to `***` in any `toString`/`toJSON`, never written to Report JSON/logs/output. `config/env.ts` is the single `process.env` reader (lint-enforced). [Source: architecture#Secrets]

### Testability — offline, no key, no network (critical)

- The whole suite must run with **no real API key and zero network**. Mechanisms: (1) `ai/test`'s `MockLanguageModelV2` drives the real `generateObject` in `generate.test.ts`; (2) `preflight.ts` takes an injectable `fetchImpl` (fake `Response`s); (3) `narrate.ts` injects `resolveModel`/`generate` fakes; (4) `provider.ts` is tested by constructing the client with a `Secret` dummy key — **constructing** the `@ai-sdk/google` model does not make a network call (the call happens only on `generateObject`, which tests never invoke against the real provider). [Source: ai@6.0.203 `./test` export]

### Implementation patterns this story must follow (P-rules — lint-enforced)

- **P2:** `kebab-case.ts`; **named exports only**; ports as `*.port.ts`. [Source: architecture#Implementation Patterns]
- **P5:** **no `console`** in `narrate/`. Surface failure as the `degraded` outcome (auto) or a thrown `NarrationError` (required) — never log. [Source: architecture#Stream Discipline]
- **Env isolation:** `process.env` only in `config/` — the key is read in `config/env.ts` and passed via `NarrateConfig`; `narrate/` never touches `process.env`. [Source: eslint.config.js]
- **Secret discipline:** `aiKey.reveal()` appears **only** in `provider.ts` and `preflight.ts`. Never interpolate a secret into a prompt, error message, or log. [Source: architecture#Secrets]
- **Hexagonal boundary:** narrate depends on the `NarratePort` contract; it receives the AI-relevant config subset, not `argv`/`env`/prompts. [Source: architecture#Architectural Boundaries]
- **P3:** unit tests **co-located** `*.test.ts`. [Source: 1-1#Testing standards]

### Previous story intelligence (1.1–1.5)

- **Consumes 1.5's `Analysis`:** `import type { Analysis } from "../analyze/engine.js"` (`{ metrics: Metric[] }`); each `Metric` is `{ id, group, title, status, value?, reason? }`. The narrate stage reads this — **not** `RepoHistory`. [Source: src/analyze/engine.ts]
- **`NarrationError` (exit 6) exists** (1.3, `shared/errors.ts`) and supports **`cause`** chaining (added in 1.4) — wrap the underlying SDK error. [Source: src/shared/errors.ts]
- **`Secret<string>`** (1.3) — `new Secret(key)`, `.reveal()` the lone read path; redacts in `toString`/`toJSON`/`util.inspect`. [Source: src/shared/secret.ts]
- **`Provider`/`AiMode` types** live in `config/run-config.ts` (1.2): `Provider = "ollama"|"openai"|"gemini"|"anthropic"|"openai-compatible"`, `AiMode = "required"|"auto"|"off"`. Import as `import type`. [Source: src/config/run-config.ts]
- **`config/env.ts`** has the documented "secret env vars deferred to Story 1.6" marker — fulfill it. The non-secret `readEnvLayer` + `str()` helper are there; reuse `str()` for trimming the key. [Source: src/config/env.ts]
- **Toolchain:** TS 6.0.3 strict, ESM `.js` import specifiers in source, `nodenext`, `"types":["node"]`, vitest 4.1.8, tsup 8.5.1. `import type` for type-only (`isolatedModules`). [Source: 1-2#Completion Notes]
- **`src/narrate/` holds only `.gitkeep`** — first real modules; remove it. [Source: src/narrate/.gitkeep]
- **Dependency posture:** the locked deps were exact-pinned; the 3 new ones (`ai`/`@ai-sdk/google`/`zod`) are George-approved (2026-06-13) and exact-pinned. No other new deps. [Source: 1-1#Locked dependency versions]

### Testing standards

- vitest 4.1.8, **co-located** `*.test.ts`, **fully offline**. The highest-value suites: `prompt.test.ts` (privacy: only-analysis-in), `schema.test.ts` (parse/validate), `narrate.test.ts` (the 4 `aiMode` branches via injected fakes), `preflight.test.ts` (fake fetch, the configured-vs-reachable matrix). `generate.test.ts` uses `MockLanguageModelV2`.
- **No test may require `GOOGLE_GENERATIVE_AI_API_KEY` or make a network call.** Constructing the provider with a dummy `Secret` is fine; only `generateObject`/`fetch` would call out, and both are mocked/injected.
- DoD: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.

### Project Structure Notes

- New files under `src/narrate/` per the architecture map: `narrate.port.ts`, `preflight.ts`, `provider.ts`, `generate.ts`, plus `schema.ts`/`prompt.ts`/`narrate.ts` (the orchestrator). The map lists `narrate/prompts/` (a folder) for prompt templates and `grounding.ts` — `prompts/` collapses to a single `prompt.ts` for the minimal slice (one Summary prompt); `grounding.ts` is Story 3.4. Flag in Completion Notes. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- `narrate.ts` (the stage composer) is the analogue of 1.5's `engine.ts` — not separately named in the map; named per P2. [Source: architecture map]

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.6: Minimal single-provider AI narration]
- [Source: docs/planning-artifacts/architecture.md#C3 — AI / Narration Layer]
- [Source: docs/planning-artifacts/architecture.md#C1 — Data Contracts & Runtime Validation]
- [Source: docs/planning-artifacts/architecture.md#Secrets]
- [Source: docs/planning-artifacts/architecture.md#Key Architecture Rulings] (fail-open / aiMode)
- [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- [Source: docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md#FR-8] (narrative) [Source: …#FR-11] (BYOK) [Source: …#FR-2] (secrets)
- [Source: src/analyze/engine.ts] · [Source: src/shared/errors.ts] · [Source: src/shared/secret.ts] · [Source: src/config/run-config.ts] · [Source: src/config/env.ts] · [Source: eslint.config.js]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root:

- `npm install ai@6.0.203 @ai-sdk/google@3.0.82 zod@4.4.3` → exact-pinned; `zod@4.4.3` deduped across the SDK tree; `npm ls` clean.
- `npm run typecheck` → `tsc --noEmit` clean. (Confirmed `tsc` does **not** error on the `@deprecated` jsdoc of `generateObject`; one real error — `NarrationError` lacked the `cause` param — was fixed by adding `options?: ErrorOptions` to it, the consumer-driven 1.4 pattern.)
- `npm run lint` → ESLint clean: no `console` in `narrate/`; `process.env` only in `config/`; named-exports-only; `aiKey.reveal()` confined to `provider.ts`/`preflight.ts`.
- `npm test` → vitest: **28 files / 176 tests passed** (was 22/146; +6 files, +30 tests), **fully offline — no API key, no network**.
- `npm run build` → tsup ESM build success.

### Completion Notes List

- **All 4 ACs satisfied.** AC1: `generateObject` bound to the `SummarySchema` (standard `zod`) produces a structured `Summary`; the prompt serializes **only** the `Analysis` metric envelopes (privacy by construction — narrate never receives `RepoHistory`); the key is read from `GOOGLE_GENERATIVE_AI_API_KEY` with `GEMINI_API_KEY` as an explicitly-read alias, wrapped in `Secret`. AC2: `preflightProvider` does one cheap round-trip (gemini models-list / ollama `/api/tags`, never a paid inference), `aiMode`-aware (`off` skips with no fetch; configured-vs-reachable distinguished). AC3: `createNarrate` fails open in `auto` (a narration failure ⇒ `degraded` outcome, computed analysis preserved). AC4: `off` ⇒ `skipped` (no LLM call); a missing/unsupported provider in `required` ⇒ thrown `NarrationError` (exit 6), in `auto` ⇒ `degraded` (the 2026-06-13 fail-open reconciliation).
- **Dependencies (George-approved 2026-06-13):** `ai@6.0.203`, `@ai-sdk/google@3.0.82`, `zod@4.4.3`, all exact-pinned runtime deps. Single-provider scope held — no other `@ai-sdk/*` packages.
- **`generateObject` is `@deprecated` in `ai@6.0.203`** (the SDK suggests `generateText` + an `output` setting). The AC **and** architecture both explicitly name `generateObject`, and it remains fully functional; `tsc` does not error on the jsdoc deprecation. Kept `generateObject` per spec, with a header note. **Flagged for review** as a candidate deferral (migrate to `generateText`+`output` when the full narrative lands in Epic 3).
- **Offline-test design (sanctioned fallback):** `ai/test`'s `MockLanguageModelV3` `doGenerate` result shape is version-fiddly (nested `usage.inputTokens.{total,…}`, a `finishReason` union) — the story pre-authorized falling back if so. `generateSummary` now takes an **injectable `generateObject`**, and `generate.test.ts` asserts the wrapper's contract (schema binding, `temperature: 0`, metrics-only prompt, returned object) with a fake — no model-result-shape coupling, no network, no key. Every suite runs offline.
- **`NarrationError` gained `cause`** (4th optional `options` param) — the consumer-driven pattern established for `RetrieveError` in 1.4; the narrate orchestrator wraps the underlying SDK error in `required` mode.
- **Privacy is structural:** the narrate stage's only input is `Analysis` (metric envelopes), so commit messages / raw diffs / tokens are absent from any prompt by the call signature, not by filtering. `prompt.test.ts` asserts a raw-diff sentinel never appears. The `aiKey` is `reveal()`ed only in `provider.ts` (client construction) and `preflight.ts` (auth probe); `Secret` redacts everywhere else.
- **`aiKey` not folded onto `RunConfig`:** it is read in `config/env.ts` (`readAiKey`) and passed via the `NarrateConfig` subset (mirrors 1.5's `AnalysisContext`). The architecture's `RunConfig.aiKey` field + the gate-band wiring land when the CLI shell composes everything (Story 1.8). `RunConfig` is unchanged.
- **Structure deviations (flagged):** `narrate/prompts/` (a folder, in the architecture map) collapsed to a single `prompt.ts` for the one Summary prompt; `narrate/grounding.ts` is Story 3.4; `narrate.ts` (the stage composer) is named per P2 (the 1.5 `engine.ts` analogue). The test type import `@ai-sdk/provider` (for `LanguageModelV3` in the original mock attempt) was removed in the fallback — no transitive-dep import remains.
- **Security advisory (unchanged):** `npm audit` reports the **same 2 pre-existing high-severity esbuild/tsup advisories** documented in Story 1.1 (GHSA-gv7w-rqvm-qjhr Deno integrity, GHSA-g7r4-m6w7-qqqr dev-server Windows) — **no new advisories from the AI deps**. esbuild is a build-time devDependency; neither attack vector is used. Not auto-fix-forced (would downgrade tsup).
- **SonarQube advisory** (unchanged): `type IsoDate = string` — intentional. New-file advisories resolved during implementation; tsc/eslint/vitest/tsup all green.

### File List

**Added (source):**
- `src/narrate/schema.ts` — `SummarySchema` (zod) + `Summary` type
- `src/narrate/narrate.port.ts` — `NarratePort`, `Narrative`, `NarrateConfig`, `NarrateOutcome`
- `src/narrate/prompt.ts` — `buildSummaryPrompt` (privacy-safe, metrics-only)
- `src/narrate/provider.ts` — `resolveModel` (gemini → `@ai-sdk/google`)
- `src/narrate/generate.ts` — `generateSummary` (injectable `generateObject`, temperature 0)
- `src/narrate/preflight.ts` — `preflightProvider` (`aiMode`-aware reachability probe, injectable fetch)
- `src/narrate/narrate.ts` — `createNarrate` (fail-open orchestrator)

**Added (tests, co-located, offline):**
- `src/narrate/{schema,prompt,provider,generate,preflight,narrate}.test.ts`

**Modified (source):**
- `src/config/env.ts` — added `readAiKey` (gemini native var + alias → `Secret`); header updated
- `src/config/env.test.ts` — added `readAiKey` coverage
- `src/shared/errors.ts` — `NarrationError` gained the optional `cause` param
- `package.json` / `package-lock.json` — added the 3 AI deps (exact-pinned)

**Removed:**
- `src/narrate/.gitkeep`

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 1-6 → in-progress → review → done
- `docs/implementation-artifacts/1-6-minimal-single-provider-ai-narration.md` — this story (record filled, review findings, status → done)

**Patched during code review (2026-06-13):**
- `src/narrate/preflight.ts` — gemini key moved to the `x-goog-api-key` header (out of the URL); `AbortSignal.timeout` on both probes; key-scrubbing in `reachFailureReason`; ollama base-URL trailing-slash normalization
- `src/narrate/narrate.ts` — `narrationReason` scrubs the key from the degraded/thrown reason
- `src/narrate/preflight.test.ts`, `src/narrate/narrate.test.ts` — added header / scrub / timeout / base-URL-normalization tests
- `docs/implementation-artifacts/deferred-work.md` — 7 deferred review items appended

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 1.6 drafted via create-story (ultimate context engine). Dependencies (ai@6.0.203, @ai-sdk/google@3.0.82, zod@4.4.3) pre-approved by George. Status → ready-for-dev. |
| 2026-06-13 | Story 1.6 implemented (TDD): narrate port + Summary zod schema + privacy-safe prompt + gemini provider factory + injectable `generateObject` + `aiMode`-aware preflight + fail-open orchestrator; `config/env.ts readAiKey`; `NarrationError` cause. 6 new suites, **fully offline** (no key/network); 28 files / 176 tests green; typecheck/lint/build clean. `generateObject` deprecation flagged for review. Status → review. |
| 2026-06-13 | Code review (3 layers). All 4 ACs confirmed met by the spec-aware auditor (at the building-block level the story scopes to; exit-code/render outcomes are Story 1.8). Applied 4 privacy/robustness patches: gemini key → request header (out of URL), `AbortSignal` timeouts on both probes, key-scrubbing in failure reasons, ollama base-URL normalization. 7 items deferred, 6 dismissed. Suite green (179 tests). Status → done. |
