---
epic: 4
story: 4
title: JSON output and multi-select formats
baseline_commit: e70bc68
---

# Story 4.4: JSON output and multi-select formats

Status: Done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an automation user,
I want to select one or more output formats including JSON,
so that I can pipe, diff, and archive the canonical artifact.

## Acceptance Criteria

1. **Multi-select formats from the one Report JSON, no re-analysis / no second LLM call (AC1).** **Given** one or more selected output formats (`terminal`, `html`, `markdown`, `json`), **when** a run completes, **then** all selected formats are produced from the **single in-memory Report** (the same `assembleReport` output the pipeline already built) — each via its pure `Report → string` renderer — with **no re-analysis and no second narration/LLM call**; a single run can emit several formats at once (e.g. `--format html,markdown,json`), and the deterministic `analysis` is identical across every emitted format.

2. **Selecting `json` writes the canonical Report JSON to the chosen destination (AC2).** **Given** `json` is among the selected formats, **when** output is emitted, **then** the **canonical Report JSON** (`schemaVersion` · `degraded` · `analysis` · optional `narrative`) is serialized **deterministically** (stable key order from the byte-stable assembled report, pretty-printed, trailing newline) and written to the chosen destination — it **round-trips** through `parseReport` (the C1 read-back), and is byte-identical for identical input.

3. **Default paths, `-` = stdout, terminal is stdout-native, predictable + safe (AC3).** **Given** the file formats `html` / `markdown` / `json`, **when** no path is given, **then** each defaults to `./commit-sage-report.{html,md,json}`; **and** `-` means **stdout**; **and** `terminal` is always stdout-native (never a file); **and** a single explicit `--output <path>` is honored only when exactly one file format is selected (more than one file format + an explicit single path is an ambiguity usage error, exit 2); **and** the run reports each written artifact's path on **stderr** (human chrome — stdout stays machine-clean), so `commit-sage --format json -o - | jq` and `commit-sage --format json > report.json` both stay uncorrupted.

## Tasks / Subtasks

