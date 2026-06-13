/**
 * Metric registry (Story 1.5).
 *
 * The single ordered list of every registered metric, each paired with its spec
 * so the engine knows its identity even if the computation throws. Group A is
 * implemented now; Groups B–F (Epic 2) append to `ALL_METRICS` here, so the
 * engine never changes. Order is stable and defines the output order.
 */

import type { RegisteredMetric } from "./model.js";
import { GROUP_A_METRICS } from "./groups/a-cadence.js";
import { GROUP_B_METRICS } from "./groups/b-contribution.js";
import { GROUP_C_METRICS } from "./groups/c-message-quality.js";

export type { RegisteredMetric };

/** Every metric the engine runs, in stable output order. */
export const ALL_METRICS: RegisteredMetric[] = [...GROUP_A_METRICS, ...GROUP_B_METRICS, ...GROUP_C_METRICS];
