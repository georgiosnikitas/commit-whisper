---
baseline_commit: b77c74b964029385142e135faf20fadab46cc1b8
---

# Story 1.1: Project scaffold and toolchain

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer building commit-sage,
I want a strict, ESM-first TypeScript project scaffold with the locked toolchain,
so that every later story is written against a consistent, type-safe, testable foundation.

## Acceptance Criteria

1. `package.json` declares an **ESM** (`"type": "module"`) Node 22 project with the locked **runtime** deps (`commander@15.0.0`, `@clack/prompts@1.5.1`) and **dev** deps (`typescript@6.0.3`, `tsup@8.5.1`, `vitest@4.1.8`, `@types/node@22`).
2. A strict `tsconfig.json` is committed with `module: nodenext`, `moduleResolution: nodenext`, `target: es2023`, and `strict: true` (full `compilerOptions` per Dev Notes).
3. The `src/` feature-folder structure exists: `cli/`, `config/`, `retrieve/`, `analyze/`, `narrate/`, `assemble/`, `render/`, `license/`, `shared/`.
4. `npm run build` succeeds on the empty scaffold (tsup → `dist/`).
5. `npm test` succeeds on the empty scaffold (vitest).
6. The linter runs and succeeds, and the ESLint config **enforces** (as build failures, not warnings): named-exports-only (no `export default`), no `console.log` in pipeline modules, and `process.env` access only within `config/`.

## Tasks / Subtasks

- [x] **Task 1 — Initialize npm project + install locked dependencies (AC: 1)**
  - [x] `npm init -y`, then set `"type": "module"`, `"engines": { "node": ">=22" }`, and a meaningful `"name"`/`"description"`
  - [x] Install runtime deps at exact pinned versions: `npm install commander@15.0.0 @clack/prompts@1.5.1`
  - [x] Install dev toolchain at exact pinned versions: `npm install -D typescript@6.0.3 tsup@8.5.1 vitest@4.1.8 @types/node@22`
  - [x] Install ESLint toolchain (versions not pinned by the epic — use latest stable, see Dev Notes): `npm install -D eslint typescript-eslint` → resolved `eslint@10.5.0`, `typescript-eslint@8.61.0`
  - [x] Add `package.json` scripts: `build` (`tsup`), `test` (`vitest run`), `test:watch` (`vitest`), `typecheck` (`tsc --noEmit`), `lint` (`eslint .`)
  - [x] Confirm versions in `package.json` are pinned exactly (no `^`/`~`) for the locked deps, matching the architecture lock (enforced via `.npmrc` `save-exact=true`)
- [x] **Task 2 — Commit strict `tsconfig.json` (AC: 2)**
  - [x] Create `tsconfig.json` with the exact `compilerOptions` block in Dev Notes (nodenext module + resolution, es2023, strict, esModuleInterop, skipLibCheck, declaration, `outDir: dist`, `rootDir: src`, `include: ["src"]`)
  - [x] Run `npm run typecheck` and confirm it passes on the empty scaffold
- [x] **Task 3 — Create `src/` feature-folder structure + minimal entrypoint (AC: 3, 4)**
  - [x] Create the 9 feature folders under `src/`: `cli/ config/ retrieve/ analyze/ narrate/ assemble/ render/ license/ shared/`
  - [x] Add a `.gitkeep` to each otherwise-empty folder so the structure is tracked by git
  - [x] Create `src/index.ts` as a minimal ESM entrypoint (placeholder bootstrap — no logic yet; this is the tsup entry). Keep it `console`-free and use a named export only
- [x] **Task 4 — Configure tsup build (AC: 4)**
  - [x] Create `tsup.config.ts` targeting `src/index.ts` → `dist/` (ESM format, Node 22 target, `clean: true`)
  - [x] Run `npm run build` and confirm a clean build to `dist/`
