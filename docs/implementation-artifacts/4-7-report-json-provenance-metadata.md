---
epic: 4
story: 7
title: Report-JSON provenance metadata + HTML masthead/footer chips (FR-17)
baseline_commit: 567f5e3
---

# Story 4.7: Report-JSON provenance metadata + HTML masthead/footer chips (FR-17)

Status: Done

<!-- Record-after-implementation story. FR-17 was scoped by the PM (prd.md §4.5) and implemented
     in the same pass; this file documents it. It unblocks the masthead/footer provenance chips
     that Story 4.1 deferred (no provenance subtree existed on the Report JSON). -->

## Story

As a user who shares a commit-whisper HTML report,
I want the masthead and footer to show the run's provenance — repo, branch, commit + contributor counts, AI provider/model, timestamp, tier, and the Free cap — sourced from the canonical Report JSON,
so that the report is self-describing and traceable without re-deriving its context, and the same facts appear across every render format.

## Acceptance Criteria

FR-17 (`docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md`). A new OPTIONAL third top-level `provenance` subtree on the Report, consumed by the HTML masthead ① and footer ⑦.

1. **Present → chips render (AC1).** **Given** a Report whose `provenance` carries repo/scale/ai/run/entitlement, **when** rendered to HTML, **then** the masthead shows `name · branch · N commits · C contributors · analyzed <date>` and the footer shows `commit-whisper v<ver> · schemaVersion 1.0.0 · <provider>/<model> · <timestamp>`.
2. **Absent → still renders, no empty chips (AC2).** **Given** a Report with **no** `provenance` (a pre-FR-17 Report), **when** rendered, **then** masthead ① and footer ⑦ render with zero provenance chips — no dangling separators, no `undefined`, no error; output stays byte-stable. Back-compat with every existing fixture.
3. **`--no-ai` → no provider/model chip (AC3).** **Given** `provenance.ai` is absent (metrics-only / degraded), **when** rendered, **then** no provider/model chip appears; all other present chips still render. The `ai` subtree is emitted ONLY when narration ran.
4. **Free tier → cap line "X of N" (AC4).** **Given** `entitlement.tier === "free"`, a `commitCap`, and `scale.totalCommits`, **then** the masthead shows the Free cap line (`Free · 100 of 1,204 commits analyzed`); a paid tier (no `commitCap`) renders no cap line.
5. **Determinism — `analysis` byte-identical (AC5).** **Given** two assemblies of identical inputs, one with and one without `provenance`, **when** each `analysis` subtree is serialized, **then** they are byte-identical; `provenance` never appears under `analysis`; the trend-diff target is unaffected.
6. **Security — no secret/token ever (AC6).** **Given** a remote run cloned from a token-bearing URL with a provider key set, **when** the JSON + HTML are emitted, **then** no API key / git token / credential substring appears anywhere, and `provenance.repo.target` is the credential-stripped URL.
7. **Cross-format parity (AC7 — FR-13).** **Given** a Report with `provenance`, **when** emitted as JSON and rendered as HTML, **then** the JSON carries the `provenance` subtree verbatim and the HTML masthead/footer show the same facts. (Markdown/Terminal rendering of provenance is the deferred fast-follow; JSON already carries it.)

**Invariants preserved:** pure `Report → string` render determinism; self-containment (no new network ref, no new dependency); HTML-escape on every interpolated provenance value (repo name/branch/target, provider/model, timestamp); the WCAG floor; and the narrative-first band order. `analysis` and `narrative` subtrees are untouched — `provenance` is a sibling, never welded in.

## Dev Notes

### Contract — the `provenance` subtree (read-back boundary, `.strict()`)

An OPTIONAL third top-level sibling on the Report, every leaf optional:

- `repo?` — `name`, credential-stripped `target`, `source: "local" | "remote"`, optional `branch`.
- `scale?` — `totalCommits?`, `analyzedCommits?`, `contributors?` (ints).
- `ai?` — `provider`, `model` — present ONLY when narration ran (absent on `--no-ai` / degraded).
- `run?` — `generatedAt` (ISO 8601, `== RunConfig.analysisTimestamp`, never `Date.now()`), `toolVersion`.
- `entitlement?` — `tier`, `commitCap?` (Free only).

### Determinism & security seam

`provenance` is RUN METADATA, not analysis: the run-varying fields (the timestamp, provider/model) live in `provenance`, never under the byte-stable `analysis` subtree, so the trend-diff target stays clean. A remote `repo.target` is credential-stripped at the builder (no `user:token@` / `x-access-token:…@` ever reaches the Report); every interpolated value is `escapeHtml`'d at the render boundary.

### Scope

**In:** the schema subtree, the CLI provenance builder, populate across retrieve/analyze/narrate/license/config, the assembler plumbing, and the HTML masthead/footer chips + Free cap line. **Deferred:** Markdown/Terminal provenance rendering (JSON already carries it verbatim) and the Buy-Me-a-Coffee link wiring.

## Dev Agent Record

### Completion Notes

- **Schema** (`src/assemble/report-schema.ts`): `ProvenanceSchema` (`.strict()`, all leaves optional) + `provenance: ProvenanceSchema.optional()` on `ReportSchema`; `ReportProvenance` type exported.
- **Builder** (`src/cli/provenance.ts`, new): assembles the subtree from `RunConfig` + stage outputs; strips credentials from a remote `repo.target`; emits `ai{}` only when narrated; sources `generatedAt` from `RunConfig.analysisTimestamp` and `toolVersion` from the package version.
- **Assembler** (`src/assemble/report.ts`): threads the optional `provenance` input and attaches it via `structuredClone`; `analysis` stays byte-identical.
- **Wiring** (`src/cli/run.ts`): builds and passes provenance through the retrieve→analyze→narrate→assemble flow.
- **Render** (`src/render/html/html-renderer.ts`): `masthead()`/`footer()` consume `report.provenance` and render only the chips present (`.prov-chips` row, `aria-hidden` separators), with the Free cap line; every value escaped.
- **Tests** added/extended across `report-schema.test.ts`, `report.test.ts`, `cli/provenance.test.ts`, `html-renderer.test.ts` covering all seven ACs (present/absent, `--no-ai`, Free cap, determinism, no-secret, escaping).
- **Gates:** `npm run test` → **962 passed** · `npm run typecheck` → clean · `npm run lint` → clean.

### Deferred / follow-up

- Markdown + Terminal provenance rendering (parity — JSON already carries it).
- Buy-Me-a-Coffee link in the Free footer.
- `scale.totalCommits` under a Free cap may need a cheap `git rev-list --count`; where unavailable the cap line degrades to the analyzed count alone.

### File List

**Added:** `src/cli/provenance.ts`, `src/cli/provenance.test.ts`

**Modified:** `src/assemble/report-schema.ts`, `src/assemble/report-schema.test.ts`, `src/assemble/report.ts`, `src/assemble/report.test.ts`, `src/cli/run.ts`, `src/render/html/html-renderer.ts`, `src/render/html/html-renderer.test.ts`, `docs/planning-artifacts/prds/prd-commit-whisper-2026-06-06/prd.md`, `docs/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Change |
|---|---|
| 2026-06-18 | FR-17 scoped (PM, prd.md §4.5 + Decision Log #20). Implemented: `provenance` subtree + CLI builder (credential-stripped, narrated-only `ai`) + assembler plumbing + HTML masthead/footer chips + Free cap line. Tests for all 7 ACs. 962 tests · typecheck · lint green. Status → Done. |
