---
epic: 5
story: 1
title: Remote HTTPS clone with stateless cleanup
baseline_commit: 79e7d33
---

# Story 5.1: Remote HTTPS clone with stateless cleanup

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to analyze a remote repository by URL,
so that I can report on repos I am not sitting inside.

## Acceptance Criteria

1. **A remote HTTPS URL is cloned into an OS temp dir via the system `git`, then analyzed (AC1).** **Given** the `repoTarget` is a **remote HTTPS URL** (e.g. `https://github.com/owner/repo`), **when** retrieval runs, **then** commit-whisper **clones it into an OS temp working directory** via a `git clone` shell-out to the **system `git`** (no native bindings, `execFile` array args — no shell), and reads the repository's HEAD history from the clone using the **same** read path as a local repo (the `git log --numstat` reader + parser), emitting a `RepoHistory` whose `repoTarget` is the **URL** (the user's target, not the temp path). A local filesystem path still routes to the existing local adapter unchanged.

2. **The temp clone is cleaned up on every exit path — success, failure, and Ctrl-C (AC2).** **Given** a remote clone, **when** the run ends by **any** path — successful read, a thrown error (clone or read failure), or an **interrupt (SIGINT/SIGTERM)** — **then** the temp working directory is **removed** (best-effort, idempotent), so no clone is ever left behind; the signal handlers that guarantee cleanup-on-interrupt are **deregistered** when the workspace scope exits (no listener leak across runs).

3. **Stateless — no clone persists between runs (AC3).** **Given** two remote runs, **when** each completes, **then** neither leaves a persisted clone (each run clones fresh into a new unique temp dir and removes it), and nothing is cached or reused between runs — the remote retrieval holds no state outside the single run's temp workspace.

## Tasks / Subtasks

- [ ] **Task 1 — Target classification (AC1) [src/retrieve/target.ts] (new).**
  - [ ] `export function isRemoteTarget(target: string): boolean` — pure: `true` iff the (trimmed) target has an `https://` (or `http://`) scheme; otherwise `false` (a local filesystem path). Anchored `^https?://` so a path can never be misread and a leading `-` is never a remote (so it can never reach `git clone` as an option). SSH (`git@`/`ssh://`) and private-auth are Story 5.2 — out of scope here.