- [x] **Task 5 — Configure vitest + a smoke test (AC: 5)**
  - [x] Create `vitest.config.ts` (Node environment; co-located `*.test.ts` discovery per P3)
  - [x] Add one trivial co-located smoke test (e.g. `src/index.test.ts`) so the harness has a passing test and `vitest run` does not error on "no test files"
  - [x] Run `npm test` and confirm green
- [x] **Task 6 — Configure ESLint flat config enforcing P2/P4/P5 (AC: 6)**
  - [x] Create `eslint.config.js` (flat config) wiring `typescript-eslint` (plain flat-config array export)
  - [x] Rule: forbid `export default` everywhere (named exports only) — see Dev Notes for the `no-restricted-syntax` selector
  - [x] Rule: forbid `console` in pipeline folders (`retrieve/ analyze/ narrate/ assemble/ render/ license/ shared/`) via a scoped `files` override with `no-console: error`
  - [x] Rule: forbid `process.env` access outside `config/` via a scoped override (allow it only in `src/config/**`)
  - [x] Run `npm run lint` and confirm it passes on the empty scaffold; add a temporary violating snippet to prove each rule *fails the build*, then remove it (verified: all 3 rules emitted errors on a probe file, then probe deleted)
- [x] **Task 7 — Validate the TS 6.0.3 toolchain risk (AC: 1, 4, 5 — tracked risk 🟡)**
  - [x] Confirm `tsup`/`esbuild` and `vitest` build and run cleanly against `typescript@6.0.3`
  - [x] If any toolchain link is incompatible with TS 6, fall back cleanly to `typescript@5.9` (document the decision in Completion Notes) — **not needed: TS 6.0.3 works cleanly with tsup 8.5.1 / esbuild 0.27.7 and vitest 4.1.8; fallback not exercised**
- [x] **Task 8 — Supporting root files (AC: 1) — recommended**
  - [x] `.gitignore` (ignore `node_modules/`, `dist/`) — **already present and comprehensive; no change needed**
  - [x] `.npmrc` (e.g. `save-exact=true` to keep the locked versions pinned)
  - [x] Add a `README.md` (the repo currently has only `README.txt` — do **not** delete it; see Project Structure Notes) — added; `README.txt` left untouched
  - [x] Optional: `.github/workflows/ci.yml` running `lint · typecheck · test · build` (the architecture lists it; safe to add now or defer to a later story) — **deferred to a later story (kept scope tight); `.github/` currently holds only BMAD agent files**

### Review Findings

**Code review — 2026-06-13** (parallel layers: Blind Hunter · Edge Case Hunter · Acceptance Auditor). The Acceptance Auditor independently confirmed **all 6 ACs are met** and build/test/lint/typecheck are green. The items below are hardening / forward-scoping notes, not AC failures. The lone HIGH finding (typescript-eslint vs ESLint 10 / TS 6 peer incompatibility) was **verified a false positive** — clean `npm ls`, no unsupported-TS banner, lint exits 0 — and dismissed.

**Decision-needed:** _(resolved 2026-06-13 — George chose **full harden**, option 2)_

**Patch:** _(all 3 applied & verified 2026-06-13)_

