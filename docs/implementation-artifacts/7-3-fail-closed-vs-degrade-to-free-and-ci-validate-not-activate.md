---
epic: 7
story: 3
title: Fail-closed vs degrade-to-Free and CI validate-not-activate
baseline_commit: c1e63e9
---

# Story 7.3: Fail-closed vs degrade-to-Free and CI validate-not-activate

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a CI author and an interactive user,
I want correct behavior when validation can't complete,
so that automation stays trustworthy and interactive use stays friendly.

## Acceptance Criteria

1. **Headless / CI fails closed on a validation failure — no analysis, exit 8 — and CI validates (never activates) (AC1).** **Given** a headless/CI run whose license validation fails (unreachable, network, transient, or definitively invalid/revoked), **when** the gate evaluates, **then** it **fails closed** — no analysis or rendering — exiting with the license exit code (8), **and** the CI runner is supplied the key via **environment variable** and performs a **validate (never a fresh activate)**, so a multi-repo matrix does not exhaust activations.

2. **Interactive degrades to the Free cap with a clear notice — never refuses to run (AC2).** **Given** an interactive run whose license cannot be validated, **when** the gate evaluates, **then** it **degrades to the Free 100-commit cap** and **clearly states it is running under the Free cap**, never refusing to run.

## Tasks / Subtasks

- [x] **Task 1 — The gate reports a verifiable outcome instead of silently degrading (AC1, AC2) [src/license/gate.ts].** [Source: architecture.md "I3 — Fail-closed: an unreachable server or failed validation grants no paid features and surfaces a typed error + exit 8"; the 7.1 gate's own comment naming 7.3 as the extension point]
  - [ ] Change `resolveEntitlement` to return a discriminated `EntitlementResolution = { kind: "resolved"; entitlement: Entitlement } | { kind: "unverified"; reason: string }` (the gate reports FACTS; the shell applies the headless-vs-interactive POLICY — the gate stays free of `LicenseError`/capability coupling).
  - [ ] No / empty key ⇒ `{ kind: "resolved", entitlement: FREE_ENTITLEMENT }` with NO network call (the Free path is legitimately resolved, NEVER "unverified" — a keyless CI run must not fail closed; 7.1 AC2 preserved).
  - [ ] A valid key ⇒ `{ kind: "resolved", entitlement: entitlementForTier(tierForValidation(v)) }`.
  - [ ] A `valid: false` validation (definitively invalid / revoked / unreachable / transient — the 7.1 validator NEVER throws, it returns `{ valid: false, error }`) ⇒ `{ kind: "unverified", reason: v.error ?? "Your license could not be verified." }`.
  - [ ] A throwing collaborator (a misbehaving injected `validate`/`readInstanceId`, or a future disk/network change) ⇒ `{ kind: "unverified", reason: <scrubbed/generic> }` — the gate STILL never throws; it just reports the unverified fact (so the shell, not the gate, owns the fail-closed-vs-degrade decision).

- [x] **Task 2 — Headless fails closed; interactive degrades with a notice (AC1, AC2) [src/cli/cli.ts].** [Source: epics.md Story 7.3 ACs; the existing two call sites — `main` (≥1-arg STRICT single-shot = headless) and `runZeroArg` (0-arg = the only interactive path)]
  - [ ] Update `CliDeps.resolveEntitlement?` + `defaultResolveEntitlement` to the new `Promise<EntitlementResolution>` return.
  - [ ] **`main` (headless single-shot):** after resolving the gate outcome, the REAL run **fails closed** on `unverified` — `throw new LicenseError(<CI-friendly message>)` → the existing outer catch maps it to **exit 8** with the message on stderr, BEFORE any `resolveRunConfig`/pipeline (no analysis, no rendering, AC1). The fail-closed message names `COMMIT_SAGE_LICENSE_KEY` and states CI **validates via the env var** (no activation consumed) — the validate-not-activate guidance.
  - [ ] **`--show-config` stays lenient:** it is a diagnostic dump and must NOT fail closed — an `unverified` outcome renders as the degraded `tier = free` (so the user can SEE the gate result), never throwing.
  - [ ] **`runZeroArg` (interactive):** an `unverified` outcome **degrades to `FREE_ENTITLEMENT`** and emits a clear `ui.warn` notice ("running under the Free 100-commit cap") BEFORE opening the launchpad; the launchpad header already shows the `free` tier, and a subsequent guided analysis surfaces the existing 2.7 "Analyzed N of M — Free tier cap" line. NEVER throws — the menu always opens (AC2).
  - [ ] CI validate-not-activate is ALREADY structural (the gate uses `createLemonSqueezyValidator`; `activate` is wired ONLY to the interactive menu in 7.2) — this story adds the MESSAGING + the fail-closed/degrade split, not a new network path. Confirm with a test that the headless path never constructs an activator.

- [x] **Task 3 — Tests (AC1, AC2).**
  - [ ] **`gate.test.ts` (rewrite the outcome expectations):** no/empty key ⇒ `{ kind: "resolved", entitlement: Free }` (no call); valid key ⇒ `{ kind: "resolved", entitlement: paid }`; instance-id passthrough unchanged; a `valid: false` ⇒ `{ kind: "unverified", reason }` carrying the validator's error; a throwing `validate`/`readInstanceId` ⇒ `{ kind: "unverified", reason }` (gate still never throws).
  - [ ] **`cli.test.ts` (update the 7 injections to the `{ kind: "resolved", entitlement }` shape + ADD 7.3):** headless `commit-sage . --no-ai` + an injected `unverified` ⇒ `main` returns **exit 8**, the pipeline `run` is NEVER called, and the stderr error names the license + `COMMIT_SAGE_LICENSE_KEY`; headless `--show-config` + `unverified` ⇒ exit 0, dumps `tier = free`, no throw; interactive 0-arg + `unverified` ⇒ the launchpad opens (exit 0), `state.tier === "free"`/`licensed === false`, and a `ui.warn` contains the Free-cap notice.
  - [ ] **`cli.e2e.test.ts` (optional sanity):** the existing keyless `commit-sage .` e2e still passes (no key ⇒ resolved Free ⇒ runs) — confirms the headless fail-closed does NOT catch the legitimate keyless Free path.

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the gate's `resolved`-vs-`unverified` outcome (replacing 7.1's always-degrade-to-Free placeholder), the **headless fail-closed** (exit 8 `LicenseError`, no analysis) vs **interactive degrade-to-Free-with-notice** SPLIT at the two existing call sites, the CI **validate-not-activate** messaging, and the `--show-config` lenient carve-out. All offline-testable (the injected `resolveEntitlement` seam + the `run`/`launchpad` fakes).

