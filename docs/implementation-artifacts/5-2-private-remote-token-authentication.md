---
epic: 5
story: 2
title: Private-remote token authentication
baseline_commit: 68a7ec3
---

# Story 5.2: Private-remote token authentication

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user with a private repository,
I want to authenticate with a personal access token from the environment,
so that I can analyze private history without leaking secrets.

## Acceptance Criteria

1. **The PAT is read from an environment variable ONLY and never leaks (AC1).** **Given** a private remote target, **when** a token is required, **then** it is read **only** from an environment variable — `COMMIT_SAGE_GIT_TOKEN` (precedence) then the host fallbacks `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` — **never** from a flag, config file, or prompt, **wrapped in `Secret<string>`**, and is supplied to `git clone` via a mechanism that keeps it **out of `argv`/`ps`** (a credential helper that reads it from the child process's environment, never the URL or a command-line option) so the token **never** appears in Report JSON, logs, rendered output, or a process listing.

2. **A local path or public remote needs no token — its absence is never an error (AC2).** **Given** a local filesystem path or a **public** remote, **when** a run executes with no token set, **then** it succeeds with no token required and the absence of a token is **never** an error; for a remote clone, git's interactive credential prompt is **disabled** (`GIT_TERMINAL_PROMPT=0` + a cleared credential helper) so a private repo with no token **fails fast** rather than hanging on a prompt.

3. **An insufficient-scope / rejected token produces a clear, actionable error (AC3).** **Given** a remote clone that is **rejected for authentication** (a 401/403, "Authentication failed", or "could not read Username" with prompts disabled), **when** it fails, **then** the run exits with the git/retrieve code (4) and an actionable message that **names the fix**: if a token **was** supplied, it states the token (`COMMIT_SAGE_GIT_TOKEN`) may **lack the scope** to read this repository (e.g. read/`repo` access) and to verify its permissions; if **no** token was supplied, it states authentication is required and names the env var(s) to set — and the message **never contains the token value**.

## Tasks / Subtasks

- [ ] **Task 1 — Read the git PAT from the environment (AC1) [src/config/env.ts].**
  - [ ] `export function readGitToken(env): Secret<string> | undefined` — reads `COMMIT_SAGE_GIT_TOKEN` (precedence) ?? `GITHUB_TOKEN` ?? `GITLAB_TOKEN` ?? `BITBUCKET_TOKEN`, trims to non-empty, wraps in `Secret`; `undefined` when none set. Env-only (the single `process.env` boundary); the alias precedence matches `readAiKey`'s pattern. A one-line note on the GitHub-Actions `GITHUB_TOKEN` footgun (auto-scoped to the workflow's own repo) — `COMMIT_SAGE_GIT_TOKEN` overrides it.

- [ ] **Task 2 — Let the git runner carry git-auth env without leaking it (AC1) [src/retrieve/git.ts].**
  - [ ] Extend `GitRunner` options with `extraEnv?: Record<string, string>` (the git-auth channel — `GIT_TERMINAL_PROMPT`, the credential-helper token var). `execFileGitRunner` passes `env: extraEnv === undefined ? undefined : { ...process.env, ...extraEnv }` (a single, justified `eslint-disable` for `process.env`: execFile **already** inherits `process.env` by default — this only makes that explicit to ADD the two git-auth vars; **no application config is read**). When `extraEnv` is absent (every local read), no env is passed (clean inherit, no `process.env` reference). The token value lives only in `extraEnv`, never in `args`.

