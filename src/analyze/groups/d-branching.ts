/**
 * Group D — Branching & Merge Structure metrics (Story 2.3, PRD §4.2).
 *
 * Five pure metric functions over the shared `RepoModel`'s parent-hash topology
 * (`commit.parents`). Each returns the uniform `Metric` envelope; an uncomputable
 * metric returns `not_available` with a precise reason (never throws, never
 * omitted). The `[ASSUMPTION]` heuristics document their rule via the named
 * helpers/constants below.
 *
 * CRITICAL — merge numstat: the 1.4 retrieval runs `git log --numstat` with no
 * `-m`/`--cc`, so git emits NO diff for merge commits ⇒ a merge commit's own
 * `additions`/`deletions` are always 0. "Average changes per merge" and
 * "long-lived branch" therefore measure the INTEGRATED unit — the off-mainline
 * commits the merge brought in (see `analyzeBranches`), never the merge's own
 * (empty) numstat.
 *
 * Determinism: tip + mainline + per-merge DFS sums/counts/min are all
 * order-independent; merges are processed in the model's `[committedAtMs, sha]`
 * order; no `Date.now()`, no `Map`/`Set` in emitted values (internal only).
 */

import type { MetricSpec } from "../metric.js";
import { computed, notAvailable } from "../metric.js";
import type { MetricFn, NormalizedCommit, RegisteredMetric, RepoModel } from "../model.js";
import { compareCodeUnits } from "../model.js";
import { mean, median, round } from "../stats.js";

// ── [ASSUMPTION] thresholds (catalog-owned domain knowledge) ──
const DAY_MS = 86_400_000;
const LONG_LIVED_DAYS = 30; // a merged branch older than this is "long-lived"
const MERGE_HEAVY_PCT = 15; // merge share at/above this reads as a merge-heavy workflow

export const TOPOLOGY: MetricSpec = { id: "d-topology-summary", group: "D", title: "Branch/merge topology summary" };
export const MERGE_VS_REBASE: MetricSpec = { id: "d-merge-vs-rebase", group: "D", title: "Merge vs. rebase tendency" };
export const DIRECT_TO_DEFAULT: MetricSpec = { id: "d-direct-to-default", group: "D", title: "Direct-to-default-branch rate" };
export const LONG_LIVED: MetricSpec = { id: "d-long-lived-branches", group: "D", title: "Long-lived branch signal" };
export const CHANGES_PER_MERGE: MetricSpec = { id: "d-average-changes-per-merge", group: "D", title: "Average changes per merge" };

// ── Topology primitives (documented heuristics, AC2) ──

function isMerge(commit: NormalizedCommit): boolean {
  return commit.parents.length >= 2;
}

function isRoot(commit: NormalizedCommit): boolean {
  return commit.parents.length === 0;
}

/** Index commits by sha for O(1) parent lookups. */
function shaIndex(commits: readonly NormalizedCommit[]): Map<string, NormalizedCommit> {
  const index = new Map<string, NormalizedCommit>();
  for (const commit of commits) {
    index.set(commit.sha, commit);
  }
  return index;
}

/**
 * The tip (= HEAD). Retrieval is HEAD-only, so the DAG has exactly ONE leaf —
 * the commit whose sha appears in no other commit's `parents`. That leaf is
 * HEAD. If (defensively) there is more than one leaf — or none, on a pathological
 * cyclic input — the deterministic max by `[committedAtMs, sha]` wins. The choice
 * is computed explicitly here, so it never depends on the caller's array order.
 */
function findTip(commits: readonly NormalizedCommit[]): NormalizedCommit | undefined {
  if (commits.length === 0) {
    return undefined;
  }
  const referenced = new Set<string>();
  for (const commit of commits) {
    for (const parent of commit.parents) {
      referenced.add(parent);
    }
  }
  const leaves = commits.filter((c) => !referenced.has(c.sha));
  const pool = leaves.length > 0 ? leaves : commits;
  // Pick the latest by [committedAtMs, sha] explicitly — order-independent.
  return pool.reduce((best, c) => (isLater(c, best) ? c : best));
}

/** True if `a` sorts after `b` in the model's total order `[committedAtMs, sha]`. */
function isLater(a: NormalizedCommit, b: NormalizedCommit): boolean {
  if (a.committedAtMs !== b.committedAtMs) {
    return a.committedAtMs > b.committedAtMs;
  }
  return compareCodeUnits(a.sha, b.sha) > 0;
}

