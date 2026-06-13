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
import { ReportSchema, SCHEMA_VERSION, type Report } from "./report-schema.js";

export interface AssembleInput {
  analysis: Analysis;
  narrative?: Narrative;
  degraded: boolean;
}

export function assembleReport(input: AssembleInput): Report {
  // Deep-copy so the report OWNS its data: a later mutation of the caller's
  // `analysis`/`narrative` can never poison an already-assembled (byte-stable) report.
  const report: Report = {
    schemaVersion: SCHEMA_VERSION,
    degraded: input.degraded,
    analysis: structuredClone(input.analysis),
  };
  if (input.narrative !== undefined) {
    report.narrative = structuredClone(input.narrative);
  }
  return report;
}

/** Bridge a narrate outcome (Story 1.6) to a canonical Report (the CLI shell uses this in 1.8). */
export function reportFromOutcome(analysis: Analysis, outcome: NarrateOutcome): Report {
  switch (outcome.kind) {
    case "narrated":
      return assembleReport({ analysis, narrative: outcome.narrative, degraded: false });
    case "skipped":
      return assembleReport({ analysis, degraded: false }); // intentional metrics-only
    case "degraded":
      return assembleReport({ analysis, degraded: true }); // fail-open, narrative lost
    default:
      return assertNever(outcome);
  }
}

/** Compile-time exhaustiveness guard: a new `NarrateOutcome` variant becomes a type error here. */
function assertNever(value: never): never {
  throw new Error(`Unhandled narrate outcome: ${JSON.stringify(value)}`);
}

/** Read-back validation (C1 checkpoint 3): parse + schema-validate a serialized report. */
export function parseReport(json: string): Report {
  return ReportSchema.parse(JSON.parse(json));
}