**Out of scope / deferred (do NOT build here):**
- **Node SEA packaging** — Story **7.4** (the last Epic 7 story). [Source: epics.md Story 7.4]
- **A retry / backoff on a transient validation failure** — the gate is single-shot (no retry, mirroring the 5.3 clone no-retry posture); a transient network blip in CI fails closed (the CI author re-runs). Adding retry is a later refinement, not an AC. [Source: epics.md Story 7.3 — "transient" is explicitly a fail-closed trigger, not a retry trigger]
- **A grace period / cached-last-good entitlement for offline paid use** — the architecture explicitly removed the offline guarantee for paid tiers ("validation needs network at startup"); there is no cached-tier fallback. [Source: architecture.md I3 "Offline removed"]
- **A distinct exit code for "degraded interactive"** — the interactive degrade is a normal (exit 0) Free run with a notice, NOT a failure; only the headless path uses exit 8. [Source: epics.md Story 7.3 AC2 "never refusing to run"]
- **Surfacing the degrade notice INSIDE the launchpad header band** — a `ui.warn` before the menu + the header's `Free` tier + the run-time 2.7 cap line already "clearly state" the Free cap; threading a notice field through `LaunchpadState`/`runLaunchpad` is polish, not an AC. [Source: epics.md Story 7.3 AC2]
- **Re-validating mid-session after a successful interactive Activate** — the launchpad reports the activated tier applies "on your next run" (7.2); a live re-gate is deferred. [Source: 7.2 Dev Notes]

### Architecture decisions (read first)