- [ ] **Task 3 — Authenticate the clone via an env-fed credential helper (AC1, AC2, AC3) [src/retrieve/remote.ts].**
  - [ ] Build the clone args so the token is **never** an argv element: always `-c credential.helper=` (clears any inherited system/global helper so no GUI/system prompt) ; when a token is present, also `-c credential.helper=!f() { test "$1" = get && echo username=x-access-token && echo "password=$COMMIT_SAGE_GIT_PAT"; }; f` — the helper script in `argv` references the **env var name** `$COMMIT_SAGE_GIT_PAT`, expanded by git's shell from the child env at runtime; the **value** is only in `extraEnv`. The username `x-access-token` works for GitHub + GitLab (PAT-as-password); per-host refinement (Bitbucket app-password username) is a documented later tweak.
  - [ ] `extraEnv` for the clone is always `{ GIT_TERMINAL_PROMPT: "0" }` (no hang / no prompt) **plus** `COMMIT_SAGE_GIT_PAT: token.reveal()` **only** when a token is present (revealed at the latest possible point — the clone call). The history **read** (from the local clone) needs no auth/env — only the clone carries `extraEnv`.
  - [ ] On a clone failure, classify the **auth** dimension only (5.3 owns the full network/not-found/rate-limit taxonomy): if git's stderr matches an auth signal (`Authentication failed` / `could not read Username` / `terminal prompts disabled` / `403` / `401` / `invalid username or password` / `Permission denied`), throw a `RetrieveError` (exit 4) whose message names the fix (token-present ⇒ scope hint; token-absent ⇒ set-the-var hint) and **never** includes the token; else fall back to the generic 5.1 "Failed to clone" (the underlying error stays in `cause`, which is never rendered). `createRemoteRetrieve` gains an optional `gitToken?: Secret<string>`.

- [ ] **Task 4 — Thread the token through the dispatcher + pipeline (AC1, AC2) [src/retrieve/retrieve.ts, src/cli/run.ts, src/cli/cli.ts].**
  - [ ] `RetrieveDeps` gains `gitToken?: Secret<string>`; `createRetrieve` passes it to `createRemoteRetrieve`. `RunDeps` gains `gitToken?: Secret<string>`; `run.ts`'s default retriever becomes `createRetrieve({ gitToken: deps.gitToken })` (an injected `deps.retrieve` is unaffected). `cli.ts` reads `const gitToken = readGitToken(env)` next to `readAiKey` and passes it into the run deps. The token rides `RunDeps` (like `aiKey`), never the frozen `RunConfig` (it never crosses the hexagonal config boundary).

