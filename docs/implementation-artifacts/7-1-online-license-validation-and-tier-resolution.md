---
epic: 7
story: 1
title: Online license validation and tier resolution
baseline_commit: e018523
---

# Story 7.1: Online license validation and tier resolution

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the product owner,
I want licenses validated online at startup,
so that paid tiers are enforced before any analysis.

## Acceptance Criteria

1. **At startup, before any analysis or rendering, the license is validated online and the effective tier is resolved into the frozen `RunConfig` (AC1).** **Given** a run that requires a tier check, **when** commit-whisper starts, **then** before any analysis or rendering it validates the license online via the **Lemon Squeezy License API** and resolves the effective tier into the frozen `RunConfig` (`entitlement {tier, commitCap?}`) — so the pipeline consumes the resolved entitlement, never the license key.

2. **The Free tier holds no key, makes no API call, and runs with the 100-commit cap (AC2).** **Given** no license key, **when** commit-whisper starts, **then** it makes **no** license API call and resolves the **Free** entitlement (`{tier: "free", commitCap: 100}`) — the Free path is unchanged and offline.

3. **License validation transmits only the license key and a device identifier — never repository data (AC3).** **Given** a paid validation call, **when** it is sent, **then** the request body carries **only** the license key (and, when an activation instance is cached, its instance id as the device identifier) — and **never** any repository data, commit content, metrics, or config.

## Tasks / Subtasks

- [ ] **Task 1 — The Lemon Squeezy validate client (AC1, AC3) [src/license/lemonsqueezy.ts] (new).** [Source: architecture.md "I3 — License Enforcement" (online Lemon Squeezy License API via global `fetch`, no SDK); narrate/preflight.ts (the fetch-seam + timeout pattern)]
  - [ ] `export interface LicenseValidation { valid: boolean; status: string; variantName?: string; variantId?: number; activationLimit?: number; activationUsage?: number; error?: string }`.
  - [ ] `export type LicenseValidator = (input: { licenseKey: string; instanceId?: string }) => Promise<LicenseValidation>`.
  - [ ] `export function createLemonSqueezyValidator(deps?: { fetchImpl?: typeof fetch; apiBase?: string; timeoutMs?: number }): LicenseValidator` — `POST ${apiBase}/v1/licenses/validate` (default base `https://api.lemonsqueezy.com`), `Accept: application/json` + `Content-Type: application/x-www-form-urlencoded`, body = `URLSearchParams({ license_key, ...(instanceId ? { instance_id } : {}) })` (PRIVACY: ONLY these two keys ever — no repo data by construction), `AbortSignal.timeout(timeoutMs ?? 8000)`. Map `res.ok` JSON → `{ valid, status: json.license_key?.status, variantName: json.meta?.variant_name, variantId: json.meta?.variant_id, activationLimit: json.license_key?.activation_limit, activationUsage: json.license_key?.activation_usage }`; a non-ok response or a thrown/timeout error → `{ valid: false, status: "error", error: <safe message> }` (never throws — the gate decides policy). The license key is NEVER logged or placed in an error message.

- [ ] **Task 2 — Tier mapping (AC1, AC2) [src/license/tiers.ts] (new).** [Source: architecture.md "Free/Single-device/Unlimited tiers"; config/resolve-run-config.ts FREE_TIER_COMMIT_CAP]
  - [ ] `export const FREE_ENTITLEMENT: Entitlement = { tier: "free", commitCap: FREE_TIER_COMMIT_CAP }` (reuse the 100 constant — single source).
  - [ ] `export function tierForValidation(v: LicenseValidation): Tier` — pure: an invalid validation → `"free"` (defensive); else map `variantName` (case-insensitive): `/unlimited|automation/` → `"unlimited"`, `/single|device/` → `"single-device"`, else a valid-but-unknown paid variant → `"single-device"` (a valid key is at least Single-device). The real variant→tier table is configured at the Lemon Squeezy product level; the substring map is the deterministic, testable resolver.
  - [ ] `export function entitlementForTier(tier: Tier): Entitlement` — `free` → `FREE_ENTITLEMENT`; `single-device`/`unlimited` → `{ tier }` (no cap — unbounded). Returns a FRESH object per call (the resolver deep-freezes the entitlement).

