/**
 * The metrics engine (Story 1.5 — C2 hybrid topology).
 *
 * `analyze` builds the shared normalized model ONCE, then maps every registered
 * metric over it in registry order, collecting uniform envelopes. It is a pure
 * function of `(history, ctx)` — no clock, no env, no filesystem. A metric that
 * throws is converted to a `not_available` envelope using its registered spec
 * (a bug in one metric never sinks the run or silently drops the metric, AC3),
 * so engine output is total and deterministic.
 */

import type { RepoHistory } from "../retrieve/retrieve.port.js";
import type { Metric } from "./metric.js";
import { notAvailable } from "./metric.js";
import type { AnalysisContext, RegisteredMetric, RepoModel } from "./model.js";
import { buildModel } from "./model.js";
import { ALL_METRICS } from "./registry.js";

export interface Analysis {
  metrics: Metric[];
}

function runMetric(entry: RegisteredMetric, model: RepoModel, ctx: AnalysisContext): Metric {
  try {
    return entry.fn(model, ctx);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "metric computation failed";
    return notAvailable(entry.spec, `Metric computation failed: ${reason}`);
  }
}

export function analyze(
  history: RepoHistory,
  ctx: AnalysisContext,
  metrics: RegisteredMetric[] = ALL_METRICS,
): Analysis {
  const model = buildModel(history, ctx); // built ONCE
  return { metrics: metrics.map((entry) => runMetric(entry, model, ctx)) };
}