- [ ] **Task 5 — Tests (AC1, AC2, AC3).**
  - [ ] **`env.test.ts`:** `readGitToken` precedence (`COMMIT_SAGE_GIT_TOKEN` > `GITHUB_TOKEN` > `GITLAB_TOKEN` > `BITBUCKET_TOKEN`), `undefined` when none, blank-string ignored, and the result **redacts** (`String(token)` / `JSON.stringify` ⇒ `***`) — the leak-safety lock-in.
  - [ ] **`git.test.ts`:** `execFileGitRunner` with `extraEnv` passes `opts.env` containing the extras (merged over the inherited env); without `extraEnv` passes no `env` (clean inherit). The args array is unchanged by `extraEnv` (token channel is env, not argv).
  - [ ] **`remote.test.ts`:** an authenticated clone — the args contain the cleared + inline credential helper, the helper references `$COMMIT_SAGE_GIT_PAT` (the **name**), `extraEnv` carries `GIT_TERMINAL_PROMPT=0` + `COMMIT_SAGE_GIT_PAT=<token>`, and the **token value appears in NO args element** (the anti-`ps`-leak assertion); a no-token clone — the args clear the helper but add **no** inline helper, `extraEnv` has `GIT_TERMINAL_PROMPT=0` and **no** `COMMIT_SAGE_GIT_PAT`; an auth-rejected clone **with** a token → `RetrieveError` (4) naming the scope, **not** the token; an auth-rejected clone **without** a token → `RetrieveError` naming the env var to set; a non-auth failure → the generic "Failed to clone"; **the token value never appears in any thrown message** (leak lock-in).
  - [ ] **`retrieve.test.ts` / `run`+`cli`:** the dispatcher threads `gitToken` to the remote adapter (a remote clone receives the auth helper; a local target ignores the token); `cli.ts` reads `COMMIT_SAGE_GIT_TOKEN` into `RunDeps.gitToken` (the `readAiKey` test's sibling — assert `deps.gitToken?.reveal()` via the run spy), and a local/public run with **no** token still succeeds (absence is never an error).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** reading the git PAT env-only (`COMMIT_SAGE_GIT_TOKEN` + host fallbacks) as a `Secret`; supplying it to `git clone` via an env-fed credential helper that keeps it out of `argv`/`ps`/logs/output; disabling git's interactive prompt so a private-no-token clone fails fast; the auth-rejection actionable error (scope hint / set-the-var hint), token-redacted; threading the token through the dispatcher + pipeline (via `RunDeps`, like `aiKey`).

**Out of scope / deferred (do NOT build here):**
- **The full failure taxonomy + no-retry (distinguish network vs auth vs not-found vs rate-limit, reset guidance, no partial Report)** — **Story 5.3**. 5.2 classifies only the **auth** dimension (token-rejected); a non-auth clone failure stays the generic 5.1 "Failed to clone" until 5.3 refines it. The 5.2 auth detector is a small helper 5.3 can absorb into its classifier. [Source: epics.md#Story 5.3]
- **SSH / `git@` targets** — 5.1's `isRemoteTarget` is HTTPS-only; SSH key auth is a separate mechanism, not in this epic's HTTPS-PAT scope. [Source: src/retrieve/target.ts]
- **Per-host username nuance (Bitbucket app-password username, GitLab `oauth2`)** — 5.2 uses `x-access-token` (GitHub-blessed; GitLab accepts any username with a PAT password). A host-aware username map is a later refinement behind the same helper. [Source: this story]
- **Interactive secret prompting / `~/.commit-sage` token storage** — **forbidden by design** (secrets are env-only, never prompted/persisted); the interactive menu (Epic 6) only **names** the env var. [Source: architecture.md#Secrets, FR-2]
- **License / entitlement gating of private access** — Epic 7; unrelated to the PAT mechanism. [Source: epics.md#Epic 7]

### Architecture decisions (read first)

- **The token never touches `argv` — it rides the child process's environment, read by a credential helper.** A `--token`-style flag is **never defined** (architecture: "no `--api-key`-style flag is even defined, so a key can never appear in `argv` or `ps`"). The clone passes `-c credential.helper=!f() { … echo "password=$COMMIT_SAGE_GIT_PAT"; }; f`: the helper **script** (with the env-var **name**) is in `argv`; the token **value** is in `extraEnv.COMMIT_SAGE_GIT_PAT`, expanded by git's shell at runtime. So `ps aux` shows the helper, never the secret. We never interpolate the token (or the URL) into the helper script — no injection vector. [Source: architecture.md#Secrets ("never appear in argv or ps"), securityRequirements]
- **`Secret<string>` + reveal-at-point-of-use.** The token is wrapped from `config/env.ts` (the single env-reading boundary) and `reveal()`-ed only at the clone call when building `extraEnv` — the same discipline as the LLM key (revealed only at the SDK call). It rides `RunDeps` (not the frozen `RunConfig`), exactly like `aiKey`, so the secret never crosses into the pure config contract. [Source: src/shared/secret.ts, src/config/env.ts readAiKey, src/cli/run.ts aiKey]
- **`execFileGitRunner` makes its already-implicit `process.env` inheritance explicit to add two git-auth vars — the one justified boundary touch.** `execFile` inherits `process.env` by default; to ADD `GIT_TERMINAL_PROMPT=0` + the token channel we must pass an explicit `env`, which (lacking a Node "extend" flag) merges `{ ...process.env, ...extraEnv }`. This is **not** reading application configuration (the hexagonal rule's intent) — it is propagating the OS env to the `git` child — so a single scoped `eslint-disable-next-line no-restricted-properties` with that justification is the honest, minimal touch. It fires **only** on the authed clone path (local reads pass no `extraEnv`). [Source: src/retrieve/git.ts, eslint.config.js, securityRequirements]
- **Prompt-off so a private-no-token clone fails fast, never hangs.** Always set `GIT_TERMINAL_PROMPT=0` and clear inherited credential helpers (`-c credential.helper=`) for a remote clone — so a private repo with no/bad token errors immediately (then AC3 guidance) instead of blocking on git's interactive username/password prompt (which would hang a headless run). A **public** remote clones fine with no token. [Source: FR-2 "absence never an error" for public/local; FR-15 headless no-hang]
- **Read-only + token-redacted errors.** Cloning is read-only (5.1). The auth error names the URL + the env var(s) + a scope hint — **never** the token; git's raw stderr stays only in the `RetrieveError` `cause` (never rendered — `messageForError` shows only `err.message`), and the token is in the env/helper, not the URL or stderr, so it cannot reach output. [Source: NFR-1/FR-2 "tokens never in logs/output", src/cli/exit-codes.ts messageForError]

### The contracts to build on (do NOT redefine)

- **`Secret<string>` (1.3):** the redaction wrapper; `reveal()` only at the clone call. [Source: src/shared/secret.ts]
- **`readAiKey` / `readProcessEnv` / `str` (1.6/3.6):** the env-only secret-reading pattern `readGitToken` mirrors (precedence + alias + `Secret` wrap). [Source: src/config/env.ts]
- **`GitRunner` / `execFileGitRunner` (1.4):** the `execFile` shell-out seam; gains `extraEnv?` (optional, backward-compatible — existing `{ cwd }` callers unchanged). [Source: src/retrieve/git.ts]
- **`createRemoteRetrieve` / `cloneArgs` / `withTempWorkspace` (5.1):** the clone-into-temp adapter; the clone args + `extraEnv` are where auth layers on; cleanup/statelessness are unchanged. [Source: src/retrieve/remote.ts, src/retrieve/temp-workspace.ts]
- **`createRetrieve` / `RetrieveDeps` (5.1) + `RunDeps` (1.8) + the `aiKey` threading (1.6):** the token threads the identical channel (`cli.ts → RunDeps → createRetrieve → remote`). [Source: src/retrieve/retrieve.ts, src/cli/run.ts, src/cli/cli.ts]
- **`RetrieveError` (1.3) + exit 4 + `messageForError` (1.3):** the auth failure is a `RetrieveError`; only its `message` is shown (token-free), `cause` carries the raw error unrendered. [Source: src/shared/errors.ts, src/cli/exit-codes.ts]

### Determinism, security & purity (the rules — unchanged)

- **Security is the heart of this story:** token env-only, `Secret`-wrapped, never in `argv`/`ps`/JSON/logs/output, credential helper fed from the child env (no URL-embedding, no `--header` flag), prompts disabled, errors token-redacted. An adversarial test asserts the token value appears in **no** clone arg and **no** thrown message. [Source: NFR-1, NFR-2, FR-2, securityRequirements]
- **No injection:** `execFile` array args (no shell from us); the credential-helper script is a literal constant (the URL/token are never interpolated into it); the `--` clone guard (5.1) still holds. [Source: src/retrieve/git.ts, securityRequirements]
- **No new dependencies:** `node:child_process` (existing runner) + the `Secret`/env machinery. [Source: architecture.md]
- **Determinism unaffected:** auth changes only *whether the clone succeeds*, not *what is read* — a private clone yields the same `analysis` as if it were local. The token never enters `RepoHistory`/`analysis`/the Report. [Source: architecture.md C2]
- **`process.env` only via `config/env.ts`** for reading the token; the one runner merge is the justified, scoped exception (execFile already inherits it). [Source: eslint.config.js]

### Previous-story intelligence

- **5.1 built the clone seam (`cloneArgs` + `GitRunner` + `withTempWorkspace`) ready for auth layering; 5.2 adds the token + the credential helper + the prompt-off + the auth error.** No change to detection, the temp workspace, cleanup, or the shared reader. [Source: src/retrieve/remote.ts]
- **`readAiKey` (1.6/3.6) is the exact template for `readGitToken`** — env-only, precedence/alias, `Secret`-wrapped, threaded via `RunDeps` and revealed at the point of use. [Source: src/config/env.ts, src/cli/cli.ts]
- **`execFile`-not-shell + `--` is the established injection-safe shell-out (1.4/5.1)** — the credential helper keeps the token in env, never argv, preserving it. [Source: src/retrieve/git.ts]
- **`messageForError` shows only `err.message`, never `cause`** (1.3) — so attaching git's stderr as `cause` is safe; the crafted message stays token-free. [Source: src/cli/exit-codes.ts]

### References

- [Source: docs/planning-artifacts/epics.md#Story 5.2: Private-remote token authentication] (the ACs) · [Source: …#FR-2] (env-only PAT, never argv/config/prompt, never in JSON/logs/output, insufficient-scope error, absence-never-an-error) · [Source: …#NFR-1/NFR-2] (privacy/security, read-only, secrets env-only)
- [Source: docs/planning-artifacts/architecture.md#Secrets] (no `--api-key` flag → never in argv/`ps`; `COMMIT_SAGE_GIT_TOKEN` precedence over `GITHUB_TOKEN`/`GITLAB_TOKEN`/`BITBUCKET_TOKEN`; `Secret<string>` redaction; first-run names the env var) · [Source: …#Retrieval] (clone shell-out, stateless)
- [Source: src/config/env.ts] (`readAiKey` pattern to mirror) · [Source: src/shared/secret.ts] (`Secret`) · [Source: src/retrieve/git.ts] (the runner to extend) · [Source: src/retrieve/remote.ts] (the clone to authenticate) · [Source: src/retrieve/retrieve.ts, src/cli/run.ts, src/cli/cli.ts] (the threading channel)

## Dev Agent Record

### Completion Notes (Amelia)

Adds private-remote PAT authentication — read env-only, supplied to `git clone` without ever touching `argv`/`ps`/logs/output. 664 tests pass (+14 over 5.1); typecheck/lint/build all green. Zero new dependencies. Bundle 146.06 → 148.57 KB.

- **`config/env.ts`** — `readGitToken(env): Secret<string> | undefined` reads `COMMIT_SAGE_GIT_TOKEN` (precedence) ?? `GITHUB_TOKEN` ?? `GITLAB_TOKEN` ?? `BITBUCKET_TOKEN`, trims, wraps in `Secret`; the exact `readAiKey` template (env-only, the single `process.env` boundary). Documents the GitHub-Actions `GITHUB_TOKEN` footgun (auto-scoped to the workflow's own repo).
- **`retrieve/git.ts`** — `GitRunner` options gain `extraEnv?: Record<string,string>` (the git-auth channel). `execFileGitRunner` passes `env: extraEnv === undefined ? undefined : { ...process.env, ...extraEnv }` with one scoped, justified `eslint-disable no-restricted-properties` — execFile **already** inherits `process.env` by default; this makes it explicit only to ADD the two auth vars (not config reading). Local reads pass no `extraEnv` → clean inherit, no `process.env` reference.
- **`retrieve/remote.ts`** — the token is supplied via an **env-fed credential helper**: `cloneArgs` always clears inherited helpers (`-c credential.helper=`, no GUI/system prompt) and, when a token is present, adds `-c credential.helper=!f() { test "$1" = get && echo username=x-access-token && echo "password=$COMMIT_SAGE_GIT_PAT"; }; f` — the helper **script** in `argv` names the env var `$COMMIT_SAGE_GIT_PAT`; the **value** is only in `extraEnv` (`cloneEnv`: `GIT_TERMINAL_PROMPT=0` always + `COMMIT_SAGE_GIT_PAT=<reveal()>` when present). `reveal()` is called at the latest point (the clone). `cloneError` classifies the **auth** dimension (token-present ⇒ provider-agnostic scope hint; token-absent ⇒ set-the-var hint), token-redacted; git's raw stderr rides `cause` (never rendered). Non-auth failures stay the generic 5.1 "Failed to clone" (5.3 owns the taxonomy).
- **`retrieve/retrieve.ts` + `cli/run.ts` + `cli/cli.ts`** — `gitToken` threads `cli (readGitToken) → RunDeps → createRetrieve → createRemoteRetrieve`, the identical channel as `aiKey`; it never enters the frozen `RunConfig`.

**End-to-end verified:** a public clone (`octocat/Hello-World`) still works (exit 0, 32 metrics, 0 temp leaks); a private/nonexistent repo with no token **fails fast** (exit 4, no hang — `GIT_TERMINAL_PROMPT=0`), 0 temp leaks.

**Security posture (the heart of this story):** the token is env-only, `Secret`-wrapped (redacts to `***` in `toString`/`toJSON`/inspect), supplied via the child env (never the URL, a `--header`, or any argv element), prompts disabled, and the auth error names the env var + a scope hint but **never** the token value. An adversarial test asserts the token appears in **no** clone arg and **no** thrown message. We never interpolate the token (or URL) into the helper script — no injection.

**Deferred (unchanged):** the full failure taxonomy (network/not-found/rate-limit) + no-retry + reset guidance (Story 5.3); SSH/`git@` auth; per-host username refinement (Bitbucket app-password username); interactive prompting / on-disk token storage (forbidden by design).

### Review (3-layer adversarial) — unanimous accept, 1 nit patched

- **Acceptance Auditor — all 3 ACs MET, scope held, 0 must-fix.** Verified env-only token + `Secret` + helper-names-the-env-var (token never in argv/ps/JSON/logs) (AC1); absence-never-an-error + `GIT_TERMINAL_PROMPT=0` fail-fast (AC2); auth-rejected → token-redacted actionable error (scope hint / set-the-var hint) (AC3). Confirmed no 5.3 over-build, no SSH, no prompt/on-disk storage, no new deps, the `Secret`/RunDeps threading mirrors `aiKey`, the eslint-disable is the single justified boundary touch, read-only, determinism preserved, back-compat (optional `extraEnv?`).
- **Edge Case Hunter — 0 unhandled edge cases.** Walked `readGitToken` (none/blank/precedence), the `extraEnv` merge (no-mutation, collision-wins, clean-inherit), `cloneArgs`/`cloneEnv` (authed/unauthed, token-with-metacharacters stays in env never argv), `isAuthFailure` (non-Error/no-stderr/non-string-stderr cause, the `\b40[13]\b` word-boundary guarding false positives), token threading (local ignores the token), and the always-on no-hang guarantee.
- **Blind Hunter — 0 leak paths, 0 Critical/High/Medium; 1 Nit PATCHED.** Token confinement sound (value only in `extraEnv`, helper names the var), error messages token-free, credential-helper a literal constant (no injection), the eslint-disable justified, the regex ReDoS-safe. **PATCHED nit:** the scope hint `read/"repo" access` was GitHub-specific → made provider-agnostic ("read access to its contents (e.g. the \"repo\" scope on GitHub, \"read_repository\" on GitLab)").

**Patches applied:** 1 (provider-agnostic scope hint). **Tests added:** 0 (the 14 co-located tests already cover the boundaries). Re-ran all gates green (664 tests).

### File List

- `src/config/env.ts` (modified) · `src/config/env.test.ts` (modified)
- `src/retrieve/git.ts` (modified) · `src/retrieve/git.test.ts` (modified)
- `src/retrieve/remote.ts` (modified) · `src/retrieve/remote.test.ts` (modified)
- `src/retrieve/retrieve.ts` (modified) · `src/retrieve/retrieve.test.ts` (modified)
- `src/cli/run.ts` (modified) · `src/cli/cli.ts` (modified) · `src/cli/cli.test.ts` (modified)
