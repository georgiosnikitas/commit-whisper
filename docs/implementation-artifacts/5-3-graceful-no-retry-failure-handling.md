---
epic: 5
story: 3
title: Graceful no-retry failure handling
baseline_commit: 612ef5b
---

# Story 5.3: Graceful no-retry failure handling

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want clear, distinct failures with no silent retries,
so that I know exactly what went wrong and can choose to re-run.

## Acceptance Criteria

1. **Retrieval failures are classified into distinct, actionable classes (AC1).** **Given** a remote clone failure, **when** it is surfaced, **then** the message **distinguishes** the failure class — **network** (DNS / connection refused / timeout / TLS), **auth** (rejected credentials / insufficient scope / prompt-disabled), **not-found** (repository missing or inaccessible) — each with a concise, **actionable** message naming the likely fix (check the URL/connection · check the token & its scope · check the URL/visibility), and the message **never contains the token value**.

2. **No retry on transient or rate-limit errors — report the class (+ reset guidance where available) and stop (AC2).** **Given** a transient or **rate-limit** failure, **when** it occurs, **then** commit-whisper does **not** retry — it reports the failure class (and, for rate-limit, the provider and any **reset guidance** git surfaced) and **exits** rather than looping; the single clone attempt is the only attempt (no backoff, no second request).

