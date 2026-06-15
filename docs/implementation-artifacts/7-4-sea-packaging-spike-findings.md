# SEA packaging spike — findings (Story 7.4)

**Status:** Spike complete. macOS/arm64 **verified end-to-end**; Linux + Windows are the documented recipe + expectation (to be confirmed on their runners). `pkg`/`nexe` recorded as the fallback.

**Date:** 2026-06-15 · **Host:** macOS (darwin/arm64) · **Node (base):** official `v22.14.0` (darwin-arm64, from nodejs.org).

---

## TL;DR

A Node SEA (Single Executable Application) binary for commit-sage **works**: from the packaged binary on macOS/arm64, the deterministic analysis runs over the **system `git` shell-out** (no native bindings), **ANSI** renders, and the **interactive @clack launchpad + raw-mode stdin** open in a TTY. The recipe is one self-contained CommonJS bundle (all pure-JS deps inlined) injected into an **official** Node runtime via `postject`.

Two non-obvious gotchas were found and handled (both below): the base `node` **must be an official build** (Homebrew omits the SEA fuse), and the bundle **must avoid a static `node:` import that the bundler's esbuild can't yet externalize** — moot now that argv handling is plain `slice(2)`.

---

## What was built

| Artifact | Purpose |
|---|---|
| [src/sea-entry.ts](../../src/sea-entry.ts) | CJS-friendly entry (no top-level await) → the same `main`. |
| [tsup.sea.config.ts](../../tsup.sea.config.ts) | Bundle to ONE self-contained CJS file (`noExternal: [/.*/]`), node builtins external. |
| [sea-config.json](../../sea-config.json) | SEA blob config (`useSnapshot:false`, `useCodeCache:false` for portability). |
| [scripts/build-sea.mjs](../../scripts/build-sea.mjs) | Cross-platform assembly: bundle → blob → copy node → (mac) unsign → postject → (mac) re-sign → chmod. |
| `package.json` scripts | `bundle:sea` (bundle only) · `build:sea` (full pipeline). |

Build artifacts (`dist-sea/`) are gitignored. Run:

```bash
# Default: uses the running node as the base (must be an official build).
npm run build:sea

# When the running node lacks the SEA fuse (e.g. Homebrew), point at an official one:
COMMIT_SAGE_SEA_NODE=/path/to/official/bin/node npm run build:sea

./dist-sea/commit-sage --version
```

---

## Verified on macOS / arm64 (from the packaged binary)

| Acceptance check | Result | Evidence |
|---|---|---|
| Binary is produced + boots | ✅ | `./dist-sea/commit-sage --version` → `1.0.0` |
| **ANSI rendering** (AC1) | ✅ | `FORCE_COLOR=1 … --format terminal -o -` → 35 ANSI escape sequences in the output |
| **Interactive prompts + raw-mode stdin** (AC1) | ✅ | Under a PTY (`script`) the launchpad renders its tagline + readiness line and accepts the ESC cancel — `@clack` raw-mode works from the binary |
| **Git retrieval via system `git` shell-out, no native bindings** (AC2) | ✅ | `./dist-sea/commit-sage . --no-ai --format json -o -` → a full, correct Report JSON (32-metric `analysis`, `schemaVersion 1.0.0`), exit 0 — the `execFile("git", …)` shell-out runs from the binary |
| Capability gate (non-TTY headless) | ✅ | piped 0-arg run returns the usage error (exit 2), not a hang — TTY detection works from the binary |

**Binary size:** ~105 MB (≈110 MB on disk) — almost entirely the embedded Node runtime; the app bundle is **2.01 MB**. Shrinking (a slimmer runtime / compression) is out of scope.

---

## Platform matrix

| Platform | Status | Notes |
|---|---|---|
| **macOS** (darwin/arm64) | ✅ **Verified locally** + CI matrix | Requires `codesign --remove-signature` before inject and an ad-hoc `codesign --sign -` after (else Gatekeeper kills it). postject needs `--macho-segment-name NODE_SEA`. |
| **Linux** (x64) | 🤖 Built by the release CI matrix | Simplest case: copy node → postject (no segment name, no signing) → `chmod +x`. No code-signing step. git is the system `git`, all deps are pure JS. |
| **Windows** (x64) | 🤖 Built by the release CI matrix | Output `commit-sage.exe`; postject with no macho segment; optional Authenticode `signtool` (Defender SmartScreen may warn for an unsigned binary). The build script branches on `process.platform` and uses a shell so `npx.cmd` resolves. |

