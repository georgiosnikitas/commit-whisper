/**
 * Group E — Code Churn & Hotspots metrics (Story 2.4, PRD §4.2).
 *
 * Five pure metric functions over the shared `RepoModel`, reading the per-file
 * change records (`commit.files`, added in Story 2.1) plus the commit-level line
 * totals and `committedAtMs`. Each returns the uniform `Metric` envelope; an
 * uncomputable metric returns `not_available` with a precise reason (never
 * throws, never omitted).
 *
 * Data realities (AC2):
 *  - BINARY files arrive with `additions/deletions: null` (git numstat `-`). They
 *    are counted as TOUCHES (a hotspot signal) but EXCLUDED from line-churn sums.
 *  - MERGE commits carry an empty `files` array (git omits merge diffs under
 *    `--numstat`, per Story 2.3) ⇒ they contribute no touches/churn — correct,
 *    the integrated work is attributed to the branch commits.
 *  - "Present in HEAD" (file-age) is NOT computable from a HEAD-only `git log
 *    --numstat` (no working-tree listing; numstat can't distinguish a delete from
 *    a large removal), so age is computed over all files SEEN in history and the
 *    metric carries a `presenceApproximation` marker.
 *
 * Determinism: key-sorted month buckets; value-sorted arrays with
 * `compareCodeUnits` tie-breaks; rounded ratios/shares/days; no `Map`/`Set`/`Date`
 * in emitted values (the per-file `Map` is internal only); no `Date.now()`.
 */

import type { MetricSpec } from "../metric.js";
import { computed, notAvailable } from "../metric.js";
import type { MetricFn, NormalizedCommit, RegisteredMetric } from "../model.js";
import { compareCodeUnits } from "../model.js";
import { median, round } from "../stats.js";
import { monthBucket } from "../time.js";

// ── [ASSUMPTION] thresholds (catalog-owned domain knowledge) ──
const DAY_MS = 86_400_000;
const HOTSPOT_TOP_FILES = 20;
const HOTSPOT_TOP_DIRS = 10;
const LARGE_CHANGE_LINES = 1000; // a commit changing ≥ this many lines is an "outsized" event
const LARGE_EVENT_LIMIT = 10; // emit at most this many largest events

export const MOST_CHANGED: MetricSpec = { id: "e-most-changed", group: "E", title: "Most-changed files / directories" };
export const CHURN_OVER_TIME: MetricSpec = { id: "e-churn-over-time", group: "E", title: "Churn rate over time" };
export const ADD_DELETE_RATIO: MetricSpec = { id: "e-add-delete-ratio", group: "E", title: "Add/delete ratio" };
export const FILE_AGE: MetricSpec = { id: "e-file-age", group: "E", title: "File survival / age" };
export const LARGE_CHANGES: MetricSpec = { id: "e-large-change-events", group: "E", title: "Large-change events" };

/** Per-file aggregation (internal; never emitted with raw identity). */
interface FileStat {
  touchCount: number;
  churn: number; // additions+deletions, binary excluded
  firstSeenMs: number;
  lastSeenMs: number;
}

/** The directory of a file path (everything before the last "/"); root files → ".". */
function directoryOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

/** Percentage of `part` in `total`, rounded (2 dp); `0` when the total is zero. */
function sharePct(part: number, total: number): number {
  return total === 0 ? 0 : round((part / total) * 100);
}

/** Aggregate per-file touch/churn/first-last-seen across all commits. */
function aggregateFiles(commits: readonly NormalizedCommit[]): Map<string, FileStat> {
  const files = new Map<string, FileStat>();
  for (const commit of commits) {
    for (const file of commit.files) {
      const stat = files.get(file.path) ?? {
        touchCount: 0,
        churn: 0,
        firstSeenMs: commit.committedAtMs,
        lastSeenMs: commit.committedAtMs,
      };
      stat.touchCount += 1; // binary counts as a touch
      if (file.additions !== null) {
        stat.churn += file.additions; // binary `null` excluded from churn
      }
      if (file.deletions !== null) {
        stat.churn += file.deletions;
      }
      stat.firstSeenMs = Math.min(stat.firstSeenMs, commit.committedAtMs);
      stat.lastSeenMs = Math.max(stat.lastSeenMs, commit.committedAtMs);
      files.set(file.path, stat);
    }
  }
  return files;
}

/** A ranked hotspot row (path, touch count, churn). `type` (not interface) for MetricValue. */
type Hotspot = { path: string; touchCount: number; churn: number };

/** Top-N paths by touch count (tie-break: path ascending), each as a `Hotspot`. */
function topByTouch(stats: Map<string, FileStat>, limit: number): Hotspot[] {
  return [...stats.entries()]
    .map(([path, s]) => ({ path, touchCount: s.touchCount, churn: s.churn }))
    .sort((a, b) => b.touchCount - a.touchCount || compareCodeUnits(a.path, b.path))
    .slice(0, limit);
}

/** Aggregate file stats into directory-level stats (sum touches+churn per directory). */
function aggregateDirectories(fileStats: Map<string, FileStat>): Map<string, FileStat> {
  const dirs = new Map<string, FileStat>();
  for (const [path, s] of fileStats) {
    const dir = directoryOf(path);
    const stat = dirs.get(dir) ?? { touchCount: 0, churn: 0, firstSeenMs: s.firstSeenMs, lastSeenMs: s.lastSeenMs };
    stat.touchCount += s.touchCount;
    stat.churn += s.churn;
    stat.firstSeenMs = Math.min(stat.firstSeenMs, s.firstSeenMs);
    stat.lastSeenMs = Math.max(stat.lastSeenMs, s.lastSeenMs);
    dirs.set(dir, stat);
  }
  return dirs;
}

