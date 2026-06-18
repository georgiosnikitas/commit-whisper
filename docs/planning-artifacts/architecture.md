---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-06-12'
inputDocuments:
  - docs/planning-artifacts/briefs/brief-commit-whisper-2026-06-06/brief.md
  - docs/planning-artifacts/briefs/brief-commit-whisper-2026-06-06/addendum.md
  - docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md
  - docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/addendum.md
  - docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/reconcile-brief.md
  - docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/review-rubric.md
  - docs/planning-artifacts/ux-designs/ux-commit-whisper-2026-06-11/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-commit-whisper-2026-06-11/EXPERIENCE.md
project_name: 'commit-whisper'
user_name: 'George'
date: '2026-06-12'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (16 across 6 areas):**
- Repository Retrieval (FR-1–3): connect to GitHub/GitLab/Bitbucket, token auth via
  env vars only, no-retry graceful failure, Free-tier 100-commit cap.
- History Analysis (FR-4–5): ~30 deterministic, AI-independent metrics in Groups A–F;
  stable JSON keys; every metric computed or explicitly `not_available`.
- Visualization (FR-6–7): a per-group overview chart **plus** a right-sized per-metric
  visual on every card, in self-contained HTML; text-only degradation
  (tables/sparklines/Mermaid) for Markdown/Terminal.
- AI Narrative (FR-8–11): repo-level Summary/Explanation/Coaching + per-metric
  explanations; grounding with post-gen verification; confidence self-assessment;
  BYOK multi-provider; **AI-first by default with fail-open degradation to the `analysis`
  substrate, plus an explicit metrics-only mode (`aiMode`).**
- Report Output (FR-12–13): canonical Report JSON (`schemaVersion` 1.0.0) split into a
  deterministic `analysis` subtree (metric envelopes, **always present**) and an **optional**
  AI `narrative` subtree (absent on a metrics-only or fail-open run); render
  HTML/Markdown/Terminal/JSON as pure functions of that JSON, via a **showpiece** path (needs
  `narrative`) or a plainer **substrate** path (analysis-only).
- Execution & Licensing (FR-14–16): interactive + headless/CI; self-contained
  executable; Free/Single-device/Unlimited tiers.

**Non-Functional Requirements (architecture drivers):**
- Determinism: identical history ⇒ identical metrics — the Report's `analysis` subtree is
  byte-stable, while the AI `narrative` is the one non-deterministic layer, bounded by
  grounding; fail-open / metrics-only make the byte-stable substrate **independently
  renderable**, so the deterministic core is never held hostage to the AI layer.
- Privacy/Security: Ollama local path first-class; only metrics/summaries to cloud LLMs;
  secrets from env vars only, never config file or CLI flags; never written to JSON/logs/output.
- Performance: 50k-commit repo on 4-vCPU/16GB — retrieval+analysis ≤ 10 min, peak RSS
  ≤ 2.5 GB, AI ≤ 4 min (cloud) / ≤ 8 min (local).
- Network: rendering needs no network; AI uses the configured provider (local Ollama = none,
  cloud = network); **paid** license validation requires network at startup (Free tier makes
  no call). Portability across macOS/Linux/Windows; Trust/accuracy as a first-class concern.

**Scale & Complexity:**
- Primary domain: terminal-native CLI / batch data-processing pipeline (Node.js) + static HTML rendering.
- Complexity level: medium-high (no multi-tenancy/real-time/persistence; depth in
  retrieval portability, metrics, multi-provider grounded AI, multi-renderer, packaging, licensing).
- Estimated architectural components: ~7 (CLI/config, retrieval, metrics engine,
  AI/narrative+grounding, Report JSON assembly, renderers, licensing).

### Technical Constraints & Dependencies

