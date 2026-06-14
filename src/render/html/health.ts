/**
 * Health-band classification (Story 4.2 — FR-6, render-owned per the §4.2 decision-log).
 *
 * The per-metric health band (`ok`/`watch`/`risk`/`na`) is DERIVED AT RENDER from
 * catalog-owned thresholds — domain knowledge that lives in the render layer, NOT
 * a Report-JSON field — so `analysis` stays byte-stable and one classifier is the
 * single consumer (no drift across formats). The band is shown by a
 * shape-differentiated GLYPH + a text LABEL (never color alone — NFR-8 / UX-DR14).
 *
 * A `not_available` metric is `na`. A computed metric with a registered threshold
 * is classified from its own value; a computed metric with NO registered threshold
 * defaults to `ok` — an honest "no concern flagged", never a fabricated alarm. The
 * registry below is a defensible baseline; tuning the full table is a later
 * refinement behind this same function.
 */

import type { ReportAnalysis } from "../../assemble/report-schema.js";

type Metric = ReportAnalysis["metrics"][number];

export type HealthBand = "ok" | "watch" | "risk" | "na";

/** Shape-differentiated glyphs — the SHAPE carries the signal, not color. */
export const HEALTH_GLYPH: Record<HealthBand, string> = {
  ok: "●",
  watch: "◐",
  risk: "▲",
  na: "○",
};

/** The always-present text label beside the glyph. */
export const HEALTH_LABEL: Record<HealthBand, string> = {
  ok: "ok",
  watch: "watch",
  risk: "risk",
  na: "n/a",
};

/** Read a finite numeric field from a metric value object (or `undefined`). */
function field(value: unknown, key: string): number | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const v = (value as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Higher field value is healthier: `>= okMin` ok · `>= watchMin` watch · else risk. */
function higherBetter(key: string, okMin: number, watchMin: number) {
  return (value: unknown): HealthBand => {
    const n = field(value, key);
    if (n === undefined) return "ok";
    if (n >= okMin) return "ok";
    if (n >= watchMin) return "watch";
    return "risk";
  };
}

/** Lower field value is healthier: `<= okMax` ok · `<= watchMax` watch · else risk. */
function lowerBetter(key: string, okMax: number, watchMax: number) {
  return (value: unknown): HealthBand => {
    const n = field(value, key);
    if (n === undefined) return "ok";
    if (n <= okMax) return "ok";
    if (n <= watchMax) return "watch";
    return "risk";
  };
}

/**
 * The render-owned threshold registry (documented domain knowledge). Each
 * classifier reads the metric's own value; thresholds are a defensible baseline.
 */
const REGISTRY: Record<string, (value: unknown) => HealthBand> = {
  // Knowledge concentration — fewer key people is riskier.
  "b-bus-factor": higherBetter("busFactor", 3, 2),
  "f-bus-factor-risk": higherBetter("busFactor", 3, 2),
  // Contribution concentration — a very high top share concentrates load.
  "b-contribution-distribution": lowerBetter("topCommitSharePct", 60, 80),
  // Message quality — higher Conventional-Commits adherence is healthier.
  "c-conventional-commits": higherBetter("adherenceSharePct", 70, 40),
  // Low-information commit messages — fewer is healthier.
  "c-low-information-rate": lowerBetter("lowInfoSharePct", 10, 25),
  // Workflow discipline — a high direct-to-default share is riskier.
  "d-direct-to-default": lowerBetter("directToDefaultSharePct", 20, 50),
  // Overall hygiene composite (0–100).
  "f-hygiene-score": higherBetter("score", 75, 50),
};

/**
 * Classify a metric's health band: `na` when not computed; else the registered
 * threshold over its value, or `ok` when no threshold is registered.
 */
export function classifyHealth(metric: Metric): HealthBand {
  if (metric.status === "not_available") {
    return "na";
  }
  const classifier = REGISTRY[metric.id];
  return classifier === undefined ? "ok" : classifier(metric.value);
}