/**
 * The default branch = the first-parent chain from the tip (`parents[0]`
 * repeatedly). git's first parent of a merge is the branch you were ON when you
 * merged (the trunk), so this is the canonical mainline.
 */
function firstParentMainline(
  tip: NormalizedCommit,
  index: Map<string, NormalizedCommit>,
): Set<string> {
  const mainline = new Set<string>();
  let current: NormalizedCommit | undefined = tip;
  while (current !== undefined && !mainline.has(current.sha)) {
    mainline.add(current.sha);
    const firstParent: string | undefined = current.parents[0];
    current = firstParent === undefined ? undefined : index.get(firstParent);
  }
  return mainline;
}

/** Per-merge integration: the off-mainline commits a merge brought in. */
interface MergeIntegration {
  integratedCommitCount: number;
  integratedChanges: number; // Σ (additions+deletions) of the branch commits (NOT the merge's own numstat)
  branchSpanMs: number; // merge time − earliest integrated commit time (0 when none)
}

/**
 * Collect the off-mainline ("integrated") commits a single merge brought in — an
 * explicit-stack DFS from the merge's non-first parents that stops at the
 * mainline (the merge-base / trunk rejoin) and at already-visited commits.
 * Bounded by the per-merge visited set. Octopus merges and branch-of-a-branch
 * merge bases are a documented approximation (the mainline is the stop boundary).
 */
function integrateBranch(
  merge: NormalizedCommit,
  index: Map<string, NormalizedCommit>,
  mainline: Set<string>,
): MergeIntegration {
  const visited = new Set<string>();
  const stack: string[] = merge.parents.slice(1); // non-first parents = merged-in tips
  let integratedChanges = 0;
  let earliestMs = Number.POSITIVE_INFINITY;
  while (stack.length > 0) {
    const sha = stack.pop();
    if (sha === undefined || mainline.has(sha) || visited.has(sha)) {
      continue; // reached the trunk / already counted
    }
    visited.add(sha);
    const branchCommit = index.get(sha);
    if (branchCommit === undefined) {
      continue; // a parent outside the retrieved history (shallow boundary)
    }
    integratedChanges += branchCommit.additions + branchCommit.deletions;
    earliestMs = Math.min(earliestMs, branchCommit.committedAtMs);
    for (const parent of branchCommit.parents) {
      stack.push(parent);
    }
  }
  const integratedCommitCount = visited.size;
  return {
    integratedCommitCount,
    integratedChanges,
    branchSpanMs: integratedCommitCount === 0 ? 0 : merge.committedAtMs - earliestMs,
  };
}

/** Per-merge integration analysis, merges processed in the model's stable order. */
function analyzeBranches(
  model: RepoModel,
  index: Map<string, NormalizedCommit>,
  mainline: Set<string>,
): MergeIntegration[] {
  return model.commits.filter(isMerge).map((merge) => integrateBranch(merge, index, mainline));
}

/** Percentage of `part` in `total`, rounded (2 dp); `0` when the total is zero. */
function sharePct(part: number, total: number): number {
  return total === 0 ? 0 : round((part / total) * 100);
}

// ── Metrics ──

export const topologySummary: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(TOPOLOGY, "No commits in the analyzed history.");
  }
  const total = model.commits.length;
  const mergeCommitCount = model.commits.filter(isMerge).length;
  const rootCommitCount = model.commits.filter(isRoot).length;
  const octopusMergeCount = model.commits.filter((c) => c.parents.length >= 3).length;
  return computed(TOPOLOGY, {
    totalCommits: total,
    mergeCommitCount,
    mergeSharePct: sharePct(mergeCommitCount, total),
    regularCommitCount: total - mergeCommitCount - rootCommitCount,
    rootCommitCount,
    octopusMergeCount,
    workflow: mergeCommitCount === 0 ? "linear" : "merge-based",
  });
};

export const mergeVsRebase: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(MERGE_VS_REBASE, "No commits in the analyzed history.");
  }
  const total = model.commits.length;
  const mergeCommitCount = model.commits.filter(isMerge).length;
  const mergeSharePctValue = sharePct(mergeCommitCount, total);
  const tip = findTip(model.commits);
  const mainlineCount =
    tip === undefined ? 0 : firstParentMainline(tip, shaIndex(model.commits)).size;
  // Documented heuristic: no merges ⇒ linear (rebase-style); a merge share at or
  // above MERGE_HEAVY_PCT ⇒ merge-heavy; otherwise a mixed workflow.
  let tendency: "linear" | "merge-heavy" | "mixed";
  if (mergeCommitCount === 0) {
    tendency = "linear";
  } else if (mergeSharePctValue >= MERGE_HEAVY_PCT) {
    tendency = "merge-heavy";
  } else {
    tendency = "mixed";
  }
  return computed(MERGE_VS_REBASE, {
    mergeSharePct: mergeSharePctValue,
    firstParentLinearityPct: sharePct(mainlineCount, total),
    tendency,
  });
};