The script is platform-aware (`process.platform` → binary name, mac signing, mac segment), so the SAME `npm run build:sea` is the per-OS command. The release matrix at [.github/workflows/release.yml](../../.github/workflows/release.yml) builds + smoke-tests + uploads all three binaries (and, on a `v*` tag, attaches them to the GitHub Release). On GitHub-hosted runners `actions/setup-node` provides an OFFICIAL Node build (with the SEA fuse), so no `COMMIT_SAGE_SEA_NODE` override is needed there. The per-platform branching is unit-tested in [tests/sea-plan.test.ts](../../tests/sea-plan.test.ts).

---

## Gotchas found (and how they're handled)

1. **The base `node` must be an OFFICIAL build (has the SEA fuse).** The host's Homebrew `node` (26.3.0) contains **no** `NODE_SEA_FUSE` sentinel, so postject fails with *"Could not find the sentinel … in the binary."* Official nodejs.org builds embed it. The build script **pre-checks** the base binary for the fuse and fails fast with guidance + the `COMMIT_SAGE_SEA_NODE` override. (Some `nvm`/distro builds may also omit it.)
2. **The copied node is read-only.** Homebrew ships `node` `r-x`; `copyFileSync` preserves that, so postject can't open it for writing. The script `chmod`s the copy to `0755` immediately after copying.
3. **Blob/runtime version must match.** The SEA blob is generated with the **same** node that becomes the base (`COMMIT_SAGE_SEA_NODE`), not the running node, to avoid a format mismatch at launch.
4. **CJS + no top-level await.** SEA's `main` is CommonJS and esbuild forbids top-level await in `cjs` output, so `src/sea-entry.ts` uses `.then(...)` (the ESM `src/index.ts` is unchanged).
5. **argv in modern SEA = `[execPath, execPath, …args]`.** Node ≥ 20 normalized a SEA binary's argv so `process.argv.slice(2)` is correct — identical to normal node. (Early/pre-20 SEA omitted `argv[1]`; an initial `node:sea`-based `slice(1)` was therefore wrong and was removed. We target Node 22.) This also sidestepped a bundler issue where tsup's esbuild strips the `node:` prefix off the newer `node:sea` builtin (→ a broken bare `require("sea")`).
6. **`postject` is invoked via `npx --yes`** (a build-time tool) so the project adds **no committed dependency**. CI/reproducible builds may pin `postject` as a devDependency.
7. **`dist-sea/` must be eslint-ignored** — the 2 MB bundle is generated code; it was added to the eslint `ignores` (alongside `dist/`).

---

## `pkg` / `nexe` fallback (AC3)

If SEA proves unviable on a platform (e.g. a target Node lacks the fuse and no official build is usable, snapshot/codesign friction, or a future ESM-only constraint):

- **`@yao-pkg/pkg`** (the maintained `vercel/pkg` fork) — bundles the app + a Node runtime into one binary, cross-compiles for macOS/Linux/Windows from a single host, and handles the `git` shell-out the same way (it's still a child process). Best first fallback for a release matrix from one runner.
- **`nexe`** — similar single-binary packager; viable but less actively maintained than the `pkg` fork.

Both keep the **no-native-bindings** guarantee (git stays a system shell-out) and the same self-contained CJS bundle as input.

---

## Out of scope (post-spike follow-ups)

- A `.github/workflows` **release matrix** — ✅ **now delivered**: [.github/workflows/release.yml](../../.github/workflows/release.yml) builds + smoke-tests + uploads macOS/Linux/Windows binaries (and attaches them to the Release on a `v*` tag).
- **Distribution signing/notarization** (Apple Developer ID + notarytool; Windows Authenticode with a real cert) — beyond the ad-hoc self-sign needed to run locally.
- **Distribution channels** (Homebrew tap, winget, Scoop, apt, an install script).
- **Startup optimization** (`useSnapshot`/`useCodeCache: true`) and **binary slimming**.
