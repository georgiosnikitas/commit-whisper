---
baseline_commit: 15fd1173e2bafd7340bb6d643ecabe9bc2f83e80
---

# Story 1.4: Local repository retrieval

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer in a git repository,
I want commit-whisper to read my local history via the system `git`,
so that analysis can run with no network and no clone.

## Acceptance Criteria

1. **(AC1 — Read local history via system git)** Given the current working directory is a git repository, when retrieval runs with no target argument, then commit-whisper defaults the target to cwd and reads, per commit, the hash, author and committer identity, author and commit timestamps, message, parent hashes, and changed-file metadata via a **shell-out to the system `git`** (no native bindings).

2. **(AC2 — Not a git repo → typed failure)** Given a directory that is not a git repository, when retrieval runs, then it fails with the **git/retrieve exit code (4)** and an actionable message.

3. **(AC3 — Strictly read-only)** Given retrieval of any kind, when it executes, then it **never writes to or mutates the repository** (strictly read-only).

## Tasks / Subtasks

- [x] **Task 1 — Retrieve port + raw data model (`src/retrieve/retrieve.port.ts`) (AC: 1)**
  - [x] Define the raw data shapes the local read produces (analyze/ builds the normalized model + `.mailmap` canonicalization later — keep these RAW): `Identity { name: string; email: string }`; `ChangedFile { path: string; additions: number | null; deletions: number | null }` (**`null` = binary**, git's `-` in `--numstat`); `RawCommit { sha; author: Identity; committer: Identity; authoredAt: string; committedAt: string; message: string; parents: string[]; files: ChangedFile[] }` (ISO-8601 timestamps); `RepoHistory { repoTarget: string; commits: RawCommit[] }`.
  - [x] Define the port: `export type RetrievePort = (config: RunConfig) => Promise<RepoHistory>` — the contract the pipeline depends on (the frozen `RunConfig` crosses the hexagonal boundary; retrieve reads `config.repoTarget`). Named exports only (P2). Import `RunConfig` as `import type`.
  - [x] No co-located test (types only) — exercised through `local.test.ts`.
- [x] **Task 2 — Git shell-out primitive (`src/retrieve/git.ts`) (AC: 1, 3)**
  - [x] Define `export type GitRunner = (args: readonly string[], options: { cwd: string }) => Promise<string>` (resolves to **stdout**) — the injectable seam so adapters/tests don't need a real repo.
  - [x] Implement the default `execFileGitRunner: GitRunner` using `node:child_process` `execFile` (promisified) — **`execFile("git", args, { cwd, maxBuffer, windowsHide: true })`**, **never `exec`/a shell** (no shell ⇒ no command injection, and read-only by construction). Set a generous `maxBuffer` (e.g. `256 * 1024 * 1024`) for large histories; note streaming via `spawn` as a future perf refinement (see Dev Notes "Deferred — streaming").
  - [x] Map spawn failures to actionable text the adapter can wrap: `ENOENT` on the **git binary** ⇒ "the system `git` was not found on PATH"; `ENOENT` on **cwd** ⇒ "directory does not exist". Surface the raw error as the `cause` (see Task 5). — **the adapter composes one actionable message covering not-a-repo / missing-path / git-not-installed with the raw error as `cause`**
  - [x] Co-locate `git.test.ts`: with an injected fake (or a stubbed `execFile`) confirm args are passed through verbatim and stdout is returned; confirm **no shell** is used (args array form). Keep this light — the real shell-out is proven by the integration test in Task 4.
- [x] **Task 3 — `git log` command builder + pure parser (`src/retrieve/git-log.ts`) (AC: 1)**
  - [x] Define the machine-parseable format using **ASCII control chars** that never appear in commit content: record separator `\x1e` (RS), field separator `\x1f` (US). `GIT_LOG_FORMAT = "%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%P%x1f%B%x1f"` — `%B` (full raw body) is delimited by `\x1f` on **both** sides so the trailing `--numstat` block is unambiguously separable even though `%B` is multi-line. (`%aI`/`%cI` = strict ISO-8601.)
  - [x] `gitLogArgs(): string[]` ⇒ `["log", "--numstat", "--no-color", "--pretty=format:" + GIT_LOG_FORMAT]` (reads HEAD history — see Dev Notes "Branch scope"). All read-only subcommands.
  - [x] `parseGitLog(stdout: string): RawCommit[]` — a **PURE** parser: split on `\x1e` (drop the empty leading chunk), for each record split on `\x1f` into the 9 fields `[H, an, ae, aI, cn, ce, cI, P, B]` plus the remainder (the `--numstat` block); parse `%P` into `parents` (space-split, empty ⇒ `[]` for a root commit); parse the numstat block lines `add\tdel\tpath` into `ChangedFile[]` (`-`/`-` ⇒ `null`/`null` for binary; handle rename `old => new` path forms by taking the new path — note as a known simplification). Empty stdout ⇒ `[]`.
  - [x] Co-locate `git-log.test.ts` (the highest-value suite — pure, deterministic, no real git): table-driven against **canned** `git log --numstat` output covering: a normal commit (all fields), a **merge** commit (2 parents in `%P`), a **root** commit (empty `%P`), a multi-line commit **message** (proves the `\x1f` body delimiting), a **binary** file (`-\t-\tfile`), a commit with **no file changes**, and **empty** stdout ⇒ `[]`. — **plus rename brace/plain forms and multi-commit ordering**
- [x] **Task 4 — Local retrieve adapter (`src/retrieve/local.ts`) (AC: 1, 2, 3)**
  - [x] `createLocalRetrieve(runner: GitRunner = execFileGitRunner): RetrievePort` — returns the port impl closing over the injected runner.
  - [x] The impl: resolve `cwd = config.repoTarget` (already defaulted to the process cwd by the 1.2 resolver); **verify it is a git work tree** via `git rev-parse --is-inside-work-tree` (read-only) — if the runner throws **or** stdout is not `"true"`, throw `RetrieveError` (exit 4) with an actionable message ("… is not a git repository") carrying the underlying error as `cause`.
  - [x] **Empty-repo boundary:** after the work-tree check, guard the no-commits case (a valid repo with no HEAD) — pre-check `git rev-parse --verify --quiet HEAD` (or treat the specific empty-history `git log` failure) and return `{ repoTarget: cwd, commits: [] }` rather than erroring. (See Dev Notes "Empty repo".)
  - [x] Read history: `runner(gitLogArgs(), { cwd })` → `parseGitLog(stdout)` → `RepoHistory`. Wrap any unexpected git-log failure as `RetrieveError` (exit 4) with `cause`.
  - [x] **Read-only by construction:** the adapter only ever invokes read subcommands (`rev-parse`, `log`). Do not pass any writing subcommand.
  - [x] Co-locate `local.test.ts` (injected fake runner — deterministic): (a) AC1 happy path — a fake returning canned `is-inside-work-tree`=`true` + canned log ⇒ a populated `RepoHistory`; (b) AC2 — fake throwing on `rev-parse` (or returning non-`true`) ⇒ `RetrieveError` with `exitCode === 4` and an actionable message; (c) AC3 — assert a **recording** fake runner was only ever called with read-only subcommands (`args[0] ∈ { "rev-parse", "log" }`); (d) empty repo ⇒ `commits: []`.
- [x] **Task 5 — Add error `cause` chaining (`src/shared/errors.ts`) (AC: 2) — the 1.3 deferred item, now consumer-driven**
  - [x] Extend the `CommitWhisperError` base constructor to accept an optional `options?: { cause?: unknown }` and pass it to `super(message, options)` (ES2022 `Error` `cause`; target is es2023, so native). Keep the existing `(message, code, exitCode)` positional shape — add `options` as a 4th optional param so **all existing subclasses/tests are unaffected**.
  - [x] Wire `cause` into `RetrieveError` (the real 1.4 consumer): `constructor(message: string, options?: { cause?: unknown })` ⇒ `super(message, "RETRIEVE", 4, options)`. Leave the other stage subclasses as-is (they gain `cause` when their wrapping call sites appear — disciplined, consumer-driven, per the 1.3 deferral).
  - [x] Extend `errors.test.ts`: `new RetrieveError("x", { cause: inner }).cause === inner`; the existing `RetrieveError` exit-4/code-`"RETRIEVE"` cases still pass; a `CommitWhisperError` with no options still has `cause === undefined`.
- [x] **Task 6 — End-to-end integration test against real git (`src/retrieve/local.integration.test.ts`) (AC: 1, 3)**
  - [x] Create a **throwaway temp git repo** (`node:fs` `mkdtemp` in `os.tmpdir()`), `git init`, configure a local deterministic identity (`git -c user.name=… -c user.email=…`), and make 2–3 commits including one multi-file commit. Always clean up in `afterEach` (rm the temp dir). — **identity via `-c` flags (no `process.env` access — keeps the env-isolation lint rule satisfied in `src/`); timestamps asserted by ISO shape, not pinned values**
  - [x] Run the **real** `createLocalRetrieve()` (default `execFileGitRunner`) against the temp repo and assert the parsed `RepoHistory` matches the commits made (sha presence, identities, parents, message, changed files).
  - [x] **AC3 read-only proof:** capture the repo's state before and after retrieval (`git status --porcelain` empty before and after; HEAD sha unchanged) and assert retrieval mutated nothing.
  - [x] **AC2 real proof:** run the retriever against a fresh temp dir that is **not** a git repo and assert a `RetrieveError` (exit 4).
  - [x] Guard the suite on git availability (`describe.skipIf`; skip cleanly if `git --version` fails) so CI without git stays green. (Dev machine: git 2.54.0 present — all 4 integration tests ran.)
- [x] **Task 7 — Verify gates (AC: 1, 2, 3)**
  - [x] `npm run typecheck` clean. `npm run lint` clean (no `console`; named-exports-only; no `process.env` in `retrieve/`). `npm test` green (unit + integration). `npm run build` clean.
  - [x] Remove the now-redundant `src/retrieve/.gitkeep` (the folder has real modules).

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The spec-aware **Acceptance Auditor verified all 3 ACs genuinely met and scope clean** (every AC1 field captured; AC2 exit-4 + actionable message; AC3 read-only by three independent proofs). The hunters converged on real parser-robustness gaps against adversarial/cross-platform git output. Triage: **4 patch · 5 defer · 6 dismissed · 0 decision-needed.**

**Patch:** _(all 4 applied & verified 2026-06-13 — suite green, 113 tests)_

- [x] [Review][Patch] `hasCommits` swallows **every** failure as "empty repo" — a permissions error / corrupt repo / missing git would return `{ commits: [] }` (exit 0) instead of erroring. Narrow the catch: an unborn HEAD is git exit code 1; rethrow anything else as `RetrieveError` [src/retrieve/local.ts] — **Fixed:** `isUnbornHead` checks `code === 1 && stderr === ""`; any other failure rethrows as `RetrieveError` (exit 4). Added a "rethrows a real HEAD-probe failure" test.
- [x] [Review][Patch] CRLF corruption — `parseNumstat` splits on `\n` (leaving a trailing `\r` on the path via `(.+)$`) and `parseGitLog` strips only `\n$` from the body; on Windows / `core.autocrlf` this corrupts paths and messages. Split on `/\r?\n/` and trim a trailing `\r` from the body [src/retrieve/git-log.ts] — **Fixed:** numstat splits on `/\r?\n/`, body strips `/\r?\n$/`. Added a CRLF regression test.
- [x] [Review][Patch] Pin ambient git config that reshapes the parser's input: prepend `-c log.showSignature=false` (GPG lines injected into the stream) and `-c core.quotePath=false` (octal-escaped non-ASCII paths) to the git log invocation so output is reproducible across machines [src/retrieve/git-log.ts] — **Fixed:** `gitLogArgs()` now leads with both `-c` pins (read-only). The AC3 read-only test was strengthened to assert the real subcommand after the `-c` pairs.
- [x] [Review][Patch] Correct the now-inaccurate 1.2 doc-comment: `run-config.ts` says the `head` sentinel is "resolved by `retrieve/` (Story 1.4)", but 1.4 reads HEAD implicitly and does not resolve named/all — reword to "1.4 reads HEAD; named/all branch selection is Epic 2" [src/config/run-config.ts] — **Fixed.**

**Defer (tracked in deferred-work.md, not actioned now):**

- [x] [Review][Defer] Delimiter collision — a commit `%B` body containing a literal RS (`\x1e`) or US (`\x1f`) byte would forge a record boundary / truncate fields. Realign fields from the head and split RS only at a real boundary (RS followed by a 40-hex sha), or switch to `-z`/`%x00` NUL framing [src/retrieve/git-log.ts] — deferred: these control bytes effectively never appear in real commit text; revisit if a hardening pass is warranted. Tighten the `parts.length < 9` guard to `< 10` at the same time (the format always yields ≥10 fields).
- [x] [Review][Defer] No subprocess `timeout` — a git that blocks (credential prompt, fsmonitor, wedged process) hangs the CLI forever. Add an `execFile` `timeout` (+ `killSignal`) and surface a `RetrieveError` [src/retrieve/git.ts] — deferred: pairs naturally with the Story 1.8 process shell + the remote-clone network-failure handling (Epic 5), where timeout policy is load-bearing.
- [x] [Review][Defer] `spawn`-streaming for very large histories — the 256 MB `maxBuffer` both caps huge monorepos (hard fail, all output discarded) and ~doubles peak memory via `stdout.split(RS)`. Stream line-by-line instead [src/retrieve/git.ts, src/retrieve/git-log.ts] — deferred: a perf refinement already noted in the code; not needed for the walking skeleton.
- [x] [Review][Defer] Surface git's stderr / preserve the real failure detail — the runner returns only stdout and the adapter flattens every failure into one message, so a maxBuffer overflow, a permission denial, and a genuine repo error are indistinguishable [src/retrieve/git.ts, src/retrieve/local.ts] — deferred: `cause` already preserves the underlying error object; richer stderr surfacing belongs with the `ui`/verbose-logging work (Epic 6) and the 1.8 shell.
- [x] [Review][Defer] Harden `resolveNumstatPath` — the greedy `^(.*)\{(.*) => (.*)\}(.*)$` regex + blanket `//`→`/` collapse can misfire on paths that legitimately contain braces, `//`, or a literal ` => `; gate rename resolution on git's actual rename status rather than substring-matching [src/retrieve/git-log.ts] — deferred: handles the common brace/plain forms (already noted as a simplification); exotic paths are rare and non-blocking for the slice.

**Dismissed (6):** "`RetrieveError`/`CommitWhisperError` never set `name`" + "ES2022 `instanceof` not guaranteed" (false positives — the base sets `this.name = new.target.name`, target is es2023/node22, and `errors.test.ts` proves `instanceof` + `name` across the hierarchy); "missing `RunConfig` import in `retrieve.port.ts`" (false positive — `import type { RunConfig }` is present; typecheck is green); "non-ASCII paths stored quoted" (addressed by the `core.quotePath=false` Patch above — not a separate item); "`Number()` on a numstat count exceeds `MAX_SAFE_INTEGER`" (a single commit touching >9 quadrillion lines is not a real input); "git writes warnings to stderr on exit 0 are dropped" (by design for the slice — stdout is the data channel; stderr verbosity is Epic 6).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope (local read, the walking-skeleton retrieve stage):**
- The retrieve **port + raw data model** (`retrieve.port.ts`).
- The **git shell-out primitive** (`git.ts`, injectable `GitRunner`).
- The **`git log` builder + pure parser** (`git-log.ts`).
- The **local adapter** (`local.ts`) — repo check, read, read-only.
- **Error `cause` chaining** added to `CommitWhisperError`/`RetrieveError` (the 1.3 deferral, now that 1.4 is the first wrapping consumer).

**Out of scope / deferred (do NOT build here):**
- **Remote HTTPS clone + `temp-workspace.ts` (stateless temp clone with guaranteed cleanup) + `gitPat` auth** — Epic 5 (Stories 5.1–5.3). This story is **local cwd only**; `temp-workspace.ts` is not created. [Source: docs/planning-artifacts/epics.md#Epic 5: Remote Repositories & Private Auth]
- **Commit-selection filters** — `authorFilter`, `maxCommits`, `noMerges`, `startDate`/`endDate`, timezone-aware date filtering — are **Story 2.6** ("commit-selection inputs") and the Free 100-cap is **Story 2.7**. 1.4 reads the **full** local HEAD history raw; it does **not** apply `--author`/`--max-count`/`--no-merges`/date filters yet (even though those fields already exist on `RunConfig` from 1.2). [Source: docs/planning-artifacts/epics.md#Story 2.6] [Source: docs/planning-artifacts/epics.md#Story 2.7]
- **The normalized model + `.mailmap`-aware author canonicalization + total ordering** — `analyze/model.ts` + `analyze/identity.ts`, **Story 1.5**. Retrieve emits **raw** commit records in git's emit order; 1.5 builds the normalized model, canonicalizes identities, and imposes the deterministic `[committerDate, sha]` order. Do NOT canonicalize or re-sort here. [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]
- **Named-branch / all-branches selection** (`branch: {kind:"named"|"all"}`) — 1.4 reads **HEAD** (the `{kind:"head"}` default sentinel). Full branch selection ties into Group D branch/merge metrics (Epic 2). Note the head-only scope; don't build `--branches`/`--all` wiring. [Source: docs/planning-artifacts/architecture.md#The Frozen RunConfig Contract]
- **Calling retrieve from the pipeline / `cli/run.ts`** — the pre-pipeline gate band and orchestration are Story 1.8. 1.4 ships the port + adapter; nothing calls them yet. [Source: docs/planning-artifacts/architecture.md#Decision Impact Analysis]

### Why shell-out to system `git` (no native bindings)

Git retrieval is a **shell-out to the system `git`** — **no native bindings** (`nodegit` etc.) — to protect the future Node SEA bundling (D1). Use `node:child_process` `execFile` (array args, **no shell**), not `exec`. This is also the AC1 requirement ("via a shell-out to the system `git` (no native bindings)"). [Source: docs/planning-artifacts/architecture.md#Required Spike] [Source: docs/planning-artifacts/architecture.md#External Dependencies]

### Per-commit fields (AC1) → `git log` placeholders

| Field | git placeholder | Notes |
|---|---|---|
| hash | `%H` | full sha |
| author identity | `%an` / `%ae` | name / email (raw — not `.mailmap`-canonicalized here; that's 1.5) |
| committer identity | `%cn` / `%ce` | name / email |
| author timestamp | `%aI` | strict ISO-8601 (determinism-friendly) |
| commit timestamp | `%cI` | strict ISO-8601 |
| message | `%B` | full raw body (subject + body); multi-line |
| parent hashes | `%P` | space-separated; empty ⇒ root commit |
| changed-file metadata | `--numstat` | `additions\tdeletions\tpath`; `-`/`-` ⇒ binary |

The control-char delimiting (`\x1e` records, `\x1f` fields, `%B` bracketed by `\x1f`) is the crux that makes a multi-line `%B` + trailing `--numstat` block unambiguously parseable. RS/US (0x1e/0x1f) are non-printing and never appear in commit content. [Source: docs/planning-artifacts/epics.md#Story 1.4: Local repository retrieval]

### Read-only guarantee (AC3)

Retrieval **never writes to or mutates the repository.** Enforced three ways: (1) `execFile` with an **args array and no shell** (no metacharacter expansion); (2) the adapter only ever issues **read subcommands** (`rev-parse`, `log`) — unit-tested via a recording fake runner that asserts `args[0] ∈ {rev-parse, log}`; (3) an **integration test** snapshots the temp repo before/after and asserts zero mutation. The architecture's stateless/privacy posture: retrieval is read-only and (for remote, later) clones into a temp dir cleaned on every exit. [Source: docs/planning-artifacts/epics.md#Story 1.4] [Source: docs/planning-artifacts/architecture.md#C1 — Data Contracts & Runtime Validation]

### Empty repo

A directory can be a valid git work tree with **no commits** (fresh `git init`). `git log` there exits non-zero ("does not have any commits yet"). Treat this as a **successful empty read** — `{ repoTarget, commits: [] }` — not a `RetrieveError`: an empty repo is analyzable (metrics become `not_available` downstream). Detect via a `git rev-parse --verify --quiet HEAD` pre-check (no HEAD ⇒ empty) so it is distinguished from a genuine failure. [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture]

### Error `cause` chaining (the 1.3 deferral, landing now)

The 1.3 review deferred adding `{ cause }` "until the first wrapping call site lands (Story 1.4)". 1.4 is that site: `RetrieveError` wraps the underlying `execFile`/git failure so diagnostics keep the root cause. Add an optional `options?: { cause?: unknown }` 4th param to the `CommitWhisperError` base (passed to `super(message, options)` — native ES2022 on es2023), and wire it into `RetrieveError`. **Keep the change minimal and backward-compatible** — the positional `(message, code, exitCode)` shape is unchanged, so every existing subclass and 1.2/1.3 test still compiles and passes. Other subclasses gain `cause` when their own wrapping sites appear (don't add speculatively). [Source: docs/implementation-artifacts/deferred-work.md#Deferred from: code review of 1-3]

### Branch scope

1.4 reads **HEAD** history (plain `git log`, no rev args) — honoring the `branch: {kind:"head"}` default. `{kind:"named"}`/`{kind:"all"}` selection is deferred (Group D branch/merge, Epic 2). [Source: docs/planning-artifacts/architecture.md#The Frozen RunConfig Contract]

### Implementation patterns this story must follow (P-rules — lint-enforced)

- **P2 · Modules & files:** `kebab-case.ts`; **named exports only**; ports as `*.port.ts`; primitives under `retrieve/`. [Source: docs/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- **P5 · Streams & logging:** **no `console`** in `retrieve/` (a pipeline folder, lint-blocked). Surface failures by throwing `RetrieveError`; never log. [Source: docs/planning-artifacts/architecture.md#Stream Discipline]
- **Env isolation:** `retrieve/` must **not** read `process.env` (only `config/` may — lint-enforced). `execFile`/`child_process` is fine; if a deterministic env must be passed to a spawned git (integration test only), that lives in the test, not the adapter. [Source: eslint.config.js]
- **Hexagonal boundary:** retrieve receives the frozen `RunConfig`; it depends on the `RetrievePort` contract, not the other way around. The port enables a fake retriever in pipeline tests later. [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]
- **P3 · Source layout:** unit tests **co-located** as `*.test.ts`; the integration test is also co-located (`*.integration.test.ts`) — vitest's default `include` (`src/**/*.test.ts`) picks it up. [Source: vitest.config.ts]

### Previous story intelligence (1.1–1.3)

- **`RunConfig`** (1.2) provides `repoTarget` already **defaulted to the process cwd** — retrieve reads it; it does **not** read `process.cwd()` itself (that injection happened in `config/`). [Source: src/config/sources.ts]
- **`RetrieveError` (exit 4, code `"RETRIEVE"`) already exists** from 1.3 (`shared/errors.ts`) — this story **uses** it and adds `cause`. Do not redefine it. [Source: src/shared/errors.ts]
- **`Secret<string>`** (1.3) is **not** needed here — local read uses no token (`gitPat` is Epic 5, remote-only). [Source: src/shared/secret.ts]
- **Toolchain:** TS 6.0.3 strict, ESM (`.js` import specifiers in source), `nodenext`, `"types":["node"]`, vitest 4.1.8, tsup 8.5.1. `node:` prefix for builtins (`node:child_process`, `node:util`, `node:fs`, `node:os`, `node:path`). No new deps. [Source: docs/implementation-artifacts/1-2-two-phase-configuration-resolver-and-frozen-runconfig.md#Completion Notes List]
- **`src/retrieve/` holds only `.gitkeep`** — first real modules land here; remove the `.gitkeep` (as done for `cli/` in 1.3). [Source: src/retrieve/.gitkeep]

### Testing standards

- vitest 4.1.8, **co-located** `*.test.ts`. The **pure parser** (`git-log.test.ts`) is the core suite — canned `git log --numstat` fixtures, fully deterministic, no real git. The **adapter** (`local.test.ts`) uses an injected fake `GitRunner` (deterministic; proves AC2 + AC3-by-construction). The **integration** test (`local.integration.test.ts`) proves the real shell-out end-to-end + AC3 by before/after snapshot, guarded on git availability.
- Determinism in the integration test: pin author/committer dates + identity when building the temp repo so assertions are stable. Always clean up the temp dir.
- DoD: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.

### Project Structure Notes

- New files land where the architecture maps them under `src/retrieve/`: `retrieve.port.ts`, `git.ts` (the architecture lists `git-clone.ts` "shell-out to system git" — for the **local** slice this is split into the `git.ts` runner + `git-log.ts` reader; `git-clone.ts`/`temp-workspace.ts` arrive with remote clone in Epic 5). Flag this naming split in Completion Notes. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- `retrieve/errors.ts` (architecture-listed) is **not** created — `RetrieveError` lives in `shared/errors.ts` (1.3) and is sufficient; a retrieve-local errors module isn't warranted yet. Note in Completion Notes.

### References

- [Source: docs/planning-artifacts/epics.md#Story 1.4: Local repository retrieval]
- [Source: docs/planning-artifacts/epics.md#Story 2.6] (selection filters — deferred)
- [Source: docs/planning-artifacts/architecture.md#Required Spike] (shell-out, no native bindings)
- [Source: docs/planning-artifacts/architecture.md#C1 — Data Contracts & Runtime Validation] (stateless, read-only, temp-clone cleanup)
- [Source: docs/planning-artifacts/architecture.md#C2 — Metrics Engine Architecture] (raw → normalized model is 1.5; determinism rules)
- [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]
- [Source: docs/planning-artifacts/architecture.md#External Dependencies] (system git shell-out)
- [Source: docs/implementation-artifacts/deferred-work.md#Deferred from: code review of 1-3] (error cause chaining)
- [Source: src/shared/errors.ts] · [Source: src/config/run-config.ts] · [Source: eslint.config.js]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root (git 2.54.0 present):

- `npm run typecheck` → `tsc --noEmit` clean (strict; `node:` builtins resolve via `"types":["node"]`).
- `npm run lint` → ESLint clean (exit 0): no `console` in `retrieve/`, named-exports-only, and **no `process.env` access in `src/`** — the integration test sets git identity via `-c` flags and lets `execFileSync` inherit env implicitly, so the env-isolation guardrail holds even in the test.
- `npm test` → vitest: **16 files / 111 tests passed** (was 12/89; +4 files, +22 tests). The 4 real-git integration tests **ran** (not skipped) on this machine.
- `npm run build` → tsup ESM build success.

### Completion Notes List

- **All 3 ACs satisfied.** AC1: `git log --numstat` (control-char-delimited format) read via an `execFile` shell-out to the system `git` (no native bindings), parsed into raw `RawCommit` records carrying sha, author + committer identity, author + commit ISO-8601 timestamps, full message, parents, and changed-file metadata — proven by the pure parser suite **and** the real-git integration test. AC2: a non-git directory throws `RetrieveError` (exit 4) with an actionable message — proven by both a faked-runner unit test and a real temp-dir integration test. AC3: read-only by construction (`execFile`, args array, no shell; only `rev-parse`/`log` subcommands) — proven by a recording-fake assertion **and** a real before/after `git status --porcelain` + HEAD-sha snapshot.
- **Naming split vs the architecture map (review-relevant):** the architecture lists `retrieve/git-clone.ts` ("shell-out to system git"). For the **local** slice this is split into `git.ts` (the `execFile` runner primitive) + `git-log.ts` (the `git log` builder + pure parser). `git-clone.ts` and `temp-workspace.ts` arrive with **remote clone in Epic 5**. `retrieve/errors.ts` (architecture-listed) was **not** created — `RetrieveError` (1.3, `shared/errors.ts`) is sufficient; a retrieve-local error module isn't warranted yet.
- **Error `cause` chaining landed here (the 1.3 deferral, consumer-driven).** Added an optional `options?: { cause?: unknown }` 4th param to the `CommitWhisperError` base (`super(message, options)`, native ES2022 on es2023) and wired it into `RetrieveError` — the first real wrapping site. Backward-compatible: the positional `(message, code, exitCode)` shape is unchanged, so every 1.2/1.3 subclass and test still compiles/passes. Other stage subclasses gain `cause` when their own wrapping sites appear (not added speculatively).
- **Control-char parse format** (`\x1e` records, `\x1f` fields, `%B` bracketed by `\x1f`) is the crux that makes a multi-line commit body + trailing `--numstat` block unambiguously separable — covered by a dedicated multi-line-message test. Rename paths (brace + plain `old => new` forms) are resolved to the new path. `%aI`/`%cI` give strict ISO-8601 timestamps.
- **Empty-repo boundary handled:** a freshly `git init`-ed repo (no HEAD) is a **successful empty read** (`commits: []`), not an error — detected via `git rev-parse --verify --quiet HEAD` and proven by an integration test.
- **Scope deferrals honored:** no remote clone / `temp-workspace.ts` / `gitPat` (Epic 5); no commit-selection filters — `authorFilter`/`maxCommits`/`noMerges`/dates (Story 2.6) or the Free cap (2.7) — 1.4 reads full raw HEAD history; no normalized model / `.mailmap` canonicalization / determinism ordering (Story 1.5, `analyze/`); no named/all-branch selection (HEAD only); nothing calls the retriever yet (pipeline wiring is 1.8). No new dependencies.
- **Integration test is git-availability-guarded** (`describe.skipIf`) so a CI image without git stays green; it ran fully here. Temp repos are always cleaned up in `afterEach`.
- **Deferred edges noted for review** (candidates for `deferred-work.md` if the reviewer agrees): `spawn`-streaming for very large histories (vs the current 256 MB `maxBuffer`); `core.quotePath=false` for non-ASCII path handling; brace-rename resolution covers common forms only.
- **SonarQube advisory** (unchanged from prior slices): `type IsoDate = string` in `config/run-config.ts` — intentional contract type. Resolved the new-file Sonar nudges (publicly-writable `/tmp` literals → synthetic `/work` paths in the faked unit test; `localeCompare` sort; dropped an unnecessary cast). tsc/eslint/vitest/tsup all green.

### File List

**Added (source):**
- `src/retrieve/retrieve.port.ts` — `RetrievePort` + raw model (`Identity`, `ChangedFile`, `RawCommit`, `RepoHistory`)
- `src/retrieve/git.ts` — `GitRunner` type + `execFileGitRunner` (the no-shell `execFile` primitive)
- `src/retrieve/git-log.ts` — `GIT_LOG_FORMAT`, `gitLogArgs`, pure `parseGitLog`
- `src/retrieve/local.ts` — `createLocalRetrieve` (repo check, empty-repo guard, read, read-only)

**Added (tests, co-located):**
- `src/retrieve/git-log.test.ts` (pure parser), `src/retrieve/local.test.ts` (faked runner: AC1/AC2/AC3/empty), `src/retrieve/git.test.ts` (runner pass-through via mocked `execFile`), `src/retrieve/local.integration.test.ts` (real git, guarded)

**Modified (source):**
- `src/shared/errors.ts` — `CommitWhisperError` base gains optional `cause`; `RetrieveError` wires it
- `src/shared/errors.test.ts` — added cause-chaining cases

**Removed:**
- `src/retrieve/.gitkeep` (folder now has real modules)

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` — 1-4 → in-progress → review → done
- `docs/implementation-artifacts/1-4-local-repository-retrieval.md` — this story (baseline_commit, tasks checked, record filled, review findings, status → done)

**Patched during code review (2026-06-13):**
- `src/retrieve/local.ts` — `hasCommits` narrows its catch to unborn-HEAD (`code===1 && empty stderr`); real failures rethrow as `RetrieveError`
- `src/retrieve/git-log.ts` — CRLF-safe parsing (`/\r?\n/`); `gitLogArgs()` pins `log.showSignature=false` + `core.quotePath=false`
- `src/config/run-config.ts` — corrected the `branch` `head`-sentinel doc-comment
- `src/retrieve/local.test.ts` — updated fake runner for the `-c`-prefixed args; strengthened the AC3 subcommand assertion; added a real-failure-rethrow test
- `src/retrieve/git-log.test.ts` — added a CRLF regression test
- `docs/implementation-artifacts/deferred-work.md` — 5 deferred review items appended

**Not committed (gitignored):** `dist/`, `node_modules/`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 1.4 drafted via create-story (ultimate context engine). Status → ready-for-dev. |
| 2026-06-13 | Story 1.4 implemented (TDD): `retrieve/` port + raw model, `execFile` git primitive, `git log` control-char format + pure parser, local adapter (repo check · empty-repo guard · read-only); added error `cause` chaining (1.3 deferral) wired into `RetrieveError`. 4 new suites incl. a guarded real-git integration test (read-only proof); 16 files / 111 tests green; typecheck/lint/build clean. Status → review. |
| 2026-06-13 | Code review (3 layers). All 3 ACs confirmed met by the spec-aware auditor; scope clean. Applied 4 patches: narrowed `hasCommits` error handling (rethrow real failures), CRLF-safe parsing, pinned `log.showSignature`/`core.quotePath`, fixed the 1.2 branch doc-comment. 5 items deferred, 6 dismissed. Suite green (113 tests). Status → done. |
