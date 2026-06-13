/**
 * Metric registry (Story 1.5).
 *
 * The single ordered list of every registered metric, each paired with its spec
 * so the engine knows its identity even if the computation throws. Group A is
 * implemented now; Groups B–F (Epic 2) append to `ALL_METRICS` here, so the
 * engine never changes. Order is stable and defines the output order.
 */

import type { RegisteredMetric, RegisteredRollup } from "./model.js";
import { GROUP_A_METRICS } from "./groups/a-cadence.js";
import { GROUP_B_METRICS } from "./groups/b-contribution.js";
import { GROUP_C_METRICS } from "./groups/c-message-quality.js";
import { GROUP_D_METRICS } from "./groups/d-branching.js";
import { GROUP_E_METRICS } from "./groups/e-churn.js";
import { GROUP_F_ROLLUPS } from "./groups/f-health.js";

export type { RegisteredMetric, RegisteredRollup };

/** Every base metric the engine runs over the model, in stable output order (Groups A–E). */
export const ALL_METRICS: RegisteredMetric[] = [
  ...GROUP_A_METRICS,
  ...GROUP_B_METRICS,
  ...GROUP_C_METRICS,
  ...GROUP_D_METRICS,
  ...GROUP_E_METRICS,
];

/** Every roll-up the engine runs over the computed base metrics (Group F), after the base pass. */
export const ALL_ROLLUPS: RegisteredRollup[] = [...GROUP_F_ROLLUPS];