- Node.js runtime (George's choice); ship as self-contained executable (Node SEA / pkg / nexe).
- Retrieval mechanism leaning `git clone` over provider APIs (minimizes rate-limit exposure
  under no-retry posture; yields local diffs for churn metrics).
  Override only if a metric genuinely requires provider-only data.
- Likely library areas (not yet decided): git access layer, HTML charting lib,
  templating engine, unified LLM client.
- Report JSON `schemaVersion` pinned at 1.0.0 (pre-implementation — see C1), carrying a
  required `analysis` subtree + an **optional** `narrative` subtree and a top-level `degraded`
  marker; structured coaching / metric-explanation objects.

### Cross-Cutting Concerns Identified

- Determinism of the metrics engine.
- Secret handling (tokens, LLM keys) end-to-end.
- AI grounding + verification pass + confidence scoring.
- Performance & memory at 50k-commit scale.
- No-network rendering; network only for cloud AI and paid license validation.
- Cross-OS packaging and machine-readable exit codes.
- License enforcement that fails safe and never transmits repo data.

## Starter Template Evaluation

### Domain Framing

commit-whisper's primary domain is a **terminal-native Node.js CLI / batch pipeline**. There
is no server, no persistence layer, and no UI framework in play; the only rich-render
concern is a **self-contained static HTML report** emitted as a build artifact. Because
of this, there is no canonical `create-app`-style starter for the project — the CLI
ecosystem has no single blessed scaffold the way web frameworks do.

### Options Weighed

**Option A — oclif 4.23.14 (generator, batteries-included) — REJECTED as base.**
oclif is an excellent framework for multi-command, plugin-driven CLIs, but commit-whisper is
a single-purpose pipeline, not a command suite. Adopting it would pull in machinery we
never use — the plugin system, auto-update, and AWS-S3-backed distribution — and expand
the dependency surface (including the AWS SDK) in direct conflict with our lean,
privacy-first, self-contained-binary posture. Its packaging story is also independent of
our chosen Node SEA path, so it buys us nothing on distribution either.

**Option B — Lean composed stack — SELECTED.**
A hand-composed, minimal stack gives us full control over the
`retrieve → analyze → narrate → assemble → render` flow with the smallest possible
dependency footprint:

| Concern | Library | Version |
|---|---|---|
| Language / type system (strict, ESM) | TypeScript | 6.0.3 |
| Argument / subcommand parsing | commander | 15.0.0 |
| Interactive menu / prompts / spinner | @clack/prompts | 1.5.1 |
| Bundling | tsup (esbuild) | 8.5.1 (esbuild 0.28.1) |
| Tests (TS-native) | vitest | 4.1.8 |
| Runtime target | Node.js LTS | 22 |
| Distribution | Node SEA (pkg / nexe as alternatives) | — |

**Rationale:** minimal dependency surface and complete control of the pipeline.
TypeScript turns the **Report JSON schema (1.0.0)** and the **~30-metric catalog**
into a typed contract, directly supporting the determinism and machine-artifact NFRs. A
mature alternative to `@clack/prompts` is **`@inquirer/prompts` 8.5.2 + `ora` 9.4.0**; we
keep it on the table but default to @clack for the reasons recorded in the CLI interaction
decision below.

### Initialization (first implementation story)

Project initialization is the **first implementation story**. The scaffold is:

```bash
# Scaffold
npm init -y

# CLI runtime deps
npm install commander@15.0.0 @clack/prompts@1.5.1

# Dev toolchain
npm install -D typescript@6.0.3 tsup@8.5.1 vitest@4.1.8 @types/node@22
```

Strict `tsconfig.json` (ESM, nodenext resolution, modern target):

```jsonc
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2023",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## Decision: CLI Interaction Model & Configuration Resolution

This section records the interaction model the team locked. Product owner **George ruled
STRICT** (see the supersession note at the end).

### Trigger Rule & Capability Gate

The naive trigger is argument count: **zero args → interactive intent; ≥1 arg →
single-shot intent.** But **capability gates intent** — we only ever go interactive when
the environment can actually support it:

```ts
interactive = stdin.isTTY && stdout.isTTY && !isCI && !flags.nonInteractive
```

(CI detection via `ci-info` or env sniffing.) The gate **fails closed** toward
non-interactive: if we cannot prove a usable TTY, we behave headlessly.

### STRICT Single-Shot (George's ruling)

**Any invocation with ≥1 arg is fully non-interactive, REGARDLESS of TTY.** It runs only
if all required inputs are satisfied; any required-missing input produces a typed error
and a non-zero exit code. It **NEVER prompts**, even in an interactive terminal. The
**only** interactive entry point in the entire product is the bare zero-arg `commit-whisper`
invoked in a TTY.

### Truth Table

| `argv` | Environment | Behavior |
|---|---|---|
| 0 args | TTY | **Interactive** — menu + guided prompts |
| 0 args | non-TTY / CI | **Fail fast** — typed error + exit code |
| ≥1 arg | TTY | **Strict single-shot** — no prompts; required-missing = hard error |
| ≥1 arg | non-TTY / CI | **Strict single-shot (headless)** — identical to ≥1 + TTY |

Under STRICT, the **only** row that ever prompts is **0 args + TTY**.

### Two-Phase Configuration Resolver

**Phase 1 — deterministic pure merge.** Merge sources by precedence
`defaults → config file → env → flags` (lowest → highest) into a `PartialRunConfig` that
carries **provenance** for every field. This is a pure function: no I/O, fully
table-testable. **Secret fields are the exception: they are sourced from environment
variables only — the config-file and flag layers never carry secrets.**

**Phase 2 — gap handling.**
- In the single interactive case (**0 + TTY**), prompt for unset **non-secret** fields —
  required ones get real prompts; optional ones are pre-filled with their defaults.
  **Secrets are never prompted**: a missing required secret is surfaced by naming its
  environment variable, exactly as in non-interactive mode.
- In **all** non-interactive cases, a required-missing field is a typed error; an
  optional-missing field falls back to its default.

**Precedence rule:** `explicit flag / env / config > interactive answer > default`. We
**never prompt for a field an explicit source already set.**

### Config Persistence — the `Settings` Write Path

The resolver above only **reads** `~/.commit-whisper/config`. The interactive **`Settings`**
action (UX: *MENUS.md → Settings*) adds the product's one config **write** path: a
`config/config-store.ts` writer that persists the user's **non-secret** everyday choices —
provider, model, base URL, default output format, timezone, max-commits — so they are
set-once and remembered.

- **Non-secret only — by construction.** The writer accepts a closed allow-list of
  non-secret config-file keys and has **no code path that can serialize a secret.** The git
  PAT and the LLM key stay **environment-variable-only** (the Secrets rule below is
  unchanged); a saved Setting never contains a key or token.
- **Read precedence is unchanged.** Persisted values re-enter the resolver at the
  **config-file layer** exactly as before — `defaults → config file → env → flags` — so a
  saved Setting is still overridden by an env var or a flag. Writing changes only what the
  config-file layer *contains*, never where it sits in precedence.
- **Stays a `cli` / `config` concern.** `config/config-store.ts` is invoked from
  `cli/interactive.ts` (Settings is interactive UI only); the **pipeline never writes config
  and still consumes only the frozen `RunConfig`.** The hexagonal boundary holds — Settings
  is a pre-pipeline configuration act, not a pipeline stage.
- **Atomic write.** Persist via **write-to-temp + `rename`** (atomic on a single volume) so a
  racing second invocation or an interrupt can never leave a torn file. The on-disk format
  remains the documented **non-secret config schema** (P7 — `camelCase` keys), the same
  shape the reader already parses; this does not make `~/.commit-whisper` a cache (C1 unchanged).

### Hexagonal Boundary

The pipeline (`retrieve → analyze → narrate → assemble → render`) receives a single
**frozen `RunConfig`** and has **no access to `argv`, `env`, or prompts.** This
guarantees:
- **Safety** — headless execution cannot accidentally prompt.
- **Determinism** — the same `RunConfig` yields the same **`analysis` subtree**. The
  `narrate` stage (which runs per **`aiMode`** — see *RunConfig Contract & Input Source
  Matrix*) is the one non-deterministic layer, bounded by grounding, so a Report's
  **`analysis` subtree is byte-stable for identical input while its `narrative` subtree
  varies** (C1). **Fail-open and metrics-only strengthen this story rather than dilute it:**
  because the substrate render is a pure function of the deterministic `analysis` alone, the
  deterministic core is now **independently renderable** and is **never held hostage** to the
  availability or success of the non-deterministic layer — when narration is off or lost, the
  byte-stable substrate is exactly what ships.
- **Testability** — construct a `RunConfig` directly; no TTY required.

### Stream Discipline

**stdout carries machine data only; stderr carries all human chrome** (menu, spinner,
prompts, update notices). This keeps `commit-whisper --format json > report.json` clean under
every condition.

### Secrets

- **No `--api-key`-style flag is even defined**, so a key can never appear in `argv` or
  `ps` output. The git access token and the LLM key resolve from **environment variables
  only** — never the config file, never a flag, never a prompt. Secrets bypass the
  config-file layer of the resolver entirely.
- **Env-var resolution specifics (read only in `config/env.ts`).** The **LLM key** uses each
  provider's **native** variable — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and for the `gemini`
  provider the SDK-native **`GOOGLE_GENERATIVE_AI_API_KEY`** (what `@ai-sdk/google` reads).
  `config/env.ts` **also** accepts **`GEMINI_API_KEY`** as a friendly alias: it reads the
  alias explicitly and injects it as the provider factory's `apiKey`, rather than relying on
  the SDK's auto-pickup, so the friendly name works without a second SDK contract. The **git
  PAT** resolves with **`COMMIT_WHISPER_GIT_TOKEN` taking precedence** over the host-specific
  `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` fallbacks (see the matrix note on the
  GitHub-Actions `GITHUB_TOKEN` footgun).
- Secrets are wrapped in a `Secret<string>` type whose `toString` / `toJSON` redact to
  `***`. They are never written to Report JSON, logs, or any output.
- **First run, no secret:** behavior is identical in every mode — commit-whisper never
  prompts for or persists a secret.
  - *Argument mode* → hard error naming the required env var and redirecting the user to
    bare `commit-whisper`.
  - *Interactive mode* → the menu **names the required env var to set**; the user exports
    it and re-runs. No masked prompt and no on-disk secret, so the cross-OS `0600`
    secret-at-rest concern is moot.

### Exit-Code Enum (FR-15)

Canonical, complete enum (see **C4** in Core Architectural Decisions), ordered to the pipeline:

| Code | Meaning |
|---|---|
| 0 | Success — full showpiece **or** intentional metrics-only (`aiMode: off`) |
| 1 | Unexpected / internal error |
| 2 | Usage / validation error (bad flags) |
| 3 | Required input missing (non-interactive) |
| 4 | Retrieve / git failure |
| 5 | Metrics-engine failure |
| 6 | Narration / LLM failure — **only when narration was *required*** (`aiMode: required`, e.g. forced `--ai`) |
| 7 | Render failure |
| 8 | License-gate failure |
| 9 | **Completed with degraded output** — `analysis` substrate rendered, `narrative` unavailable (fail-open) |

**The enum splits into two kinds.** Codes `1`–`8` mean *no intended output was produced* and
localize the failing stage; `0` and `9` both mean *a report was produced*. `0` is a clean run
— either the full narrated showpiece **or** an intentional metrics-only run (`aiMode: off`, the
CI/headless default), which is **not** degraded. `9` is the **fail-open** outcome: narration /
grounding / provider failed in the default `auto` mode, so the pipeline rendered the
deterministic `analysis` substrate (with a visible degraded banner) rather than discarding
computed work — a *distinct, scriptable* signal that output exists but is degraded. **`6` is
reserved for the case where narration was genuinely *required*** (`aiMode: required` — e.g. a
forced `--ai` run that cannot reach a provider) and the run therefore truly fails, with no
substrate masquerading as success; `6` and `9` are thus **mutually exclusive by `aiMode`**.
Unlike `1`–`8`, **code `9` is not a thrown `CommitWhisperError`** — it is a degraded-success signal
the CLI shell sets when the render path completed on the substrate (see C4 and
*Fail-Open & Metrics-Only*).

With `--format json`, errors additionally emit a **structured error object**. The
`--show-config` action flag (dumps the resolved config **with per-field provenance**,
secrets redacted via `Secret<string>` ⇒ `***`, then exits) supports CI precedence
verification — see *RunConfig Contract & Input Source Matrix* for its full contract.

### Library Choice

`@clack/prompts` is chosen over `@inquirer/prompts`: it is lighter, ESM-clean, has fewer
transitive deps, and exposes an explicit `isCancel` signal that we map to a defined exit
code. Both libraries bundle into a Node SEA cleanly (pure JS, no native addons).

### Required Spike

Build the **Node SEA** and confirm that interactive prompts, **raw-mode stdin**, and ANSI
rendering all work correctly from the **packaged binary** on macOS, Linux, and Windows.
Keep git retrieval as a **shell-out to the system `git`** (no native bindings such as
`nodegit`) to protect SEA bundling.

### Supersession & Follow-Up

This decision **supersedes** the agents' earlier **RESUMABLE** suggestion (which would
have allowed single-shot to prompt for a first-run key) — George chose **STRICT**. George
subsequently ruled secrets are **environment-variable-only** (no config-file secret
source, no interactive secret prompt), which also retires the `0600` secret-at-rest
question. FR-2, FR-11, FR-14, FR-15, the Glossary, and this section are reconciled
accordingly.

## Core Architectural Decisions

All technology versions below were verified live against the npm registry on 2026-06-12.

### Decision Priority Analysis

**Critical (block implementation):** data contracts & validation (C1), metrics-engine
architecture (C2), AI/narration layer (C3), error & exit-code model (C4).

**Important (shape architecture):** HTML charting & templating (I1), terminal/Markdown
rendering (I2), license enforcement (I3).

**Deferred (post-decision, spike-gated):** Node SEA packaging (D1).

### C1 — Data Contracts & Runtime Validation

- **Validation library: Zod 4.4.3**, imported via `zod/mini` to keep the SEA binary lean.
  Chosen for the richest ecosystem and JSON-Schema emission (free Report JSON contract
  docs). The same schemas are reused by the AI layer (C3) for structured-output coercion.
- **Three validation checkpoints** (the trust boundaries):
  1. **Config-in** — parse env/file/flags into the `PartialRunConfig`.
  2. **LLM-output** — validate the model's structured narration + per-metric explanation
     objects (untrusted by nature).
  3. **Report-JSON-in** — validate on re-render of a previously emitted report.
  The metrics-engine output is **internally typed only** (no external input → trust the
  types; no runtime cost).
- **Canonical Report JSON — a required `analysis` subtree + an optional `narrative` subtree.**
  The contract splits along the determinism seam. **`analysis`** holds the engine's output —
  every metric envelope (`value` + `status`), computed with **no AI** — and is the
  deterministic, byte-stable subtree that trend-diffing (UJ-2) targets; it is **always
  present**. **`narrative`** holds the AI layer's output — repo-level Summary / Explanation /
  Coaching **plus per-metric explanations keyed by metric id**
  (`narrative.explanations[metricId]`) — and is **optional: absent on an intentional
  metrics-only run (`aiMode: off`) and on a fail-open degraded run** (see *Fail-Open &
  Metrics-Only*). The per-metric explanation is **no longer welded into the metric object**
  (C2), so the **whole `analysis` subtree** — not merely sub-fields of it — is cleanly
  diffable, and the substrate is renderable with `narrative` entirely absent. A top-level
  **`degraded: boolean`** marker makes the two narrative-absent cases machine-distinguishable
  in-band (`false` = intentional metrics-only; `true` = narration was attempted and lost), so a
  JSON-artifact consumer that never sees the process exit code can still tell them apart. The
  marker and the analysis-byte-stability rule live **outside** the `analysis` subtree, so they
  never perturb trend-diffing. `schemaVersion` stays **`1.0.0`** (pre-implementation, not yet
  ossified); the subtree split, `narrative`-optionality, and the `degraded` marker are all
  pinned **now**, before 1.0.0 freezes.
- **Caching: stateless every run.** No on-disk clone/analysis cache; re-clone each run.
  Reinforces the no-persistence/privacy posture and keeps the no-retry story clean.
  - *Cascading:* clone into an OS temp dir with **guaranteed cleanup on every exit path**
    (success, failure, Ctrl-C / `isCancel`).
  - *Config home is not a cache:* the `~/.commit-whisper` config home holds only the config
    file and the cached license activation-instance id — it **never** holds repository
    data, so this stateless posture is **unchanged** by it.

### C2 — Metrics Engine Architecture

- **Topology: hybrid.** One shared pass builds a normalized in-memory model (commits,
  files, authors, branch/merge graph); each of the ~30 metrics is then a **pure function**
  over that model. One expensive read; isolated, table-testable, deterministic-by-design
  computations. `not_available` is just a function returning that status.
- **Determinism rules (baked in):**
  1. **Injected `analysisTimestamp`** — all age/recency metrics read a single timestamp
     frozen into `RunConfig`, never `Date.now()`.
  2. **Total stable ordering** — commits by `[committerDate, sha]`, authors by canonical
     identity, files lexically. No reliance on `Map`/`Set` insertion order in any output.
  3. **Author-identity canonicalization** — `.mailmap` honored, else normalized email.
  4. **UTC computation policy** — metrics compute in UTC; author-local time is a display
     detail only. (Resolves the PRD §4.2 timezone-derivation assumption.)
- **Uniform metric envelope:** `{ id, group, title, status: "computed" | "not_available",
  value?, reason? }` — the deterministic shape, and the whole of what lands in the Report
  JSON **`analysis`** subtree (C1). The AI Metric Explanation is **no longer welded into this
  envelope**: assemble keeps the envelope pure and places the explanation in the
  **`narrative.explanations[metricId]`** subtree, joined back to its metric by `id`. This
  keeps `analysis` byte-stable for identical input while `narrative` varies — and, being
  self-contained, the `analysis` subtree is **independently renderable** as the fail-open /
  metrics-only substrate (render).
- **Health band (`ok` / `watch` / `risk` / `n/a`) — derived presentationally; thresholds
  owned by the catalog (UX: *TEMPLATE-HTML.md* status dots).** The report UI shows a
  per-metric status dot, but the envelope deliberately carries only the computed `value` +
  `status`, **not** a health band. **Decision (recommended):** derive the band in a small
  shared classifier (`render/health-band.ts`) — a pure
  `(metricId, status, value) → "ok" | "watch" | "risk" | "n/a"` function; `not_available`
  maps to `n/a`. The **band thresholds are domain knowledge owned by the metrics catalog
  (PRD §4.2)** — sibling to the Group F hygiene weights — **not** invented in the render
  module; `render/health-band.ts` is the **presentational classifier that consumes** those
  catalog-defined thresholds, so the classifier stays in `render/` while the source of truth
  stays in the catalog. *Rationale:* the deterministic **metric value stays the contract**,
  the classifier is the single consumer (no drift across HTML / Markdown / Terminal), and the
  Report JSON (schemaVersion 1.0.0) is **not** widened. Because the classifier is a
  deterministic pure function of catalog constants, promoting the band into the Report JSON
  later (an optional `health?` field) would be a **non-breaking, additive** change if a CI
  consumer ever needs to gate on it — deferred under Rule of Three until that need is proven.

### C3 — AI / Narration Layer

- **Client: Vercel AI SDK `ai` 6.0.203** — a single `generateObject` / `generateText`
  interface across all required providers via `@ai-sdk/openai`, `@ai-sdk/anthropic`,
  `@ai-sdk/google`, `@ai-sdk/openai-compatible`, and an Ollama provider. One error model,
  one streaming model, one bundle; peer-deps Zod `^3.25 || ^4.1.8` (pairs with C1). (The
  `provider` enum value **`gemini`** maps to the **`@ai-sdk/google`** package — a cosmetic
  name difference, not two providers.)
- **Provider reachability preflight (`narrate/preflight.ts`) — `aiMode`-aware.** When AI will
  run, an unreachable or misconfigured provider should surface **early and cheaply**, not
  eight minutes into a run. A dedicated `narrate/preflight.ts` reads `provider` / `llmBaseUrl`
  / `llmModel` from the frozen `RunConfig` and does **one cheap round-trip**: Ollama →
  `GET {baseUrl}/api/tags`; cloud → a `models`-list / low-cost auth surface — **explicitly
  not** a paid `generateObject` dry run. `cli/run.ts` invokes it in the **pre-pipeline gate
  band**, ordered **license gate → provider preflight → retrieve**, but its outcome now branches
  on `aiMode`:
  - **`aiMode: off` (metrics-only)** — the preflight is **skipped entirely**; no provider is
    needed, the `narrate` stage is not run, and the gate band collapses to **license →
    retrieve**.
  - **`aiMode: required` (forced `--ai`)** — a failed preflight is a **hard gate**: exit
    **6 (narration / LLM)** *before any clone*, honoring the user's explicit demand for AI.
  - **`aiMode: auto` (the default)** — a failed preflight does **not** abort. It marks
    narration **non-viable**, surfaces the degraded warning up front, and lets the pipeline
    proceed to `retrieve → analyze → assemble → render` the **substrate** (exit **9**), so an
    Ollama daemon that simply isn't running never costs the user their deterministic report.
  This is **TOCTOU mitigation, not a guarantee** — reachable at preflight ≠ reachable when
  `narrate` actually runs — but it converts the most common failure (no Ollama, bad base URL,
  dead key) from a late, expensive event into an instant, well-localized one, and in `auto`
  mode lets us skip a doomed narration attempt. Status / doctor consumes the **same probe
  read-only** to report *configured vs reachable*.
- **Structured output:** `generateObject` bound to the **C1 Zod schemas** — the model is
  constrained to the Coaching object `{introduction, chapters[], summary}` and the
  per-metric `{explanation, goodBehaviours, needsImprovement, suggestions}` shape. No
  fragile string-parsing.
- **Batching: per-group × 6 + a coaching call.** Metric explanations are batched by Metric
  Group (A–F); coaching is its own call. Bounds each response size (survives modest local
  models), parallelizable, and a single failed group degrades gracefully instead of
  failing the whole run.
- **Grounding (FR-9): deterministic post-generation check**, not a second LLM call. Every
  numeric/fact claim must reference a metric `id` present in the assembled model;
  unreferenced claims fail the confidence check and trigger the FR-10 low-confidence
  escalation. Cheaper, reproducible, cannot itself hallucinate.
- **Sampling determinism:** generation params are **pinned internally** — `temperature: 0`
  and a fixed `seed` where the provider supports it — and are **not** exposed as user
  inputs, holding the determinism posture as tight as the non-deterministic narrative layer
  allows. (Rationale + the advanced-override question live in *RunConfig Contract & Input
  Source Matrix → Key Architecture Rulings*.)
- **Fail-open narration + the showpiece-vs-substrate boundary.** `narrate`, grounding, and the
  provider call are all **fail-open in `auto` mode**: any failure (unreachable provider, a
  refused / garbled structured output, a grounding check that cannot be salvaged) is caught at
  the `narrate` boundary and converted into an **absent `narrative` subtree**, never a discarded
  run — the already-computed deterministic `analysis` (C2) is handed to the render stage
  regardless. In `aiMode: required` the same failure is **not** swallowed: it propagates as
  exit 6. **The narrated showpiece is bound to AI by construction:** the showpiece templates
  (`TEMPLATE-HTML` / `TEMPLATE-MARKDOWN` hero) are pure functions of a Report whose `narrative`
  subtree is **present and non-optional at the type level**, so a substrate Report (no
  `narrative`) **cannot** be passed to the showpiece renderer — it routes to the plainer
  substrate render instead (see *I1* / render). That type-level constraint is what makes
  "AI is required *for the report*" true by construction, while the deterministic substrate stays
  independently renderable.

### C4 — Error & Exit-Code Model

The canonical enum is the **Exit-Code Enum (FR-15)** table above (codes 0–9), which
**supersedes** the earlier 5-code draft. Codes `1`–`8` are *failures* and are ordered to the
pipeline so a non-zero value localizes the failing stage: `4 retrieve · 5 metrics ·
6 narration (required-mode only) · 7 render · 8 license`. With `--format json`, every error
also emits a structured error object. An "unhealthy" repo finding is **not** a failure
(exit 0).

**The fail-open code (9) is a degraded *success*, not a failure.** When narration is lost in
the default `auto` mode the pipeline does **not** throw — it renders the deterministic
`analysis` substrate, and the CLI shell maps that completed-but-degraded run to **exit 9**
(see *Fail-Open & Metrics-Only*). So the shell distinguishes three terminal states: a thrown
`CommitWhisperError` ⇒ its `exitCode` (`1`–`8`); a clean completion ⇒ `0`; a completion that fell
back to the substrate ⇒ `9`. Code `6` stays meaningful precisely because it fires **only** when
narration was *required* (`aiMode: required`); in `auto`, the same underlying narration failure
degrades to `9` instead.

### I1 — HTML Charting & Templating

- **Charting: Chart.js 4.5.1 (canvas), animations disabled** for snapshot-determinism,
  **plus a mandatory accessible data-table fallback** beneath every chart. The fallback
  satisfies the WCAG 2.2 AA / keyboard-navigable floor that a raster canvas alone cannot,
  and doubles as the no-JS degradation path.
- **Templating: typed template literals** — pure TS functions `Report → string`, zero
  deps, fully typed off the Report JSON. Matches "render is a pure function of JSON."
  (`eta 4.6.0` was weighed as the file-based-template alternative and declined to avoid a
  dependency.)
- **Self-containment:** chart library JS + data are **inlined** into the single HTML file;
  it renders in-browser with no CDN or network. (Charts need JS-on; the data-table
  fallback covers JS-off.)
- **Per-metric visuals + file-weight discipline (UX: *TEMPLATE-HTML.md*).** The report now
  carries a right-sized visual on **every** metric card **in addition to** the six group
  overview charts — sized by metric shape: time-series → small line chart; distribution →
  small bar; scalar-in-range → sparkline / mini-gauge; pure scalar → **bold stat, no chart**.
  Inlining ~6 group charts **plus** up to ~24 per-metric visuals into one self-contained file
  raises file weight and render time, so the build is disciplined:
  - **Rail (a) — self-contained file-weight budget.** Target the single HTML report at
    **≤ ~1 MB**, and **flag the build at ~2 MB** as a regression to investigate. The
    **Chart.js 4.5.1 runtime (~150–210 KB) is inlined exactly once** and shared by every
    canvas instance — a fixed cost, **never** duplicated per chart.
  - **Rail (b) — hard cap on live Chart.js canvases.** A canvas instance is **reserved** for
    the **six group overviews** and the **genuinely series / distribution** per-metric cards
    only; **every other per-metric visual is inline SVG / HTML+CSS** (sparkline · mini-gauge ·
    bold stat) — **never a canvas.** This is the main lever on render time and weight, holding
    the live-canvas count far below "one per metric."
  - **Rail (c) — the a11y fallback doubles the data payload (stated cost).** The universal
    accessible data-table fallback **duplicates every chart's underlying data as HTML**
    (~2× the data payload per visual). That is a **fair WCAG 2.2 AA cost**, paid knowingly —
    it is the no-JS degradation path and the keyboard floor — and it is precisely **why** rails
    (a) and (b) exist instead of rendering everything as heavy canvases.
  - This keeps the **self-contained / offline NFR intact** (one runtime + inline SVG, still
    zero network); the only cost is a modestly larger single HTML file. For the **SEA
    binary** the inlined runtime is the same single bundled asset regardless of chart count
    (one copy, not one-per-chart) — no new packaging surface.
- **Accessible fallback is unchanged and now universal:** **every** chart — group overview
  **and** per-metric — keeps its mandatory data-table fallback (the no-JS degradation path),
  per the charting rule above and *TEMPLATE-HTML.md*.
- **Showpiece vs substrate — a render-path branch, not a new boundary (fail-open / metrics-only).**
  Every format has two render paths off the same Report JSON: the **showpiece** (the
  `TEMPLATE-HTML` / `TEMPLATE-MARKDOWN` hero — narrative-first hero band, coaching chapters,
  per-metric explanations) and a plainer **substrate** render driven by the `analysis` subtree
  **alone**. The showpiece renderer's input type **requires** the `narrative` subtree, so a
  substrate Report (no `narrative`) **cannot** be rendered as the showpiece — it can never
  *masquerade* as one. The substrate render is deliberately **plainer** (no hero narrative, no
  coaching) and carries a banner: a **loud `⚠ Narrative unavailable — raw analysis below`** on a
  fail-open (`exit 9`) run, and a **neutral** "metrics-only run" note on an intentional
  `aiMode: off` (`exit 0`) run — same template, different framing. This is purely a render-path
  branch; the hexagonal boundary, the frozen `RunConfig`, and stateless retrieval are all
  unchanged.

### I2 — Terminal & Markdown Rendering

- **Terminal:** **picocolors 1.1.1** (`NO_COLOR`-aware) for color, with **hand-rolled
  tables** reusing the width primitives already pulled in by `@clack`. (`cli-table3 0.6.5`
  was the proven alternative; hand-rolling stays leaner.)
- **Markdown:** text tables + ASCII sparklines + **Mermaid** diagrams (native on
  GitHub/GitLab; fenced code where unsupported). No embedded/binary images.

### I3 — License Enforcement

- **Mechanism: online Lemon Squeezy License API** (`activate` / `validate` / `deactivate`)
  via the global `fetch` (no SDK — leaner SEA binary; the store-management surface is not
  bundled).
- **Device binding:** Single-device tier is bound via Lemon Squeezy **activation
  instances** (server-side); Unlimited/Automation permits many activations including CI.
- **CI / headless:** the runner **validates, does not re-activate**, using the license key
  from an **environment variable** — avoids exhausting activation limits across a
  multi-repo matrix.
- **Key & instance storage:** license key via env var (CI/headless) or a one-time
  interactive activation that caches the returned **activation-instance id** in the config
  dir. That cached id is a **licensing artifact, not a user secret** — explicitly distinct
  from the env-only rule governing the PAT and LLM key.
- **Fail-closed:** an unreachable server or failed validation grants **no paid features**
  and surfaces a typed error + the **license-gate exit code (8)**; the Free 100-commit path
  is unaffected (it makes no call).
- **Offline removed:** there is no offline guarantee for paid tiers (validation needs
  network at startup). The **privacy** guarantee is preserved and independent: with Ollama,
  no repository data leaves the machine, and license calls carry only the key + a device
  id — never repository data. PRD FR-16 / §7 / §9 reconciled by the PM.

### D1 — Packaging (Deferred, Spike-Gated)

**Node SEA** is the distribution target, but it is **gated on a spike**: confirm
interactive prompts, **raw-mode stdin**, and ANSI rendering work from the packaged binary
on macOS, Linux, and Windows. Git retrieval stays a **shell-out to the system `git`** (no
native bindings such as `nodegit`) to protect bundling. `pkg` / `nexe` remain fallbacks.

### Decision Impact Analysis

**Implementation sequence (suggested):** (1) scaffold + strict tsconfig → (2) `RunConfig`
with two-phase resolver + Zod schemas (C1) → (3) retrieval (git shell-out) → (4) metrics
engine + determinism harness (C2) → (5) Report JSON assembly → (6) AI layer + grounding
(C3) → (7) renderers HTML / Markdown / Terminal + JSON emit, incl. the showpiece-vs-substrate
branch (I1/I2) → (8) license gate (I3) → (9) SEA spike (D1).

**Cross-component dependencies:**
- C1 Zod schemas are shared by C3 (structured output) and the Report JSON contract — design
  them once, first.
- C2's injected `analysisTimestamp` originates in `RunConfig` (C1) and flows through the
  frozen config across the hexagonal boundary.
- The exit-code enum (C4) is consumed by the CLI shell, the license gate (I3), and CI
  (FR-15) — it must be stable before those land.
- Chart.js + data-table fallback (I1) and the Report JSON shape (C1) co-vary: the fallback
  table renders directly from the same metric envelopes.
- The runtime **pre-pipeline gate band** in `cli/run.ts` runs **license gate (I3) → provider
  reachability preflight (C3, `narrate/preflight.ts`, `aiMode`-gated) → retrieve**. The license
  gate is always load-bearing (invalid entitlement → exit 8 before any clone). The preflight is
  **conditional on `aiMode`**: in `required` an unreachable provider fails **before any clone**
  (exit 6); in `auto` it does **not** block — it flags the run to **fail open** to the substrate
  (exit 9); in `off` it is **skipped entirely** (the gate band collapses to license → retrieve).
  This is distinct from the *build* sequence above, in which the license gate is implemented
  last.

## RunConfig Contract & Input Source Matrix

This section pins the **resolved input inventory** (party-mode round, 2026-06-12) onto the
two-phase resolver and the hexagonal `RunConfig`. It refines — does not replace — the CLI
Interaction Model decision above: the trigger rule, capability gate, STRICT single-shot,
env-only secret rule, and stream discipline all stand. Inputs split three ways:
**config-data** (flows into the frozen `RunConfig`), **action / mode flags** (short-circuit;
never enter `RunConfig`), and **behavior modifiers** (chrome only; never alter results).

### The Frozen RunConfig Contract

`config/` resolves every config-data field, freezes the result, and hands it across the
hexagonal boundary. Secrets are `Secret<string>` (redacted); `branch` carries an explicit
sentinel rather than a magic empty string; absent dates are genuinely `undefined`
(= unbounded). The injected `analysisTimestamp` (C2), the resolved licensing `entitlement`
(I3), and per-field `provenance` (P7) ride along inside — none of them a raw user input.

```ts
type Provider = "ollama" | "openai" | "gemini" | "anthropic" | "openai-compatible";
type OutputFormat = "html" | "markdown" | "terminal" | "json";

interface RunConfig {
  // — repository —
  repoTarget: string;              // local path | remote HTTPS URL; defaults to cwd
  gitPat?: Secret<string>;         // env-only; private remote only
  branch: { kind: "named"; name: string } | { kind: "all" };  // sentinel, never ""
  // — scope / filters (optional ⇒ unbounded) —
  startDate?: IsoDate;             // unset = no lower bound
  endDate?: IsoDate;               // unset = no upper bound
  timezone: string;                // IANA tz; default "UTC"; governs filters + buckets
  authorFilter?: string;
  maxCommits?: number;             // positive int; interacts with the Free 100-cap
  noMerges: boolean;               // default false; CHANGES the analyzed commit set
  // — output —
  outputFormats: OutputFormat[];   // multi-select, ≥ 1
  outputPath?: string;             // file formats only; "-" = stdout
  // — AI (runs per aiMode; see rulings) —
  aiMode: "required" | "auto" | "off";  // default: interactive→"auto", headless/CI→"off"; --ai⇒required, --no-ai⇒off
  provider: Provider;              // required unless aiMode==="off"
  aiKey?: Secret<string>;          // env-only, native per-provider var; not for ollama / aiMode "off"
  llmBaseUrl?: string;             // required for ollama / openai-compatible (when AI runs)
  llmModel: string;                // required when AI runs; defaulted per provider
  // — injected by the config / license layer, NOT user inputs —
  analysisTimestamp: IsoDate;      // C2 determinism anchor (never Date.now())
  entitlement: { tier: "free" | "single-device" | "unlimited"; commitCap?: number };
  provenance: Record<string, Source>;            // P7: which layer set each field
}
```

`licenseKey` is **deliberately absent** from `RunConfig`: the raw credential is consumed by
the license gate (I3); the pipeline only ever sees the resolved `entitlement` (tier +
effective `commitCap`).

### Input Source Matrix (config-data)

Precedence is uniform — **defaults → config file → env → flags** (low → high) — and an
interactive answer slots **above default, below any explicit flag / env / config** per the
Phase-2 rule (we never prompt for a field an explicit source already set). Secrets bypass
the config / flag / prompt layers entirely (**env only**).

| Field | Sources | Env var | Class | Requiredness · schema · notes |
|---|---|---|---|---|
| `repoTarget` | flag(pos)·config·env·prompt | `COMMIT_WHISPER_REPO` | non-secret | required overall; **defaults to cwd**; local path or HTTPS URL |
| `gitPat` | **env only** | `COMMIT_WHISPER_GIT_TOKEN` (**primary**) → host fallback `GITHUB_TOKEN`·`GITLAB_TOKEN`·`BITBUCKET_TOKEN` (lower precedence) | **secret** | conditional — **private remote only**; never flag/config/prompt |
| `branch` | flag·config·env·prompt | `COMMIT_WHISPER_BRANCH` | non-secret | default = repo HEAD; reserved `all` ⇒ `{kind:"all"}` sentinel |
| `startDate` | flag·config·env·prompt | `COMMIT_WHISPER_START_DATE` | non-secret | optional; **unset = unbounded**; `YYYY-MM-DD`, read in `timezone` |
| `endDate` | flag·config·env·prompt | `COMMIT_WHISPER_END_DATE` | non-secret | optional; **unset = unbounded** |
| `timezone` | flag(`--tz`)·config·env | `COMMIT_WHISPER_TZ` | non-secret | **default `UTC`**; **determinism-critical** (governs date filters + time-bucketed metrics); not prompted |
| `authorFilter` | flag·config·env·prompt | `COMMIT_WHISPER_AUTHOR` | non-secret | optional; matches canonical (.mailmap) identity |
| `maxCommits` | flag·config·env·prompt | `COMMIT_WHISPER_MAX_COMMITS` | non-secret | optional positive int; see Date × Free-Cap ruling |
| `noMerges` | flag(`--no-merges`)·config·env·prompt | `COMMIT_WHISPER_NO_MERGES` | non-secret | bool, default `false`; **affects metric values** (not cosmetic) |
| `outputFormats` | flag(`--format`, repeatable)·config·env·prompt | `COMMIT_WHISPER_FORMAT` | non-secret | **multi-select** `{html,markdown,terminal,json}`; ≥ 1; default `terminal` |
| `outputPath` | flag(`-o`)·config·env·prompt | `COMMIT_WHISPER_OUT` | non-secret | applies to the **file formats** `{html, markdown, json}` (default `./commit-whisper-report.{html,md,json}`; `-` = **stdout**); `terminal` is **stdout-native** and ignores it |
| `aiMode` | flag(`--ai` / `--no-ai`)·config·env·channel-default | `COMMIT_WHISPER_AI_MODE` (alias `COMMIT_WHISPER_NO_AI`) | non-secret | tri-state (`required` · `auto` · `off`); **default `auto` interactive / `off` headless·CI**; `off` ⇒ skip `narrate` + preflight, exit 0; `auto` ⇒ fail-open substrate (exit 9) on narration loss; `required` (`--ai`) ⇒ hard-fail exit 6 |
| `provider` | flag·config·env·prompt | `COMMIT_WHISPER_PROVIDER` | non-secret | **required unless `aiMode: off`**; closed enum of 5 |
| `aiKey` | **env only** | native per provider: `OPENAI_API_KEY`·`ANTHROPIC_API_KEY`·`GOOGLE_GENERATIVE_AI_API_KEY` (alias `GEMINI_API_KEY`)·… | **secret** | conditional — **not for `ollama`**; never flag/config/prompt |
| `llmBaseUrl` | flag·config·env (·prompt¹) | `COMMIT_WHISPER_LLM_BASE_URL` | non-secret | conditional-required for `ollama`/`openai-compatible`; `ollama` defaults to `http://localhost:11434` |
| `llmModel` | flag·config·env·prompt | `COMMIT_WHISPER_LLM_MODEL` | non-secret | required, but **defaulted per provider** |
| `licenseKey` | **env** or one-time interactive `activate` | `COMMIT_WHISPER_LICENSE_KEY` | **license credential** | not a pipeline input; activation caches an **instance id** in `~/.commit-whisper`; gate resolves `entitlement` (I3) |

¹ The inventory lists `llmBaseUrl` as flag/env/config; per the Phase-2 rule it is **also
prompted in interactive when conditionally required** (e.g. `openai-compatible`, which has
no sane default). Recorded as a completion, not a contradiction.

**`aiMode: off` short-circuits the AI cluster.** When the resolved `aiMode` is `off` (the
headless/CI default or an explicit `--no-ai`), the entire AI cluster — `provider`, `aiKey`,
`llmBaseUrl`, `llmModel` — is **not required**: no provider is consulted, the reachability
preflight is **skipped**, and the `narrate` stage does not run. The substrate is the intended
output and the run is a clean exit 0 (see *Key Architecture Rulings* and *Fail-Open &
Metrics-Only*).

**Git-PAT env names — architect's call (confirm at impl):** `COMMIT_WHISPER_GIT_TOKEN` is the
**primary** namespaced variable and **always wins**; the host-specific names —
`GITHUB_TOKEN` (github.com), `GITLAB_TOKEN` (gitlab.com), `BITBUCKET_TOKEN` (bitbucket.org),
resolved from the parsed remote **host** — are a **lower-precedence convenience fallback**.
Precedence matters because of a real footgun: **GitHub Actions auto-injects `GITHUB_TOKEN`**
scoped to the *current* repo, which would otherwise silently shadow the credential a user
intends for a *different* target. Letting the namespaced `COMMIT_WHISPER_GIT_TOKEN` win keeps
the user's explicit choice authoritative; the host names stay handy for the common
single-host case and for **self-hosted / enterprise** hosts the public names cannot
disambiguate.

### Action / Mode Flags (short-circuit — never enter RunConfig)

These resolve before, or instead of, the pipeline and are kept **out** of `RunConfig`:

| Flag / subcommand | Effect |
|---|---|
| `--help`, `--version` | print and exit `0` |
| `--show-config` | dump **resolved values + per-field provenance**, then exit; secrets print via `Secret<string>` ⇒ `***` |
| `--non-interactive` | forces the capability gate **closed** (STRICT headless even in a TTY) |
| `--config <path>` (or `COMMIT_WHISPER_CONFIG`) | selects the config file; **resolved before** the config layer, so it can come **only from a flag or env** — never from the file it names (provenance edge case) |
| `license activate` / `deactivate` | license lifecycle (I3): `activate` validates a typed key and caches the activation-instance id; `deactivate` frees it (FR-16). The interactive **Buy / Restore** door is a **browser hand-off** (opens the store) — there is **no in-terminal key-restore** subcommand. |

### Behavior Modifiers (chrome, not results)

- `--verbose` / `--quiet` (+ `COMMIT_WHISPER_LOG_LEVEL`) — log verbosity; **stderr only**, never touches stdout data.
- `NO_COLOR` / `FORCE_COLOR` — color policy for the `ui` module (stderr; picocolors-aware, I2); `NO_COLOR` wins.

### Key Architecture Rulings

- **AI is the default, not a hard precondition — `aiMode` is a `RunConfig` dimension.** AI is
  required **for the narrated showpiece report**, but **not** to produce *some* output. The
  tri-state `aiMode` (`required` · `auto` · `off`) governs the `narrate` stage from the frozen
  `RunConfig` (hexagonal-clean — the pipeline reads a field, never `argv` / `env`):
  - **`auto` — the interactive default (AI-first).** Narration is attempted; on any
    narrate / grounding / provider failure the run **fails open** to the deterministic
    `analysis` substrate with a visible degraded banner and **exit 9** — computed work is never
    discarded.
  - **`off` — the headless/CI default and the explicit `--no-ai` opt-out (metrics-only).** The
    `narrate` stage and the preflight are **skipped**; the substrate is the *intended* output
    and the run is a clean **exit 0** (not degraded). This kills the wasted-CI-inference tax of
    forcing an LLM call into every automated run. `off` is **never** the interactive default and
    **never** the Free-tier identity — defaults stay AI-first where a human is watching.
  - **`required` — the forced `--ai`.** Narration is mandatory; an unreachable provider or a
    narration failure is a **hard exit 6**, with no substrate masquerading as success.
  *Consequence (unchanged determinism):* the only fully **byte-stable** part of a Report is the
  **`analysis` subtree** (C1); the `narrative` subtree varies (bounded by grounding, C3) and is
  **optional**. CI reproducibility is **`analysis`-subtree-diffable** in every mode — and is
  *strengthened* by `off` / fail-open, since the substrate is now independently renderable
  rather than hostage to the non-deterministic layer. *Onboarding trade-off (softened):* an
  interactive first run still wants a working provider — local **Ollama** (free, private, no
  key) or a cloud key — to get the showpiece, but a missing provider now **degrades** to the
  substrate instead of blocking all output. *Supersession:* this refines the earlier "AI
  required every run / no metrics-only path" ruling per the 2026-06-13 fail-open decision;
  George's "**the report needs AI**" call stands — it is now enforced *by construction* (the
  showpiece needs the `narrative` subtree, C3 / render), not by aborting runs.