- [x] [Review][Patch] Harden tsconfig (resolved from decision) [tsconfig.json] — Full harden chosen over exact-block fidelity: add `noEmit: true` (kills the confirmed bare-`tsc` emit-into-`dist/` footgun), add `isolatedModules: true` (esbuild/tsup per-file-emit safety), and drop the inert `declaration: true` (tsup `dts:false`, typecheck is `--noEmit`, so it never produced output). `verbatimModuleSyntax` deferred (stricter; can wait). Deviates from the AC2 locked block deliberately — documented here as the review resolution. **Verified:** `tsc --noEmit` clean, and `tsup` still emits `dist/` (esbuild ignores tsc `noEmit`).
- [x] [Review][Patch] Harden `process.env` boundary guard [eslint.config.js] — `no-restricted-properties {process.env}` catches only the static member form; `const { env } = process` and `import { env } from "node:process"` bypass the hexagonal-boundary guardrail. Add a `no-restricted-syntax` selector covering destructuring of `process` and the `node:process` named import. (Story Dev Notes already flagged this hardening.) **Verified** via probe: the `node:process` import form is now caught (it was the genuine gap); destructure is caught by both rules.
- [x] [Review][Patch] Broaden ESLint globs + cover the entrypoint in `no-console` [eslint.config.js] — guardrail blocks scope `src/**/*.ts` only (miss `.mts`/`.cts`), and `no-console` omits `src/index.ts`. Broaden to `src/**/*.{ts,mts,cts}` and bring the entrypoint under `no-console` so P5 stream discipline can't be silently bypassed by a future non-`.ts` file or a stray bootstrap log. **Verified** via probe: a `.mts` default export and a console call in `src/index.ts` both now error.

**Defer (tracked in deferred-work.md, not actioned now):**

- [x] [Review][Defer] No `bin`/shebang for the CLI [package.json, tsup.config.ts] — deferred, out of current scope: CLI entry wiring belongs to later Epic 1 stories (1.8 end-to-end run); 1.1 is scaffold-only.
- [x] [Review][Defer] `shared/ui.ts` will collide with `no-console` when it lands [eslint.config.js] — deferred: address in the story that introduces `ui.ts` (use `process.stderr.write`, or add a scoped override for that one file).
- [x] [Review][Defer] Root config files escape `tsc` typecheck [tsup.config.ts, vitest.config.ts, eslint.config.js] — deferred: minor; add a config-typecheck pass in a later tooling/CI story.

## Dev Notes

### Scope discipline — what this story does and does NOT include