- [ ] **Task 2 — Bounded temp workspace with guaranteed cleanup (AC2, AC3) [src/retrieve/temp-workspace.ts] (new).**
  - [ ] `withTempWorkspace<T>(run: (dir: string) => Promise<T>, deps?): Promise<T>` — creates a fresh unique temp dir (`mkdtemp` under the OS tmpdir, prefix `commit-whisper-`), runs `run(dir)`, and **always** removes the dir in a `finally` (success **and** failure). An **idempotent** `cleanup()` (a `done` guard) does a best-effort recursive `rmrf` (a cleanup error never masks the real error).
  - [ ] **Interrupt safety:** register one-shot `SIGINT`/`SIGTERM` handlers that `cleanup()` then exit with the conventional code (`130`/`143`) — so Ctrl-C mid-clone still removes the temp dir (Node's default signal handling would skip the `finally`). The handlers are **removed** in the same `finally` (no cross-run listener leak).
  - [ ] **Injectable seams** (offline-testable): `mkdtemp?: () => string`, `rmrf?: (dir: string) => void`, `signals?: SignalHub` (`once`/`removeListener`/`exit`, default wraps `process`). Defaults wire `node:fs`/`node:os`/`node:path`. No `process.env` (lint boundary).

- [ ] **Task 3 — Extract the shared git-history reader (AC1) [src/retrieve/read-history.ts] (new) + [src/retrieve/local.ts] (refactor).**
  - [ ] Move the `assertGitRepo` → `hasCommits`/`isUnbornHead` → `git log` → `parseGitLog` logic out of `local.ts` into `readGitHistory(runner, workdir, repoTargetLabel): Promise<RepoHistory>` (the `workdir` git is run in; the `repoTargetLabel` stamped on the result). Behavior is **byte-identical** to today's local read.
  - [ ] `createLocalRetrieve(runner)` becomes a thin delegate: `readGitHistory(runner, config.repoTarget, config.repoTarget)` — the existing local unit + integration tests pass unchanged (same observable behavior).

- [ ] **Task 4 — Remote retrieve adapter (AC1, AC2, AC3) [src/retrieve/remote.ts] (new).**
  - [ ] `createRemoteRetrieve(runner?, workspaceDeps?): RetrievePort` — for a URL target, `withTempWorkspace(async (dir) => { clone url → dir/repo; return readGitHistory(runner, dir/repo, url) }, workspaceDeps)`. The clone runs `git clone --quiet -- <url> <dest>` (the `--` end-of-options guard so a weird URL can never be parsed as a flag; `execFile` array args — no shell), with `dest = join(dir, "repo")`. A clone failure → a single `RetrieveError` (exit 4) "Failed to clone …" (the network/auth/not-found classification + no-retry is Story 5.3). The emitted `RepoHistory.repoTarget` is the **URL**.

- [ ] **Task 5 — Local/remote dispatcher + pipeline wiring (AC1) [src/retrieve/retrieve.ts] (new) + [src/cli/run.ts].**
  - [ ] `createRetrieve(deps?): RetrievePort` — picks `createRemoteRetrieve` when `isRemoteTarget(config.repoTarget)`, else `createLocalRetrieve`, sharing one `GitRunner`. Both adapters use the same reader, so a remote and a local analysis of the same history are identical.
  - [ ] `run.ts`: change the default `deps.retrieve ?? createLocalRetrieve()` → `deps.retrieve ?? createRetrieve()`. No other pipeline change — the frozen `RunConfig` already carries `repoTarget` (a URL or a path); everything downstream of retrieve is unchanged.

- [ ] **Task 6 — Tests (AC1, AC2, AC3).**
  - [ ] **`target.test.ts`:** `https://…`/`http://…` (any case, leading/trailing space) → remote; a local path (`.`, `/abs/path`, `./rel`, `~/x`, a Windows `C:\…`), an empty string, and a `-`-leading string → not remote.
  - [ ] **`temp-workspace.test.ts`:** success → `run` gets the temp dir + `rmrf` called once + handlers removed; `run` throws → the error propagates **and** `rmrf` still called once + handlers removed; a fired `SIGINT`/`SIGTERM` (via a fake `SignalHub`) → `cleanup` runs + `exit(130/143)`; `cleanup` is idempotent (a double path rms once); an `rmrf` throw is swallowed (never masks the real result/error).
  - [ ] **`remote.test.ts`:** with a fake `GitRunner` (responds to clone + `rev-parse` + `log`) + injected workspace deps (fake `mkdtemp`/`rmrf`) — a URL target → the runner is called with `clone --quiet -- <url> <dest>` (dest under the temp dir), the history is read **from the clone**, `repoTarget` is the **URL**, and `rmrf` runs (cleanup); a clone failure → `RetrieveError` (exit 4) + the temp dir still cleaned.
  - [ ] **`retrieve.test.ts`:** the dispatcher routes a `https://…` target to the remote adapter and a local path to the local adapter (assert via an injected runner's first call — `clone` vs `rev-parse`).
  - [ ] **`remote.integration.test.ts` (real git, `describe.skipIf(!gitAvailable)`):** clone a **local bare repo via a `file://` URL**… — *skip if `file://` isn't classified remote*; instead clone is exercised against a real on-disk source by pointing the adapter at a `file://` path **only when** `isRemoteTarget` accepts it. **Decision:** keep the integration test to the **unit** level (fake runner) for determinism/offline; a real-network clone is not run in CI. (Document: a real `https://` clone is a manual/QA check, not an automated test — no network in the suite.)

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** remote HTTPS detection (`isRemoteTarget`); the bounded temp workspace with guaranteed cleanup on success/failure/SIGINT/SIGTERM (+ handler deregistration); the remote clone adapter (`git clone` into the temp dir, then read HEAD history via the shared reader); extracting the shared `readGitHistory` so local + remote read identically; the local/remote dispatcher; wiring it as the pipeline's default retriever. All offline-testable (the `GitRunner`, `mkdtemp`, `rmrf`, and `signals` are injected).

**Out of scope / deferred (do NOT build here):**
- **Private-remote authentication (the env-only PAT, insufficient-scope errors, `GIT_TERMINAL_PROMPT`/credential-prompt suppression)** — **Story 5.2**. 5.1 clones a **public** HTTPS repo; a private one fails the clone (surfaced as a generic `RetrieveError` here, classified in 5.3). The clone uses `execFile` (no shell) so 5.2 can layer auth on the same seam. [Source: epics.md#Story 5.2]
- **Graceful failure classification + no-retry (distinguish network / auth / not-found, reset guidance, no partial Report)** — **Story 5.3**. 5.1 maps any clone failure to one `RetrieveError` (exit 4); 5.3 refines the message + classes. [Source: epics.md#Story 5.3]
- **Multi-branch / "all branches" reading** — already deferred in the retrieve port (a future story); 5.1 reads HEAD history, exactly like the local adapter, so local↔remote parity holds. [Source: src/retrieve/retrieve.port.ts]
- **Shallow clone / performance tuning (`--depth`)** — out of scope; a full clone preserves the full history Group D/E/F need (NFR-4 perf is a tracked spike, not a 5.1 blocker). [Source: epics.md#NFR-4]
- **Killing an orphaned `git` child on SIGINT** — 5.1 guarantees the temp **dir** is removed on interrupt (the AC); the terminal's process-group SIGINT already interrupts the foreground `git`, and rming the dir out from under a lingering clone makes it error out. Tracking + killing the child handle is a later refinement (the `GitRunner` returns a Promise, not a handle). [Source: this story]

### Architecture decisions (read first)

- **Clone into an OS temp dir, read with the SAME reader, then delete — stateless by construction.** The remote adapter is `withTempWorkspace(dir => { clone url → dir/repo; readGitHistory(dir/repo, url) })`. Because the read path is the **shared** `readGitHistory` (extracted from the local adapter), a remote analysis is **byte-identical** to a local analysis of the same history — no second code path to drift. The temp dir is removed in a `finally` on every exit, so nothing persists between runs (AC3). [Source: architecture.md#Retrieval — git clone shell-out, stateless, temp working dir with guaranteed cleanup]
- **Guaranteed cleanup needs explicit signal handlers — Node's default SIGINT skips `finally`.** A bare Ctrl-C terminates the process **without** running the `finally`, leaking the temp dir. So `withTempWorkspace` registers one-shot `SIGINT`/`SIGTERM` handlers that `cleanup()` then `exit(130/143)`; the `finally` covers success + failure and **deregisters** the handlers (no listener leak across runs). `cleanup()` is idempotent (a `done` guard) so the handler-then-finally double path rms once. [Source: architecture.md#guaranteed cleanup on every exit path (success / failure / Ctrl-C)]
- **`execFile`, array args, `--` end-of-options — the `git.ts` injection discipline, extended to clone.** `git clone --quiet -- <url> <dest>` passes the URL + dest as standalone argv elements (no shell, no metacharacter expansion); the `--` guard means even a hostile URL can never be parsed as a `git` option (`--upload-pack=…` style injection). `isRemoteTarget` additionally requires an `https?://` prefix, so a `-`-leading target never classifies as remote. [Source: src/retrieve/git.ts, securityRequirements / OWASP]
- **Read-only against the remote.** `git clone` is a read operation — commit-whisper never pushes, never mutates the remote (NFR-2). The only writes are into the disposable temp dir. [Source: NFR-2, FR-1 "strictly read-only"]
- **Injected side-effect seams keep it offline-testable.** `GitRunner` (the clone + read shell-out), `mkdtemp`, `rmrf`, and the `SignalHub` are all injected — the unit tests never touch the network or the real filesystem signal table; the real `https://` clone is a manual/QA check (no network in the suite). [Source: src/retrieve/git.ts, src/retrieve/local.integration.test.ts]
- **No `process.env` in `retrieve/`.** The temp-dir + clone need no env; `GIT_TERMINAL_PROMPT`/credential env is Story 5.2 (and will thread through a dedicated seam, not a raw `process.env` read in `retrieve/`). The `SignalHub` references the `process` global (`once`/`removeListener`/`exit`) — allowed; only `process.env` is lint-banned outside `config/`. [Source: eslint.config.js]

### The contracts to build on (do NOT redefine)

- **`RetrievePort` / `RepoHistory` / `RawCommit` (1.4):** the remote adapter produces the SAME `RepoHistory` shape; only `repoTarget` differs (the URL). [Source: src/retrieve/retrieve.port.ts]
- **`GitRunner` / `execFileGitRunner` (1.4):** the injected `(args, { cwd }) => Promise<string>` shell-out — reused verbatim for `git clone` (cwd = the temp dir) and the history read (cwd = the clone). No runner change. [Source: src/retrieve/git.ts]
- **`gitLogArgs` / `parseGitLog` (1.4):** the read command + pure parser — reused by the shared `readGitHistory`. [Source: src/retrieve/git-log.ts]
- **`createLocalRetrieve` (1.4):** refactored to delegate to `readGitHistory`; its public behavior + tests are unchanged. [Source: src/retrieve/local.ts]
- **`RetrieveError` (1.3) + `runPipeline` (1.8/4.x):** a clone/read failure is a `RetrieveError` (exit 4); `run.ts` swaps its default retriever to the dispatcher — no other pipeline change. [Source: src/shared/errors.ts, src/cli/run.ts]

### Determinism, security & purity (unchanged rules)

- **Determinism:** the remote read uses the same parser + the analyze stage's injected `analysisTimestamp`/ordering — a remote analysis is byte-stable, identical to a local one of the same history. The temp dir **name** is random (`mkdtemp`) but never enters the emitted `RepoHistory` (the label is the URL), so it can't perturb determinism. [Source: architecture.md C2]
- **Security:** `execFile` array args + `--` (no shell injection); read-only clone; secrets are not involved in 5.1 (public clone). [Source: securityRequirements, NFR-2]
- **No new dependencies:** `node:child_process` (via the existing runner), `node:fs`, `node:os`, `node:path` are builtins. [Source: architecture.md]
- **Stream discipline / no-console:** `retrieve/` is under `no-console`; the adapters never write — the pipeline surfaces chrome via `ui`. [Source: eslint.config.js]

### Previous-story intelligence

- **The local adapter (1.4) already nails the read-only `git` shell-out + the empty/unborn-HEAD handling; 5.1 reuses it verbatim via the extracted reader** — the only new surfaces are detection, the temp workspace, and the clone. No parser/model/analyze change. [Source: src/retrieve/local.ts, src/retrieve/git-log.ts]
- **`execFile`-not-shell is the established injection-safe shell-out (1.4 `git.ts`, 4.5 `open-browser.ts`)** — clone follows it, plus `--` for the URL. [Source: src/retrieve/git.ts, src/cli/open-browser.ts]
- **Injected side-effect seams keep the pipeline offline-testable (4.4 `writeFile`, 4.5 `openBrowser`)** — `mkdtemp`/`rmrf`/`signals`/`GitRunner` follow the identical pattern; the real network never runs in tests. [Source: src/cli/run.test.ts]
- **The local integration test's `mkdtemp`/`rmSync` + `describe.skipIf(!gitAvailable)` pattern** is the template for any real-git test; 5.1 keeps the automated suite offline (fake runner) and leaves a real `https://` clone to manual QA. [Source: src/retrieve/local.integration.test.ts]

### References

- [Source: docs/planning-artifacts/epics.md#Story 5.1: Remote HTTPS clone with stateless cleanup] (the ACs) · [Source: …#FR-1] (target a local path or a remote HTTPS URL; read-only) · [Source: …#NFR-2] (read-only against remotes)
- [Source: docs/planning-artifacts/architecture.md#Retrieval] (git clone shell-out to system git, stateless every run, temp working dir with guaranteed cleanup on every exit path)
- [Source: src/retrieve/local.ts, src/retrieve/git.ts, src/retrieve/git-log.ts, src/retrieve/retrieve.port.ts] (the read-only local adapter + runner + parser to reuse) · [Source: src/cli/run.ts] (the default retriever to swap) · [Source: src/cli/open-browser.ts] (the 4.5 injected-shell-out precedent)

## Dev Agent Record

### Completion Notes (Amelia)

Opens Epic 5 — analyze a remote HTTPS repository by URL. Clones into a disposable OS temp dir, reads it with the SAME reader as a local repo (so remote == local analysis), and removes the temp dir on every exit path. 650 tests pass (+18 over 4.5); typecheck/lint/build all green. Zero new dependencies (`node:fs`/`os`/`path`/`child_process` builtins). Bundle 143.41 → 146.06 KB.

- **`src/retrieve/target.ts`** (new) — `isRemoteTarget(target)`: `^https?://` (anchored, case/space-tolerant) → remote; else local. A `-`-leading or path-like target never classifies remote (so it can never reach `git clone` as an option). SSH/auth are Story 5.2.
- **`src/retrieve/read-history.ts`** (new) — `readGitHistory(runner, workdir, repoTargetLabel)`: the read logic EXTRACTED verbatim from the 1.4 local adapter (assertGitRepo → unborn-HEAD handling → `git log` → `parseGitLog`), with `workdir` (where git runs) split from `repoTargetLabel` (stamped on the result + named in errors). Local + remote share it, so they read byte-identically.
- **`src/retrieve/temp-workspace.ts`** (new) — `withTempWorkspace(work, deps)`: `mkdtemp` → `work(dir)` → **always** `rmrf` in a `finally` (success + failure); one-shot SIGINT/SIGTERM handlers `cleanup()` then `exit(130/143)` (Node's default signal handling skips `finally` → would leak); cleanup is idempotent (a `cleaned` guard → handler-then-finally rms once); handlers deregistered in the `finally` (no cross-run leak); an rmrf throw is swallowed (never masks the real result/error). `mkdtemp`/`rmrf`/`signals` all injected.
- **`src/retrieve/remote.ts`** (new) — `createRemoteRetrieve`: `withTempWorkspace(dir => { clone url → dir/repo; readGitHistory(dir/repo, url) })`. Clone = `git clone --quiet -- <url> <dest>` via the injected `GitRunner` (execFile array args, never a shell; the `--` end-of-options guard means a hostile URL can't be parsed as a flag). The emitted `RepoHistory.repoTarget` is the URL. A clone failure → one `RetrieveError` (exit 4); classification is Story 5.3.
- **`src/retrieve/retrieve.ts`** (new) — `createRetrieve`: routes a remote URL → remote adapter, a local path → local adapter, sharing one `GitRunner`.
- **`src/retrieve/local.ts`** (refactor) — now a thin delegate to `readGitHistory` (public behavior + tests unchanged). **`src/cli/run.ts`** — the default retriever swapped `createLocalRetrieve()` → `createRetrieve()`; nothing else in the pipeline changed.

**End-to-end verified:** `node dist/index.js https://github.com/octocat/Hello-World --no-ai --format json -o -` cloned over HTTPS, computed all 32 metrics, emitted clean canonical JSON (exit 0), and left **0 temp clones behind** (cleanup confirmed).

**Deferred (unchanged):** private-remote PAT auth + credential-prompt suppression (Story 5.2); failure classification (network/auth/not-found) + no-retry + reset guidance (Story 5.3); shallow clone / multi-branch. Read-only throughout (`git clone` reads; the only writes are into the disposable temp dir).

### Review (3-layer adversarial)

- **Acceptance Auditor — all 3 ACs MET, scope held, 0 must-fix.** Verified the clone-into-temp + shared-reader (AC1, URL-labelled result, local routes unchanged), cleanup on success/failure/SIGINT/SIGTERM + idempotent + handler-deregistration + swallowed-rmrf (AC2), and the fresh-unique-dir/no-persistence/random-name-not-in-history statelessness (AC3). Confirmed no auth, no classification, no `--depth`/multi-branch, no new deps, refactor parity, read-only, `execFile`+`--` injection-safety, and determinism.
- **Blind Hunter — 0 defects** (Critical/High/Medium/Low/Nit all clean): command injection (`--` guard + `https?://` gate), refactor parity, cleanup correctness, signal handling (130/143), determinism (temp name never in history), and lint/style.
- **Edge Case Hunter — 5 findings → 1 PATCHED, 2 tests added, 3 DISMISSED:**
  - **[#1 "CRITICAL: `createRetrieve()` default crashes on remote"] DISMISSED — FALSE POSITIVE.** JS default parameters apply for an `undefined` argument (`createRemoteRetrieve(runner, undefined)` → `workspaceDeps = {}`), so there is no crash. **Proven** by the live smoke test above (the real `createRetrieve()` cloned octocat/Hello-World and cleaned up). 
  - **[#2 "HIGH: `isUnbornHead` non-string stderr"] DISMISSED — pre-existing + non-occurring.** Byte-identical extracted 1.4 code; `execFile` (utf8 default) always yields string stderr, so the path can't fire with the real runner. Not a 5.1 change.
  - **[#3 "HIGH: error messages expose the temp path"] PATCHED.** `assertGitRepo`/`hasCommits` named `workdir` (the disposable clone path for a remote) in their user-facing messages instead of the URL label. Threaded `repoTargetLabel` into the messages (keeping `cwd: workdir` for the git call) → a post-clone read error now names the URL. Parity holds for local (label === workdir). +1 lock-in test.
  - **[#4 "MEDIUM: `isRemoteTarget` untested"] DISMISSED — `target.test.ts` already covers https/http/case/space/path/empty/flag/ssh.**
  - **[#5 "MEDIUM: `mkdtemp` failure untested"] ACTIONED — added a test** proving a `mkdtemp` throw rejects cleanly with no dir, no rmrf, and no leaked handler (the throw precedes registration).

**Patches applied:** 1 (label in read-error messages). **Tests added:** 2 (URL-in-remote-read-error; mkdtemp-throws contract). **Dismissed:** 3. Re-ran all gates green (650 tests).

### File List

- `src/retrieve/target.ts` (new) · `src/retrieve/target.test.ts` (new)
- `src/retrieve/read-history.ts` (new)
- `src/retrieve/temp-workspace.ts` (new) · `src/retrieve/temp-workspace.test.ts` (new)
- `src/retrieve/remote.ts` (new) · `src/retrieve/remote.test.ts` (new)
- `src/retrieve/retrieve.ts` (new) · `src/retrieve/retrieve.test.ts` (new)
- `src/retrieve/local.ts` (refactored to delegate) · `src/cli/run.ts` (default retriever → dispatcher)
