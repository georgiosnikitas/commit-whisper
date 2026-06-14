---
epic: 4
story: 5
title: HTML auto-open with --no-open
baseline_commit: d56aaf4
---

# Story 4.5: HTML auto-open with `--no-open`

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an interactive user,
I want the HTML report to open in my browser automatically,
so that the payoff is immediate — while scripts can suppress it.

## Acceptance Criteria

1. **Interactive + HTML-to-file ⇒ auto-open, with the path printed on failure (AC1).** **Given** `html` is a selected output written to a **file** at an **interactive** terminal, **when** rendering completes, **then** the written HTML file is opened in the OS default browser via a cross-platform shell-out (`open` macOS · `start` Windows · `xdg-open` Linux), and **on auto-open failure the file path is printed clearly** (a stderr line) — the failure is **non-fatal** (the file was written; the run still exits with its normal code, never an error for a browser that wouldn't launch).

2. **`--no-open` suppresses auto-open (AC2).** **Given** the `--no-open` flag (or its absence of intent), **when** a run that would otherwise auto-open completes, **then** auto-open is suppressed entirely (no shell-out) — the HTML file is still written and its path reported, just not opened.

3. **Non-interactive / CI never auto-opens, regardless of the flag (AC3).** **Given** a non-interactive or CI context (the strict single-shot ≥1-arg path, a non-TTY, or `CI` set), **when** HTML is selected, **then** the report is **never** auto-opened (whether or not `--no-open` was passed) — auto-open is gated on the capability gate's `interactive` signal (which already excludes CI / non-TTY / `--non-interactive`), so headless runs and pipes are never disrupted by a browser launch.

## Tasks / Subtasks

- [ ] **Task 1 — Cross-platform browser opener (AC1) [src/cli/open-browser.ts] (new).**
  - [ ] `export type OpenBrowser = (target: string) => Promise<void>` — the injectable side-effect seam (mirrors `WriteFile`).
  - [ ] `export const defaultOpenBrowser: OpenBrowser` — shells out to the platform opener via `node:child_process` `execFile` (**array args, never a shell** — no metacharacter expansion / command injection, exactly the `git.ts` discipline): `process.platform === "darwin"` → `open <target>`; `=== "win32"` → `cmd /c start "" <target>` (the empty title arg guards a quoted path); else → `xdg-open <target>`. `windowsHide: true`; a short timeout so a missing opener can't hang the run; reject on a non-zero exit (the caller treats any rejection as a non-fatal "couldn't open").
  - [ ] `export function browserCommand(platform, target): { command; args }` — the **pure** platform→argv mapping, unit-tested without spawning (the side-effecting `defaultOpenBrowser` is a thin wrapper over it + `execFile`).

- [ ] **Task 2 — Wire non-fatal auto-open into the pipeline (AC1, AC2, AC3) [src/cli/run.ts].**
  - [ ] Extend `RunDeps`: `openBrowser?: OpenBrowser` (defaults to `defaultOpenBrowser`); `autoOpen?: boolean` (defaults to **`false`** — fail-closed: never open unless the shell explicitly enables it).
  - [ ] In the emit loop, capture the HTML **file** destination (a target with `format === "html"` and `destination.kind === "file"`) — at most one (formats are de-duped). HTML to stdout (`-`) has no file to open.
  - [ ] After the loop, if `autoOpen === true` **and** an HTML file was written, `await openBrowser(path)` inside a try/catch: success → `ui.info("Opened <path> in your browser")`; failure → `ui.warn("Could not open a browser automatically — open <path> manually")`. **Never throws** — auto-open is a convenience, not a pipeline stage; the exit code is unchanged (`degraded ? 9 : 0`).
  - [ ] Auto-open runs **after** all writes succeed (so a write failure, exit 7, pre-empts it) and only opens a file that was actually written.

- [ ] **Task 3 — `--no-open` flag + the interactive auto-open decision (AC2, AC3) [src/cli/cli.ts].**
  - [ ] Add the commander option `--no-open` (negation: `opts.open` is `true` by default, `false` when `--no-open` is passed — the `--no-merges` pattern). Help: "do not auto-open the HTML report in a browser".
  - [ ] Compute the capability in the shell (`detectCapability({ nonInteractive: true, stdinIsTTY, stdoutIsTTY, env })` — the same inputs already passed to `resolveRunConfig`) to get `interactive`. The auto-open decision is `autoOpen = capability.interactive && opts.open !== false`, passed into `runDeps`. Because STRICT single-shot always sets `nonInteractive: true`, `interactive` is `false` here, so **single-shot never auto-opens** (AC3) — the live interactive auto-open is exercised by the Epic 6 menu (which resolves capability interactively); 4.5 builds + tests the mechanism, the flag, and the gate.
  - [ ] `--no-open` is a **behavior modifier** (like `--verbose` / `NO_COLOR`), NOT a `RunConfig` config-data field — it does not cross the hexagonal boundary into the pure stages; it only governs the shell's post-render side effect.

- [ ] **Task 4 — Tests (AC1, AC2, AC3).**
  - [ ] **`open-browser.test.ts`:** `browserCommand` maps `darwin` → `open`, `win32` → `cmd …start`, `linux`/other → `xdg-open`, with the target passed as a **separate arg** (no shell string) — a path containing a space / `;` / `&&` is a single argv element, never interpolated into a command line (injection-safe). (No real spawn — the pure mapping is asserted.)
  - [ ] **`run.test.ts` (extend):** with an injected `openBrowser` recorder + `autoOpen: true` and `--format html` (default path) → the opener is called once with `commit-sage-report.html` and a stderr "Opened …" line; `autoOpen: false` (the default) → the opener is **never** called even with html selected; `autoOpen: true` but html to stdout (`-o -`) → opener **not** called (no file); `autoOpen: true` but no html selected (e.g. `--format json`) → opener not called; an `openBrowser` **rejection** with `autoOpen: true` → the run still resolves to its normal exit code (non-fatal) and a stderr "Could not open …" line names the path; auto-open never fires before the html write (a write failure exit-7 pre-empts it).
  - [ ] **`cli.test.ts` / `cli.e2e.test.ts` (extend):** `--no-open` resolves the run with `autoOpen: false` (captured via the run spy); a plain single-shot `--format html` also resolves `autoOpen: false` (non-interactive ⇒ never opens, AC3); an e2e `--no-ai --format html` run writes the file, never spawns the injected opener (single-shot is headless), and exits 0.

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the cross-platform `openBrowser` helper (injectable, `execFile`-not-shell); wiring a **non-fatal** auto-open of the written HTML file into `runPipeline` (after all writes succeed, gated on an injected `autoOpen` boolean); the `--no-open` flag; the `interactive && !noOpen` auto-open decision in the shell; the "never in non-interactive/CI" guarantee (structural — gated on the capability `interactive` signal). All offline-testable (the opener + the decision are injected/pure).

**Out of scope / deferred (do NOT build here):**
- **The interactive launchpad menu that makes `interactive === true`** — Epic 6 (Story 6.1). Under STRICT single-shot (every ≥1-arg run) the capability gate yields `interactive === false`, so live auto-open does not fire yet; 4.5 builds the mechanism + flag + gate and tests them with `autoOpen` injected. The menu will call the pipeline with `autoOpen` resolved from the real interactive capability. [Source: epics.md#Story 6.1, src/config/capability.ts]
- **The run-summary "Opened/Wrote" block polish (UX-DR5)** — 4.5 emits the minimal honest stderr lines (`Opened … in your browser` / `Could not open …`); the richer run-summary block (saved paths · scope · confidence) is Epic 6's command-echo/summary surface. [Source: epics.md#UX-DR5, Epic 6]
- **Masthead/footer provenance, multi-select prompt, config-file defaults** — unchanged deferrals (Epic 6 / a schema story). [Source: 4.1–4.4 deferrals]
- **Opening Markdown/JSON or a stdout artifact** — only an HTML **file** is auto-opened (you cannot open stdout; MD/JSON are not the browser showpiece). [Source: FR-13]

### Architecture decisions (read first)

- **Auto-open is a non-fatal shell side effect, isolated behind an injected seam — the pipeline never depends on a browser.** `defaultOpenBrowser` is the one new I/O edge (alongside `writeFile`), injected into `runPipeline` so the whole pipeline still runs offline in tests. A browser that won't launch is a **convenience failure**, not a pipeline failure: the HTML is already on disk, so auto-open failure prints the path and the run exits with its normal code — it never becomes a `RenderError`/exit 7. This is the deliberate asymmetry with `writeFile` (a write failure IS fatal — there's no artifact; an open failure is NOT — the artifact exists). [Source: architecture.md#stream discipline / side effects in the shell, FR-13]
- **`execFile`, never a shell — the `git.ts` injection discipline.** The opener passes the file path as a **separate argv element** to `execFile` (array args, `windowsHide: true`), so a path containing spaces / `;` / `&&` / `$(...)` is never interpreted by a shell — no command injection from a user-chosen `--output` path. The pure `browserCommand(platform, target)` mapping is unit-tested without spawning. [Source: src/retrieve/git.ts, securityRequirements / OWASP]
- **Gated on the capability `interactive` signal (which already excludes CI / non-TTY / `--non-interactive`).** AC3 ("never in non-interactive/CI") is satisfied structurally: `interactive = stdinIsTTY && stdoutIsTTY && !isCI && !nonInteractive` (Story 1.2). The shell computes `autoOpen = interactive && opts.open !== false`; since STRICT single-shot forces `nonInteractive: true`, single-shot is always `autoOpen: false`. No separate CI check is needed — it's already folded into `interactive`. [Source: src/config/capability.ts]
- **`--no-open` is a behavior modifier, not a `RunConfig` field.** Like `--verbose` / `NO_COLOR`, it tunes a shell-level side effect (the post-render browser launch) and does not enter the frozen `RunConfig` that crosses into the pure stages. The pipeline receives the resolved `autoOpen` boolean via `RunDeps` (the same channel as `writeFile`), keeping retrieve/analyze/narrate/assemble/render untouched. [Source: architecture.md#behavior modifiers, src/config/run-config.ts]
- **`runPipeline` (the shell orchestrator) owns the open step, after the emit loop.** Auto-open runs only after every write has succeeded (a write failure, exit 7, pre-empts it) and opens exactly the HTML **file** target (at most one — formats are de-duped; `-`/stdout has no file). [Source: src/cli/run.ts]

### The contracts to build on (do NOT redefine)

- **`OutputTarget` / `planOutputs` (4.4):** the emit loop already yields `{ format, destination }`; 4.5 reads the `html` + `file` target's path from it. No planner change. [Source: src/render/output-plan.ts]
- **`RunDeps` + the injected-edge pattern (1.8 / 4.4):** `writeStdout` and `writeFile` are already injected; `openBrowser` + `autoOpen` join them the same way (defaults wire the real adapters). [Source: src/cli/run.ts]
- **`detectCapability` / `computeCapability` (1.2):** the pure capability gate the shell reuses to get `interactive` (it already excludes CI / non-TTY). No change. [Source: src/config/capability.ts]
- **`Ui` (1.3):** the stderr human-chrome surface for the "Opened …" / "Could not open …" lines (stdout stays machine-clean). [Source: src/shared/ui.ts]
- **The `--no-merges` commander-negation pattern (2.6):** `--no-open` mirrors it (`opts.open === false` ⟺ `--no-open` passed). [Source: src/cli/cli.ts]

### Determinism, security & purity (unchanged rules)

- **Pure where it can be:** `browserCommand` is a pure platform→argv mapping; the only impurity (`execFile`) is isolated in `defaultOpenBrowser` (cli/, the shell) and injected. The pure render/assemble/analyze stages are untouched. [Source: architecture.md]
- **No command injection:** `execFile` array args, never a shell string — a hostile `--output` path is a single argv element, never interpolated (the `git.ts` rule). [Source: securityRequirements, src/retrieve/git.ts]
- **No new dependencies:** `node:child_process` is a builtin (the same one `git.ts` uses). No `open`/`opener` npm package. [Source: architecture.md]
- **Stream discipline:** the auto-open lines are stderr chrome (`ui.info`/`ui.warn`); stdout stays machine-only, so a `--format json -o - | jq` or `--format html -o -` pipe is never disrupted. [Source: architecture.md#stream discipline]
- **Back-compat:** the default `["terminal"]` selection writes no file and has no HTML target, so `autoOpen` is a no-op there; every existing run/e2e test is unchanged (single-shot is `autoOpen: false`). [Source: src/cli/run.test.ts, src/cli/cli.e2e.test.ts]

### Previous-story intelligence

- **4.4 built the emit loop + the injected `writeFile` edge; 4.5 adds the sibling `openBrowser` edge + a non-fatal open step after it.** No planner / renderer / config-field change — only the opener helper, two `RunDeps` fields, the `--no-open` flag, and the shell's `interactive && !noOpen` decision. [Source: src/cli/run.ts, src/render/output-plan.ts]
- **The capability gate already excludes CI / non-TTY (1.2)** — so AC3 is structural, not a bolted-on `CI` check. Single-shot's hardcoded `nonInteractive: true` makes `autoOpen` false today; the menu (Epic 6) is the live interactive path. [Source: src/config/capability.ts]
- **`execFile`-not-shell is the established injection-safe shell-out (1.4 `git.ts`)** — reuse it verbatim for the opener. [Source: src/retrieve/git.ts]
- **Injected side-effect edges keep the pipeline offline-testable (4.4 `writeFile`)** — `openBrowser` follows the identical pattern; the real opener never runs in tests. [Source: src/cli/run.test.ts]

### References

- [Source: docs/planning-artifacts/epics.md#Story 4.5: HTML auto-open with --no-open] (the ACs) · [Source: …#FR-13] (HTML auto-opens interactively; --no-open suppresses; CI never auto-opens) · [Source: …#FR-15] (--no-open among the operational flags) · [Source: …#UX-DR12] (browser-open-failure state treatment)
- [Source: docs/planning-artifacts/architecture.md#behavior modifiers / side effects in the shell / stream discipline]
- [Source: src/cli/run.ts] (the emit loop to extend) · [Source: src/cli/cli.ts] (the flag + capability) · [Source: src/render/output-plan.ts] (`OutputTarget`) · [Source: src/config/capability.ts] (`detectCapability` / `interactive`) · [Source: src/retrieve/git.ts] (the `execFile`-not-shell pattern) · [Source: src/shared/ui.ts] (stderr chrome)

## Dev Agent Record

### Completion Notes (Amelia)

The Epic 4 finale — wires non-fatal HTML auto-open into the pipeline behind an injected opener, with the `--no-open` flag and the `interactive`-gated decision. 632 tests pass (+14 over 4.4); typecheck/lint/build all green. Zero new dependencies (`node:child_process` is a builtin, the same one `git.ts` uses). Bundle 141.92 → 143.41 KB.

- **`src/cli/open-browser.ts`** (new) — `browserCommand(platform, target)` is the PURE platform→argv mapping (darwin `open` · win32 `cmd /c start "" <target>` · else `xdg-open`); `defaultOpenBrowser` is the thin `execFile` wrapper over it (ARRAY args, never a shell — the `git.ts` injection-safe discipline; `windowsHide: true`; a 5s timeout so a missing/hung opener can't stall the run). `OpenBrowser` is the injectable seam (mirrors `WriteFile`).
- **`src/cli/run.ts`** (edit) — `RunDeps` gains `openBrowser?` (default `defaultOpenBrowser`) + `autoOpen?` (default **`false`** — fail-closed). The emit loop now captures the HTML **file** destination (`format === "html" && kind === "file"` — at most one; stdout/`-` has no file). After all writes succeed, if `autoOpen && htmlFilePath`, `tryOpen` opens it: success → `ui.info("Opened …")`, failure → `ui.warn("Could not open …")`. **`tryOpen` never throws** — auto-open is a convenience, so a browser that won't launch prints the path and the run exits its normal code (the deliberate asymmetry with `writeFile`, whose failure IS fatal exit 7). Auto-open runs strictly after the writes, so a write failure pre-empts it.
- **`src/cli/cli.ts`** (edit) — `--no-open` (commander negation → `opts.open === false`). The shell computes the capability (`detectCapability({ nonInteractive: true, stdinIsTTY, stdoutIsTTY, env })` — same inputs already passed to `resolveRunConfig`) and `autoOpen = interactive && opts.open !== false`, passed into `runDeps`. Since STRICT single-shot forces `nonInteractive: true`, `interactive` is `false`, so **single-shot never auto-opens (AC3)** — the live interactive auto-open is the Epic 6 menu's job; 4.5 builds + tests the mechanism, the flag, and the gate.

**AC3 is structural, not a bolted-on CI check:** the capability gate already folds in `!isCI && stdinIsTTY && stdoutIsTTY && !nonInteractive`, so a CI/non-TTY/`--non-interactive`/single-shot run yields `interactive === false` → `autoOpen === false`. No separate CI guard needed.

**Deferred (unchanged):** the interactive launchpad menu that makes `interactive === true` (Epic 6 / Story 6.1) — the live trigger for auto-open; masthead/footer provenance; the richer run-summary block (Epic 6). Only the HTML **file** is auto-opened (not Markdown/JSON, not a stdout artifact).

### Review (3-layer adversarial) — unanimous accept, 0 patches

- **Acceptance Auditor — all 3 ACs MET, scope held, 0 must-fix.** Verified the cross-platform shell-out + path-on-failure + non-fatal contract (AC1), `--no-open` → `autoOpen false` (AC2), and the `interactive`-gated structural never-in-CI guarantee (AC3). Confirmed: no menu built, no new deps, no RunConfig field (the flag is a behavior modifier via RunDeps), `execFile`-not-shell, the write-fatal/open-non-fatal asymmetry, stderr-only chrome, back-compat (default terminal is a no-op), and HTML-file-only scope.
- **Edge Case Hunter — 0 unhandled edge cases.** Walked `browserCommand` (all platforms incl. the xdg-open catch-all → ENOENT rejects → non-fatal warn), `defaultOpenBrowser` (timeout/non-zero-exit/missing-binary all reject → warn), the run.ts open step (autoOpen true/false, html→stdout, no-html, multi-format html-only, write-failure pre-empt, degraded-exit-9 still opens the written file), and the cli.ts decision (no double-negation, single-shot always non-interactive, the two capability computations can't drift — same pure fn, same inputs).
- **Blind Hunter — 0 Critical/High/Medium; 1 Nit DISMISSED.** Command injection (array argv all platforms, win32 empty-title correct), non-fatal contract (catch swallows + warns, exit code unchanged), gating (html-file-only, post-write), `--no-open` boolean logic, the 5s timeout, and lint/style all clean. **DISMISSED nit:** "document why `windowsHide` is unconditional" — it's a harmless no-op on non-Windows and matches the existing `git.ts` convention (which also sets it unconditionally); no change for consistency.

**Patches applied:** 0. **Tests added:** 0 (the 14 co-located tests already cover every boundary the hunters enumerated). All gates green (632 tests).

### File List

- `src/cli/open-browser.ts` (new) · `src/cli/open-browser.test.ts` (new)
- `src/cli/run.ts` (modified) · `src/cli/run.test.ts` (modified)
- `src/cli/cli.ts` (modified) · `src/cli/cli.test.ts` (modified) · `src/cli/cli.e2e.test.ts` (modified)
