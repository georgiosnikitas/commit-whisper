/**
 * Deterministic confidence self-assessment (Story 3.5 — FR-10).
 *
 * A PURE, no-LLM, no-clock, no-I/O assessment of how trustworthy a narrated run
 * is. The architecture pairs it with grounding: "unreferenced claims fail the
 * confidence check and trigger the FR-10 low-confidence escalation. Cheaper,
 * reproducible, cannot itself hallucinate." So this is computed — never
 * generated — from three measurable signals:
 *   1. verification PASS RATE   — the Story-3.4 grounding report (grounded ÷ total
 *      numeric claims);
 *   2. `not_available` SHARE    — availability = computed ÷ total metrics (a
 *      tiny/young repo is inherently less certain, so it GATES `high` but never
 *      forces `low` on its own);
 *   3. provider/runtime SIGNAL  — explanation COVERAGE = metrics that received an
 *      explanation ÷ total metrics (a failed per-group batch (Story 3.3) or an
 *      incomplete model response (Story 3.2) lowers it — the "weak/generic output"
 *      runtime signal). The provider/model NAME is used only in the escalation
 *      text, not the score (judging by provider identity would be unfair/brittle).
 *
 * A `low` rating carries an `escalation` that explicitly recommends a stronger
 * model and NAMES the config to change (`COMMIT_WHISPER_PROVIDER` /
 * `COMMIT_WHISPER_LLM_MODEL`). Confidence is a quality signal carried under the
 * Report `narrative` subtree — it never changes the exit code (a low-confidence
 * narrated run is still a clean showpiece).
 */

import type { Analysis } from "../analyze/engine.js";
import type { Provider } from "../config/run-config.js";
import type { GroundingReport } from "./grounding.js";
import type { Confidence, ConfidenceLevel, MetricExplanations } from "./schema.js";

// — Threshold constants ([ASSUMPTION]: calibrated against real model output later) —
/** Below this grounding pass rate, the run is `low` (many fabricated claims). */
export const LOW_PASS_RATE = 0.5;
/** Below this explanation coverage, the run is `low` (half the metrics unexplained). */
export const LOW_COVERAGE = 0.5;
/** At/above this pass rate (with the other `high` gates), the run may be `high`. */
export const HIGH_PASS_RATE = 0.9;
/** At/above this coverage (with the other `high` gates), the run may be `high`. */
export const HIGH_COVERAGE = 0.9;
/** `high` requires at least this availability (the `not_available` share gates `high`). */
export const MIN_AVAILABILITY_FOR_HIGH = 0.5;

export interface ConfidenceInput {
  grounding: GroundingReport;
  analysis: Analysis;
  explanations?: MetricExplanations;
  provider?: Provider;
  llmModel?: string;
}

/** A ratio in [0,1]; an empty denominator is a vacuous 1 (nothing to doubt). */
function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

/** Round a [0,1] ratio to a whole percentage for the rationale text. */
function pct(value: number): number {
  return Math.round(value * 100);
}

/** Classify the three sub-scores into a confidence level (documented thresholds). */
function classify(passRate: number, coverage: number, availability: number): ConfidenceLevel {
  if (passRate < LOW_PASS_RATE || coverage < LOW_COVERAGE) {
    return "low";
  }
  if (
    passRate >= HIGH_PASS_RATE &&
    coverage >= HIGH_COVERAGE &&
    availability >= MIN_AVAILABILITY_FOR_HIGH
  ) {
    return "high";
  }
  return "medium";
}

/**
 * The low-confidence escalation: recommend a stronger model and NAME the config
 * to change (AC2). The current provider/model are surfaced so the user knows what
 * they ran with.
 */
export function buildEscalation(provider: Provider | undefined, llmModel: string | undefined): string {
  const current = `${provider ?? "(unset)"}/${llmModel ?? "(unset)"}`;
  return (
    "Confidence is low — re-run with a stronger model. " +
    `Set COMMIT_WHISPER_PROVIDER and COMMIT_WHISPER_LLM_MODEL (currently ${current}) ` +
    "to a more capable provider/model."
  );
}

/**
 * Assess the run's confidence from the grounding report, the `not_available`
 * share, and the explanation coverage. Pure and deterministic.
 */
export function assessConfidence(input: ConfidenceInput): Confidence {
  const { grounding, analysis, explanations, provider, llmModel } = input;

  const passRate = ratio(grounding.totalClaims - grounding.ungroundedClaims, grounding.totalClaims);
  const totalMetrics = analysis.metrics.length;
  const computedCount = analysis.metrics.filter((metric) => metric.status === "computed").length;
  const explainedCount =
    explanations === undefined
      ? 0
      : analysis.metrics.filter((metric) => Object.hasOwn(explanations, metric.id)).length;
  const availability = ratio(computedCount, totalMetrics);
  const coverage = ratio(explainedCount, totalMetrics);

  const level = classify(passRate, coverage, availability);
  const rationale =
    `Grounding ${pct(passRate)}%, explanation coverage ${pct(coverage)}%, ` +
    `${pct(1 - availability)}% of metrics not available.`;

  return level === "low"
    ? { level, rationale, escalation: buildEscalation(provider, llmModel) }
    : { level, rationale };
}