export const mostChanged: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(MOST_CHANGED, "No commits in the analyzed history.");
  }
  const fileStats = aggregateFiles(model.commits);
  if (fileStats.size === 0) {
    return notAvailable(MOST_CHANGED, "No changed-file data in the analyzed history.");
  }
  const dirStats = aggregateDirectories(fileStats);
  return computed(MOST_CHANGED, {
    topFiles: topByTouch(fileStats, HOTSPOT_TOP_FILES),
    topDirectories: topByTouch(dirStats, HOTSPOT_TOP_DIRS),
    totalFilesTouched: fileStats.size,
    totalDirectoriesTouched: dirStats.size,
  });
};

/** Monthly churn bucket (emitted under `perMonth`). `type` (not interface) for MetricValue. */
type MonthChurn = {
  additions: number;
  deletions: number;
  churn: number;
  commitCount: number;
};

export const churnOverTime: MetricFn = (model, ctx) => {
  if (model.commits.length === 0) {
    return notAvailable(CHURN_OVER_TIME, "No commits in the analyzed history.");
  }
  const buckets = new Map<string, MonthChurn>();
  let totalChurn = 0;
  for (const commit of model.commits) {
    const key = monthBucket(commit.committedAtMs, ctx.timezone);
    const bucket = buckets.get(key) ?? { additions: 0, deletions: 0, churn: 0, commitCount: 0 };
    bucket.additions += commit.additions; // commit-level totals are already binary-excluded
    bucket.deletions += commit.deletions;
    bucket.churn += commit.additions + commit.deletions;
    bucket.commitCount += 1;
    buckets.set(key, bucket);
    totalChurn += commit.additions + commit.deletions;
  }
  const perMonth: Record<string, MonthChurn> = {};
  for (const [key, bucket] of [...buckets.entries()].sort((a, b) => compareCodeUnits(a[0], b[0]))) {
    perMonth[key] = bucket;
  }
  return computed(CHURN_OVER_TIME, { perMonth, totalChurn });
};

export const addDeleteRatio: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(ADD_DELETE_RATIO, "No commits in the analyzed history.");
  }
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const commit of model.commits) {
    totalAdditions += commit.additions;
    totalDeletions += commit.deletions;
  }
  return computed(ADD_DELETE_RATIO, {
    totalAdditions,
    totalDeletions,
    // `null` (not Infinity) when there are no deletions — "all growth, no removals".
    addDeleteRatio: totalDeletions === 0 ? null : round(totalAdditions / totalDeletions),
    netLines: totalAdditions - totalDeletions,
  });
};

export const fileAge: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(FILE_AGE, "No commits in the analyzed history.");
  }
  const fileStats = aggregateFiles(model.commits);
  if (fileStats.size === 0) {
    return notAvailable(FILE_AGE, "No changed-file data in the analyzed history.");
  }
  const ages: number[] = [];
  let singleTouchFileCount = 0;
  let maxAgeDays = 0;
  for (const stat of fileStats.values()) {
    const ageDays = (stat.lastSeenMs - stat.firstSeenMs) / DAY_MS;
    ages.push(ageDays);
    maxAgeDays = Math.max(maxAgeDays, ageDays);
    if (stat.touchCount === 1) {
      singleTouchFileCount += 1;
    }
  }
  return computed(FILE_AGE, {
    medianAgeDays: round(median(ages) ?? 0),
    maxAgeDays: round(maxAgeDays),
    filesConsidered: fileStats.size,
    singleTouchFileCount,
    // The HEAD-only retrieval has no working-tree listing, so "present in HEAD" is
    // approximated by "appeared in the analyzed history" (precise filtering needs ls-tree).
    presenceApproximation: "seen-in-history",
  });
};

/** A large-change event — change-level context ONLY (no author; NFR-8). `type` for MetricValue. */
type LargeChangeEvent = { date: string; churn: number; changedFileCount: number };

export const largeChangeEvents: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(LARGE_CHANGES, "No commits in the analyzed history.");
  }
  const sized = model.commits.map((c) => ({
    churn: c.additions + c.deletions,
    committedAtMs: c.committedAtMs,
    sha: c.sha,
    changedFileCount: c.changedFileCount,
  }));
  const largeChangeCount = sized.filter((c) => c.churn >= LARGE_CHANGE_LINES).length;
  const events: LargeChangeEvent[] = sized
    .filter((c) => c.churn > 0) // a zero-churn commit (e.g. a merge) is not a change event
    .sort((a, b) => b.churn - a.churn || a.committedAtMs - b.committedAtMs || compareCodeUnits(a.sha, b.sha))
    .slice(0, LARGE_EVENT_LIMIT)
    .map((c) => ({
      date: new Date(c.committedAtMs).toISOString(),
      churn: c.churn,
      changedFileCount: c.changedFileCount,
    }));
  return computed(LARGE_CHANGES, {
    thresholdLines: LARGE_CHANGE_LINES,
    largeChangeCount,
    largeChangeSharePct: sharePct(largeChangeCount, model.commits.length),
    events,
  });
};

/** Group E in stable registry order. */
export const GROUP_E_METRICS: RegisteredMetric[] = [
  { spec: MOST_CHANGED, fn: mostChanged },
  { spec: CHURN_OVER_TIME, fn: churnOverTime },
  { spec: ADD_DELETE_RATIO, fn: addDeleteRatio },
  { spec: FILE_AGE, fn: fileAge },
  { spec: LARGE_CHANGES, fn: largeChangeEvents },
];
