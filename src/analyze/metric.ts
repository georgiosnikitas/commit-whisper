/**
 * The uniform metric envelope (Story 1.5 — C2).
 *
 * Every metric in the catalog returns this exact shape — it is the whole of what
 * lands in the Report JSON `analysis` subtree (Story 1.7). It is kept PURE: no AI
 * Metric Explanation is welded in (that joins later by `id` under
 * `narrative.explanations[id]`), and no health band (that is a render-time
 * classifier). The two constructors guarantee the `computed`/`not_available`
 * invariant by construction: a computed metric carries a `value` and no `reason`;
 * an unavailable metric carries a `reason` and no `value` (never silently omitted).
 */

export type MetricStatus = "computed" | "not_available";

export type MetricGroup = "A" | "B" | "C" | "D" | "E" | "F";

/** A JSON-serializable metric value (no `Date`/`Map`/`Set` — determinism). */
export type MetricValue =
  | number
  | string
  | boolean
  | null
  | MetricValue[]
  | { [key: string]: MetricValue };

/** Identity of a metric, independent of its computed outcome. */
export interface MetricSpec {
  id: string; // stable kebab id, e.g. "a-commit-cadence"
  group: MetricGroup;
  title: string;
}

export interface Metric {
  id: string;
  group: MetricGroup;
  title: string;
  status: MetricStatus;
  value?: MetricValue; // present iff status === "computed"
  reason?: string; // present iff status === "not_available"
}

/** Build a `computed` metric envelope from a spec + its value. */
export function computed(spec: MetricSpec, value: MetricValue): Metric {
  return { id: spec.id, group: spec.group, title: spec.title, status: "computed", value };
}

/** Build a `not_available` metric envelope from a spec + a reason (never omitted). */
export function notAvailable(spec: MetricSpec, reason: string): Metric {
  return { id: spec.id, group: spec.group, title: spec.title, status: "not_available", reason };
}