3. **A failed retrieval exits without producing a partial Report (AC3).** **Given** any retrieval failure, **when** it propagates, **then** the run exits with the git/retrieve code (4), **no Report is assembled, written, or rendered** (stdout stays empty, no artifact file is created), and the typed `RetrieveError` carries the actionable message (its `cause` holds git's raw error, which is never rendered) — a failure is never laundered into a partial or empty-but-successful output.

## Tasks / Subtasks

- [ ] **Task 1 — The clone-failure classifier (AC1, AC2) [src/retrieve/errors.ts] (new).** [Source: architecture.md FR-3 → `retrieve/errors.ts`]
  - [ ] `export type CloneFailureKind = "auth" | "network" | "not-found" | "rate-limit" | "unknown"`.
  - [ ] `export function classifyCloneFailure(cause): CloneFailureKind` — pure: read the error's `stderr` + `message` text (guarded — a non-`Error`/missing-field cause → `"unknown"`), test an **ordered** signal list (most-specific first), return the first match or `"unknown"`. Order: **rate-limit** (`rate limit` / `too many requests` / `429`) → **auth** (the 5.2 set: `Authentication failed` / `could not read Username` / `terminal prompts disabled` / `invalid username or password` / `40[13]` / `Permission denied`) → **not-found** (`not found` / `does not exist` / `404`) → **network** (`could not resolve host` / `couldn't resolve` / `unable to access` / `failed to connect` / `connection (refused|reset|timed out)` / `could not connect` / `network is unreachable` / `operation timed out` / `SSL`/`TLS`). Anchored, case-insensitive, no catastrophic backtracking.
  - [ ] `export function cloneFailureError(url, authenticated, cause): RetrieveError` — the single home for the clone-failure → `RetrieveError` (exit 4) mapping, generalizing the 5.2 `cloneError`. Per kind, a **token-redacted**, actionable message that names the URL + the fix: **auth** keeps the 5.2 token-present (scope hint, names `COMMIT_WHISPER_GIT_TOKEN`) / token-absent (set-the-var hint) split; **not-found** acknowledges the GitHub-style private-repo ambiguity ("it may not exist, or it may be private and your token lacks access"); **network** points at the URL/connection; **rate-limit** names the host + "the tool does not retry — wait and re-run" (+ any reset text git surfaced, never fabricated); **unknown** → the generic "Failed to clone". The crafted message **never** includes the token; git's raw error rides `cause` (never rendered).

- [ ] **Task 2 — Wire the classifier into the remote adapter (AC1, AC2, AC3) [src/retrieve/remote.ts].**
  - [ ] Replace the inline 5.2 `cloneError`/`isAuthFailure`/`AUTH_FAILURE` with a call to `cloneFailureError(url, gitToken !== undefined, cause)` from `errors.ts`. The clone is still a **single** `runner(...)` call inside the `try` — **no retry loop** (the no-retry posture is structural: there is no second attempt anywhere). The credential-helper / prompt-off / token-channel mechanics (5.2) are unchanged; only the failure-mapping moves to the classifier. The auth-redaction + cleanup-on-failure (5.1/5.2) are preserved.

- [ ] **Task 3 — Confirm a failed retrieval produces no partial output (AC3) [src/cli/run.ts — verify, likely no change].**
  - [ ] Verify (and lock with a test) that a `RetrieveError` thrown from `retrieve(config)` propagates **before** `analyze`/`narrate`/`assemble`/`render` — so nothing is assembled, no file is written, stdout stays empty, and the shell maps it to exit 4. (The pipeline already `await`s `retrieve` first and the renderers run only after `reportFromOutcome`; this task is a guard test, not a code change — note explicitly if no change is needed.)

- [ ] **Task 4 — Tests (AC1, AC2, AC3).**
  - [ ] **`errors.test.ts`:** `classifyCloneFailure` maps representative git stderr strings to each kind — `Could not resolve host: github.com` → network; `fatal: Authentication failed` / `403` / `terminal prompts disabled` → auth; `remote: Repository not found` / `404` → not-found; `You have exceeded a secondary rate limit` / `429` → rate-limit; a benign/empty/non-Error cause → unknown; **ordering** (a `403` is auth not not-found; a `429` is rate-limit not auth); `cloneFailureError` produces a `RetrieveError` (exit 4) whose message matches the kind + names the fix and **never contains the token** (pass a token-bearing `authenticated=true`, assert the secret string is absent — the message takes only the URL + booleans, so this is structural, but lock it).
  - [ ] **`remote.test.ts` (extend):** a network-class clone failure → a network-worded `RetrieveError`; a not-found clone failure → a not-found-worded error; a rate-limit clone failure → a rate-limit-worded error that states it will not retry; the clone runner is invoked **exactly once** on failure (no-retry lock-in); the temp dir is still cleaned on every class of failure; the existing 5.2 auth cases still pass through the new path unchanged.
  - [ ] **`run.test.ts` (extend):** a `retrieve` that throws a `RetrieveError` → the pipeline rejects with it (exit 4 at the shell), **stdout is empty**, and the injected `writeFile` is **never called** (no partial artifact) — the AC3 no-partial-output lock-in.

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the clone-failure **classifier** (`classifyCloneFailure` → auth/network/not-found/rate-limit/unknown) + the `RetrieveError` mapping (`cloneFailureError`) in the architecture's `retrieve/errors.ts`; wiring it into the remote adapter (replacing the 5.2 inline auth-only mapping); the **no-retry** guarantee (structural — one clone attempt, asserted); the **no-partial-output** guarantee (a retrieval failure exits 4 with nothing written, asserted); token-redacted messages throughout. All offline-testable (canned stderr through the injected `GitRunner`).

**Out of scope / deferred (do NOT build here):**
- **Actual retry / backoff logic** — explicitly **forbidden** by the AC (no-retry posture). 5.3 *guarantees the absence* of retry; it adds none. [Source: epics.md#FR-3, architecture.md "no-retry"]
- **Provider-API rate-limit headers / precise reset timestamps** — commit-whisper clones over the **git protocol**, not the provider REST API (the architecture's deliberate rate-limit-minimizing choice), so git stderr rarely carries a precise `X-RateLimit-Reset`. 5.3 surfaces the rate-limit **class** + any reset text git *already* printed, but never fabricates a reset time or calls a provider API. [Source: architecture.md (git clone over provider APIs minimizes rate-limit exposure)]
- **Local-retrieval failure re-wording** — the local adapter's "not a git repository" errors (1.4) are already actionable and unchanged; 5.3 classifies **remote clone** failures (the new network/auth/not-found/rate-limit surface). [Source: src/retrieve/read-history.ts]
- **Narration / LLM-provider failure classification** — a separate concern (Epic 3's preflight + fail-open, exit 6/9); 5.3 is retrieval (exit 4) only. [Source: src/cli/run.ts]
- **Retry-able partial clone resumption / shallow re-fetch** — out of scope; a failed clone is a clean abort + cleanup (5.1), then a typed error. [Source: this story]

### Architecture decisions (read first)

- **`retrieve/errors.ts` is the FR-3 home (the architecture map names it).** The classifier + the `RetrieveError` mapping live there, generalizing the 5.2 `cloneError`/`isAuthFailure` (which were a deliberate auth-only seed). The remote adapter calls one function (`cloneFailureError`) and stops owning the taxonomy. [Source: architecture.md#Component Map (FR-3 → `retrieve/errors.ts`)]
- **No-retry is structural, not a setting.** There is no retry loop anywhere in `retrieve/`: the remote adapter makes a **single** `git clone` call; on failure it throws. 5.3 does not add a retry and asserts the single-attempt invariant (the clone runner is called exactly once on failure). A transient/rate-limit error is reported + raised, never looped — matching the architecture's "no-retry keeps the story clean" + "git clone over provider APIs minimizes rate-limit exposure". [Source: architecture.md, src/retrieve/remote.ts]
- **Classification order resolves the overlaps deliberately.** rate-limit (`429`) before auth (so a throttle isn't mis-read as a credential problem); auth (`401`/`403`) before not-found (an explicit reject is auth; a `404` is not-found); not-found acknowledges GitHub's **private-repo ambiguity** (a hidden private repo and a missing repo both surface as `404`/"not found", so the message names both possibilities). An unmatched failure is `unknown` → the generic "Failed to clone" (never a wrong-but-confident class). [Source: this story; GitHub's 404-for-private behavior]
- **Token-redaction is preserved end-to-end.** Every crafted message takes only the **URL** + the auth booleans — never the token; git's raw stderr stays in `RetrieveError.cause`, which `messageForError` never renders (it shows only `err.message`). An adversarial test asserts the token value is absent from every classified message. [Source: src/cli/exit-codes.ts messageForError, src/shared/secret.ts]
- **No partial Report on failure — structural in the pipeline.** `runPipeline` `await`s `retrieve(config)` **first**; a thrown `RetrieveError` short-circuits before `analyze`/`narrate`/`assemble`/`render`, so no Report is built and `writeStdout`/`writeFile` are never reached. 5.3 locks this with a test (exit 4 · empty stdout · no file written); the only "output" of a failed run is the stderr error line. [Source: src/cli/run.ts, src/cli/exit-codes.ts]

### The contracts to build on (do NOT redefine)

- **`RetrieveError` (1.3) + exit 4 + `messageForError` (1.3):** every clone failure is a `RetrieveError`; only its `message` is shown (token-free), `cause` carries the raw error unrendered. [Source: src/shared/errors.ts, src/cli/exit-codes.ts]
- **`createRemoteRetrieve` / the clone seam (5.1/5.2):** the single `try { await runner(cloneArgs…) } catch` is where `cloneFailureError` replaces the inline `cloneError`; the credential-helper/prompt-off/token-channel + cleanup are unchanged. [Source: src/retrieve/remote.ts]
- **The 5.2 auth signals (`AUTH_FAILURE` regex):** fold into the classifier's `auth` signal verbatim (the auth dimension is unchanged; 5.3 adds the network/not-found/rate-limit dimensions around it + keeps the token-present/absent message split). [Source: src/retrieve/remote.ts]
- **`runPipeline` (1.8):** `retrieve` is the first awaited stage; a thrown `RetrieveError` already aborts before any output. 5.3 verifies + tests this (no code change expected there). [Source: src/cli/run.ts]

### Determinism, security & purity (the rules — unchanged)

- **Security:** every classified message is token-free (URL + booleans only); git's stderr stays in `cause` (never rendered); the adversarial test asserts no token leaks through any class. No new secret surface. [Source: NFR-1/FR-2, securityRequirements]
- **Pure classifier:** `classifyCloneFailure` is a pure text-over-regex function (no clock/I/O/random); `cloneFailureError` is pure (cause + URL + booleans → `RetrieveError`). The regexes are anchored / alternation-only (no nested quantifiers → no ReDoS). [Source: architecture.md, securityRequirements]
- **Determinism:** classification depends only on git's stderr text → deterministic for identical input; a failed run produces no Report, so determinism of the success path is untouched. [Source: architecture.md C2]
- **No new dependencies:** pure regex + the existing `RetrieveError`/`Secret`. [Source: architecture.md]
- **No-console / layering:** `retrieve/errors.ts` is under `no-console` and imports only `shared/errors`; the adapter calls it (correct direction). [Source: eslint.config.js]

### Previous-story intelligence

- **5.2 built the auth classifier as a deliberate seed; 5.3 generalizes it into the full taxonomy in `retrieve/errors.ts`.** The auth regex + the token-present/absent message split move verbatim; network/not-found/rate-limit join them; the remote adapter swaps its inline mapping for the one classifier call. [Source: src/retrieve/remote.ts]
- **The injected `GitRunner` (1.4) lets every failure class be tested offline with canned stderr** — no real network; a rejecting fake runner with a crafted `.stderr` drives each branch. [Source: src/retrieve/remote.test.ts]
- **`messageForError` shows only `err.message`, never `cause` (1.3)** — so attaching git's raw stderr as `cause` is safe and the crafted message stays token-free + class-specific. [Source: src/cli/exit-codes.ts]
- **The single-`git clone`-call shape (5.1) IS the no-retry guarantee** — 5.3 just asserts it (clone runner called once on failure) and never adds a loop. [Source: src/retrieve/remote.ts]
- **Cleanup-on-every-exit (5.1 `withTempWorkspace`) already covers a failed clone** — the temp dir is removed whether the clone throws or succeeds; 5.3's new error classes inherit that. [Source: src/retrieve/temp-workspace.ts]

### References

- [Source: docs/planning-artifacts/epics.md#Story 5.3: Graceful no-retry failure handling] (the ACs) · [Source: …#FR-3] (distinguish network/auth/not-found, no retry on transient/rate-limit, report provider + reset guidance, exit without a partial Report)
- [Source: docs/planning-artifacts/architecture.md#Component Map] (FR-3 → `retrieve/errors.ts`) · [Source: …] (no-retry posture, git clone over provider APIs to minimize rate-limit exposure, stateless + guaranteed cleanup)
- [Source: src/retrieve/remote.ts] (the 5.2 `cloneError`/`isAuthFailure` seed + the clone seam) · [Source: src/shared/errors.ts] (`RetrieveError`) · [Source: src/cli/exit-codes.ts] (`messageForError` — `cause` never rendered) · [Source: src/cli/run.ts] (retrieve-first pipeline — no partial output on failure)

## Dev Agent Record

### Completion Notes (Amelia)

The Epic 5 finale — classifies remote-clone failures into actionable classes, guarantees no retry, and guarantees no partial Report. 691 tests pass (+27 over 5.2); typecheck/lint/build all green. Zero new dependencies (pure regex + the existing `RetrieveError`/`Secret`). Bundle 148.57 → 149.86 KB.

- **`src/retrieve/errors.ts`** (new — the architecture's FR-3 home) — `classifyCloneFailure(cause): CloneFailureKind` reads git's stderr+message (guarded — a non-`Error`/missing-field cause → `""` → `"unknown"`, never a crash) against an **ordered** signal list: **rate-limit** (`429`/`rate limit`/`too many requests`) → **auth** (the 5.2 set: `Authentication failed`/`could not read Username`/`terminal prompts disabled`/`40[13]`/`Permission denied`) → **not-found** (`404`/`not found`/`does not exist`) → **network** (`could not resolve host`/`unable to access`/`failed to connect`/`connection refused|reset|timed out`/`SSL`/`TLS`/…) → `"unknown"`. The order resolves overlaps deliberately (a `429` is rate-limit not auth; a `403` is auth not not-found). `cloneFailureError(url, authenticated, cause)` maps the kind to a token-redacted `RetrieveError` (exit 4): auth keeps the 5.2 token-present (scope hint) / token-absent (set-the-var hint) split; not-found names GitHub's private-repo ambiguity; network points at the URL/connection; rate-limit states the tool **does not retry**; unknown → generic "Failed to clone". Regexes are alternation-only (no ReDoS).
- **`src/retrieve/remote.ts`** (refactor) — the inline 5.2 `cloneError`/`isAuthFailure`/`AUTH_FAILURE` are replaced by one `cloneFailureError(...)` call in the clone `catch`. The clone is still a **single** `runner(...)` attempt — **no retry loop anywhere** (the no-retry posture is structural). The credential-helper/prompt-off/token-channel/cleanup (5.1/5.2) are unchanged.
- **No code change in `run.ts`** — a `RetrieveError` thrown from `retrieve(config)` already short-circuits before `analyze`/`narrate`/`assemble`/`render`, so no Report is built and `writeStdout`/`writeFile` are never reached. Locked with a test (exit 4 · empty stdout · no file written).

**End-to-end verified:** a bad host → "Could not reach the remote … Check the URL and your network connection"; a missing repo → "Repository not found … may not exist, or may be private and your token lacks access"; both exit 4 with 0 temp leaks.

**Deferred (unchanged):** actual retry/backoff (forbidden by the AC); provider-API rate-limit headers / precise reset timestamps (clone is over the git protocol, not the REST API — surface only what git printed); local-retrieval re-wording; narration/LLM failure classification (exit 6/9, separate).

### Review (3-layer adversarial)

- **Acceptance Auditor — all 3 ACs MET, scope held, 0 must-fix.** Verified the distinct actionable classes + token-free messages (AC1), the no-retry posture (single clone attempt, "does not retry" wording, no fabricated reset) (AC2), and the no-partial-output guarantee (exit 4, empty stdout, no file, `cause` unrendered) (AC3). Confirmed: no retry/backoff added, no provider-API calls, no local re-wording, no new deps, the classifier in `retrieve/errors.ts`, refactor parity (auth split preserved), token-redaction, determinism.
- **Blind Hunter — 0 defects** (Critical/High/Medium/Low/Nit all clean): regex safety (alternation-only, no ReDoS), token-leak prevention (message takes no token param; `cause` never rendered), classification order, the `failureText` guard, refactor parity, no-retry, no-partial-output, and lint/style (exhaustive switch).
- **Edge Case Hunter — 3 findings → 1 PATCHED, 2 DISMISSED:**
  - **[EC1 "CRITICAL: a URL with embedded `user:TOKEN@` userinfo leaks via the echoed URL"] PATCHED.** Although the token is env-only by design, a user *could* paste a credential-bearing clone URL as the target; the failure messages echo the URL, so a `redactUrl` helper now strips `//user:secret@` → `//***@` before the URL enters any message. +1 lock-in test (the embedded secret is absent, the redacted host still shown). A genuine leak-safety hardening consistent with Epic 5's posture.
  - **[EC2 "MEDIUM: a throwing-getter Proxy cause crashes `failureText`"] DISMISSED — can't occur.** The `cause` is always an `execFile` rejection (a plain `Error` with string `stderr`); nothing in the codebase constructs a throwing-getter cause. The existing sibling guards (`isUnbornHead` in read-history.ts) use the identical no-try/catch `typeof` pattern — adding defensive code for an impossible input would be over-engineering inconsistent with the codebase.
  - **[EC3 "LOW: a Buffer `stderr` is silently lost"] DISMISSED — safe + non-occurring.** `execFile` returns string `stderr` by default; the guard correctly defaults a non-string to `""` (→ `"unknown"`, the safe fallback), never a crash.

**Patches applied:** 1 (URL userinfo redaction). **Tests added:** 1 (the redaction lock-in). **Dismissed:** 2. Re-ran all gates green (691 tests).

### File List

- `src/retrieve/errors.ts` (new) · `src/retrieve/errors.test.ts` (new)
- `src/retrieve/remote.ts` (refactored to call the classifier) · `src/retrieve/remote.test.ts` (modified)
- `src/cli/run.test.ts` (modified — the no-partial-output lock-in)