- [ ] **Task 1 — Canonical Report-JSON serializer + per-format render dispatch (AC1, AC2) [src/render/render.ts] (new).**
  - [ ] `serializeReportJson(report): string` — `JSON.stringify(report, null, 2)` + a trailing newline. Deterministic (the assembled report's key order is stable + `analysis` is byte-stable); a test asserts it **round-trips** through `parseReport` and is byte-identical across two calls. (No re-validation needed at write time — the report was assembled from already-validated parts; the round-trip test is the lock-in.)
  - [ ] `renderFormat(report, format): string` — the pure dispatch over the closed `OutputFormat` enum: `terminal` → `renderTerminal`, `html` → `renderHtml`, `markdown` → `renderMarkdown`, `json` → `serializeReportJson`; a closed `switch` + an `assertNever` exhaustiveness guard (a new format becomes a compile error here). No clock/I/O/random — every renderer is already pure.
  - [ ] `DEFAULT_OUTPUT_BASENAME = "commit-sage-report"` + `FILE_EXTENSION: Record<"html"|"markdown"|"json", string>` (`html`/`md`/`json`) — the default-path building blocks.

- [ ] **Task 2 — Pure output-target planner (AC3) [src/render/output-plan.ts] (new).**
  - [ ] `type OutputDestination = { kind: "stdout" } | { kind: "file"; path: string }`; `interface OutputTarget { format: OutputFormat; destination: OutputDestination }`.
  - [ ] `planOutputs(formats, outputPath?): OutputTarget[]` — pure, deterministic. De-dupe `formats` preserving first-seen order. `terminal` → `stdout`. A file format (`html`/`markdown`/`json`): `outputPath === "-"` → `stdout`; `outputPath` a real path → that path **only when exactly one file format is selected**, else throw `UsageError` (exit 2 — ambiguous: a single `--output` cannot address multiple files); `outputPath` absent → the default `./commit-sage-report.{ext}`. Returns the targets in the de-duped format order. (`render/` may import `shared/errors` — correct layering.)

- [ ] **Task 3 — Wire the multi-format dispatch + file writing into the pipeline (AC1, AC2, AC3) [src/cli/run.ts].**
  - [ ] After `report` is assembled, replace the terminal-only render with: `const targets = planOutputs(config.outputFormats, config.outputPath)`; for each target, `renderFormat(report, target.format)` (wrap a throw in `RenderError`, exit 7), then **emit**: `stdout` → `writeStdout` (preserve the existing trailing-newline guarantee for terminal); `file` → `await writeFile(path, text)` (wrap a throw in `RenderError` naming the path) then `ui.info("Wrote <format> → <path>")` (stderr run-summary chrome — UX-DR5 lite). The exit code is unchanged: `report.degraded ? Degraded : Success`.
  - [ ] Add `writeFile?: (path: string, content: string) => Promise<void>` to `RunDeps`, defaulting to a thin wrapper over `node:fs/promises` `writeFile` (UTF-8). Injected so the pipeline stays offline/testable; the default is the only new real I/O edge.
  - [ ] Preserve back-compat: the default `outputFormats: ["terminal"]` ⇒ exactly one `stdout` terminal render ⇒ existing run/e2e stdout assertions and exit codes are unchanged.

- [ ] **Task 4 — `--format` / `--output` CLI flags (AC1, AC3) [src/cli/cli.ts].**
  - [ ] `--format <list>` — a comma-separated list; split + trim + validate each against the closed enum `{terminal, html, markdown, json}` (an unknown token → a `UsageError` naming the valid set), de-dupe preserving order, `≥1` → `flags.outputFormats`. `--output <path>` (alias `-o`) → `flags.outputPath` (trimmed; `-` preserved). Both are non-secret config-data flags (highest precedence over the existing `COMMIT_SAGE_FORMAT` / `COMMIT_SAGE_OUT` env layer, which already parses them).
  - [ ] Help text: `--format` "one or more of terminal,html,markdown,json (comma-separated)"; `--output`/`-o` "output path for the single file format ('-' = stdout)".

- [ ] **Task 5 — Tests (AC1, AC2, AC3).**
  - [ ] **`render.test.ts`:** `serializeReportJson` round-trips through `parseReport` and is byte-identical across two calls (determinism) + ends with a newline; `renderFormat` routes each of the four formats to recognizably the right output (terminal banner text vs `<!doctype html>` vs `## Summary`/`# commit-sage` vs the JSON `"schemaVersion"`), for both a showpiece and a substrate report.
  - [ ] **`output-plan.test.ts`:** `terminal` → stdout; a single file format, no path → its default `./commit-sage-report.{ext}`; `-` → stdout; one file format + explicit path → that path; **two file formats + one explicit path → `UsageError`**; `--format html,markdown,json` (no path) → three file targets at the three default paths; de-dupe preserves order; `terminal,json` → terminal=stdout + json=default file.
  - [ ] **`run.test.ts` (extend):** with an injected `writeFile` recorder — `--format json -o -` writes the canonical JSON to **stdout** (and it `parseReport`s); `--format json` (no path) calls `writeFile("commit-sage-report.json", <json>)` and writes **nothing** to stdout (machine-clean) + emits a stderr "Wrote" line; `--format terminal,html` writes terminal to stdout AND `writeFile("commit-sage-report.html", <html>)`; a `writeFile` rejection → `RenderError` (exit 7) naming the path; multi-format shares ONE report (narrate called at most once — assert call count); the default (`["terminal"]`) path is unchanged (terminal on stdout, exit code intact).
  - [ ] **`cli.test.ts` / `cli.e2e.test.ts` (extend):** `--format json,html -o report.json` → a `UsageError` (exit 2, ambiguous); `--format bogus` → a `UsageError` naming the valid set; an e2e `--no-ai --format json -o -` run emits a parseable canonical Report JSON on stdout (exit 0) with the `analysis` subtree and no `narrative`.

## Dev Notes

### Scope discipline — what this story does and does NOT include

**In scope:** the canonical Report-JSON serializer; the pure per-format render dispatch (`renderFormat`) over the four renderers; the pure output-target planner (default paths · `-`=stdout · terminal-native · single-path-ambiguity guard); wiring multi-format render + file writing into `runPipeline` (with an injected `writeFile`); the `--format` / `--output` CLI flags; the per-artifact stderr run-summary line. All deterministic, offline-testable.

**Out of scope / deferred (do NOT build here):**
- **HTML auto-open in the browser + `--no-open`** — that is **Story 4.5** (the next story). 4.4 writes the HTML file and prints its path; it does not open anything. [Source: epics.md#Story 4.5]
- **Masthead/footer provenance + the cap line + the Buy-Me-a-Coffee link** — still deferred across 4.1/4.2/4.3; needs a Report-JSON metadata subtree not yet in the schema. The JSON output emits exactly today's schema (`schemaVersion` · `degraded` · `analysis` · `narrative?`). [Source: 4.1/4.2/4.3 deferrals]
- **Interactive multi-select format prompt + the `~/.commit-sage` config-file format default** — Epic 6 (the launchpad/guided prompts + Settings). 4.4 drives formats from the existing flag/env/default resolver layers only (the config-file layer is still `{}` until Epic 6). [Source: epics.md#Epic 6, resolve-run-config.ts]
- **Schema versioning / migration of the Report JSON** — the schema is fixed at `1.0.0`; 4.4 only serializes it. [Source: report-schema.ts]
- **Atomic write (temp+rename) / directory creation / overwrite prompts** — 4.4 writes the file directly (overwriting an existing artifact, the expected report behavior) via `writeFile`; the atomic temp+rename pattern is the Settings/config-write concern (Epic 6). A write failure surfaces as a typed `RenderError` (exit 7) naming the path. [Source: architecture.md, Epic 6 Settings]

### The contracts to build on (do NOT redefine)

- **`OutputFormat` / `ConfigData.outputFormats` / `ConfigData.outputPath` (1.2):** the closed format enum and the already-resolved multi-select fields. `outputFormats` defaults to `["terminal"]`; `COMMIT_SAGE_FORMAT` (comma list) + `COMMIT_SAGE_OUT` are **already parsed** by the env layer — 4.4 adds only the matching `--format` / `--output` flags + the consumer. [Source: src/config/run-config.ts, src/config/env.ts, src/config/sources.ts]
- **`assembleReport` / `reportFromOutcome` / `parseReport` / `Report` (1.7):** the single in-memory canonical report the pipeline already builds; `parseReport` is the read-back the JSON serializer round-trips against. [Source: src/assemble/report.ts]
- **`renderTerminal` (1.8) · `renderHtml` (4.1/4.2) · `renderMarkdown` (4.3):** the three pure `Report → string` renderers; 4.4 adds `json` and the dispatch over all four. Each is already pure + escaped + deterministic. [Source: src/render/terminal/…, src/render/html/…, src/render/markdown/…]
- **`runPipeline` + `RunDeps` (1.8):** the orchestration that currently renders terminal-only to `writeStdout`. 4.4 generalizes the final render step to the planned targets and adds the injected `writeFile`. Everything before the render step (gate band · retrieve · select · analyze · narrate · assemble) is **unchanged**. [Source: src/cli/run.ts]
- **`UsageError` (2) / `RenderError` (7) + `ExitCode` (1.3):** the ambiguous-path usage error and the write-failure render error; codes unchanged. [Source: src/shared/errors.ts, src/cli/exit-codes.ts]

### Architecture decisions (read first)

- **Render stays a pure function of the Report JSON; the CLI shell owns the side effects.** `renderFormat` / `serializeReportJson` / `planOutputs` are pure (no clock/I/O/random) and live under `render/` (`no-console`, no `fs`). The ONLY new I/O — writing a file — lives in `runPipeline` (`cli/`, the shell that owns side effects) behind an **injected `writeFile`**, exactly as `writeStdout` is injected, so the whole pipeline still runs offline in tests. This preserves the hexagonal boundary and the "render is a pure function of JSON" rule. [Source: architecture.md#render is a pure function of JSON, eslint.config.js]
- **One Report, many formats — by construction.** The four renderers each take the SAME already-assembled `report`; multi-format is a `map` over `planOutputs`, so re-analysis or a second LLM call is structurally impossible (the report is built once, upstream of the render step). The shared `classifyReport` keeps every format's showpiece/substrate routing identical. [Source: src/render/render.port.ts]
- **Canonical JSON determinism = key order + byte-stable analysis.** `assembleReport` builds the report with a fixed key order (`schemaVersion` · `degraded` · `analysis` · `narrative?`) and the `analysis` subtree is byte-stable (C2); `JSON.stringify(report, null, 2)` therefore yields a deterministic, diff-stable artifact. The round-trip-through-`parseReport` test is the lock-in. [Source: src/assemble/report.ts, architecture.md C2]
- **stdout = machine-only, stderr = human chrome (unchanged discipline).** A `json` (or any file format) emitted to `-` goes to stdout **clean** (no chrome interleaved); the "Wrote … → path" run-summary line and any cap/degraded warning go to **stderr** via `ui`. So `--format json -o - | jq` and `> report.json` are uncorrupted. When only file formats are selected (no `terminal`), **nothing** goes to stdout. [Source: architecture.md#stream discipline, src/shared/ui.ts]
- **Single `--output` + multiple file formats = a usage error, not a silent guess.** One path cannot address three files; rather than silently overwriting or inventing names, `planOutputs` throws a typed `UsageError` (exit 2) — the multi-file case is served by the per-extension defaults (`--format html,markdown,json` → three default-named files). [Source: this story; FR-13 "predictable artifact output paths"]

### Determinism, security & purity (the render rules — unchanged)

- **Pure dispatch/serialize/plan** — identical `report` ⇒ byte-identical output for every format; no clock/I/O/random/env in `render/`. [Source: architecture.md, eslint.config.js]
- **No new dependencies** — `node:fs/promises` is a built-in (the `writeFile` default in `cli/`); the renderers add nothing. [Source: architecture.md]
- **Secrets never reach output** — the report carries no secrets (keys are env-only, never in `analysis`/`narrative`); the JSON is the same already-secret-free report. No new exposure surface. [Source: NFR-1, src/assemble/report-schema.ts]
- **Path handling** — `writeFile` receives the resolved path string as-is (a user-chosen artifact path); no shell, no interpolation, no traversal beyond what the user typed (they own the path). The default basename is a constant. [Source: securityRequirements]

### Previous-story intelligence

- **4.1/4.2/4.3 built the three pure renderers behind the SAME `classifyReport` seam; 4.4 is the dispatcher + writer that finally wires them to the CLI.** No renderer changes — only a new `json` serializer + the dispatch + the plan + the pipeline wiring + two flags. [Source: src/render/*]
- **The config layer was built format-ready in 1.2:** `outputFormats`/`outputPath` fields, `COMMIT_SAGE_FORMAT`/`COMMIT_SAGE_OUT` env parsing, the `["terminal"]` default. 4.4 consumes what was reserved — minimal new config surface (just the two flags). [Source: src/config/*]
- **Back-compat is load-bearing:** the default `["terminal"]` must keep rendering terminal to stdout with the same trailing-newline + exit codes, or the 1.8 run/e2e suite breaks. Keep the terminal-stdout path byte-identical. [Source: src/cli/run.test.ts, src/cli/cli.e2e.test.ts]
- **Determinism + escaping carry over** — the JSON is byte-stable; the HTML/MD escaping already holds at their boundaries; 4.4 adds no new interpolation, only serialization + file writing. [Source: 4.1/4.2/4.3 reviews]

### References

- [Source: docs/planning-artifacts/epics.md#Story 4.4: JSON output and multi-select formats] (the ACs) · [Source: …#FR-12] (canonical Report JSON) · [Source: …#FR-13] (emit/render selected formats, default paths, `-`=stdout, multi-select) · [Source: …#FR-15] (headless artifact paths)
- [Source: docs/planning-artifacts/architecture.md#render is a pure function of JSON / stream discipline / JSON output path writes the canonical Report JSON directly]
- [Source: src/cli/run.ts] (the pipeline to extend) · [Source: src/cli/cli.ts] (the flag surface) · [Source: src/assemble/report.ts] (`assembleReport`/`parseReport`) · [Source: src/render/render.port.ts] (`classifyReport`) · [Source: src/render/terminal/terminal-renderer.ts, src/render/html/html-renderer.ts, src/render/markdown/markdown-renderer.ts] (the three renderers) · [Source: src/config/run-config.ts, src/config/env.ts, src/config/sources.ts] (`outputFormats`/`outputPath`)

## Dev Agent Record

### Completion Notes (Amelia)

The Epic 4 integration story — wires the three pure renderers (HTML 4.1/4.2, Markdown 4.3) + a new canonical JSON serializer into the CLI run with multi-format output + file writing. 618 tests pass (+33 over 4.3); typecheck/lint/build all green. Zero new dependencies (`node:fs/promises` is a builtin). Bundle grew 102.66 → 141.92 KB (expected — the HTML/Markdown renderers are now reachable from the CLI run path, no longer tree-shaken out of the terminal-only build).

- **`src/render/render.ts`** (new) — `serializeReportJson(report)` = `JSON.stringify(report, null, 2)` + trailing newline (deterministic; round-trips through `parseReport`); `renderFormat(report, format)` = a closed `switch` over `OutputFormat` (terminal/html/markdown/json) + an `assertNeverFormat` exhaustiveness guard; `DEFAULT_OUTPUT_BASENAME` + `FILE_EXTENSION`. Pure, `no-console`, no I/O.
- **`src/render/output-plan.ts`** (new) — `planOutputs(formats, outputPath?): OutputTarget[]`, pure: de-dupe preserving first-seen order; `terminal` → stdout; a file format → `-`→stdout / explicit path (only when EXACTLY ONE file format — else a `UsageError`) / default `./commit-sage-report.{ext}`. The single-`--output`-but-many-files ambiguity is a typed exit-2 error, never a silent guess.
- **`src/cli/write-file.ts`** (new) — the injectable `WriteFile` type + `defaultWriteFile` (`node:fs/promises`, UTF-8). The ONE new real I/O edge, isolated in `cli/` (the shell owns side effects) so the pipeline stays offline-testable.
- **`src/cli/run.ts`** (edit) — the terminal-only render step is now: `planOutputs(config.outputFormats, config.outputPath)` → for each target, `renderFormat` (throw → `RenderError` exit 7) → emit: stdout via `writeStdout` (preserving the trailing-newline guarantee) or file via the injected `writeFile` (throw → `RenderError` naming the path) + a stderr `ui.info("Wrote <format> → <path>")` run-summary line. The report is built ONCE upstream, so multi-format is a `map` — re-analysis / a second LLM call are structurally impossible. Exit code unchanged (`degraded ? 9 : 0`).
- **`src/cli/cli.ts`** (edit) — `--format <list>` (comma list, strict-validated against the closed enum, de-duped, ≥1) + `-o, --output <path>` (`-` preserved). `buildFlags` refactored into `applyAiFlags`/`applyOutputFlags`/`applySelectionFlags` to hold cognitive complexity ≤ 15.

**End-to-end verified on the real repo:** `--format json -o -` emits clean canonical JSON to stdout (32 metrics, exit 0, chrome on stderr); `--format markdown,html,json` writes the three default-named artifacts (HTML 60k, well under 1 MB) with the stderr run summary.

**Deferred (unchanged):** HTML auto-open + `--no-open` (Story 4.5, next); masthead/footer provenance (needs a Report-JSON metadata subtree); interactive multi-select prompt + `~/.commit-sage` config-file format default (Epic 6). No schema change (Report fixed at 1.0.0).

### Review (3-layer adversarial) — unanimous accept, 0 patches

- **Acceptance Auditor — all 3 ACs MET, scope held, 0 must-fix.** Verified one-report-many-formats with narrate called exactly once (AC1); canonical JSON serialized deterministically + round-trips through `parseReport` (AC2); default paths / `-`=stdout / terminal-native / single-`--output` ambiguity → exit 2 / paths on stderr / stdout machine-clean (AC3). Confirmed no auto-open, no provenance, no schema change, no new deps, render purity preserved, back-compat intact.
- **Blind Hunter — 0 defects.** Stream discipline (no chrome on stdout, `-o -` JSON uncorrupted), determinism (byte-stable serialize, array-dedupe order preserved), error handling (renderer + writeFile throws → RenderError exit 7, properly awaited), security (no code-introduced path injection, no secret in output), and lint/style all clean.
- **Edge Case Hunter — 0 crashes / 0 data corruption; 1 Medium DISMISSED.** Walked planOutputs (empty/dup/terminal/multi-file/`-`/ambiguity), renderFormat/serialize (substrate/zero-metrics/trailing-newline/exhaustiveness), the multi-format loop (narrate-once, mid-loop throw, file-write rejection, stdout-only newline), and cli parseFormats (empty/whitespace/invalid/case/dedupe). **DISMISSED:** the flag-strict (`--format json,bogus` throws) vs env-lenient (`COMMIT_SAGE_FORMAT=json,bogus` drops the bad token) `parseFormats` divergence is the codebase's ESTABLISHED two-tier convention — `env.ts` `parseProvider`/`parsePositiveInt`/`parseAiMode` are all lenient (fall through resolver precedence), while `cli.ts` `--provider`/`--max-commits`/dates all throw. My `--format` flag correctly matches the strict-flag side; touching `env.ts` would break the deliberate lenient-env model and is out of scope (Story 1.2 code).

**Patches applied:** 0. **Tests added:** 0 (the 33 co-located tests already cover every boundary the hunters enumerated). All gates green (618 tests).

### File List

- `src/render/render.ts` (new) · `src/render/render.test.ts` (new)
- `src/render/output-plan.ts` (new) · `src/render/output-plan.test.ts` (new)
- `src/cli/write-file.ts` (new)
- `src/cli/run.ts` (modified) · `src/cli/run.test.ts` (modified)
- `src/cli/cli.ts` (modified) · `src/cli/cli.test.ts` (modified) · `src/cli/cli.e2e.test.ts` (modified)