export const directToDefault: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(DIRECT_TO_DEFAULT, "No commits in the analyzed history.");
  }
  const total = model.commits.length;
  const index = shaIndex(model.commits);
  const tip = findTip(model.commits);
  const mainline = tip === undefined ? new Set<string>() : firstParentMainline(tip, index);
  // Direct-to-default = NON-merge commits on the first-parent mainline (landed
  // straight on the default branch). Everything else (merge commits + off-mainline
  // branch commits) arrived via a branch+merge.
  const directToDefaultCount = model.commits.filter(
    (c) => mainline.has(c.sha) && !isMerge(c),
  ).length;
  return computed(DIRECT_TO_DEFAULT, {
    directToDefaultCount,
    directToDefaultSharePct: sharePct(directToDefaultCount, total),
    viaMergeCount: total - directToDefaultCount,
    mainlineCommitCount: mainline.size,
    totalCommits: total,
  });
};

export const longLivedBranches: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(LONG_LIVED, "No commits in the analyzed history.");
  }
  const merges = model.commits.filter(isMerge);
  if (merges.length === 0) {
    return notAvailable(LONG_LIVED, "No merge commits to assess branch lifespans.");
  }
  const index = shaIndex(model.commits);
  const tip = findTip(model.commits);
  const mainline = tip === undefined ? new Set<string>() : firstParentMainline(tip, index);
  const integrations = analyzeBranches(model, index, mainline);

  let longLivedBranchCount = 0;
  let branchesWithUniqueCommits = 0;
  let longestBranchDays = 0;
  for (const integration of integrations) {
    if (integration.integratedCommitCount === 0) {
      continue; // a merge that integrated no unique commits has no measurable lifespan
    }
    branchesWithUniqueCommits += 1;
    const spanDays = integration.branchSpanMs / DAY_MS;
    if (spanDays > longestBranchDays) {
      longestBranchDays = spanDays;
    }
    if (spanDays > LONG_LIVED_DAYS) {
      longLivedBranchCount += 1;
    }
  }
  return computed(LONG_LIVED, {
    longLivedBranchCount,
    thresholdDays: LONG_LIVED_DAYS,
    mergesAnalyzed: merges.length,
    branchesWithUniqueCommits,
    longestBranchDays: round(longestBranchDays),
  });
};

export const averageChangesPerMerge: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(CHANGES_PER_MERGE, "No commits in the analyzed history.");
  }
  const merges = model.commits.filter(isMerge);
  if (merges.length === 0) {
    return notAvailable(CHANGES_PER_MERGE, "No merge commits to measure integrated change size.");
  }
  const index = shaIndex(model.commits);
  const tip = findTip(model.commits);
  const mainline = tip === undefined ? new Set<string>() : firstParentMainline(tip, index);
  const integrations = analyzeBranches(model, index, mainline);

  // Integrated size = the branch commits' churn, NOT the merge commit's own
  // numstat (git emits no diff for merges under `--numstat`).
  const sizes = integrations.map((i) => i.integratedChanges);
  const mergesWithNoUniqueCommits = integrations.filter((i) => i.integratedCommitCount === 0).length;
  return computed(CHANGES_PER_MERGE, {
    mergeCount: merges.length,
    averageIntegratedChanges: round(mean(sizes) ?? 0),
    medianIntegratedChanges: round(median(sizes) ?? 0),
    maxIntegratedChanges: sizes.reduce((m, v) => Math.max(m, v), 0),
    mergesWithNoUniqueCommits,
  });
};

/** Group D in stable registry order. */
export const GROUP_D_METRICS: RegisteredMetric[] = [
  { spec: TOPOLOGY, fn: topologySummary },
  { spec: MERGE_VS_REBASE, fn: mergeVsRebase },
  { spec: DIRECT_TO_DEFAULT, fn: directToDefault },
  { spec: LONG_LIVED, fn: longLivedBranches },
  { spec: CHANGES_PER_MERGE, fn: averageChangesPerMerge },
];
