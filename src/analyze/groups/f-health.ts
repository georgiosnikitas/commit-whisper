/**
 * Group F — Repository Health Signals (Story 2.5, PRD §4.2). The Epic 2 capstone.
 *
 * Group F is a ROLL-UP: each metric is a pure function of the COMPUTED A–E metric
 * envelopes (indexed by id), not the raw model — so the hygiene composite is a
 * transparent function of the catalog, never a re-derivation of Group A–E logic
 * (no drift). The engine runs these after the base pass (see `analyze`).
 *
 * Team-level only (NFR-8): the bus-factor risk flag consumes Group B's already-
 * anonymized bus-factor and frames it as risk to mitigate — no author identity
 * appears in any Group F value.
 *
 * Transparency (AC1): the hygiene score is a WEIGHTED AVERAGE of five component
 * sub-scores (each a documented 0–100 transform of one source metric), RENORMALIZED
 * over the components whose source is available — so a repo where one group could
 * not compute still gets a meaningful score, and the `components` array shows which
 * contributed. Determinism: a pure function of the deterministic A–E values.
 */

import type { Metric, MetricSpec } from "../metric.js";
import { computed, notAvailable } from "../metric.js";
import type { AnalysisContext, RegisteredRollup, RollupFn } from "../model.js";
import { compareCodeUnits } from "../model.js";
import { mean, round, stdev } from "../stats.js";

// ── Hygiene composite weights (catalog-owned domain knowledge, verbatim from PRD §4.2) ──
const WEIGHT_MESSAGE_QUALITY = 35;
const WEIGHT_COMMIT_SIZE = 20;
const WEIGHT_BRANCHING = 20;
const WEIGHT_COLLABORATION = 15;
const WEIGHT_CHURN_STABILITY = 10;

// ── [ASSUMPTION] sub-score transform thresholds ──
const GOOD_MEDIAN_LINES = 50; // commit-size median ≤ this ⇒ full commit-size sub-score
const POOR_MEDIAN_LINES = 500; // commit-size median ≥ this ⇒ zero commit-size sub-score
const STRENGTHS_TOP_N = 2; // best/worst dimensions surfaced for Coaching

export const HYGIENE: MetricSpec = { id: "f-hygiene-score", group: "F", title: "Overall hygiene score" };
export const BUS_FACTOR_RISK: MetricSpec = { id: "f-bus-factor-risk", group: "F", title: "Bus-factor risk flag" };
export const TREND_DELTAS: MetricSpec = { id: "f-trend-deltas", group: "F", title: "Trend deltas" };
export const STRENGTHS_WEAKNESSES: MetricSpec = { id: "f-strengths-weaknesses", group: "F", title: "Hygiene strengths & weaknesses" };

// ── Safe reads from the computed-metric index ──

/** The value object of a metric IF it is `computed` and object-shaped, else `undefined`. */
function computedValue(byId: ReadonlyMap<string, Metric>, id: string): Record<string, unknown> | undefined {
  const metric = byId.get(id);
  if (metric?.status !== "computed" || metric.value === null || typeof metric.value !== "object") {
    return undefined;
  }
  return metric.value as Record<string, unknown>;
}