- **The gate reports; the shell decides.** `resolveEntitlement` is pure-ish license logic that returns `resolved | unverified` — it does NOT know about `LicenseError`, exit codes, or the interactive/headless capability. The POLICY (headless ⇒ fail closed; interactive ⇒ degrade + notice) lives in `cli/` where the capability + the two run modes already are. This keeps the license module free of cli coupling and makes the gate trivially table-testable. [Source: hexagonal layering; capability.ts owns interactivity]
- **The two existing call sites ARE the headless/interactive split.** `main` (any ≥1-arg invocation) is STRICT single-shot = `nonInteractive: true` = headless — it fails closed. `runZeroArg` (the bare 0-arg path) is only reached when the capability gate proves `interactive` (it returns a Usage error otherwise) — it degrades. No new capability plumbing is needed; the split falls out of WHERE the gate outcome is consumed. [Source: cli.ts `main` `nonInteractive: true`; `runZeroArg` early `!interactive` Usage return]
- **No key ⇒ resolved Free, never unverified.** A keyless run (the overwhelming CI/headless default for Free users) must NOT fail closed — there is nothing to validate. "Unverified" means a key WAS supplied but could not be confirmed. This preserves 7.1 AC2 (no key ⇒ Free, no network) and keeps the keyless e2e green. [Source: epics.md Story 7.1 AC2; architecture.md "the Free 100-commit path is unaffected (it makes no call)"]
- **`valid: false` and a thrown collaborator both ⇒ unverified.** The 7.1 validator never throws — a non-ok HTTP / timeout / network error already maps to `{ valid: false, error }`. So "unreachable / network / transient / invalid / revoked" all arrive as `valid: false` ⇒ `unverified`. The catch (a misbehaving injected collaborator or a future disk/network change) ALSO ⇒ `unverified` — fail-safe: if the gate cannot confirm a paid entitlement, it does not grant one, and headless fails closed. [Source: 7.1 lemonsqueezy.ts NEVER-throws contract; architecture.md "unreachable server or failed validation grants no paid features"]
- **`--show-config` is a lenient diagnostic.** It already resolves the config LENIENTLY (no required-gap throw) so a user can SEE a broken setup; the license gate follows suit — an `unverified` outcome renders `tier = free`, never fail-closed, so `--show-config` always dumps. [Source: 6.4 `--show-config` lenient resolve]
- **The fail-closed message carries the validate-not-activate guidance.** The `LicenseError` message names `COMMIT_SAGE_LICENSE_KEY` and states that CI validates via the env var WITHOUT consuming an activation — the AC1 "validate, does not re-activate" guidance, surfaced exactly where a CI author hits the wall. [Source: epics.md Story 7.3 AC1; architecture.md I3 "CI / headless: the runner validates, does not re-activate"]
- **Determinism / privacy unchanged.** The gate still transmits only the key + the cached instance id (never repo data); the resolved `Entitlement` is the only thing crossing the hexagonal boundary; the license key never enters `RunConfig`/`--show-config`/logs. [Source: architecture.md I3; 7.1 gate]

### References

- epics.md → Epic 7 / **Story 7.3: Fail-closed vs degrade-to-Free and CI validate-not-activate** (the two ACs), FR-16.
- architecture.md → "I3 — License Enforcement" ("Fail-closed: an unreachable server or failed validation grants no paid features and surfaces a typed error + exit 8"; "CI / headless: the runner validates, does not re-activate"; "Offline removed"), the exit-code table (8 = license gate).
- Reuse: `license/gate.ts` (the 7.1 `resolveEntitlement` — this story changes its return), `license/tiers.ts` (`FREE_ENTITLEMENT`, `entitlementForTier`, `tierForValidation` — unchanged), `license/lemonsqueezy.ts` (the never-throw validator — unchanged), `shared/errors.ts` (`LicenseError` exit 8 — unchanged), `cli/exit-codes.ts` (`exitCodeForError`/`messageForError` — unchanged), `cli/cli.ts` (`main`, `runZeroArg`, `defaultResolveEntitlement`, the `CliDeps.resolveEntitlement` seam), `config/capability.ts` (the interactive/headless gate — unchanged).

## Dev Agent Record

### Context

Baseline `c1e63e9` (Story 7.2). Replaced 7.1's always-degrade-to-Free placeholder with a real fail-closed-vs-degrade split, exploiting the fact that the two existing entitlement call sites ALREADY correspond to the two run modes: `main` (≥1-arg STRICT single-shot) is headless; `runZeroArg` (0-arg) is the only interactive path.

