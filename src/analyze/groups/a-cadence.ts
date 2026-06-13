/**
 * Group A — Activity & Cadence metrics (Story 1.5, PRD §4.2).
 *
 * Six pure metric functions over the shared `RepoModel`. Each returns the
 * uniform `Metric` envelope; an uncomputable metric returns `not_available`
 * with a reason (never throws, never omitted). All time math uses the model's
 * UTC epoch-ms plus the injected `ctx.timezone` for bucket labels — never
 * `Date.now()`.
 */

import type { MetricSpec } from "../metric.js";
import { computed, notAvailable } from "../metric.js";
import type { MetricFn, NormalizedCommit, RegisteredMetric } from "../model.js";
import { compareCodeUnits } from "../model.js";
import { mean, median, percentile, round } from "../stats.js";
import { dayBucket, isoWeekBucket, monthBucket, zonedParts } from "../time.js";

/** Gap (seconds) above which the project is considered dormant between commits. */
const DORMANT_GAP_SECONDS = 14 * 24 * 3600; // [ASSUMPTION] 14 days

/** Reduce-based min/max (avoids `Math.min(...arr)` argument-spread overflow on large repos). */
function minOf(values: readonly number[]): number {
  return values.reduce((m, v) => (v < m ? v : m), values[0]);
}
function maxOf(values: readonly number[]): number {
  return values.reduce((m, v) => (v > m ? v : m), values[0]);
}

export const VOLUME: MetricSpec = { id: "a-commit-volume", group: "A", title: "Commit volume over time" };
export const CADENCE: MetricSpec = { id: "a-commit-cadence", group: "A", title: "Commit frequency / cadence" };
export const ACTIVE_DORMANT: MetricSpec = { id: "a-active-dormant", group: "A", title: "Active vs. dormant periods" };
export const PROJECT_AGE: MetricSpec = { id: "a-project-age", group: "A", title: "Project age & lifespan" };
export const SIZE_DIST: MetricSpec = { id: "a-commit-size-distribution", group: "A", title: "Commit size distribution" };
export const TIME_PATTERN: MetricSpec = { id: "a-time-of-day-day-of-week", group: "A", title: "Time-of-day / day-of-week pattern" };

/** Counts keyed by bucket label, emitted as a key-sorted plain object (stable JSON). */
function countByBucket(commits: readonly NormalizedCommit[], label: (ms: number) => string): Record<string, number> {
  const counts = new Map<string, number>();
  for (const c of commits) {
    const key = label(c.committedAtMs);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: Record<string, number> = {};
  for (const key of [...counts.keys()].sort(compareCodeUnits)) {
    out[key] = counts.get(key) ?? 0;
  }
  return out;
}

export const commitVolume: MetricFn = (model, ctx) => {
  if (model.commits.length === 0) {
    return notAvailable(VOLUME, "No commits in the analyzed history.");
  }
  return computed(VOLUME, {
    perDay: countByBucket(model.commits, (ms) => dayBucket(ms, ctx.timezone)),
    perWeek: countByBucket(model.commits, (ms) => isoWeekBucket(ms, ctx.timezone)),
    perMonth: countByBucket(model.commits, (ms) => monthBucket(ms, ctx.timezone)),
  });
};

export const commitCadence: MetricFn = (model) => {
  if (model.commits.length < 2) {
    return notAvailable(CADENCE, "At least two commits are required to measure an interval.");
  }
  const intervals: number[] = [];
  for (let i = 1; i < model.commits.length; i++) {
    intervals.push((model.commits[i].committedAtMs - model.commits[i - 1].committedAtMs) / 1000);
  }
  return computed(CADENCE, {
    averageIntervalSeconds: round(mean(intervals) ?? 0),
    medianIntervalSeconds: round(median(intervals) ?? 0),
    intervalCount: intervals.length,
  });
};

export const activeDormantPeriods: MetricFn = (model, ctx) => {
  if (model.commits.length < 2) {
    return notAvailable(ACTIVE_DORMANT, "At least two commits are required to detect periods.");
  }
  const isoDay = (ms: number): string => dayBucket(ms, ctx.timezone);
  const dormant: { start: string; end: string; gapDays: number }[] = [];
  let activeStart = model.commits[0].committedAtMs;
  const activePeriods: { start: string; end: string }[] = [];

  for (let i = 1; i < model.commits.length; i++) {
    const prev = model.commits[i - 1].committedAtMs;
    const curr = model.commits[i].committedAtMs;
    const gapSeconds = (curr - prev) / 1000;
    if (gapSeconds > DORMANT_GAP_SECONDS) {
      activePeriods.push({ start: isoDay(activeStart), end: isoDay(prev) });
      dormant.push({ start: isoDay(prev), end: isoDay(curr), gapDays: round(gapSeconds / 86400) });
      activeStart = curr;
    }
  }
  activePeriods.push({
    start: isoDay(activeStart),
    end: isoDay(model.commits.at(-1)?.committedAtMs ?? activeStart),
  });

  return computed(ACTIVE_DORMANT, {
    dormantGapThresholdDays: DORMANT_GAP_SECONDS / 86400,
    activePeriods,
    dormantPeriods: dormant,
  });
};

export const projectAge: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(PROJECT_AGE, "No commits in the analyzed history.");
  }
  const firstMs = model.commits[0].committedAtMs;
  const lastMs = model.commits.at(-1)?.committedAtMs ?? model.commits[0].committedAtMs;
  return computed(PROJECT_AGE, {
    firstCommitDate: new Date(firstMs).toISOString(),
    latestCommitDate: new Date(lastMs).toISOString(),
    lifespanDays: round((lastMs - firstMs) / 86400000),
    ageDays: round((model.analysisTimestampMs - firstMs) / 86400000),
  });
};

export const commitSizeDistribution: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(SIZE_DIST, "No commits in the analyzed history.");
  }
  const sizes = model.commits.map((c) => c.additions + c.deletions);
  return computed(SIZE_DIST, {
    min: minOf(sizes),
    median: round(median(sizes) ?? 0),
    p90: round(percentile(sizes, 90) ?? 0),
    max: maxOf(sizes),
    mean: round(mean(sizes) ?? 0),
    commitCount: sizes.length,
  });
};

export const timeOfDayDayOfWeek: MetricFn = (model, ctx) => {
  if (model.commits.length === 0) {
    return notAvailable(TIME_PATTERN, "No commits in the analyzed history.");
  }
  const byHour = new Array<number>(24).fill(0);
  const byWeekday = new Array<number>(7).fill(0);
  for (const c of model.commits) {
    const p = zonedParts(c.committedAtMs, ctx.timezone);
    byHour[p.hour] += 1;
    byWeekday[p.weekday] += 1;
  }
  return computed(TIME_PATTERN, { timezone: ctx.timezone, byHour, byWeekday });
};

/** Group A in stable registry order. */
export const GROUP_A_METRICS: RegisteredMetric[] = [
  { spec: VOLUME, fn: commitVolume },
  { spec: CADENCE, fn: commitCadence },
  { spec: ACTIVE_DORMANT, fn: activeDormantPeriods },
  { spec: PROJECT_AGE, fn: projectAge },
  { spec: SIZE_DIST, fn: commitSizeDistribution },
  { spec: TIME_PATTERN, fn: timeOfDayDayOfWeek },
];