/** A finite numeric field from a computed metric's value, else `undefined`. */
function numAt(byId: ReadonlyMap<string, Metric>, id: string, key: string): number | undefined {
  const value = computedValue(byId, id);
  const field = value?.[key];
  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

/** The monthly `churn` values from `e-churn-over-time.perMonth`, or `undefined`. */
function monthlyChurn(byId: ReadonlyMap<string, Metric>): number[] | undefined {
  const value = computedValue(byId, "e-churn-over-time");
  const perMonth = value?.perMonth;
  if (perMonth === null || typeof perMonth !== "object" || perMonth === undefined) {
    return undefined;
  }
  const churns: number[] = [];
  for (const bucket of Object.values(perMonth as Record<string, unknown>)) {
    if (bucket !== null && typeof bucket === "object") {
      const churn = (bucket as Record<string, unknown>).churn;
      if (typeof churn === "number" && Number.isFinite(churn)) {
        churns.push(churn);
      }
    }
  }
  return churns;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// ── The five component sub-score transforms (each → 0–100, higher = healthier, or null) ──

/** Message Quality ← Conventional-Commits adherence blended with (100 − low-information rate). */
function messageQualityScore(byId: ReadonlyMap<string, Metric>): number | null {
  const adherence = numAt(byId, "c-conventional-commits", "adherenceSharePct");
  const lowInfo = numAt(byId, "c-low-information-rate", "lowInfoSharePct");
  const parts: number[] = [];
  if (adherence !== undefined) {
    parts.push(adherence);
  }
  if (lowInfo !== undefined) {
    parts.push(100 - lowInfo);
  }
  return parts.length === 0 ? null : (mean(parts) ?? null);
}

/** Commit Size Discipline ← median lines/commit (≤GOOD ⇒ 100, ≥POOR ⇒ 0, linear between). */
function commitSizeScore(byId: ReadonlyMap<string, Metric>): number | null {
  const medianLines = numAt(byId, "a-commit-size-distribution", "median");
  if (medianLines === undefined) {
    return null;
  }
  return clamp((100 * (POOR_MEDIAN_LINES - medianLines)) / (POOR_MEDIAN_LINES - GOOD_MEDIAN_LINES), 0, 100);
}

/**
 * Branching Discipline ← 100 − direct-to-default share (high direct-to-default = low
 * review/branch discipline). [ASSUMPTION] a fully-linear/solo repo legitimately scores
 * low here; the visible sub-score keeps the composite transparent rather than hidden.
 */
function branchingScore(byId: ReadonlyMap<string, Metric>): number | null {
  const directShare = numAt(byId, "d-direct-to-default", "directToDefaultSharePct");
  return directShare === undefined ? null : clamp(100 - directShare, 0, 100);
}

/**
 * Collaboration Breadth ← 100 − top author's commit share (lower concentration = broader).
 * Uses the top share (NOT 1−gini, which is degenerately 0 for a single author): a
 * single-author repo ⇒ top share 100 ⇒ score 0 (correctly narrow).
 */
function collaborationScore(byId: ReadonlyMap<string, Metric>): number | null {
  const topShare = numAt(byId, "b-contribution-distribution", "topCommitSharePct");
  return topShare === undefined ? null : clamp(100 - topShare, 0, 100);
}

/** Churn Stability ← coefficient of variation of monthly churn (needs ≥2 months). */
function churnStabilityScore(byId: ReadonlyMap<string, Metric>): number | null {
  const churns = monthlyChurn(byId);
  if (churns === undefined || churns.length < 2) {
    return null; // not enough months to measure variability
  }
  const avg = mean(churns) ?? 0;
  const sd = stdev(churns) ?? 0;
  if (avg === 0) {
    return 100; // no churn at all is trivially "stable"
  }
  const cv = sd / avg;
  return clamp(100 - cv * 100, 0, 100);
}

/** A hygiene component: its weight, sub-score (null when its source is unavailable), and contribution. `type` for MetricValue. */
type Component = { name: string; weightPct: number; subScore: number | null; contributed: boolean };

/** The five components, each with its rounded sub-score (or null when excluded). */
function componentSubScores(byId: ReadonlyMap<string, Metric>): Component[] {
  const raw: { name: string; weightPct: number; subScore: number | null }[] = [
    { name: "Message Quality", weightPct: WEIGHT_MESSAGE_QUALITY, subScore: messageQualityScore(byId) },
    { name: "Commit Size Discipline", weightPct: WEIGHT_COMMIT_SIZE, subScore: commitSizeScore(byId) },
    { name: "Branching Discipline", weightPct: WEIGHT_BRANCHING, subScore: branchingScore(byId) },
    { name: "Collaboration Breadth", weightPct: WEIGHT_COLLABORATION, subScore: collaborationScore(byId) },
    { name: "Churn Stability", weightPct: WEIGHT_CHURN_STABILITY, subScore: churnStabilityScore(byId) },
  ];
  return raw.map((c) => ({
    name: c.name,
    weightPct: c.weightPct,
    subScore: c.subScore === null ? null : round(c.subScore),
    contributed: c.subScore !== null,
  }));
}

/** The weighted hygiene score, renormalized over the contributing components (null when none). */
function weightedScore(components: readonly Component[]): number | null {
  const contributing = components.filter((c): c is Component & { subScore: number } => c.subScore !== null);
  if (contributing.length === 0) {
    return null;
  }
  const totalWeight = contributing.reduce((sum, c) => sum + c.weightPct, 0);
  const weighted = contributing.reduce((sum, c) => sum + c.subScore * c.weightPct, 0);
  return round(weighted / totalWeight);
}

export const hygieneScore: RollupFn = (byId) => {
  const components = componentSubScores(byId);
  const score = weightedScore(components);
  if (score === null) {
    return notAvailable(HYGIENE, "No component metrics available to compute a hygiene score.");
  }
  return computed(HYGIENE, {
    score,
    components,
    componentsContributing: components.filter((c) => c.contributed).length,
    methodology: "weighted-average-renormalized-over-available-components",
  });
};

export const busFactorRisk: RollupFn = (byId) => {
  const busFactor = numAt(byId, "b-bus-factor", "busFactor");
  if (busFactor === undefined) {
    return notAvailable(BUS_FACTOR_RISK, "The bus-factor metric is not available.");
  }
  // [ASSUMPTION] 1 author covering the majority = high risk; 2 = moderate; ≥3 = low.
  let risk: "low" | "moderate" | "high";
  if (busFactor <= 1) {
    risk = "high";
  } else if (busFactor === 2) {
    risk = "moderate";
  } else {
    risk = "low";
  }
  return computed(BUS_FACTOR_RISK, {
    busFactor,
    risk,
    topAuthorSharePct: numAt(byId, "b-bus-factor", "topAuthorSharePct") ?? 0,
    framing: "team-level concentration-of-knowledge risk",
  });
};

export const trendDeltas: RollupFn = (byId, ctx: AnalysisContext) => {
  if (ctx.priorMetrics === undefined || ctx.priorMetrics.length === 0) {
    return notAvailable(TREND_DELTAS, "No prior report available for trend comparison.");
  }
  const priorById = new Map(ctx.priorMetrics.map((metric) => [metric.id, metric]));
  const current = weightedScore(componentSubScores(byId));
  const prior = weightedScore(componentSubScores(priorById));
  if (current === null || prior === null) {
    return notAvailable(TREND_DELTAS, "The hygiene score is unavailable in the current or prior report.");
  }
  const delta = round(current - prior);
  let direction: "improving" | "declining" | "stable";
  if (delta > 0) {
    direction = "improving";
  } else if (delta < 0) {
    direction = "declining";
  } else {
    direction = "stable";
  }
  return computed(TREND_DELTAS, {
    priorHygieneScore: prior,
    currentHygieneScore: current,
    hygieneScoreDelta: delta,
    direction,
  });
};

/** A best/worst dimension (name + sub-score). `type` for MetricValue. */
type ScoreEntry = { name: string; subScore: number };

export const strengthsWeaknesses: RollupFn = (byId) => {
  const scored = componentSubScores(byId)
    .filter((c): c is Component & { subScore: number } => c.subScore !== null)
    .map((c) => ({ name: c.name, subScore: c.subScore }));
  if (scored.length === 0) {
    return notAvailable(STRENGTHS_WEAKNESSES, "No component metrics available to rank.");
  }
  const byBest = [...scored].sort((a, b) => b.subScore - a.subScore || compareCodeUnits(a.name, b.name));
  const strengths: ScoreEntry[] = byBest.slice(0, STRENGTHS_TOP_N);
  const weaknesses: ScoreEntry[] = [...byBest].reverse().slice(0, STRENGTHS_TOP_N);
  return computed(STRENGTHS_WEAKNESSES, { strengths, weaknesses });
};

/** Group F in stable registry order. Roll-ups (consume the computed A–E envelopes). */
export const GROUP_F_ROLLUPS: RegisteredRollup[] = [
  { spec: HYGIENE, fn: hygieneScore },
  { spec: BUS_FACTOR_RISK, fn: busFactorRisk },
  { spec: TREND_DELTAS, fn: trendDeltas },
  { spec: STRENGTHS_WEAKNESSES, fn: strengthsWeaknesses },
];