- **Config home = `~/.commit-whisper`.** Holds the **config file** and the **cached license
  activation-instance id** — nothing else. The repo to analyze **defaults to cwd**; remote
  repos remain **stateless temp-clone-with-cleanup (C1 unchanged)**. `~/.commit-whisper` is
  **not** a clone / analysis cache and **never** holds repository data. Its cross-OS path
  convention (XDG base dir / `%APPDATA%`) is an impl detail to confirm.
- **Date × Free-Cap ordering.** **Filter by date first**, then cap to the most-recent
  **100** commits within range (Free tier), using the C2 total order `[committerDate, sha]`.
  Any truncation is surfaced on **stderr** ("showing 100 of N"); the cap never silently
  reshapes the date window.
- **LLM sampling determinism (recommendation).** Pin generation params **internally** —
  `temperature: 0` and a fixed `seed` where the provider supports it — and **do not** expose
  them as user inputs, to keep the determinism posture as tight as the (inherently
  non-deterministic) narrative layer allows. *Open question:* whether to later surface a
  single advanced override (e.g. `--llm-temperature`) for power users; the default stance is
  **not exposed**.

## Reconciliation — UX Composition (2026-06-12)

Three architectural refinements absorbed from the UX composition specs Sally authored. Each
**refines an existing decision in place**; none reverses a locked one — env-only secrets,
the hexagonal boundary, C1 stateless retrieval, and the determinism posture all stand.

