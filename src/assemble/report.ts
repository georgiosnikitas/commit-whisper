/**
 * Canonical Report JSON assembler (Story 1.7).
 *
 * `assembleReport` is a PURE function that joins the deterministic `analysis`
 * (always present, byte-stable — the trend-diff target) with the OPTIONAL AI
 * `narrative`, plus the top-level `degraded` marker. The metric envelopes are
 * passed through verbatim — never reordered, reformatted, re-keyed, or welded to
 * an explanation — so the `analysis` subtree's byte-stability is preserved.
 *
 * `reportFromOutcome` bridges the 1.6 `NarrateOutcome` to the assembler, encoding
 * the intentional-vs-degraded distinction: `narrated` ⇒ narrative present, not
 * degraded; `skipped` ⇒ narrative absent, not degraded (intentional metrics-only);
 * `degraded` ⇒ narrative absent, degraded (fail-open). `parseReport` is the C1
 * "Report-JSON-in" read-back validation.
 */

import type { Analysis } from "../analyze/engine.js";
import type { Narrative, NarrateOutcome } from "../narrate/narrate.port.js";
import { ReportSchema, SCHEMA_VERSION, type Report, type ReportProvenance } from "./report-schema.js";

export interface AssembleInput {
  analysis: Analysis;
  narrative?: Narrative;
  degraded: boolean;
  /** OPTIONAL run-metadata subtree (Story 4.7 — FR-17); attached verbatim, never welded into `analysis`. */
  provenance?: ReportProvenance;
}

export function assembleReport(input: AssembleInput): Report {
  // Deep-copy so the report OWNS its data: a later mutation of the caller's
  // `analysis`/`narrative`/`provenance` can never poison an already-assembled (byte-stable) report.
  const report: Report = {
    schemaVersion: SCHEMA_VERSION,
    degraded: input.degraded,
    analysis: structuredClone(input.analysis),
  };
  if (input.narrative !== undefined) {
    report.narrative = structuredClone(input.narrative);
  }
  if (input.provenance !== undefined) {
    report.provenance = structuredClone(input.provenance);
  }
  return report;
}

/** Bridge a narrate outcome (Story 1.6) to a canonical Report (the CLI shell uses this in 1.8). */
export function reportFromOutcome(analysis: Analysis, outcome: NarrateOutcome, provenance?: ReportProvenance): Report {
  switch (outcome.kind) {
    case "narrated":
      return assembleReport({ analysis, narrative: outcome.narrative, degraded: false, provenance });
    case "skipped":
      return assembleReport({ analysis, degraded: false, provenance: withoutAi(provenance) }); // intentional metrics-only
    case "degraded":
      return assembleReport({ analysis, degraded: true, provenance: withoutAi(provenance) }); // fail-open, narrative lost
    default:
      return assertNever(outcome);
  }
}

/**
 * Drop the `ai` field: the provider/model are recorded ONLY when narration ran, so
 * a `--no-ai` metrics-only run and a fail-open degraded run carry no `ai` subtree —
 * mirroring the `narrative`-subtree presence rule exactly (FR-17).
 */
function withoutAi(provenance: ReportProvenance | undefined): ReportProvenance | undefined {
  if (provenance?.ai === undefined) {
    return provenance;
  }
  const rest: ReportProvenance = { ...provenance };
  delete rest.ai;
  return rest;
}

/** Compile-time exhaustiveness guard: a new `NarrateOutcome` variant becomes a type error here. */
function assertNever(value: never): never {
  throw new Error(`Unhandled narrate outcome: ${JSON.stringify(value)}`);
}

/** Read-back validation (C1 checkpoint 3): parse + schema-validate a serialized report. */
export function parseReport(json: string): Report {
  return ReportSchema.parse(JSON.parse(json));
}
