---
epic: 7
story: 4
title: Node SEA packaging spike
baseline_commit: 67ca550
---

# Story 7.4: Node SEA packaging spike

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user without a Node runtime,
I want a self-contained executable,
so that I can run commit-sage with no prerequisites.

## Acceptance Criteria

1. **A Node SEA build is produced and runs; interactive prompts, raw-mode stdin, and ANSI render correctly from the packaged binary (AC1).** **Given** the Node SEA build, **when** it is produced and run on macOS, Linux, and Windows, **then** interactive prompts, raw-mode stdin, and ANSI rendering work correctly from the packaged binary.

2. **Git retrieval works via the system `git` shell-out (no native bindings) from the packaged binary (AC2).** **And** git retrieval works via the system `git` shell-out (no native bindings) from the packaged binary.

3. **If SEA is unviable on a platform, the spike records `pkg`/`nexe` as the fallback (AC3).** **And** if SEA proves unviable on a platform the spike records `pkg`/`nexe` as the fallback.

## Tasks / Subtasks

- [x] **Task 1 — A self-contained CJS bundle entry for SEA (AC1, AC2) [src/sea-entry.ts + tsup.sea.config.ts].** [Source: architecture.md "D1 — Packaging (Deferred, Spike-Gated)": Node SEA, git shell-out, no native bindings]
  - [ ] `src/sea-entry.ts` — a dedicated CJS-friendly entry (NO top-level await, which esbuild forbids in `cjs` output). It slices argv correctly for BOTH contexts: a SEA binary's `process.argv` has NO script path (`[exe, ...args]`) while plain node has `[node, script, ...args]` — use `isSea()` from `node:sea` to pick `slice(1)` vs `slice(2)`, so flags reach commander either way. Delegates to the SAME `main` (no logic fork). The existing ESM `src/index.ts` (the npm `main`, top-level await) is UNCHANGED.
  - [ ] `tsup.sea.config.ts` — bundle `src/sea-entry.ts` → `dist-sea/commit-sage.cjs`, `format: ["cjs"]`, `target: "node22"`, `platform: "node"`, `noExternal: [/.*/]` (inline EVERY third-party dep — `ai`/`@ai-sdk/*`/`@clack/prompts`/`commander`/`picocolors`/`zod` are all pure JS, no native bindings, so they bundle cleanly), `sourcemap: false`. Node builtins stay external (SEA provides them). The result is ONE self-contained file with no runtime `require` of `node_modules` and no on-disk asset dependency (the runtime reads no `package.json` — `VERSION` is a const, the only file read is in a test).

- [x] **Task 2 — The SEA assembly pipeline (AC1, AC3) [sea-config.json + scripts/build-sea.mjs].** [Source: Node SEA docs — `--experimental-sea-config` → `postject`; architecture.md D1 "pkg / nexe remain fallbacks"]
  - [ ] `sea-config.json` — `main: "dist-sea/commit-sage.cjs"`, `output: "dist-sea/sea-prep.blob"`, `disableExperimentalSEAWarning: true`, `useSnapshot: false`, `useCodeCache: false` (the V8 code cache is NOT portable across platform/arch; disabling it keeps ONE recipe usable on every target — each platform still builds its own binary, but without a cache-mismatch failure).
  - [ ] `scripts/build-sea.mjs` — the cross-platform assembly: (1) `tsup --config tsup.sea.config.ts` (the bundle); (2) `node --experimental-sea-config sea-config.json` (the blob); (3) copy `process.execPath` (the running node) → `dist-sea/commit-sage[.exe]`; (4) macOS only: `codesign --remove-signature` before inject; (5) `npx --yes postject <bin> NODE_SEA_BLOB dist-sea/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2` (+ `--macho-segment-name NODE_SEA` on macOS); (6) macOS only: `codesign --sign -` (ad-hoc) so Gatekeeper lets it run; (7) `chmod +x`. Branches on `process.platform` (darwin/linux/win32). Uses `npx --yes postject` so NO new committed dependency is added (the no-new-deps rule); a teammate/CI may pin `postject` as a devDependency for reproducibility (noted in the findings).

- [x] **Task 3 — Wiring + hygiene [package.json, .gitignore].**
  - [ ] `package.json` scripts: `"bundle:sea": "tsup --config tsup.sea.config.ts"` and `"build:sea": "node scripts/build-sea.mjs"`. (No dependency change.)
  - [ ] `.gitignore` — add `dist-sea/` (the bundle, the prep blob, and the multi-hundred-MB binary are build artifacts, never committed).