1. **Config-write path** (→ *Config Persistence — the `Settings` Write Path*;
   `config/config-store.ts`). The interactive `Settings` action persists **non-secret**
   config to `~/.commit-whisper`; the resolver's read precedence
   (`defaults → config file → env → flags`) is unchanged and secrets remain env-only.
2. **Per-metric visuals + file-weight** (→ *I1*; `render/html/sparkline.ts`). Six group
   overview charts **plus** a right-sized per-metric visual on every card; one inlined
   Chart.js runtime, lightweight inline SVG for the small visuals, an accessible data-table
   fallback on **every** chart — self-contained / offline NFR intact.
3. **Metric health band** (→ *C2*; `render/health-band.ts`). The
   `ok` / `watch` / `risk` / `n/a` status dot is **derived presentationally** from `value` +
   thresholds **owned by the metrics catalog (PRD §4.2)**; the metric envelope and Report
   JSON are unchanged, preserving determinism.

Sources — `docs/planning-artifacts/ux-designs/ux-commit-whisper-2026-06-11/`:
`MENUS.md`, `TEMPLATE-HTML.md`, `TEMPLATE-MARKDOWN.md`.

## Alignment Fix Pass (2026-06-13)

A party-mode alignment review (PRD ⋈ UX ⋈ Architecture ⋈ Epics) surfaced real defects; the
orchestrator **locked** cross-cutting resolutions so every agent encodes them identically.
The nine below are the **architecture-side** fixes, applied here in place. Each **refines an
existing decision**; none reverses a locked one — C1 stateless retrieval, env-only secrets,
and the hexagonal boundary all stand.

