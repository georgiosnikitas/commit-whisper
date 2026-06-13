/**
 * The format-agnostic showpiece-vs-substrate render-path branch (Story 1.8 —
 * Fail-Open & Metrics-Only #4, C3, I1).
 *
 * Every renderer (terminal now; HTML/Markdown/JSON in Epic 4) routes a `Report`
 * down exactly one of two paths off the SAME Report JSON:
 *   - showpiece — the narrated hero render; its input type REQUIRES the
 *     `narrative` subtree, so a substrate Report (no `narrative`) cannot
 *     type-check into it and can never *masquerade* as the showpiece.
 *   - substrate — a plainer, analysis-only render that carries the metric
 *     analysis but omits the narrative bands, framed either as an intentional
 *     metrics-only run or a fail-open degraded one.
 *
 * `classifyReport` is the pure (no-I/O) router shared by all formats.
 */

import type { Report, ReportAnalysis, ReportNarrative } from "../assemble/report-schema.js";

/**
 * A `Report` whose `narrative` subtree is GUARANTEED present. The showpiece
 * renderer accepts ONLY this type — the compile-time encoding of "the narrated
 * report needs AI." A substrate `Report` (optional/absent `narrative`) is not
 * assignable here.
 */
export interface ShowpieceReport extends Report {
  narrative: ReportNarrative;
}

/**
 * Why a substrate render carries no narrative: an intentional `--no-ai`
 * metrics-only run (neutral note) vs a fail-open degraded run (loud banner).
 */
export type SubstrateFraming = "metrics-only" | "degraded";

/** The render-path branch a `Report` routes to — format-agnostic. */
export type RenderRoute =
  | { kind: "showpiece"; report: ShowpieceReport }
  | { kind: "substrate"; analysis: ReportAnalysis; framing: SubstrateFraming };

/**
 * Pure render-path classifier. `narrative` present ⇒ showpiece; absent +
 * `degraded` ⇒ substrate `"degraded"`; absent + not degraded ⇒ substrate
 * `"metrics-only"`. The `narrative`-present branch narrows the report to a
 * `ShowpieceReport` so the caller hands the showpiece renderer a
 * narrative-guaranteed value.
 */
export function classifyReport(report: Report): RenderRoute {
  const { narrative } = report;
  if (narrative !== undefined) {
    return { kind: "showpiece", report: { ...report, narrative } };
  }
  return {
    kind: "substrate",
    analysis: report.analysis,
    framing: report.degraded ? "degraded" : "metrics-only",
  };
}