- [x] **Task 4 — Execute the spike on the host platform + record the findings (AC1, AC2, AC3) [docs/implementation-artifacts/7-4-sea-packaging-spike-findings.md].**
  - [ ] Run `npm run build:sea` on the host (macOS/arm64 in this dev environment) and smoke-test the produced binary: `./dist-sea/commit-sage --version` (commander + the binary boots), `./dist-sea/commit-sage --help` (ANSI/help text), `./dist-sea/commit-sage . --no-ai -o -` IN this repo (the git shell-out via `execFile` + a full deterministic analysis + JSON render, all from the packaged binary — proves AC2 with NO native bindings), and an interactive launchpad / raw-mode check (`./dist-sea/commit-sage` in a TTY drives the `@clack` menu — AC1).
  - [ ] Write the findings doc: the recipe, the host result (what was actually executed here), the macOS/Linux/Windows MATRIX (executed vs expected, with the platform-specific notes: macOS code-sign, Windows `.exe` + optional `signtool`, Linux straight copy), the at-risk surfaces verified (git shell-out, `@clack` raw-mode, ANSI), and the **`pkg`/`nexe` fallback** recommendation per platform (AC3). Be explicit that only the host platform was executed in this environment; Linux/Windows are the documented recipe + expectation to be confirmed on their runners (a release-CI matrix is the post-spike follow-up).

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the SEA build TOOLING (a self-contained CJS bundle entry + `tsup.sea.config.ts`, `sea-config.json`, a cross-platform `scripts/build-sea.mjs`, the npm scripts, the gitignore), ACTUALLY producing + smoke-testing the binary on the host platform (macOS/arm64), and the findings doc with the platform matrix + the `pkg`/`nexe` fallback. The product runtime is UNCHANGED except for the new non-TLA entry shim (a sibling of `index.ts`).

**Out of scope / deferred (do NOT build here):**
- **A release CI matrix that actually builds macOS + Linux + Windows binaries** — that needs the three OS runners (GitHub Actions `runs-on` matrix) and is the post-spike follow-up. The spike DELIVERS the recipe + proves it on the host and RECORDS the per-platform expectation; it does not wire `.github/workflows`. [Source: this is a spike — "produced and run … records the fallback"; architecture D1 "spike-gated"]
- **Distribution-grade code signing / notarization** — the macOS step is the ad-hoc self-sign (`codesign --sign -`) needed for the binary to RUN locally; Apple notarization, a Developer ID, and Windows Authenticode `signtool` with a real cert are a distribution concern, not the spike. [Source: architecture D1]
- **Auto-update, Homebrew/winget/apt/Scoop packaging, install scripts** — distribution channels, post-spike. [Source: out of scope]
- **A V8 snapshot / code-cache-optimized build** (`useSnapshot`/`useCodeCache: true`) — faster startup but platform/arch-locked and snapshot-incompatible with some top-level patterns; the spike uses the portable, no-cache recipe and notes the optimization as a follow-up. [Source: Node SEA docs]
- **Shrinking the binary** (the SEA binary is node + the blob, ~100 MB) — out of scope; noted in findings. [Source: this is a spike]
- **Changing the npm `main`/ESM build** — `dist/index.js` (ESM, the `npx`/library path) stays exactly as-is; SEA is an ADDITIONAL artifact. [Source: scope]

### Architecture decisions (read first)