1. **Report JSON `analysis` / `narrative` split** (C1, C2, assemble). The canonical Report
   JSON now has two top-level subtrees: **`analysis`** (deterministic engine output — metric
   envelopes only, no AI) and **`narrative`** (AI Summary / Explanation / Coaching + per-metric
   explanations keyed by metric id). The per-metric explanation **no longer welds into the
   metric envelope**, so the whole `analysis` subtree is byte-stable and cleanly
   trend-diffable (UJ-2). `schemaVersion` stays **`1.0.0`** — pinned now, before it ossifies.
2. **Determinism contract corrected** (Hexagonal Boundary, Key Rulings). Wording that called
   "the metrics block" byte-stable now reads honestly: the **`analysis` subtree** is
   byte-stable for identical input; the **`narrative` subtree** varies, bounded by grounding.
3. **Provider reachability preflight** (C3, `narrate/preflight.ts`). One cheap round-trip in
   the **pre-pipeline gate band** (`license gate → provider preflight → retrieve`) fails an
   unreachable provider with **exit 6 before any clone** — TOCTOU mitigation, and the
   compensating control for the AI-required ruling. Status / doctor reads the same probe.
   (Subsequently made **`aiMode`-gated** by *Fail-Open & Metrics-Only*: hard exit 6 only in
   `required`; skipped in `off`; non-blocking — fail-open — in `auto`.)
4. **JSON default destination** (source matrix `outputPath`). `{html, markdown, json}` are
   **file formats** (default `./commit-whisper-report.{html,md,json}`, `-` = stdout); `terminal`
   is stdout-native.
5. **Gemini env var** (source matrix, Secrets). Canonical native
   **`GOOGLE_GENERATIVE_AI_API_KEY`**; **`GEMINI_API_KEY`** accepted as an explicit alias
   that `config/env.ts` injects as `apiKey` (not SDK auto-pickup).
6. **Git PAT naming** (source matrix, Secrets). **`COMMIT_WHISPER_GIT_TOKEN` is primary**;
   `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` are lower-precedence fallbacks —
   guarding the GitHub-Actions auto-`GITHUB_TOKEN` footgun.
7. **Health-band ownership** (C2). The `ok` / `watch` / `risk` / `na` thresholds are **domain
   knowledge owned by the metrics catalog (PRD §4.2)**, consumed by the presentational
   `render/health-band.ts` classifier — not invented in the render module.
8. **Per-metric file-weight rails** (I1). Three rails: a self-contained-HTML weight budget
   (≤ ~1 MB, flag at ~2 MB), a hard cap on live Chart.js canvases (group overviews +
   series/distribution only; the rest inline SVG/CSS), and an explicit statement that the
   a11y data-table fallback ~doubles the data payload.
9. **Perf spike + new risk** (Gap Analysis). The 50k spike now explicitly tests the
   fully-resident shared model (Group E churn is the memory driver) with a streaming / fold
   fallback in reserve; a new tracked risk — **provider reachability + Ollama lifecycle** —
   is recorded as reliability / UX, load-bearing for the narrated showpiece (subsequently
   refined to *graceful degradation* by *Fail-Open & Metrics-Only*).

Source — the 2026-06-13 party-mode alignment review (PRD owned by John, UX by Sally, epics
by the orchestrator; this pass touches **architecture only**).

### Final polish pass (2026-06-13)

A whole-document consistency sweep after the appended fix sections — **no new scope, no
locked decision touched.** The earlier body now tells the **same** story as the later fixes,
so a fresh reader meets one coherent architecture, not a doc that argues with itself:

- **Determinism stated once, authoritatively.** The Requirements Overview, Technical
  Constraints, and the determinism harness now all speak the same language — the `analysis`
  subtree is byte-stable, the AI `narrative` varies (bounded by grounding). The harness
  comment now checks the **`analysis` subtree**, not the misleading "identical-JSON."
- **Per-metric visuals, everywhere they belong.** The early Visualization summary no longer
  says "chart-per-group"; it matches **I1** — a per-group overview chart **plus** a
  right-sized per-metric visual on every card.
- **Report JSON, post-split.** The early Report-Output summary and the `schemaVersion`
  mentions now name the two subtrees and drop "fixed/frozen" wording: 1.0.0 is **pinned
  pre-implementation** (C1), not ossified.
- **Four output formats.** The component map and the coverage table now count **four**
  formats and list the JSON renderer alongside HTML / Markdown / Terminal.
- **License lifecycle reconciled to PRD FR-14 / FR-16.** Removed the stale key-based
  `restore` subcommand: `activate` (the only in-terminal key-entry path) and `deactivate`
  are the lifecycle subcommands; **Buy / Restore** is a **browser hand-off** (opens the
  store), never an in-terminal key restore.

The four tracked risks — 50k fully-resident-model (+ streaming/fold fallback) · Node SEA ·
TS 6 toolchain · provider-reachability / Ollama-lifecycle — are confirmed current and
well-framed. **Verdict: buildable from this document without guessing.**

## Fail-Open & Metrics-Only (2026-06-13)