- [ ] **Task 3 — The cached activation-instance reader + the license-key env reader (AC2, AC3) [src/license/store.ts (new), src/config/env.ts].** [Source: architecture.md "Key & instance storage" (instance id cached under `~/.commit-whisper`, a licensing artifact not a secret); config/config-store.ts (the config-home + io-seam pattern)]
  - [ ] `src/license/store.ts`: `export async function readActivationInstanceId(env, io?): Promise<string | undefined>` — read `${configHome(env)}/license.json` → the cached `{ instanceId }` (the device identifier transmitted on validate); a missing/corrupt file → `undefined` (never throws). Reuse `config-store.ts`'s `configHome` + an injected read seam (the WRITE path — caching the id on activate — is Story 7.2). `COMMIT_WHISPER_LICENSE_INSTANCE` env override accepted (for CI that pins an instance).
  - [ ] `src/config/env.ts`: `export function readLicenseKey(env): string | undefined` — `str(env.COMMIT_WHISPER_LICENSE_KEY)` (trim, empty → undefined). The license key is a **credential, not a user secret** (architecture I3) — it is NOT wrapped in `Secret`, but it never enters `RunConfig`, `--show-config`, or any log (only the resolved `entitlement` crosses the boundary).

- [ ] **Task 4 — The entitlement gate (AC1, AC2) [src/license/gate.ts] (new).** [Source: architecture.md "pre-pipeline gate band ... license gate (I3)"; the Free no-call rule]
  - [ ] `export interface EntitlementGateDeps { licenseKey?: string; validate: LicenseValidator; readInstanceId?: () => Promise<string | undefined> }`.
  - [ ] `export async function resolveEntitlement(deps): Promise<Entitlement>` — **no `licenseKey`** → return `FREE_ENTITLEMENT` (NO validate call — AC2). Else: `instanceId = await deps.readInstanceId?.()`; `v = await deps.validate({ licenseKey, instanceId })`; `v.valid` → `entitlementForTier(tierForValidation(v))`; **otherwise → `FREE_ENTITLEMENT`** (Story 7.1's safe baseline: a failed/invalid validation grants no paid features and never blocks the run; the **headless fail-closed (exit 8)** vs **interactive degrade-with-notice** SPLIT is Story 7.3). The gate makes at most ONE validate call.

- [ ] **Task 5 — Wire the gate into the CLI shell (AC1, AC2) [src/cli/cli.ts].**
  - [ ] `CliDeps` gains `resolveEntitlement?: (env: NodeJS.ProcessEnv) => Promise<Entitlement>` (the injectable seam) defaulting to a closure that calls `resolveEntitlement` (gate) with `licenseKey: readLicenseKey(env)`, `validate: createLemonSqueezyValidator({ fetchImpl: ... })`, `readInstanceId: () => readActivationInstanceId(env)`.
  - [ ] In `main`, resolve the entitlement ONCE (`const entitlement = await (deps.resolveEntitlement ?? defaultResolveEntitlement)(env)`) BEFORE the resolve calls, and pass it into EVERY `resolveRunConfig({ … entitlement })` (single-shot run, `--show-config`, guided `resolveAndRun`). The resolver already overlays an injected `entitlement` over its Free default, so the frozen `RunConfig.entitlement` is now the real tier. (Free = no key = no network, so an offline / no-key run is unchanged and still resolves Free.)
  - [ ] In `runZeroArg`, resolve the entitlement and set the launchpad `state.tier = entitlement.tier` and `state.licensed = entitlement.tier !== "free"` (so the header shows the real tier and the menu's license rows flip by state — the Deactivate/Activate VISIBILITY becomes correct now; the actions themselves stay Story 7.2 placeholders). The launchpad must still open even if validation fails (the gate degrades to Free, so it never throws here).

- [ ] **Task 6 — Tests (AC1–AC3).**
  - [ ] **`lemonsqueezy.test.ts` (new):** `createLemonSqueezyValidator` with a fake `fetchImpl` — posts to `…/v1/licenses/validate`, the body URLSearchParams has EXACTLY `license_key` (+ `instance_id` when given) and NOTHING ELSE (the AC3 privacy lock — assert no repo/metric keys); a valid response maps `valid`/`variant_name`/`variant_id`; a 404/400 response → `{ valid: false }`; a thrown fetch (network) / a timeout → `{ valid: false, status: "error" }` (never throws); the license key never appears in the returned `error`.
  - [ ] **`tiers.test.ts` (new):** `tierForValidation` — `variant_name` "Unlimited"/"Automation" → unlimited; "Single Device" → single-device; an unknown valid variant → single-device; an invalid validation → free. `entitlementForTier` — free → `{tier:"free", commitCap:100}`; single-device/unlimited → no cap; returns a fresh object each call.
  - [ ] **`gate.test.ts` (new):** no key → `FREE_ENTITLEMENT` and `validate` is NEVER called (AC2); a valid key → the mapped paid entitlement, and `validate` is called once with the key + the read instance id (AC3 — the instance id is passed); an invalid/unreachable validation → `FREE_ENTITLEMENT` (the 7.1 degrade baseline); `readInstanceId` returning undefined → validate called with `instanceId: undefined`.
  - [ ] **`store.test.ts` (new):** `readActivationInstanceId` — a present `license.json` with `{instanceId}` → that id; a `COMMIT_WHISPER_LICENSE_INSTANCE` env override wins; a missing/corrupt file → undefined (never throws), via an in-memory io.
  - [ ] **`env.test.ts` (extend):** `readLicenseKey` reads `COMMIT_WHISPER_LICENSE_KEY`, trims, empty → undefined.
  - [ ] **`cli.test.ts` (extend):** an injected `resolveEntitlement` (→ `{tier:"unlimited"}`) flows into the run config's `entitlement` (no commitCap); the DEFAULT (no key, env `{}`) still yields the Free entitlement with `commitCap: 100` (existing behavior unchanged — no network); a paid entitlement makes the 0-arg launchpad header show the real tier + `licensed: true` (so Deactivate is the visible license row). The license key is never present in a `--show-config` dump.

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the **validate** call against the Lemon Squeezy License API (via global `fetch`, no SDK), the **tier mapping** (validation → `Tier` → `Entitlement`), the read-only **cached-instance-id** reader (the device identifier) + the **license-key env reader**, the **entitlement gate** (`resolveEntitlement`: Free = no call; valid key = paid tier; failure = degrade-to-Free baseline), and **wiring** it into the CLI so the resolved tier rides the frozen `RunConfig` and the launchpad header shows the real tier. All offline-testable via an injected `LicenseValidator` / `fetchImpl` / in-memory io.

**Out of scope / deferred (do NOT build here):**
- **`activate` / `deactivate` / Buy-Restore + the instance-id WRITE/cache** — Story **7.2**. 7.1 only READS a cached instance id (validate-only); it never activates, never writes `license.json`, and the launchpad's Activate/Deactivate/Buy-Restore actions stay placeholders (only their visibility-by-tier becomes real). [Source: epics.md Story 7.2]
- **The fail-closed (headless, exit 8) vs degrade-to-Free-with-notice (interactive) SPLIT + CI validate-not-activate messaging** — Story **7.3**. 7.1's gate uses a single safe baseline: any validation failure degrades to Free (never blocks, never exits 8). 7.3 adds the headless fail-closed branch, the explicit "running under the Free cap" notice, and the CI guidance. (7.1 already validates-not-activates by only implementing validate — 7.3 adds the env-var-key CI nuance.) [Source: epics.md Story 7.3; architecture.md "Fail-closed"]
- **The real Lemon Squeezy product/variant IDs** — the variant→tier mapping is substring-based on `variant_name` (deterministic + testable); the real store's variant catalog is a deployment concern, not code. No store ID / API key is hardcoded. [Source: architecture.md I3]
- **A hardware-derived machine fingerprint** — the "device identifier" is the Lemon Squeezy **activation-instance id** (server-issued, cached by 7.2), not a hardware fingerprint; 7.1 transmits the cached instance id when present, else just the key. No `node-machine-id`-style native binding (keeps the SEA binary lean — Story 7.4). [Source: architecture.md "Device binding via activation instances"; NFR-5]
- **Persisting / caching the validation result** — `~/.commit-whisper` is "not a cache" (C1); 7.1 validates at startup each run (the architecture's "validated online at startup"), caching nothing but the (7.2-written) instance id. [Source: architecture.md "Config home is not a cache"]
- **`--show-config` exposing the license key** — the key is never in `RunConfig` and never dumped; only the resolved `entitlement` (tier + cap) appears. [Source: architecture.md source matrix — `licenseKey` "never crosses the hexagonal boundary"]
- **Note — `--show-config` validates (intentional):** the entitlement is resolved before the `--show-config` branch, so `--show-config` shows the REAL tier. With no key this is a no-op (Free, no network); with a paid key it performs the same startup validation a run would — `--show-config` is a startup tier check, and showing a live tier is the honest answer (a validation failure degrades the shown tier to Free, like a run). This is a deliberate choice, not an accidental network call.

### Architecture decisions (read first)

- **Only the resolved `entitlement` crosses the hexagonal boundary — never the key.** The gate runs in the `cli`/`license` layer, validates, and resolves `Entitlement {tier, commitCap?}`; that frozen value rides `RunConfig` exactly like `analysisTimestamp` (the resolver already has the `entitlement` slot + a Free default). The license key is read by the gate and used only for the validate call — it never enters `RunConfig`, `--show-config`, or any log. [Source: architecture.md source matrix; config/resolve-run-config.ts]
- **Free is offline by construction.** `resolveEntitlement` returns `FREE_ENTITLEMENT` and makes ZERO network calls when there is no license key — so every existing run (env `{}`) is unchanged and the Free path stays offline + deterministic. The validate call happens only when a key is present. [Source: architecture.md "Free tier makes no call"; NFR-5]
- **Privacy by construction (AC3).** The validate request body is built from a closed two-key `URLSearchParams` (`license_key` + optional `instance_id`); there is no code path that adds repository data, metrics, or config to a license call. A test asserts the body keys are exactly that set. License calls carry only the key + the (server-issued) instance id — never repo data. [Source: architecture.md "license calls carry only the key + a device id — never repository data"; NFR-5]
- **`fetch` seam + bounded timeout, mirroring preflight.** The validator takes an injectable `fetchImpl` and uses `AbortSignal.timeout` (no SDK — leaner SEA binary), exactly like `narrate/preflight.ts`. A network/timeout/HTTP failure resolves to `{ valid: false }` (the validator never throws); the GATE decides policy (7.1 = degrade to Free). [Source: architecture.md I3 "via the global fetch (no SDK)"; narrate/preflight.ts]
- **Degrade-to-Free is the 7.1 baseline; the headless/interactive split is 7.3.** Making any validation failure resolve to Free keeps 7.1 purely additive and non-blocking (the launchpad always opens; a run never exits 8 from licensing yet). 7.3 then layers the headless fail-closed (exit 8) + the interactive "running under Free cap" notice on top of this gate — the `resolveEntitlement` seam is the extension point. [Source: epics.md Story 7.3; architecture.md "Fail-closed" default]
- **The launchpad tier becomes real.** `runZeroArg` resolves the entitlement and sets `state.tier`/`state.licensed`; the 6.1 `buildLaunchpadOptions` already flips the license rows by `state.licensed`, so a paid key now shows **Deactivate** (its action lands in 7.2) and the header shows `Single-device`/`Unlimited`. The free hardcode (6.1) is replaced by the resolved value. [Source: cli/interactive.ts buildLaunchpadOptions; 6.1]
- **Cognitive-complexity ≤ 15 (SonarQube).** `createLemonSqueezyValidator` keeps the parse in a small mapper; `tierForValidation` is a short ordered match; the gate is a 3-branch function. [Source: repo lint conventions]

### References

- epics.md → Epic 7 / **Story 7.1: Online license validation and tier resolution** (the three ACs), FR-16, NFR-5.
- architecture.md → "I3 — License Enforcement" (Lemon Squeezy via fetch, device binding, fail-closed, key/instance storage), the pre-pipeline gate band, the exit-code enum (8 = license), the source matrix (`licenseKey` never crosses the boundary; `entitlement` rides `RunConfig`).
- Reuse: `config/run-config.ts` (`Entitlement`/`Tier`), `config/resolve-run-config.ts` (`FREE_TIER_COMMIT_CAP`, the `entitlement` resolver slot), `config/config-store.ts` (`configHome` + io-seam), `config/env.ts` (`str` shape, `readProcessEnv`), `narrate/preflight.ts` (the `fetch` seam + timeout pattern), `shared/errors.ts` (`LicenseError` exit 8 — used by 7.3), `cli/cli.ts` (the `resolveRunConfig` call sites + `runZeroArg`).

## Dev Agent Record

### Summary

The license gate — the start of Epic 7. At startup, commit-whisper validates a license online (Lemon Squeezy License API, validate-only) and resolves the effective tier into the frozen `RunConfig` (`entitlement {tier, commitCap?}`), so the pipeline consumes the resolved entitlement and the license key never crosses the hexagonal boundary. Free is offline by construction (no key ⇒ no call ⇒ 100-commit cap), and a validation call transmits only the key + the cached instance id — never repository data.

### Approach

- **`license/lemonsqueezy.ts`** (new) — `createLemonSqueezyValidator({ fetchImpl?, apiBase?, timeoutMs? })` → a `LicenseValidator` that POSTs to `/v1/licenses/validate` with a closed two-key form (`license_key` + optional `instance_id` — the AC3 privacy invariant), maps the response to `LicenseValidation`, and NEVER throws (network/timeout/HTTP/JSON failure → `{ valid: false }`); the key is scrubbed from any error. No SDK (leaner SEA binary), mirroring `preflight.ts`'s fetch seam + timeout.
- **`license/tiers.ts`** (new) — `tierForValidation` (variant-name substring → `unlimited`/`single-device`; valid-unknown → single-device; invalid → free) + `entitlementForTier` (free carries the 100 cap, paid uncapped, fresh object each call) + `FREE_ENTITLEMENT`.
- **`license/store.ts`** (new) — `readActivationInstanceId` (READ-only; the device identifier; `COMMIT_WHISPER_LICENSE_INSTANCE` override, else `~/.commit-whisper/license.json`; missing/corrupt → undefined). The WRITE/cache is 7.2.
- **`license/gate.ts`** (new) — `resolveEntitlement`: no/empty key → Free no-call; key → one validate → tier; ANY failure (incl. a throwing collaborator) → Free. Wrapped in try/catch so the gate NEVER throws (the launchpad always opens; 7.3 adds the headless fail-closed split).
- **`config/env.ts`** — `readLicenseKey` (`COMMIT_WHISPER_LICENSE_KEY`, trimmed; a credential, not a `Secret`, never in `RunConfig`/show-config/logs).
- **`cli/cli.ts`** — resolves the entitlement once at startup (`CliDeps.resolveEntitlement` seam → `defaultResolveEntitlement` = the gate + the real validator + the instance reader) and threads it into every `resolveRunConfig` (single-shot, `--show-config`, guided); `runZeroArg` sets the launchpad `state.tier`/`licensed` from it (the 6.1 free hardcode is gone — a paid key now shows the real tier + flips the license rows to Deactivate; the action lands in 7.2).

### Review — 3-layer adversarial (Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor:** all 3 ACs **MET**, scope **HELD**, **0 must-fix** (entitlement resolved before the pipeline + rides the frozen config; key never in RunConfig/show-config; no key → Free with validate-call-count 0 + cap 100; the validate body is exactly key + instance id; the degrade-to-Free-on-failure baseline is the correct 7.3 boundary; no activate/write, no hardcoded store ID).
- **Edge Case Hunter:** 105 cases, **2 PATCHED** (a throwing `readInstanceId` or a throwing injected `validate` propagated out of the gate — the spec says the gate "never throws here" so the launchpad always opens; now both are caught → Free, plus an empty-string key short-circuits to Free with no call), **1 dismissed** (`--show-config` makes a validate call with a paid key — intentional + documented: it's a startup tier check; Free makes no call). 102 safe-by-construction.
- **Blind Hunter:** 2 findings → **0 patched** (both false positives from diff-only visibility / control-flow misread: "missing `str()`" — `str` is defined at env.ts:23, disproven by passing typecheck + 857 tests; "double entitlement resolution" — the two resolutions are on MUTUALLY-EXCLUSIVE paths, the 0-arg branch returns early via `runZeroArg` before main's resolution).

**Patches applied:** 1 (gate try/catch + empty-key guard). **Tests added:** 3 (empty-key, throwing-validate, throwing-readInstanceId lock-ins). **Dismissed:** 3 (2 Blind + 1 Edge). Re-ran all gates green.

### Gates

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm test` ✓ **857 passed** (+33: lemonsqueezy +6, tiers +8, store +4, gate +8, env +2, cli +5) · `npm run build` ✓ (181.30 KB). Smoke-tested the real binary: Free (no key) → `tier=free, cap=100`, no network; a fake key → validates against the live API → invalid → degrades to Free, the key never leaks to stderr.

### File List

- `src/license/lemonsqueezy.ts` + `.test.ts` (new) · `src/license/tiers.ts` + `.test.ts` (new) · `src/license/store.ts` + `.test.ts` (new) · `src/license/gate.ts` + `.test.ts` (new)
- `src/config/env.ts` (`readLicenseKey`) · `src/config/env.test.ts` (extended)
- `src/cli/cli.ts` (the entitlement seam + gate wiring into all resolves + launchpad tier) · `src/cli/cli.test.ts` (extended)