- **A SEPARATE CJS entry, not a fork of the runtime.** esbuild forbids top-level await in `cjs` output, and SEA's `main` must be CJS — so `src/index.ts` (ESM, top-level await, the npm entry) cannot be the SEA entry. `src/sea-entry.ts` is a thin sibling shim that calls the SAME `main`; there is NO second code path through the product. [Source: esbuild cjs+TLA limitation; Node SEA "main is CommonJS"]
- **The argv-slice gotcha is the one real runtime difference.** In a SEA binary `process.argv === [exePath, ...userArgs]` (no script path); under `node script.js` it is `[node, script, ...userArgs]`. The shim uses `isSea()` to slice `1` vs `2` so commander receives the right tokens in both the packaged binary AND a `node dist-sea/commit-sage.cjs` dry-run. This is the classic SEA trap and the reason the entry is tested by EXECUTION (the smoke test), not a unit test. [Source: Node SEA `process.argv`]
- **Everything bundles because nothing is native.** The dependency set (`ai`, `@ai-sdk/*`, `@clack/prompts`, `commander`, `picocolors`, `zod`) is pure JavaScript — no `.node` addons, no `nodegit`. Git is a `git` SHELL-OUT via `execFile` (Story 1.4/5.1, array-args, injection-safe), which works from a SEA binary exactly as from node (it spawns the system `git`). That is precisely why the architecture mandated the shell-out over native bindings (D1): it keeps the binary bundleable. [Source: architecture D1 "Git retrieval stays a shell-out to the system git (no native bindings)"; retrieve/git.ts]
- **No on-disk asset dependency.** The runtime reads no bundled file: `VERSION` is a hardcoded const (Story 6.4), the only `package.json` read lives in `version.test.ts`. So the SEA needs NO asset injection (`sea.getAsset`) — a plain single-file blob suffices. [Source: cli/version.ts; the grep proving the only `import.meta.url`/`readFileSync` is in a test]
- **`useCodeCache: false` for a portable recipe.** The V8 code cache embedded by SEA is platform+arch+Node-version specific; enabling it would make the prep blob non-portable and can warn/fail when host≠target. Disabling it costs a little startup time but lets the ONE `sea-config.json` + script serve every platform (each still builds locally). [Source: Node SEA docs]
- **`npx --yes postject` keeps the dep surface clean.** `postject` is the Node-recommended injector but is a BUILD-time tool; invoking it via `npx --yes` avoids adding a committed dependency (the project's no-new-deps discipline) while still producing the binary. The findings note that CI/reproducible builds may pin it. [Source: Node SEA docs; repo no-new-deps rule]
- **Honest spike reporting.** Only the host platform (macOS/arm64) is executed in this environment. The findings doc records that result as VERIFIED and the Linux/Windows rows as the documented recipe + expectation (to be confirmed on their runners), plus the `pkg`/`nexe` fallback — rather than claiming a three-platform pass that wasn't run. [Source: AC honesty; spike intent]

### References

- epics.md → Epic 7 / **Story 7.4: Node SEA packaging spike** (the three ACs), FR-16 / NFR distribution.
- architecture.md → "D1 — Packaging (Deferred, Spike-Gated)" (Node SEA target; raw-mode/ANSI/prompts must work from the binary; git shell-out, no native bindings; `pkg`/`nexe` fallbacks), the implementation sequence "(9) SEA spike (D1)".
- Node.js docs → Single Executable Applications (`--experimental-sea-config`, `postject`, the `NODE_SEA_FUSE` sentinel, `--macho-segment-name` on macOS, code-signing).
- Reuse / verify (no change): `src/index.ts` (the ESM entry — untouched), `src/cli/cli.ts` (`main`), `src/retrieve/git.ts` (`execFileGitRunner` — the shell-out that must work from the binary), `src/cli/interactive.ts` (`@clack` raw-mode prompts), `picocolors` (ANSI), `tsup.config.ts` (the existing ESM build — untouched), `src/cli/version.ts` (`VERSION` const — why no asset injection is needed).

## Dev Agent Record

### Context

Baseline `67ca550` (Story 7.3). A packaging spike, not pipeline logic: add the SEA build tooling, actually produce + smoke-test the binary on the host (macOS/arm64), and record the platform matrix + `pkg`/`nexe` fallback. The product runtime is unchanged except a new CJS entry shim.

### Implementation summary

- **`src/sea-entry.ts`** (new) — a CJS-friendly sibling of `index.ts` (no top-level await, which esbuild forbids in `cjs` output) calling the same `main` with `process.argv.slice(2)`. The ESM `index.ts` is untouched.
- **`tsup.sea.config.ts`** (new) — bundles the entry to ONE self-contained CJS file (`dist-sea/commit-sage.cjs`, `noExternal: [/.*/]`, node builtins external). 2.01 MB.
- **`sea-config.json`** (new) — SEA blob config (`useSnapshot:false`, `useCodeCache:false` for portability).
- **`scripts/build-sea.mjs`** (new) — cross-platform assembly (bundle → blob → copy base node → macOS unsign → `npx --yes postject` inject → macOS re-sign → chmod). Selects the base node via `COMMIT_SAGE_SEA_NODE ?? process.execPath`, pre-validates it exists + embeds the SEA fuse, and makes the copy writable.
- **`package.json`** — `bundle:sea` + `build:sea` scripts (no dependency change; `postject` via `npx --yes`). **`.gitignore`** + **`eslint.config.js`** — ignore `dist-sea/`.
- **Findings doc** — [7-4-sea-packaging-spike-findings.md](7-4-sea-packaging-spike-findings.md): the recipe, the macOS/arm64 VERIFIED results, the Linux/Windows documented matrix, the gotchas, and the `pkg`/`nexe` fallback.

### Spike execution (macOS / arm64, official Node v22.14.0 base)

From the **packaged binary**: `--version` → `1.0.0`; ANSI render → 35 escape sequences (`FORCE_COLOR=1 … --format terminal`); the `@clack` launchpad rendered its tagline + readiness line under a PTY (raw-mode stdin); `commit-sage . --no-ai --format json -o -` → a full correct Report JSON (32-metric analysis, exit 0) via the **system `git` shell-out** — AC1 + AC2 verified end-to-end. Binary ≈ 105 MB (mostly the node runtime).

### Spike discoveries (the real value of the spike)

1. **Homebrew Node lacks the SEA fuse** — the host's `node` (26.3.0, Homebrew) has NO `NODE_SEA_FUSE` sentinel, so postject fails ("Could not find the sentinel"). An OFFICIAL nodejs.org build is required as the base; the script pre-checks this and offers `COMMIT_SAGE_SEA_NODE`.
2. **The copied node is read-only** (Homebrew r-x) — chmod the copy writable before postject.
3. **argv in modern SEA = `[execPath, execPath, …args]`** — so `slice(2)` is correct (an initial `node:sea`-based `slice(1)`, from outdated early-SEA behavior, was empirically WRONG — the binary parsed `commit-sage .` as two positionals; fixed). This also removed a bundler headache (tsup's esbuild strips the `node:` prefix off the newer `node:sea` builtin).
4. **CJS + no TLA** — the dedicated entry exists precisely because SEA's main is CJS and esbuild forbids top-level await there.

### Code review — 2026-06-15 (3 parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor)

- **Acceptance Auditor: ACCEPT — all 3 ACs MET, scope held, honest.** Confirmed AC1 (binary + prompts + raw-mode + ANSI from the packaged binary), AC2 (git shell-out, no native bindings), AC3 (`pkg`/`nexe` fallback recorded with specificity), and that the findings doc honestly distinguishes VERIFIED (macOS) from EXPECTED (Linux/Windows). 0 must-fix.
- **Blind Hunter: 1 CRITICAL** — `chmodSync(0o755)` throws `ENOTSUP` on Windows.
- **Edge Case Hunter: 1 CRITICAL** — `shell:true` + a base-node path with spaces (e.g. `C:\Program Files\nodejs\node.exe`) breaks on Windows; plus a minor base-node-not-found clarity gap.

**Triage → 3 patches applied (all Windows-correctness; the script is cross-platform and AC1 names Windows):**

- [x] **[Patch] Guard `chmod` on Windows.** Both `chmodSync` calls are now `if (!isWindows)` (Windows `.exe` has no Unix mode bits).
- [x] **[Patch] No shell for `node`/`codesign`; shell only `npx`.** `run()` now defaults `shell:false` (so a base-node path with spaces is passed intact to `execFileSync`); only the two `npx` calls pass `{ shell: isWindows }` (to resolve `npx.cmd`), and their args are all space-free relative paths.
- [x] **[Patch] Fail fast + clearer base-node errors.** The existence + fuse validation moved AHEAD of the blob step (the first use of the base node), with a distinct "not found" vs "no fuse" message.
- [Spike-acceptable / not patched] An offline `npx`/postject download surfaces the raw npm error (acceptable for a build script); partial-injection re-runs are recoverable (step 3 re-copies); concurrent builds are user error.

Re-verified on macOS after the refactor: the binary still builds + analyzes correctly; all gates green.

### Gates

- `npm run typecheck` ✓ · `npm run lint` ✓ (after ignoring `dist-sea/`) · `npx vitest run` ✓ **905 tests** (no new unit tests — the spike is validated by EXECUTION of the binary, like `index.ts`) · `npm run build` ✓ (ESM `dist/index.js` 192.07 KB, unchanged). SEA: `npm run build:sea` → `dist-sea/commit-sage` (≈105 MB), smoke-tested.

### Files

- `src/sea-entry.ts` (new), `tsup.sea.config.ts` (new), `sea-config.json` (new), `scripts/build-sea.mjs` (new), `package.json`, `.gitignore`, `eslint.config.js`, + the findings doc.

### Epic 7 complete

With 7.4, **all 4 Epic 7 stories are done** — and with Epics 1–6 already complete, **all 7 epics of commit-sage are delivered**.