### Implementation summary

- **`src/license/gate.ts`** — `resolveEntitlement` now returns a discriminated `EntitlementResolution = { kind: "resolved"; entitlement } | { kind: "unverified"; reason }`. No/empty key → `resolved` Free (no network). Valid key → `resolved` paid tier. A `valid: false` validation → `unverified` (reason from the server, normalized). A thrown `validate`/`readInstanceId` → `unverified` (the gate STILL never throws — it reports the fact, the shell owns the policy). The gate knows nothing of `LicenseError`, exit codes, or the capability gate.
- **`src/cli/cli.ts`** — the policy. `defaultResolveEntitlement` + `CliDeps.resolveEntitlement` now return `EntitlementResolution`. `entitlementForHeadlessRun(resolution)` throws `LicenseError` (exit 8) on `unverified` — used by `main`'s real run, BEFORE `resolveRunConfig`/the pipeline (no analysis, no rendering). `--show-config` stays lenient (unverified → dumps `tier = free`, never throws). `runZeroArg` degrades `unverified` → `FREE_ENTITLEMENT` + `ui.warn(LICENSE_DEGRADE_NOTICE)`, never throwing. `licenseFailClosedMessage(reason)` names `COMMIT_SAGE_LICENSE_KEY` and states CI validates via the env var without consuming an activation (the validate-not-activate guidance).

### Code review — 2026-06-15 (3 parallel adversarial layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor: ACCEPT — both ACs MET, scope held, all locks non-vacuous.** Verified the headless exit-8-before-pipeline, the validate-not-activate message, the `--show-config` lenient carve-out, the interactive Free+warn degrade, and the critical keyless carve-out (no key → resolved Free, NOT fail-closed). Flagged one OPTIONAL belt-and-suspenders test (headless never activates) — adopted.
- **Blind Hunter: 0 defects.** The gate/shell separation is clean; the discriminated union is correctly narrowed at every branch; the key never leaks into the message (the validator already scrubs it).
- **Edge Case Hunter:** all infra paths fail-safe; found one real LOW + a directly-relevant pre-existing gap.

**Triage → 3 patches applied:**

- [x] **[Patch] Empty / whitespace server reason (Edge Case #1, LOW).** `validation.error ?? FALLBACK` let an empty-string `error: ""` through (`??` only guards null/undefined), producing a blank/double-spaced message. **Fix:** a `reasonFrom(error?)` helper trims and falls back on undefined/empty/whitespace. Lock-in test added (a `"   "` error → the exact fallback).
- [x] **[Patch] `mapValidate` dropped the server error (enables AC1).** The 7.1 `mapValidate` never copied `json.error` into `LicenseValidation.error`, so a `valid: false` ("revoked"/"expired") ALWAYS arrived with `error: undefined` — meaning 7.3's `reason: v.error ?? fallback` could NEVER surface the real server cause. **Fix:** `mapValidate` now carries `error: json.error ?? undefined`. This is in direct service of AC1's "definitively invalid/revoked" clarity (7.3 is the first consumer of the invalid-path `error`). Lock-in test added (a `valid:false` with `error:"license has been revoked"` surfaces it).
- [x] **[Patch — Auditor optional] Headless-never-activates lock.** Added a cli test injecting an `activateLicense` spy on a headless resolved run — asserts the spy is never called and the paid run proceeds (the structural validate-not-activate guarantee, made explicit per Task 2's note).
- [Dismissed] None — the Edge Case Hunter's other walked paths were verified safe (whitespace key trimmed by the env reader; thrown collaborators → unverified; resolver-throw caught by `main`'s try/catch; keyless headless runs Free).

### Gates (post-patch)

- `npm run typecheck` ✓ · `npm run lint` ✓ · `npx vitest run` ✓ **905 tests** (+8: 5 behavior + 3 review lock-ins) · `npm run build` ✓ (`dist/index.js` 192.07 KB).

### Files

- `src/license/gate.ts`, `src/cli/cli.ts`, `src/license/lemonsqueezy.ts` (+ co-located `gate.test.ts`, `cli.test.ts`, `lemonsqueezy.test.ts`).
