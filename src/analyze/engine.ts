/**
 * The metrics engine (Story 1.5 — C2 hybrid topology; roll-up pass added Story 2.5).
 *
 * `analyze` builds the shared normalized model ONCE, then maps every registered
 * metric over it in registry order, collecting uniform envelopes. It is a pure
 * function of `(history, ctx)` — no clock, no env, no filesystem. A metric that
 * throws is converted to a `not_available` envelope using its registered spec
 * (a bug in one metric never sinks the run or silently drops the metric, AC3),
 * so engine output is total and deterministic.
 *
 * Group F (Story 2.5) is a ROLL-UP: it consumes the computed A–E envelopes rather
 * than the raw model. After the base metric pass, the engine indexes the results
 * by `id` and runs each registered roll-up over that index, appending the roll-up
 * metrics to the same `metrics` array (stable order A–E then F). Roll-ups are pure
 * functions of `(computedMetrics, ctx)` — deterministic by construction.
 */

import type { RepoHistory } from "../retrieve/retrieve.port.js";
import type { Metric } from "./metric.js";
import { notAvailable } from "./metric.js";
import type { AnalysisContext, RegisteredMetric, RegisteredRollup, RepoModel } from "./model.js";
import { buildModel } from "./model.js";
import { ALL_METRICS, ALL_ROLLUPS } from "./registry.js";

export type { RollupFn, RegisteredRollup } from "./model.js";

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

function runRollup(entry: RegisteredRollup, byId: ReadonlyMap<string, Metric>, ctx: AnalysisContext): Metric {
  try {
    return entry.fn(byId, ctx);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "roll-up computation failed";
    return notAvailable(entry.spec, `Metric computation failed: ${reason}`);
  }
}

export function analyze(
  history: RepoHistory,
  ctx: AnalysisContext,
  metrics: RegisteredMetric[] = ALL_METRICS,
  rollups: RegisteredRollup[] = ALL_ROLLUPS,
): Analysis {
  const model = buildModel(history, ctx); // built ONCE
  const baseMetrics = metrics.map((entry) => runMetric(entry, model, ctx));
  // Index the base results by id, then run the roll-ups (Group F) over them.
  const byId = new Map(baseMetrics.map((metric) => [metric.id, metric]));
  const rollupMetrics = rollups.map((entry) => runRollup(entry, byId, ctx));
  return { metrics: [...baseMetrics, ...rollupMetrics] };
}
