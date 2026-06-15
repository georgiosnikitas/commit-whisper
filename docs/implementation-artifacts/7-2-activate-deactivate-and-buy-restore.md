---
epic: 7
story: 2
title: Activate, deactivate, and buy/restore
baseline_commit: 7b48dd0
---

# Story 7.2: Activate, deactivate, and buy/restore

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a paid user,
I want to activate, move, and recover my license,
so that I control my devices without new purchases.

## Acceptance Criteria

1. **Buy / Restore opens the store in the browser — no in-terminal key entry, no in-app checkout (AC1).** **Given** the unlicensed interactive menu, **when** the user chooses **"Buy / Restore license"**, **then** commit-whisper opens the store in the browser to buy a new license or recover an existing purchase (**no in-terminal key entry, no in-app checkout**).

2. **Activate is the only in-app key entry: enter the key, validate online, cache the activation-instance id (AC2).** **Given** the unlicensed interactive menu and a license key in hand, **when** the user chooses **"Activate license"** and enters the key, **then** commit-whisper **validates/activates it online** and **caches the activation-instance id** under `~/.commit-whisper` — **this is the only in-app key-entry screen**.

3. **Deactivate frees the current activation so the license can move; a second-device activation while still active is refused with a clear message (AC3).** **Given** a licensed Single-device user, **when** they choose **"Deactivate license"**, **then** the current activation instance is **freed** so the license can move to another device with no new purchase, **and** activating on a second device while still active is **refused with a clear message**.

## Tasks / Subtasks

- [x] **Task 1 — Activate + deactivate Lemon Squeezy calls (AC2, AC3) [src/license/lemonsqueezy.ts].** [Source: architecture.md "I3 — License Enforcement" (`activate`/`deactivate` via global `fetch`); the 7.1 `createLemonSqueezyValidator` pattern]
  - [ ] `export interface LicenseActivation { activated: boolean; instanceId?: string; variantName?: string; variantId?: number; error?: string }` and `export type LicenseActivator = (input: { licenseKey: string; instanceName: string }) => Promise<LicenseActivation>`.
  - [ ] `export interface LicenseDeactivation { deactivated: boolean; error?: string }` and `export type LicenseDeactivator = (input: { licenseKey: string; instanceId: string }) => Promise<LicenseDeactivation>`.
  - [ ] `export function createLemonSqueezyActivator(deps?)` — `POST ${apiBase}/v1/licenses/activate`, body = `URLSearchParams({ license_key, instance_name })` (the closed key + device-name form — never repo data); map `{ activated: json.activated === true, instanceId: json.instance?.id, variantName: json.meta?.variant_name, variantId: json.meta?.variant_id }`; a non-ok response → `{ activated: false, error: <server message, e.g. activation-limit> }`; a thrown/timeout → `{ activated: false, error: <scrubbed> }`. NEVER throws; the key is never logged/echoed.
  - [ ] `export function createLemonSqueezyDeactivator(deps?)` — `POST ${apiBase}/v1/licenses/deactivate`, body = `URLSearchParams({ license_key, instance_id })`; map `{ deactivated: json.deactivated === true, error: json.error }`; non-ok/throw → `{ deactivated: false, error: <scrubbed> }`. NEVER throws.
  - [ ] Refactor the shared `fetch`+timeout+JSON+scrub boilerplate (now used by validate/activate/deactivate) into a small private `postForm(doFetch, url, body, timeoutMs, scrub)` helper — keep each mapper thin (cognitive-complexity ≤ 15).

- [x] **Task 2 — The license cache: read both fields + atomic write + clear (AC2, AC3) [src/license/store.ts].** [Source: architecture.md "Key & instance storage" (instance id cached under `~/.commit-whisper`; the key is "not a user secret … may be cached"); config/config-store.ts atomic-write pattern]
  - [ ] `export interface LicenseCache { instanceId?: string; licenseKey?: string }`. `export async function readLicenseCache(env, io?): Promise<LicenseCache>` — parse `license.json` → the two allow-listed fields (missing/corrupt → `{}`, never throws). Refactor `readActivationInstanceId` to derive from it (keeping the `COMMIT_WHISPER_LICENSE_INSTANCE` env override). `export async function readCachedLicenseKey(env, io?): Promise<string | undefined>` — the cached key (the "may be cached" path that lets a one-time interactive activation work on later runs without re-setting the env var).
  - [ ] Extend `LicenseStoreIo` with `writeFile`/`mkdir`/`rename`/`unlink` (+ `defaultLicenseStoreIo`). `export async function writeLicenseCache(env, cache: LicenseCache, io?): Promise<string>` — ATOMIC (mkdir → temp `license.json.<rand>.tmp` in the same dir → rename; unlink the temp on a rename failure), serialising ONLY the two allow-listed fields. `export async function clearLicenseCache(env, io?): Promise<void>` — `unlink` `license.json` (best-effort; missing → fine). The license key is a credential, not a user secret (architecture I3) — caching it is sanctioned; no OTHER field is ever written.