- **In scope:** project initialization only — `package.json`, `tsconfig.json`, build/test/lint config, the empty `src/` feature-folder tree, a minimal entrypoint, and a smoke test. This is the **walking-skeleton foundation**; later Epic 1 stories fill the folders.
- **Out of scope (do NOT add these dependencies or files yet):** `zod`, the Vercel AI SDK (`ai`, `@ai-sdk/*`), `chart.js`, `picocolors`, license/`fetch` code, the two-phase resolver, `RunConfig`, the error hierarchy, etc. Those belong to their own stories (RunConfig → Story 1.2, error model/exit codes → Story 1.3, etc.). Adding them here is scope creep and will break the "empty scaffold builds clean" ACs. [Source: docs/planning-artifacts/architecture.md#Decision Impact Analysis]

### Locked dependency versions (verified live against npm 2026-06-12 — do not change)

| Concern | Package | Version | Dep type |
|---|---|---|---|
| Language / type system (strict, ESM) | `typescript` | `6.0.3` | dev |
| Argument / subcommand parsing | `commander` | `15.0.0` | runtime |
| Interactive menu / prompts / spinner | `@clack/prompts` | `1.5.1` | runtime |
| Bundling (esbuild under the hood) | `tsup` | `8.5.1` | dev |
| Tests (TS-native) | `vitest` | `4.1.8` | dev |
| Node typings | `@types/node` | `22` | dev |
| Runtime target | Node.js LTS | `22` | engines |

Pin these **exactly** (no `^`/`~`). [Source: docs/planning-artifacts/architecture.md#Starter Template Evaluation] [Source: docs/planning-artifacts/epics.md#Story 1.1: Project scaffold and toolchain]

### Exact `tsconfig.json` to commit

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

[Source: docs/planning-artifacts/architecture.md#Initialization (first implementation story)]

### Implementation patterns this scaffold must encode (P1–P7)

The ESLint config is the **enforcement mechanism** for the cross-agent consistency rules — "violations are build failures, not review notes." Encode at least these three now (the rest land as their code arrives):

- **P2 · Modules & files** — `kebab-case.ts` filenames; **named exports only** (no `export default`); ports as `*.port.ts`; shared primitives under `src/shared/`.
- **P5 · Streams & logging** — all human chrome → stderr via a single `ui` module; machine data → stdout; **no `console.log` inside the pipeline** (lint-enforced).
- **Anti-pattern (env isolation)** — reading `process.env` **outside `config/`** is forbidden (lint-enforced); `config/env.ts` is the single intended reader.
- **P3 · Source layout** — pipeline-mirroring feature folders; tests **co-located** as `*.test.ts`; `tests/` holds only shared fixtures + the determinism harness.

[Source: docs/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] [Source: docs/planning-artifacts/architecture.md#Anti-Patterns (forbidden)]

#### ESLint flat-config guidance (lean — prefer built-in rules over extra plugins)

To honor the lean/SEA-friendly dependency posture, prefer `typescript-eslint` + built-in rules rather than adding `eslint-plugin-import`:

- **No default exports (named-exports-only):**
  `"no-restricted-syntax": ["error", { "selector": "ExportDefaultDeclaration", "message": "Named exports only (P2)." }]`
- **No `console` in pipeline modules:** a flat-config `files` override scoping
  `"no-console": "error"` to `src/{retrieve,analyze,narrate,assemble,render,license,shared}/**/*.ts`.
- **No `process.env` outside `config/`:** apply `no-restricted-properties` / a `no-restricted-syntax` member-expression selector for `process.env` to all `src/**` files, then a second override that **re-allows** it under `src/config/**`.

The epic does not pin ESLint's own version — use the current stable `eslint` + `typescript-eslint` (flat config is the default in modern ESLint). Record the chosen versions in the File List / Completion Notes.

### Complete target directory structure (reference — build only the scaffold subset now)

The full project tree is documented in the architecture. **This story creates only the root config files, the 9 `src/` feature folders (with `.gitkeep`), `src/index.ts`, and the test config** — not the inner `.ts` modules shown below (those are later stories). Reproduced here so the dev agent places everything correctly and never invents alternate paths:

```
commit-sage/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js          # enforces P2/P4/P5 + no-console-in-pipeline
├── .gitignore
├── .npmrc
├── src/
│   ├── index.ts              # entrypoint (only top-level await later; minimal placeholder now)
│   ├── cli/        config/   retrieve/   analyze/
│   ├── narrate/    assemble/ render/     license/
│   └── shared/
├── tests/
│   ├── fixtures/             # (later) synthetic repos / canned git output
│   └── determinism/          # (later) identical-history ⇒ identical analysis-subtree harness
└── dist/                     # build output (gitignored)
```

Only `cli/` and `config/` may ever touch `argv`/`env`/prompts; every stage from `retrieve/` onward receives the frozen `RunConfig` (the hexagonal boundary). The scaffold just establishes the folders; the rule is enforced from Story 1.2 onward. [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure] [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]

### Testing standards

- **Framework:** `vitest` 4.1.8, TS-native. Unit tests are **co-located** as `*.test.ts` next to the code they test (P3). `tests/` is reserved for shared fixtures and the determinism harness (added in Story 1.5, not here).
- **This story's test bar:** a single trivial smoke test that makes `npm test` green, proving the harness is wired. Do not over-build tests for empty folders.
- `npm run build`, `npm test`, and `npm run lint` must **all succeed on the empty scaffold** — this is AC 4/5/6 and the definition of done. [Source: docs/planning-artifacts/epics.md#Story 1.1: Project scaffold and toolchain]

### Tracked risk to clear in this story

- **TypeScript 6.0.3 toolchain confirmation (🟡):** TS 6 is bleeding-edge — confirm `tsup`/`esbuild` and `vitest` fully support it at scaffold time. **Clean fallback to TypeScript 5.9** if not, documented in Completion Notes. This is a pre-approved architecture fallback, not a blocker. [Source: docs/planning-artifacts/architecture.md#Gap Analysis Results]

### Project Structure Notes

- **Greenfield:** the repository currently contains only `_bmad/`, `docs/`, `.agents/`, and `README.txt` — no `package.json` or `src/`. This matches the epic's "Given an empty repository." Initialize at the repo root (`/Users/georgiosnikitas/Workspace/commit-sage`).
- **`README.txt` already exists.** The architecture tree expects `README.md`. Add `README.md` but **do not delete or overwrite `README.txt`** — it may be in-progress content. Leave it untouched.
- **Empty folders + git:** git does not track empty directories. Use a `.gitkeep` (or a placeholder) in each feature folder so the structure is committed and visible.
- **`src/index.ts` must exist** for tsup to have an entry and for the build AC to pass; keep it a minimal, `console`-free, named-export placeholder.
- **No conflicts detected** between the architecture's prescribed structure and this scaffold — paths and naming align exactly.

### References

- [Source: docs/planning-artifacts/epics.md#Epic 1: Foundation & Walking Skeleton]
- [Source: docs/planning-artifacts/epics.md#Story 1.1: Project scaffold and toolchain]
- [Source: docs/planning-artifacts/epics.md#Additional Requirements] (Project scaffold — greenfield init)
- [Source: docs/planning-artifacts/architecture.md#Starter Template Evaluation]
- [Source: docs/planning-artifacts/architecture.md#Initialization (first implementation story)]
- [Source: docs/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: docs/planning-artifacts/architecture.md#Anti-Patterns (forbidden)]
- [Source: docs/planning-artifacts/architecture.md#Complete Project Directory Structure]
- [Source: docs/planning-artifacts/architecture.md#Architectural Boundaries]
- [Source: docs/planning-artifacts/architecture.md#Gap Analysis Results]
- [Source: docs/planning-artifacts/architecture.md#Implementation Handoff]

## Dev Agent Record

### Agent Model Used

GitHub Copilot (Claude Opus 4.8)

### Debug Log References

All commands run from repo root on Node v26.3.0 / npm 11.16.0:

- `npm run typecheck` → `tsc --noEmit` clean (no errors) — confirms strict tsconfig + TS 6.0.3.
- `npm run build` → tsup v8.5.1, target node22, ESM → `dist/index.js` (102 B) + sourcemap, "Build success".
- `npm test` → vitest v4.1.8, 1 file / 1 test passed.
- `npm run lint` → ESLint v10.5.0 clean (exit 0).
- ESLint rule probe (`src/analyze/_probe.ts`, since deleted) emitted exactly 3 errors:
  `no-restricted-properties` (process.env), `no-console`, `no-restricted-syntax` (default export) — confirming all three guardrails fail the build.

### Completion Notes List

- **All 6 acceptance criteria satisfied.** Empty scaffold builds, tests, type-checks, and lints clean; the three architecture guardrails (P2 named-exports-only, P5 no-console-in-pipeline, env-isolation) are enforced as ESLint errors and were proven to fail the build via a probe file.
- **Locked versions all exist and were installed exactly** (pinned via `.npmrc` `save-exact=true`): `commander@15.0.0`, `@clack/prompts@1.5.1`, `typescript@6.0.3`, `tsup@8.5.1`, `vitest@4.1.8`, `@types/node@22.19.21`. ESLint toolchain (not pinned by the epic) resolved to `eslint@10.5.0` + `typescript-eslint@8.61.0`.
- **TS 6.0.3 toolchain risk (🟡) cleared:** TypeScript 6.0.3 builds and tests cleanly with tsup 8.5.1 (esbuild 0.27.7) and vitest 4.1.8. The pre-approved TS 5.9 fallback was **not** needed.
- **⚠ Security — accepted dev-only advisory (needs awareness):** `npm audit` reports 2 high-severity advisories in `esbuild@0.27.7` (transitive via `tsup@8.5.1`): GHSA-gv7w-rqvm-qjhr (esbuild **Deno** module integrity — we do not use Deno) and GHSA-g7r4-m6w7-qqqr (esbuild **dev server** arbitrary file read on Windows — tsup uses esbuild as a bundler, never its dev server). Neither attack vector is used by commit-sage, and esbuild is a build-time devDependency (not shipped in the runtime/SEA surface). npm's `audit fix --force` would **downgrade tsup to 6.5.0**, violating the locked architecture decision, so it was deliberately not applied. Recommend revisiting when tsup ships an esbuild bump.
- **`.gitignore` already existed** and is comprehensive (ignores `node_modules/`, `dist/`, `coverage/`, etc.) — left unchanged.
- **`README.txt` left untouched**; added `README.md` alongside it per the architecture tree.
- **CI workflow deferred:** `.github/workflows/ci.yml` is optional in this story and was deferred to keep scope tight (`.github/` currently holds only BMAD agent files). The `lint · typecheck · test · build` scripts are all wired and ready for a future CI story.
- **Dev runtime note:** the dev machine runs Node v26.3.0 (satisfies `engines.node >=22`); the project still locks `@types/node@22` and targets `node22` per the architecture. No action needed.
- **`package.json` hardening:** set `"private": true` (commercial product shipped as a binary, not published to npm) and `"license": "UNLICENSED"`.

### File List

**Added (source / config):**
- `package.json` (created via `npm init`, then finalized: ESM, engines, scripts, private)
- `package-lock.json` (generated by npm; pins the full dependency tree)
- `.npmrc` (`save-exact=true`)
- `tsconfig.json` (strict, nodenext, es2023)
- `tsup.config.ts`
- `vitest.config.ts`
- `eslint.config.js` (flat config; enforces P2 / P5 / env-isolation)
- `README.md`
- `src/index.ts` (minimal named-export entrypoint)
- `src/index.test.ts` (smoke test)
- `src/cli/.gitkeep`, `src/config/.gitkeep`, `src/retrieve/.gitkeep`, `src/analyze/.gitkeep`, `src/narrate/.gitkeep`, `src/assemble/.gitkeep`, `src/render/.gitkeep`, `src/license/.gitkeep`, `src/shared/.gitkeep`

**Modified (tracking):**
- `docs/implementation-artifacts/sprint-status.yaml` (1-1 → review → done; epic-1 → in-progress)
- `docs/implementation-artifacts/1-1-project-scaffold-and-toolchain.md` (this story: tasks checked, record filled, review findings, status → done)
- `docs/implementation-artifacts/deferred-work.md` (created by code review; 3 deferred items)

**Patched during code review (2026-06-13):**
- `tsconfig.json` (added `noEmit` + `isolatedModules`, dropped `declaration`)
- `eslint.config.js` (hardened `process.env` guard; broadened globs to `.mts`/`.cts`; entrypoint under `no-console`)

**Not committed (gitignored):** `dist/` (build output), `node_modules/`

**Left untouched:** `README.txt`, existing `.gitignore`, `.github/agents/*`

### Change Log

| Date | Change |
|---|---|
| 2026-06-13 | Story 1.1 implemented: npm/TypeScript ESM scaffold, strict tsconfig, tsup build, vitest + smoke test, ESLint flat config enforcing P2/P5/env-isolation, `src/` feature-folder tree, README. All ACs met; build/test/lint/typecheck green. Status → review. |
| 2026-06-13 | Code review (3 layers). All 6 ACs confirmed met; lone HIGH finding (ts-eslint peer compat) verified a false positive. Applied 3 hardening patches: tsconfig full-harden (`noEmit`+`isolatedModules`, drop `declaration`), `process.env` guard hardening (destructure + `node:process` import), ESLint glob broadening (`.mts`/`.cts`) + entrypoint `no-console`. 3 items deferred to `deferred-work.md`. All guards re-proven via probes; suite green. Status → done. |