A party-mode debate on whether a run may ever produce output without AI concluded with the
orchestrator **locking** a fail-open render path and a metrics-only mode. The decision
**refines — does not reverse** — George's "**the report needs AI**" ruling: the narrated
*showpiece* still requires AI **by construction**, while the deterministic substrate becomes
independently renderable. These are the **architecture-side** encodings; each refines a
decision in place (C1 / C2 / C3 / render / RunConfig / C4) and none disturbs the hexagonal
boundary, stateless retrieval, or env-only secrets.

1. **Fail-open render path.** A `narrate` / grounding / provider failure **no longer
   discards** the already-computed deterministic `analysis`. `assemble` always carries the
   `analysis` subtree; when `narrative` is absent or failed, the renderer takes the
   **substrate** branch (a plainer, analysis-only render) instead of aborting on computed work.
   This is a **render-path branch, not a new boundary** — the hexagonal / stateless model is
   unchanged (C1, C3, render).
2. **Exit-code resolution (the architect's call).** The debate floated "exit 3" for a
   degraded-but-rendered run, but `3` is **Required input missing** in the locked enum.
   **Resolved with a new dedicated code — `9` = "completed with degraded output; `analysis`
   rendered, `narrative` unavailable."** Rationale: the locked decision demands a *distinct,
   scriptable* signal, which **exit 0 + marker cannot give** (`$?` would read success); a new
   non-zero code does, while staying semantically apart from the stage-failure codes `1`–`8`
   (which mean *no output*). The enum now reads in two kinds — `1`–`8` *failed, no output*;
   `0` / `9` *produced output* (`0` clean or intentional metrics-only, `9` degraded). **Code
   `6` is retained for narration that was genuinely *required*** (`aiMode: required`, e.g.
   forced `--ai`) and truly fails; `6` and `9` are mutually exclusive by `aiMode`. **Metrics-only
   (`--no-ai`) exits `0`, not `9`** — it is intended, not degraded. (Enum table + C4 +
   `cli/exit-codes.ts` updated.)
3. **`aiMode` as a `RunConfig` dimension.** A tri-state `aiMode: "required" | "auto" | "off"`
   joins the frozen `RunConfig` (source-matrix row + TS sketch): explicit `--no-ai` ⇒ `off`,
   explicit `--ai` ⇒ `required`, **default `auto` interactive / `off` headless · CI**. The
   pipeline reads it from the frozen config (hexagonal-clean). **Preflight interaction:** in
   `off` the provider preflight is **skipped entirely** (no provider needed); in `required` a
   failed preflight is a hard **exit 6** before clone; in `auto` it never blocks — it flags the
   run to fail open.
4. **Showpiece bound to AI by construction.** The full narrated showpiece templates
   (`TEMPLATE-HTML` / `TEMPLATE-MARKDOWN` hero) are pure functions of a Report whose `narrative`
   subtree is **present and non-optional at the type level**; a substrate Report (no
   `narrative`) **cannot** be passed to the showpiece renderer and routes to the plainer
   substrate render. That type-level constraint is what makes "AI-required *for the report*"
   true — a substrate render (fail-open **or** metrics-only) can never *masquerade* as the
   showpiece (C3, I1, render).
5. **Determinism, strengthened.** Fail-open and metrics-only **reinforce** the determinism
   story: the `analysis` substrate is fully deterministic and **now independently renderable**,
   so the deterministic core is **never held hostage** to the non-deterministic narrative
   layer — when narration is off or lost, the byte-stable substrate is exactly what ships
   (Hexagonal Boundary, C1).

**Terminal outcomes (one row per case):**

| Run | `aiMode` | `narrative` | Render | Exit |
|---|---|---|---|---|
| Full narrated showpiece | `auto` / `required`, narration OK | present | **showpiece** | `0` |
| Intentional metrics-only | `off` (`--no-ai` or CI/headless default) | absent *by design* | substrate + neutral note | `0` |
| Fail-open degraded | `auto`, narration unreachable/failed | absent *by failure* | substrate + ⚠ degraded banner | `9` |
| Forced-AI hard fail | `required` (`--ai`), narration unreachable/failed | — (run aborts) | none (typed error) | `6` |

Source — the 2026-06-13 party-mode fail-open / metrics-only decision (PRD owned by John, UX by
Sally, epics by the orchestrator; this pass touches **architecture only**). Schema ripple noted
for John: the Report JSON now makes `narrative` **optional** and adds a top-level **`degraded`**
marker (PRD FR-12 may want to mirror the optionality + marker); `schemaVersion` stays `1.0.0`,
pinned pre-implementation.

## ADRs — HTML Renderer Inline-SVG Rebuild (2026-06-18)

Four decisions taken while building the HTML report renderer (Stories 4.1–4.2) that **deviate
from I1 as originally locked**. Recorded here, in the dated-decision-pass family, so the
architecture and the shipped renderer stop drifting. Two **extend** I1 in its own spirit (the
inline-SVG engine, the second per-group chart), one **reverses** a locked leanness call (the
inlined web font), and one **relaxes** a Story-4.2 acceptance criterion (progressive disclosure).
The first was pre-approved in the Story 4.2 *ADR deviation* note (2026-06-14) and is **promoted to
the architecture record** here; the other three are new.

**What did NOT change — the load-bearing invariants (stated so reviewers can confirm at a
glance):** the renderer is still a pure `Report → string` function (no clock, no random, no I/O;
SVG coordinates rounded so output is **byte-stable** and Node-snapshot-testable); still
**self-contained** (no `<link>`, no `<script src>`, no CDN, no `@import`, no network); still
HTML-escapes **every** interpolated value at the render boundary (OWASP A03 / stored-XSS into a
shareable artifact); still meets the **WCAG 2.2 AA floor** (semantic landmarks, `role="img"` +
`aria-label` on every chart, a mandatory `<table>` data-table fallback, a working no-JS path); and
still lives inside the **Rail (a)** ~1 MB weight budget. The hexagonal boundary, frozen
`RunConfig`, stateless retrieval, and the showpiece-vs-substrate branch (C3 / I1) are untouched.

### ADR H1 — Inline-SVG chart engine supersedes Chart.js (extends I1)

- **Context.** I1 locked **Chart.js 4.5.1 (canvas, animations off)** plus a data-table fallback,
  with **Rails (a)/(b)** built to cap how many live canvases the report inlines. A canvas renders
  only in a browser, so it is **neither deterministic nor snapshot-testable in Node** — the
  determinism posture every other render surface holds.
- **Decision.** Replace Chart.js wholesale with a **pure inline-SVG chart engine**
  (`render/html/svg.ts`): each chart is a deterministic `data → SVG string` transform — `svgLine`,
  `svgSparkline`, `svgBars`, `svgHBars`, `svgGauge`, `svgRadar` (plus the two new primitives in ADR
  H2). The charts draw **real axes**, not decorative shapes: value gridlines + tick labels via a
  **"nice tick" 1/2/5 × 10ⁿ** algorithm (`niceStep` / `valueTicks`), category/month x-axis labels
  via an **ISO-key prettifier** (`tickLabel`: `2026-03` → `Mar`, `…-W12` → `W12`, path → basename),
  and component labels at each radar axis tip.
- **Rationale.** Determinism + Node snapshot-testability (no browser, no canvas, no DOM);
  self-containment with **zero new dependencies** and **no ~150–210 KB runtime to inline**; a native
  **no-JS floor** (inline SVG + `<details>` tables need no script to display). This is **Rails
  (a)/(b) taken to their conclusion** — they already pushed everything except a few canvases toward
  inline SVG; H1 removes the last canvases too.
- **Consequences.** Charts draw in a uniform-scaled coordinate space
  (`preserveAspectRatio="xMidYMid meet"`) so text stays crisp at any width; coordinates are rounded
  (2 dp) and all values finite-guarded (`safe`) against `NaN` / `±Infinity`. **Rail (b)** (the
  live-canvas cap) is now **moot** — there are no canvases. The accessible contract is **unchanged
  and universal**: every chart keeps `role="img"` + `aria-label` + a mandatory `<table>` fallback.
  *(Internal staleness to sweep later: the I1 prose above and a header comment in `charts.ts` still
  say "Chart.js" / "fixed-type"; the shipped constants are authoritative.)*
- **Status.** Accepted / Implemented — 2026-06-18. (Promotes the user-approved Story 4.2 *ADR
  deviation*, 2026-06-14, to the architecture record.)

### ADR H2 — Two charts per group + new SVG primitives (revises the fixed-type-per-group spec)

- **Context.** The locked UX spec (*TEMPLATE-HTML*) gave each group **one fixed-type** overview
  chart — and Group B specifically as a **"Pareto bar + bus-factor marker."**
- **Decision.** Each group now renders a **primary + a secondary** chart (`GROUP_CHARTS` in
  `render/html/charts.ts`), the secondary chosen by the **value-shape** available in the group — a
  **radial gauge** for a 0–100 share/score, a **doughnut**, or a second series. This adds two
  primitives to the engine: **`svgDonut`** (annular-sector `<path>` arcs + a side legend rendering
  `label · share%`) and **`svgRadialGauge`** (a full-ring arc via `stroke-dasharray` + centre value
  text). The shipped plan: A volume line + cadence bars · **B ownership doughnut + concentration
  gauge** · C category bars + adherence gauge · D merge line + direct-to-default gauge · E hotspots
  h-bars + churn-trend line · F component radar + hygiene gauge.
- **Rationale.** A single chart underuses each group's data; a shape-matched second view
  (composition as a doughnut, a bounded score as a gauge) reads better and reuses the same
  deterministic engine at **no dependency cost**.
- **Consequences — a deliberate divergence to reconcile.** **Group B is now an ownership doughnut +
  a concentration gauge, not the locked "Pareto bar + bus-factor marker."** This is recorded as an
  **explicit, intentional divergence**; the **bus-factor marker is not yet expressed** in the new
  pairing. **Recommendation (next step, owned by the UX designer): update *TEMPLATE-HTML* to
  match** — ratify the two-chart-per-group model and re-specify where the Group B bus-factor signal
  lands. Each sub-chart keeps its own data-table fallback (still "never a chart alone").
- **Status.** Accepted / Implemented — 2026-06-18. UX-spec reconciliation **pending** (Sally).

### ADR H3 — Inlined Inter web font (reverses the system-font-stack leanness call)

- **Context.** Story 4.1's shell deliberately shipped a **system-font stack** ("no web font —
  self-contained + lean").
- **Decision.** The report now **inlines the Inter latin subset** (weights 400/600/700/800) as
  base64 **woff2 `data:` URIs**, isolated in `render/html/inter-font.ts` (`INTER_FONT_CSS`) and
  injected once into the document `<style>`. The body `font-family` leads with `"Inter"` and keeps
  the system stack as fallback.
- **Rationale.** A consistent, designed typographic identity on every machine, independent of
  installed fonts — the report is a **shareable artifact**, so its look should not vary host-to-host.
- **Consequences — the weight tradeoff (flag this one).** This **reverses** the leanness decision and
  adds **~130 KB** per report (sample reports land **~210–225 KB** — still **comfortably under the
  Rail (a) ~1 MB budget**, nowhere near the ~2 MB regression flag). It remains **fully
  self-contained** — no `<link>`, no http(s), no `@import` (verified by tests). The cost is
  **isolated in one module**, so it is **trivially revertible** (drop the import → back to the
  system stack) or **gateable behind a flag** if weight ever matters more than identity. **Of the
  four, this is the decision most worth a second look on weight grounds.** *(Staleness to sweep: the
  shell's "system font stack / no web font" comments now mis-describe the shipped behavior.)*
- **Status.** Accepted / Implemented — 2026-06-18. **Revisit candidate** (weight vs. identity).

### ADR H4 — Stat-card + always-open disclosure model (relaxes Story 4.2 AC3)

- **Context.** I1 / Story 4.2 envisioned **chart-embedded collapsible cards** with **progressive
  disclosure** — `watch` / `risk` cards expanded, **`ok` cards collapsed** (so calm survives ~30
  metrics), a tiny inline script collapsing `ok` cards on load.
- **Decision.** Metric cards are restructured into **clean stat cards** — title + health pill +
  headline stat in the `<summary>`, with a **collapsible four-facet explanation** in the body — laid
  out in a **responsive equal-height grid** (`repeat(auto-fit, minmax(260px, 1fr))`,
  `align-items: stretch`). **Charts now live ONLY in the group-overview panel, not inside each
  card.** All cards render **`<details open>` and stay expanded by default** (the reader may collapse
  any card manually); the inline disclosure script no longer touches cards at all — it **only tucks
  the chart data-table fallbacks** (`details.data-table` → `open = false`).
- **Rationale.** Separating **evidence** (the group charts) from **explanation** (the stat cards)
  makes each card scannable and uniform, and an equal-height grid reads calmer than a column of
  variable-height chart cards. Keeping cards open by default makes the **no-JS and with-JS views
  identical** (everything visible) — simpler to reason about and to test.
- **Consequences.** **Story 4.2 AC3 is intentionally relaxed** from "`ok` collapsed / `watch` ·
  `risk` expanded" to **"all cards expanded by default, manually collapsible."** The health band is
  still shape-differentiated glyph + label (never color alone) and `not_available` cards still render
  greyed with the "why." The no-JS guarantee is **strengthened** (the script now only *tucks* tables;
  it never *hides* a card). The AC3 wording in the Story 4.2 file should be updated to read "expanded
  by default, manually collapsible."
- **Status.** Accepted / Implemented — 2026-06-18.

**Open questions for the next steps:**

- **UX designer (Sally) — *TEMPLATE-HTML*.** Ratify the **two-chart-per-group** model and resolve
  the **Group B divergence**: where does the **bus-factor marker** live now that B is a doughnut +
  concentration gauge (ADR H2)? Confirm the secondary-chart selection rule (gauge / doughnut /
  second series) per group.
- **PM (John) — provenance / masthead chips.** Still deferred: the masthead/footer **provenance
  chips** (repo · branch · provider · timestamp · tier) and the Free-tier cap line need the
  Report-JSON **metadata subtree** not yet in the schema. H3's typographic upgrade makes the masthead
  more prominent, raising the priority of landing that metadata. (Unchanged by these ADRs, but
  flagged.)
- **Weight watch (architecture).** Re-confirm H3's font weight against the Rail (a) budget once
  real-world reports (large repos, many metrics) are measured; keep the one-module isolation so a
  flag-gate stays cheap.

Source — the 2026-06-18 HTML-renderer inline-SVG rebuild (Stories 4.1–4.2 implementation; this
pass touches **architecture only**). Grounded in `src/render/html/svg.ts`, `charts.ts`,
`html-renderer.ts`, and `inter-font.ts`. Downstream ripples flagged for the UX designer
(*TEMPLATE-HTML* chart spec) and the PM (provenance / masthead metadata).

## Implementation Patterns & Consistency Rules

These rules exist so that multiple AI agents implementing different stories produce
compatible, mergeable code. Seven conflict points apply to a terminal-native CLI /
pipeline; web/DB/REST/frontend categories are **N/A** (no server, no persistence, no API
surface, no UI framework). Two patterns encode prior decisions: **P4** ← the C4 exit-code
enum, **P5** ← stream discipline.

### Naming Patterns

- **P1 · Report JSON & data shapes** — keys are `camelCase` (`schemaVersion`,
  `goodBehaviours`); status enums are lowercase string unions
  (`"computed" | "not_available"`); all dates are **ISO-8601 UTC** strings; collections are
  arrays even when single-element; `null` means "known absent," and `undefined` is never
  serialized.
- **P2 · Modules & files** — `kebab-case.ts` filenames; **named exports only** (no
  `export default`); one port interface per boundary as `*.port.ts`; types co-located with
  their owning module, shared primitives under `src/shared/`.
- **P7 · Config surface** — flags are `--kebab-case`; env vars are
  `COMMIT_WHISPER_SCREAMING_SNAKE`; config-file keys are `camelCase`; the resolver records
  `provenance` per field (which source set it).

### Structure Patterns

- **P3 · Source layout** — pipeline-mirroring feature folders:
  `src/{config,retrieve,analyze,narrate,assemble,render,license,cli,shared}/`; tests are
  **co-located** as `*.test.ts` (vitest). The hexagonal rule holds: only `cli/` and
  `config/` touch `argv` / `env` / prompts; everything downstream receives the frozen
  `RunConfig`.

### Format Patterns

- **P4 · Errors** — all failures are typed classes extending a `CommitWhisperError` base that
  carries an `exitCode` (the C4 enum), a stable machine `code` string, and a human message;
  errors are thrown upward and mapped to an exit code + stderr **only at the CLI shell**.
  With `--format json`, the error object is serialized to **stdout**. **Exit 9 is the one
  exception to "exit code ⇐ thrown error":** a fail-open degraded run is **not** an error — the
  CLI shell sets exit 9 when the render path completed on the substrate, so the shell maps
  *thrown `CommitWhisperError` → its `exitCode` (1–8)*, *clean completion → 0*, and
  *substrate-fallback completion → 9*.

### Communication Patterns

- **P5 · Streams & logging** — all human chrome goes through a single `ui` module to
  **stderr**; machine data goes to **stdout**; verbosity is gated by `--verbose` / `--quiet`;
  **no `console.log` inside the pipeline** (lint-enforced).
- **P6 · Async & concurrency** — `async/await` only (no raw `.then` chains); bounded
  parallelism for per-group LLM calls via a small `pLimit`-style helper; top-level await
  only in the entrypoint; every spawned resource (temp clone, child `git`) is cleaned up on
  all exit paths.

### Enforcement Guidelines

**All AI agents MUST:** use named exports + `kebab-case` files; keep `argv` / `env` /
prompts out of the pipeline; throw `CommitWhisperError` subclasses (never a bare `Error` at a
boundary); route human text to stderr via `ui`; emit `camelCase`, ISO-UTC Report JSON.
Enforced via ESLint rules plus the determinism test harness — violations are **build
failures, not review notes.**

### Anti-Patterns (forbidden)

`console.log` in pipeline code · default exports · `Date.now()` inside metrics (use the
injected `analysisTimestamp`) · reading `process.env` outside `config/` · secrets in any
flag / config / log · emitting a **partial** Report on error (the fail-open substrate is a
**complete** `analysis`-only Report rendered on the deliberate degraded path — not a partial
one, and distinct from this anti-pattern).

## Project Structure & Boundaries

### Requirements → Component Mapping

| Pipeline stage | Module | FRs |
|---|---|---|
| CLI shell, menu, arg parse, exit-code mapping | `src/cli/` | FR-14, FR-15 |
| Two-phase resolver, `RunConfig` (incl. `aiMode`), source matrix, Zod schemas, provenance, `~/.commit-whisper` home + `Settings` non-secret config-write | `src/config/` | FR-2, FR-11, FR-14, FR-15 |
| `git clone` shell-out, retrieval, temp-clone lifecycle | `src/retrieve/` | FR-1, FR-2, FR-3 |
| Normalized model + ~30 pure-fn metrics (Groups A–F) | `src/analyze/` | FR-4, FR-5 |
| AI client, `aiMode`-gated reachability preflight, per-group batching, grounding check, fail-open on narration loss | `src/narrate/` | FR-8, FR-9, FR-10, FR-11 |
| Report JSON assembly (`analysis` always + **optional** `narrative` subtree + `degraded` marker) + schema validation | `src/assemble/` | FR-12 |
| HTML (Chart.js group overviews + per-metric SVG visuals + table fallback), Markdown, Terminal, JSON renderers; shared `health-band` classifier; **showpiece (needs `narrative`) vs substrate (analysis-only, degraded banner) render branch** | `src/render/` | FR-6, FR-7, FR-13 |
| Lemon Squeezy validate/activate/deactivate, instance cache, Buy/Restore browser hand-off, fail-closed gate | `src/license/` | FR-16 |
| Errors, `ui` (stderr), `Secret<string>`, ports, types | `src/shared/` | cross-cutting |

### Complete Project Directory Structure

```
commit-whisper/
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── tsup.config.ts            # bundle → dist (esbuild)
├── vitest.config.ts
├── eslint.config.js          # enforces P2/P4/P5 + no-console-in-pipeline
├── .gitignore
├── .npmrc
├── commit-whisper.config.example.jsonc   # non-secret config template
├── .github/
│   └── workflows/
│       ├── ci.yml            # lint · typecheck · test · build
│       └── release.yml       # SEA build matrix (macOS/Linux/Windows)
├── src/
│   ├── index.ts              # entrypoint: bootstrap → cli (only top-level await)
│   ├── cli/
│   │   ├── cli.ts            # commander wiring; arg-count → mode (STRICT); --ai/--no-ai → aiMode; flags + license subcommands
│   │   ├── interactive.ts    # @clack menu (0-arg TTY): run · settings · activate · buy/restore · deactivate · status/doctor + guided prompts
│   │   ├── show-config.ts    # --show-config: resolved values + per-field provenance (secrets ***), then exit
│   │   ├── run.ts            # pre-pipeline gate band (license → aiMode-gated preflight → retrieve), orchestrates pipeline from frozen RunConfig; maps clean→0, substrate-fallback→9
│   │   └── exit-codes.ts     # C4 enum 0–9 (9 = degraded: analysis rendered, narrative unavailable)
│   ├── config/
│   │   ├── run-config.ts     # RunConfig type (frozen) + required matrix; incl. aiMode (required|auto|off)
│   │   ├── sources.ts        # input source matrix: field → layers · env var · class; aiMode default auto(interactive)/off(headless·CI)
│   │   ├── resolver.ts       # Phase 1 pure merge + provenance (defaults→config→env→flags)
│   │   ├── gaps.ts           # Phase 2 gap handling (prompt vs typed error)
│   │   ├── capability.ts     # TTY/CI gate (fails closed); channel also sets aiMode default (interactive→auto, headless/CI→off)
│   │   ├── config-home.ts    # resolves ~/.commit-whisper (config file + license cache; XDG/%APPDATA%)
│   │   ├── config-store.ts   # Settings WRITE path: non-secret fields only (atomic temp+rename); never a secret
│   │   ├── schema.ts         # Zod schemas (zod/mini)
│   │   └── env.ts            # the ONLY reader of process.env (native + COMMIT_WHISPER_*)
│   ├── retrieve/
│   │   ├── retrieve.port.ts
│   │   ├── git-clone.ts      # shell-out to system git
│   │   ├── temp-workspace.ts # temp dir + guaranteed cleanup (all exits)
│   │   └── errors.ts
│   ├── analyze/
│   │   ├── model.ts          # one shared normalized pass
│   │   ├── identity.ts       # .mailmap-aware author canonicalization
│   │   ├── metric.ts         # envelope {id,group,title,status,value?,reason?}
│   │   ├── registry.ts       # assembles all metrics
│   │   └── groups/
│   │       ├── a-contribution.ts
│   │       ├── b-cadence.ts
│   │       ├── c-message-quality.ts
│   │       ├── d-branch-merge.ts
│   │       ├── e-churn-hotspots.ts
│   │       └── f-health.ts
│   ├── narrate/
│   │   ├── narrate.port.ts   # fail-open in auto: any narration/grounding/provider failure ⇒ absent narrative (substrate), never a discarded run; hard-fail only in required
│   │   ├── preflight.ts      # provider reachability probe (Ollama GET /api/tags · cloud models-list); aiMode-gated — SKIPPED when off; hard exit 6 before clone in required; in auto flags fail-open (never blocks)
│   │   ├── provider.ts       # Vercel AI SDK; provider/model from config (gemini → @ai-sdk/google)
│   │   ├── generate.ts       # generateObject bound to Zod; per-group ×6 + coaching
│   │   ├── grounding.ts      # deterministic post-gen verification
│   │   └── prompts/
│   ├── assemble/
│   │   ├── report.ts         # builds canonical Report JSON: analysis (deterministic envelopes, always) + OPTIONAL narrative (AI summary/coaching + explanations[metricId]) + top-level degraded marker
│   │   └── report-schema.ts  # schemaVersion "1.0.0": analysis required · narrative OPTIONAL · degraded:boolean
│   ├── render/
│   │   ├── render.port.ts    # showpiece (input type REQUIRES narrative) vs substrate (analysis-only) — fail-open/metrics-only render-path branch
│   │   ├── health-band.ts    # shared classifier: (id,status,value)→ok|watch|risk|n/a; thresholds owned by catalog (PRD §4.2); presentational (not in Report JSON)
│   │   ├── html/
│   │   │   ├── html-renderer.ts   # routes showpiece (needs narrative) vs substrate (analysis-only + ⚠ degraded banner / neutral metrics-only note)
│   │   │   ├── charts.ts     # Chart.js canvases: 6 group overviews + distributional/time-series cards (runtime inlined once)
│   │   │   ├── sparkline.ts  # lightweight inline SVG / HTML+CSS per-metric visuals (sparkline · mini-gauge · bold stat)
│   │   │   ├── data-table.ts # mandatory a11y fallback / no-JS path (every chart: group + per-metric)
│   │   │   └── inline.ts     # self-contained bundling
│   │   ├── markdown/
│   │   │   └── markdown-renderer.ts   # tables · sparklines · Mermaid
│   │   ├── terminal/
│   │   │   └── terminal-renderer.ts   # picocolors + hand-rolled tables
│   │   └── json/
│   │       └── json-renderer.ts       # canonical Report JSON → file / stdout (`-`)
│   ├── license/
│   │   ├── license.port.ts
│   │   ├── lemonsqueezy.ts   # fetch: validate/activate/deactivate
│   │   ├── commands.ts       # activate (key entry) · deactivate subcommands + buy/restore browser hand-off (opens store; no in-terminal key-restore) — FR-14/FR-16
│   │   ├── gate.ts           # startup check; interactive→degrade / headless→fail-closed
│   │   └── instance-store.ts # cached activation-instance id in ~/.commit-whisper (config home)
│   └── shared/
│       ├── errors.ts         # CommitWhisperError base (exitCode + code)
│       ├── ui.ts             # ALL human output → stderr
│       ├── secret.ts         # Secret<string> (redacts to ***)
│       ├── concurrency.ts    # pLimit-style helper
│       └── types.ts
├── tests/
│   ├── fixtures/             # synthetic repos / canned git output
│   └── determinism/          # identical-history ⇒ identical analysis-subtree harness
└── dist/                     # build output (gitignored)
```

Unit tests are **co-located** as `*.test.ts` (per P3); `tests/` holds only shared fixtures
and the determinism harness.

### Architectural Boundaries

- **Hexagonal core:** only `cli/` and `config/` read `argv` / `env` / prompts. Every stage
  from `retrieve/` onward receives the **frozen `RunConfig`** — guaranteeing headless
  safety, determinism, and direct testability.
- **Ports:** each external-touching stage exposes a `*.port.ts` interface, so the pipeline
  depends on contracts, not implementations (real git / LLM / Lemon Squeezy are swapped for
  fakes in tests).
- **`process.env` isolation:** `config/env.ts` is the single reader of `process.env`
  (lint-enforced per the anti-patterns), keeping secret resolution in one auditable place.

### Data Flow

Strictly one-directional; no stage reaches backward. **`Narrative` is optional** — absent on a
metrics-only (`aiMode: off`) or fail-open run, in which case `Report JSON` carries the
`analysis` substrate alone and the render stage takes the **substrate** branch:

```
RunConfig → CloneResult → AnalysisModel → Metric[] → Narrative? → Report JSON → Rendered outputs
```

### External Integrations (only three)

- **System `git`** — shell-out from `retrieve/git-clone.ts` (no native bindings; protects SEA).
- **BYOK LLM provider** — via `narrate/provider.ts` (network unless local Ollama).
- **Lemon Squeezy** — via `license/lemonsqueezy.ts` (network; paid tiers only).

All three are isolated behind ports and are the only modules permitted to perform I/O
beyond the filesystem.

## Architecture Validation Results

### Coherence Validation ✅

**Decision compatibility:** Zod 4.4.3 ↔ Vercel AI SDK 6.0.203 (peer-deps Zod
`^3.25 || ^4.1.8`) ✅ · `@clack/prompts` ESM ↔ TypeScript 6 nodenext ✅ · commander 15 ↔
strict-single-shot CLI ✅. No contradictory technology choices.

**Pattern consistency:** the env-only secret rule, the hexagonal frozen-`RunConfig`
boundary, and stream discipline (stdout=data / stderr=chrome) mutually reinforce one
another; stateless retrieval + no-retry + guaranteed temp-clone cleanup are internally
consistent. P1–P7 align with the chosen stack.

**Structure alignment:** the `src/` tree directly realizes the pipeline
(`retrieve → analyze → narrate → assemble → render`), the C2 determinism rules, and the C4
exit-code enum. The architecture enum is **codes 0–9**; the PRD exit-code list agrees on
`0`–`8` and should mirror the new degraded-success code **`9`** (see *Fail-Open &
Metrics-Only*) — flagged for the PM.

### Requirements Coverage Validation ✅

All 16 functional requirements map to a module, and no module is unjustified:

| FR | Home | FR | Home |
|---|---|---|---|
| FR-1 retrieve | `retrieve/` | FR-9 grounding | `narrate/grounding.ts` |
| FR-2 auth (env-only) | `config/env.ts` + `retrieve/` | FR-10 confidence | `narrate/` |
| FR-3 no-retry failures | `retrieve/errors.ts` | FR-11 BYOK | `narrate/provider.ts` |
| FR-4 ~30 metrics | `analyze/groups/` | FR-12 Report JSON | `assemble/` |
| FR-5 computed/`not_available` | `analyze/metric.ts` | FR-13 render 4 formats | `render/` |
| FR-6 group + per-metric visuals | `render/html/` | FR-14 interactive | `cli/interactive.ts` |
| FR-7 text degradation | `render/markdown` + `terminal` | FR-15 headless | `cli/` + `config/` |
| FR-8 narrative + per-metric | `narrate/generate.ts` | FR-16 license | `license/` |

**Non-functional coverage:** determinism (C2 rules + `tests/determinism/` harness) ✅ ·
privacy/secrets (env-only, `Secret<string>`, `process.env` isolated to `config/env.ts`) ✅ ·
network posture (reconciled: render offline-capable, network only for cloud AI + paid
validation) ✅ · trust/accuracy (deterministic grounding + confidence self-assessment) ✅.

### Implementation Readiness Validation ✅

Decisions are versioned (verified live against npm 2026-06-12); patterns are enforceable
via ESLint + the determinism harness; the project structure is complete and specific; all
identified conflict points have a rule.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed (budgets stated; empirical validation is a
      tracked gap, see below)

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Gap Analysis Results

No *critical* gaps (nothing blocks beginning implementation). Four **important** items are
empirical validations, future spikes, or tracked reliability risks — not missing decisions:

1. **Performance unvalidated at 50k scale (🟠).** The in-memory normalized model is fast,
   but holding it plus computing ~30 metrics against the **2.5 GB RSS** budget is unproven.
   The spike must explicitly test the **fully-resident shared model** (C2) — every commit /
   file / diff object retained for the whole metrics pass — because **Group E (churn /
   hotspots) across all commits is the memory driver**: it is what forces full residency.
   *Mitigation:* measure peak RSS during the metrics build at 50k, and keep a **streaming /
   fold fallback in reserve** — accumulate each metric into its reducer as commits stream
   past, **without retaining every commit object** — which the single-pass design permits
   **without changing the metric contracts**.
2. **SEA packaging spike-gated (🟠, D1).** The self-contained-binary + interactive-binary
   story depends on an unproven spike (raw-mode stdin / ANSI across macOS/Linux/Windows).
   Sequenced last so it blocks no early work; `pkg` / `nexe` are fallbacks.
3. **TypeScript 6.0.3 toolchain confirmation (🟡).** Bleeding-edge; confirm tsup/esbuild +
   vitest fully support TS6 at scaffold time. Clean fallback to TS 5.9 if not.
4. **Provider reachability + Ollama lifecycle (🟠).** Provider availability is **load-bearing
   for the narrated showpiece** — a reliability / UX risk, not merely an AI-quality one. A dead
   cloud key, a wrong base URL, or an **Ollama daemon that is installed but not running** would,
   in `aiMode: required`, turn the report's AI dependency into a failed run. *Mitigation (now
   two-layer):* the reachability **preflight** (`narrate/preflight.ts`, C3) surfaces the problem
   early — *configured vs reachable* in Status / doctor — and, crucially, the **fail-open** path
   means an unreachable provider in the default `auto` mode **degrades to the deterministic
   substrate (exit 9) rather than failing the whole run**, so the risk is now *graceful
   degradation* for the common case and a hard **exit 6** only when the user *forced* `--ai`.
   The residual TOCTOU window (reachable at preflight, gone at `narrate`) is handled as a normal
   narration failure — i.e. it, too, fails open in `auto`. (Promoted from the party-mode
   review — Sally's finding; refined by the 2026-06-13 fail-open decision.)

**Deferred minor items:** headless license-validation TTL / offline-grace policy. The
config home is now fixed at `~/.commit-whisper` (config file + cached activation-instance id);
only its **cross-OS path convention** (XDG base dir / `%APPDATA%`) remains an impl detail.

### Architecture Readiness Assessment

**Overall Status:** READY WITH MINOR GAPS — all 16 checklist items documented and addressed;
the open items are empirical spikes, not absent decisions.

**Confidence Level:** High.

**Key strengths:** strict determinism by construction; clean hexagonal boundary enabling
headless safety + direct testability; lean, ESM-clean, SEA-friendly dependency surface;
secrets provably absent from `argv`/config/logs; every FR has exactly one home.

**Areas for future enhancement:** the two performance/packaging spikes above; richer
license offline-grace UX; per-OS config-path conventions.

### Implementation Handoff

**AI agent guidelines:** follow the architectural decisions exactly; apply patterns P1–P7
consistently; respect the hexagonal boundary (no `argv`/`env`/prompts past `cli/`+`config/`);
consult this document for any architectural question.

**First implementation priority:** the scaffold from the Starter Template Evaluation —
`npm init`, install the locked runtime + dev dependencies, and commit the strict
`tsconfig.json` — then build `config/` (RunConfig + two-phase resolver + Zod schemas) as
the foundation everything else depends on.