- [x] **Task 3 — The activate / deactivate orchestrators (AC2, AC3) [src/license/actions.ts] (new).**
  - [ ] `export type ActivationOutcome = { ok: true; tier: Tier } | { ok: false; reason: string }`. `export async function activateLicense(deps: { licenseKey; instanceName; activate: LicenseActivator; persist: (cache: { instanceId; licenseKey }) => Promise<void> }): Promise<ActivationOutcome>` — a blank key → `{ ok: false, reason }`; `r = await activate(...)`; `r.activated && r.instanceId` → `persist({ instanceId, licenseKey })` then `{ ok: true, tier: tierForVariantName(r.variantName) }`; else `{ ok: false, reason: r.error ?? "Activation failed." }` (the AC3 second-device refusal surfaces the server's activation-limit message verbatim).
  - [ ] `export type DeactivationOutcome = { ok: true } | { ok: false; reason: string }`. `export async function deactivateLicense(deps: { licenseKey?; instanceId?; deactivate: LicenseDeactivator; clear: () => Promise<void> }): Promise<DeactivationOutcome>` — no key → `{ ok: false, reason: "set COMMIT_WHISPER_LICENSE_KEY" }`; no instanceId → `{ ok: false, reason: "no activation found on this device" }`; `r = await deactivate(...)`; `r.deactivated` → `clear()` then `{ ok: true }`; else `{ ok: false, reason }`.
  - [ ] `src/license/tiers.ts`: extract `export function tierForVariantName(name?: string): Tier` (the substring map; `undefined`/unknown → `single-device`) and have `tierForValidation` delegate to it (DRY — the activate + validate paths share one tier map).

- [x] **Task 4 — The launchpad license screens + dispatch (AC1, AC2, AC3) [src/cli/interactive.ts].** [Source: MENUS.md "Activate license", "Buy / Restore license", "Deactivate license"]
  - [ ] `LaunchpadDeps` gains `activateLicense?: (licenseKey: string) => Promise<ActivationOutcome>`, `deactivateLicense?: () => Promise<DeactivationOutcome>`, `openUrl?: (url: string) => Promise<void>`, `storeUrl?: string`, `coffeeUrl?: string` (all injected by `cli/`; the screens do no I/O of their own).
  - [ ] `runActivate(deps, output)` — `key = await prompts.text({ message: "License key" })` (NOT a secret — entered in-app); `null` → return; blank → calm "enter a key" + return; `await deps.activateLicense(key)` in try/catch (a throw degrades to a calm message — never crash the menu); `ok` → `✓ License activated — <tier> tier. It applies on your next run.` / `!ok` → `⚠ <reason>` (the only in-app key entry).
  - [ ] `runDeactivate(deps, output)` — a `selectOne` confirm (Deactivate / Cancel); Cancel/`null` → return; else `await deps.deactivateLicense()` in try/catch; `ok` → `✓ License deactivated — freed on this device.` / `!ok` → `⚠ <reason>`.
  - [ ] `runOpenUrl(deps, url, label, note, output)` — write `Opening <label> in your browser…` (+ the Buy/Restore note: "commit-whisper never handles payment; buy or recover, then return and choose Activate"); `await deps.openUrl?.(url)` in try/catch; on failure (or no opener) → write the **URL plainly so it stays copyable** (the never-dead-end principle). `buy-restore` → store URL + note; `coffee` → coffee URL.
  - [ ] In `runLaunchpad`, dispatch `activate`/`deactivate`/`buy-restore`/`coffee` to their handlers. All four `COMING_SOON` entries are now live, so **remove `COMING_SOON`** entirely and make the loop's action handling exhaustive (every `LaunchpadAction` has an explicit branch).

- [x] **Task 5 — Wire the license actions + the cached-key gate read into the shell (AC1, AC2, AC3) [src/cli/cli.ts].**
  - [ ] In `runZeroArg`, inject into the launchpad: `openUrl` (default `defaultOpenBrowser`), `storeUrl`/`coffeeUrl` (`env.COMMIT_WHISPER_STORE_URL ?? DEFAULT_STORE_URL` / `env.COMMIT_WHISPER_COFFEE_URL ?? DEFAULT_COFFEE_URL` — deployment-overridable constants), `activateLicense: (key) => activateLicense({ licenseKey: key, instanceName: hostname(), activate: createLemonSqueezyActivator(), persist: (cache) => writeLicenseCache(ctx.env, cache) })`, `deactivateLicense: async () => deactivateLicense({ licenseKey: readLicenseKey(ctx.env) ?? (await readCachedLicenseKey(ctx.env)), instanceId: await readActivationInstanceId(ctx.env), deactivate: createLemonSqueezyDeactivator(), clear: () => clearLicenseCache(ctx.env) })`.
  - [ ] Update `defaultResolveEntitlement` to read the key as `readLicenseKey(env) ?? (await readCachedLicenseKey(env))` — so a one-time interactive **Activate** (which caches the key) resolves the paid tier on later runs without the user re-exporting the env var. (Env still wins — config<env precedence preserved.)
  - [ ] `CliDeps` gains injectable seams `activateLicense?`, `deactivateLicense?`, `openUrl?` (so a cli test exercises the wiring offline). `hostname` is read from `node:os` behind a tiny default (kept out of the pure modules).

- [x] **Task 6 — Tests (AC1–AC3).**
  - [ ] **`lemonsqueezy.test.ts` (extend):** `createLemonSqueezyActivator` posts to `/v1/licenses/activate` with EXACTLY `license_key` + `instance_name`; maps `activated`/`instance.id`/`variant_name`; an activation-limit response → `{ activated: false, error }`; a thrown fetch → `{ activated: false }` with the key scrubbed. `createLemonSqueezyDeactivator` posts `/v1/licenses/deactivate` with `license_key` + `instance_id`; maps `deactivated`; non-ok → `{ deactivated: false }`.
  - [ ] **`store.test.ts` (extend):** `writeLicenseCache` is atomic (mkdir → same-dir `.tmp` → rename; temp cleaned on rename failure) and serialises ONLY `{ instanceId, licenseKey }` (a forced extra field never lands); `readLicenseCache`/`readCachedLicenseKey` round-trip a write; `readActivationInstanceId` still honours the env override; `clearLicenseCache` unlinks (best-effort; missing → no throw).
  - [ ] **`actions.test.ts` (new):** `activateLicense` — a successful activate persists `{ instanceId, licenseKey }` and returns `{ ok: true, tier }` (variant→tier); an activation-limit failure → `{ ok: false, reason: <server msg> }` and persists NOTHING (AC3 second-device); a blank key → `{ ok: false }` with no call. `deactivateLicense` — success clears the cache + `{ ok: true }`; no key / no instance → `{ ok: false, reason }` with no deactivate call; a server `deactivated: false` → `{ ok: false }` and does NOT clear.
  - [ ] **`interactive.test.ts` (extend):** `runActivate` (scripted `text` + a fake `activateLicense`) — a key → calls the action once, prints success+tier; a cancel (`null`) → no call; the prompt message contains no "secret" framing (the key is entered in-app, which is allowed). `runDeactivate` — confirm → calls the action, prints freed; cancel → no call. `buy-restore`/`coffee` → call `openUrl` with the store/coffee URL and write a note; an `openUrl` throw → the URL is still printed (copyable). The four license launchpad actions route to these (a scripted `["activate","quit"]` etc. loops back to the menu). NO secret is ever collected (the license key is not a secret, but assert no AI-key/token prompt appears).
  - [ ] **`cli.test.ts` (extend):** the launchpad receives `activateLicense`/`deactivateLicense`/`openUrl` functions + the store/coffee URLs; an injected `activateLicense` flows through; the cached-key gate read — with `configFile`/env unset but a cached key (inject via `resolveEntitlement` OR a fake store), the paid tier resolves (a focused test of `readLicenseKey(env) ?? readCachedLicenseKey` precedence — env wins when both present).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the **activate** + **deactivate** Lemon Squeezy calls (siblings of 7.1's validate), the license **cache write/clear** (the instance id + the "may be cached" key) via an ATOMIC write, the **orchestrators** (`activateLicense`/`deactivateLicense`), the four interactive **license screens** (Activate = the only in-app key entry; Buy/Restore + Buy-Me-a-Coffee = browser hand-offs; Deactivate = confirm + free), wiring them into the launchpad (the 7.1 visibility-by-tier rows now have live actions), and the small **cached-key gate read** so a one-time activation works on later runs. All offline-testable (injected `activate`/`deactivate`/`openUrl`/store io).

**Out of scope / deferred (do NOT build here):**
- **The headless fail-closed (exit 8) vs interactive degrade-to-Free split + CI validate-not-activate messaging** — Story **7.3**. 7.2 keeps 7.1's gate behaviour (any validation failure → Free); it adds activate/deactivate (which CI never calls — CI validates only). [Source: epics.md Story 7.3]
- **Node SEA packaging** — Story **7.4**. [Source: epics.md Story 7.4]
- **A `license activate` / `deactivate` non-interactive SUBCOMMAND** — the architecture lists CLI license subcommands, but the AC scopes Activate/Deactivate/Buy-Restore to the **interactive menu**. 7.2 wires the menu actions; the strict-single-shot subcommand form (if wanted) is a later refinement. [Source: epics.md Story 7.2 (interactive menu); architecture.md subcommands]
- **An in-app checkout / payment** — explicitly forbidden by AC1 (Buy/Restore is a browser hand-off; payment + account lookup always live in the browser). [Source: epics.md Story 7.2 AC1; MENUS.md]
- **A mid-session launchpad header refresh after activate** — AC2 requires caching the instance id (done) + the key (so the NEXT run shows the paid tier). 7.2 reports the activated tier on the Activate screen and notes it applies next run; re-rendering the live header mid-session is polish, not an AC. [Source: epics.md Story 7.2 AC2; MENUS "returns to the launchpad now showing the paid tier"]
- **Real store / Buy-Me-a-Coffee URLs** — the store + coffee URLs are deployment-configurable constants (`COMMIT_WHISPER_STORE_URL` / `COMMIT_WHISPER_COFFEE_URL` overrides) with product-link defaults; the live URLs are a deployment concern. [Source: this story]
- **Hardware device fingerprinting** — the device binding is the Lemon Squeezy server-issued activation-instance id (the activate response), labelled by the OS hostname (`instance_name`); no `node-machine-id`-style native binding (keeps the SEA binary lean — 7.4). [Source: architecture.md "Device binding via activation instances"]

### Architecture decisions (read first)

- **Activate is the ONE in-app key entry; Buy/Restore + Coffee are browser hand-offs.** Activate prompts for the license key (NOT a secret — entered in-app, sanctioned), validates/activates online, and caches the instance id (+ the key). Buy/Restore and Buy-Me-a-Coffee never collect anything — they open a URL via the reused `cli/open-browser.ts` opener (array-args `execFile`, injection-safe). On an open failure the URL is printed plainly so it stays copyable (never a dead-end). [Source: MENUS.md "Activate"/"Buy / Restore"/"Deactivate"; architecture.md I3; cli/open-browser.ts]
- **The cache write reuses the 6.5 atomic discipline.** `writeLicenseCache` is a same-dir temp + rename (atomic on one volume; temp cleaned on a rename failure), serialising ONLY `{ instanceId, licenseKey }` — there is no path to write any other field. The instance id is a licensing artifact and the key is a credential, not a user secret (architecture I3), so both may be cached; the PAT and the LLM key stay env-only and never touch this file. [Source: architecture.md "Atomic write"; config/config-store.ts]
- **Deactivate's key + instance come from env/cache, not a fresh prompt.** A licensed interactive user reached the Deactivate row because the startup gate resolved a paid tier — which means a key was available (env or the cached key). So Deactivate reads `readLicenseKey(env) ?? readCachedLicenseKey(env)` + `readActivationInstanceId(env)`; a missing key/instance returns a clear `{ ok: false, reason }` (never a crash). [Source: 7.1 gate; architecture.md key storage]
- **Second-device refusal is server-side, surfaced verbatim.** Lemon Squeezy enforces the Single-device activation limit; a second-device `activate` returns `activated: false` with an activation-limit message, which `activateLicense` returns as `{ ok: false, reason }` and the Activate screen shows plainly (AC3). No client-side device counting. [Source: architecture.md "Single-device bound via activation instances"; epics.md Story 7.2 AC3]
- **The cached-key gate read keeps the precedence.** `defaultResolveEntitlement` resolves the key as `readLicenseKey(env) ?? readCachedLicenseKey(env)` (env wins), so a one-time interactive Activate resolves the paid tier on later runs without re-exporting the env var, while CI's env key still takes precedence. The 7.1 gate (`resolveEntitlement`) is unchanged — only the cli key-source closure changes. [Source: 7.1 cli wiring; architecture.md key storage]
- **The launchpad dispatch becomes exhaustive.** With all four license rows live, `COMING_SOON` is removed and every `LaunchpadAction` has an explicit branch in `runLaunchpad` — TypeScript's narrowing makes the exhaustiveness structural (a future action would be an unhandled-case compile signal). [Source: cli/interactive.ts]
- **Cognitive-complexity ≤ 15 (SonarQube).** The shared `postForm` keeps the three LS callers thin; each `run*` screen delegates the call to the injected action and just formats the outcome. [Source: repo lint conventions]

### References

- epics.md → Epic 7 / **Story 7.2: Activate, deactivate, and buy/restore** (the three ACs), FR-16.
- architecture.md → "I3 — License Enforcement" (`activate`/`validate`/`deactivate` via fetch; device binding via activation instances; key/instance storage; second-device refusal), the source matrix.
- MENUS.md → "Activate license" (the only in-terminal key entry), "Buy / Restore license" (browser hand-off), "Deactivate license".
- DESIGN.md / EXPERIENCE.md → the state-conditioned license actions; "Buy Me a Coffee" unlicensed-only.
- Reuse: `license/lemonsqueezy.ts` (7.1 validate + the fetch pattern), `license/tiers.ts` (`tierForValidation` → extract `tierForVariantName`), `license/store.ts` (the read; add write/clear), `license/gate.ts` (unchanged), `config/config-store.ts` (the atomic-write pattern), `config/env.ts` (`readLicenseKey`), `cli/open-browser.ts` (`defaultOpenBrowser`/`browserCommand`), `cli/interactive.ts` (the launchpad `LaunchpadDeps`/`runLaunchpad`/`GuidedPrompts`/`buildLaunchpadOptions` license rows), `cli/cli.ts` (`runZeroArg`, `defaultResolveEntitlement`).

## Dev Agent Record

### Context

Baseline `7b48dd0` (Story 7.1). Implemented activate/deactivate + buy-restore on top of 7.1's validate-only gate, following the hexagonal seam (only `cli/`/`config/` touch env/prompts/network; the orchestrators + screens are pure and injected).

### Implementation summary

- **`src/license/lemonsqueezy.ts`** — refactored the 7.1 validator to share a private `postForm(doFetch, url, body, timeoutMs, key)` helper (NEVER throws; scrubs the key from any error via `.split(key).join("***")`). Added `LicenseActivation`/`LicenseActivator` + `createLemonSqueezyActivator` (`POST /v1/licenses/activate`, body `URLSearchParams({ license_key, instance_name })`) and `LicenseDeactivation`/`LicenseDeactivator` + `createLemonSqueezyDeactivator` (`POST /v1/licenses/deactivate`, body `{ license_key, instance_id }`). Bodies carry ONLY the key + device label/instance — never repo data.
- **`src/license/store.ts`** — `LicenseCache { instanceId?; licenseKey? }`; `readLicenseCache`/`readCachedLicenseKey`/`readActivationInstanceId` (allow-listed fields; missing/corrupt → `{}`; never throw); ATOMIC `writeLicenseCache` (mkdir → same-dir `.tmp` → rename; temp cleaned on rename failure; serialises ONLY `{ instanceId, licenseKey }`); best-effort `clearLicenseCache`.
- **`src/license/actions.ts`** (new) — `activateLicense`/`deactivateLicense` orchestrators returning UI-agnostic `{ ok, … }` outcomes.
- **`src/license/tiers.ts`** — extracted `tierForVariantName`; `tierForValidation` delegates (DRY).
- **`src/cli/interactive.ts`** — `runActivate` (the ONLY in-app key entry), `runDeactivate` (confirm + free), `runOpenUrl` (Buy/Restore + Coffee browser hand-offs, URL printed plainly on failure). Removed `COMING_SOON`; extracted `dispatchAction` to hold `runLaunchpad`'s complexity ≤ 15.
- **`src/cli/cli.ts`** — wired the activate/deactivate closures (`instanceName: hostname()`, persist = `writeLicenseCache`, clear = `clearLicenseCache`), `openUrl`/store/coffee URLs, and the cached-key gate read (`readLicenseKey(env) ?? readCachedLicenseKey(env)` — env wins).

### Code review — 2026-06-15 (3 parallel adversarial layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor: ACCEPT — all 3 ACs MET, 0 must-fix.** Verified the browser hand-off (no in-app checkout / no key entry on Buy-Restore), the atomic cache write serialising only the two allow-listed fields, the cached-key gate read precedence (env wins), and the verbatim server second-device refusal. Scope held (no 7.3/7.4 logic).
- **Blind Hunter: 0 defects.** The `postForm` refactor preserves the validator's privacy + error semantics; request bodies carry exactly 2 fields each; the key is scrubbed from all error paths.
- **Edge Case Hunter:** surfaced a real correctness gap + two honesty gaps; the rest were false positives.

**Triage → 3 patches applied · rest dismissed (with rationale):**

- [x] **[Patch] Empty-string instance id (#1, HIGH).** `activateLicense` guarded only `instanceId === undefined`, so a server `instance.id: ""` would be cached and later POSTed to deactivate. **Fix:** the guard is now `!result.activated || result.instanceId === undefined || result.instanceId === ""` (empty id is treated as a failed activation — persists nothing). Lock-in test added. (`deactivateLicense` already guarded `instanceId === ""`.)
- [x] **[Patch] Activate half-state honesty (#3/#4).** If the server activation SUCCEEDED (consuming a device slot) but the local cache write then threw, the screen showed a generic `⚠ Could not activate` — misleading, and a user who re-tries would waste a second device slot (locking a Single-device license out). **Fix:** `activateLicense` now catches the `persist` throw and returns `{ ok: false, reason: "Activated online, but couldn't save it on this device (<err>). Set COMMIT_WHISPER_LICENSE_KEY so it applies on your next run — do NOT re-activate …" }`. Lock-in test added.
- [x] **[Patch] Deactivate half-state honesty (#9).** Symmetric: a successful server deactivation followed by a `clear` throw now returns `{ ok: false, reason: "Freed online, but couldn't clear the local cache (<err>). Remove ~/.commit-whisper/license.json to finish." }` rather than implying the deactivation failed. Lock-in test added.
- [x] **[Patch — adopted from #17] Exhaustive dispatch.** `dispatchAction`'s `default:` silently routed any unknown action to "coffee" — a future `LaunchpadAction` would be a silent mis-route, not a compile error. **Fix:** `case "coffee"` is now explicit and `default: return assertNeverAction(action)` (the repo's established `assertNever` exhaustiveness pattern) — a new action is now a compile error here.
- [Dismissed] **`json.error` as a non-string (#2, LOW)** — the `LicenseActivation.error`/`LicenseDeactivation.error` interface types the field as `string`; the LS contract returns strings. Defensive runtime coercion is out of scope.
- [Dismissed] **`runOpenUrl` `note` undefined (#15)** — `note` is a required `string` parameter (every call site passes a string constant); `undefined` is a compile error. False positive.
- [Dismissed] **Readers throw → uncaught (#18/#19/#20, "CRITICAL")** — `readLicenseCache`/`readCachedLicenseKey`/`readActivationInstanceId` each wrap their I/O in `try/catch` returning `{}`/`undefined`; they never throw by construction. False positives (diff-only visibility — the source has the guards).
- [Dismissed] **URL `undefined` / control chars (#14/#16)** — every caller passes a validated constant URL; output is stderr. Out of scope (caller responsibility).

### Gates (post-patch)

- `npm run typecheck` ✓ · `npm run lint` ✓ · `npx vitest run` ✓ **897 tests** (+3 lock-in) · `npm run build` ✓ (`dist/index.js` 190.38 KB).

### Files

- `src/license/lemonsqueezy.ts`, `src/license/store.ts`, `src/license/actions.ts` (new), `src/license/tiers.ts`, `src/cli/interactive.ts`, `src/cli/cli.ts` (+ co-located `*.test.ts`).
