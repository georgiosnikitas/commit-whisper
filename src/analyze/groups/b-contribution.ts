/**
 * Group B — Contribution & Ownership metrics (Story 2.1, PRD §4.2).
 *
 * Six pure metric functions over the shared `RepoModel`, each returning the
 * uniform `Metric` envelope. Group B's raw material is per-author data, so it is
 * the highest-risk group for NFR-8 ("never rank, score, or single out individual
 * developers; all manager-facing output is team-level"). The resolution is
 * ANONYMIZATION BY CONSTRUCTION: per-author tallies are computed internally but
 * NEVER emitted with identity — values are sorted-descending shares, concentration
 * coefficients, team-level counts, and per-area concentration + author counts.
 * No author name or email appears in any Group B value (enforced by a guard test).
 */

import type { MetricSpec } from "../metric.js";
import { computed, notAvailable } from "../metric.js";
import type { CanonicalIdentity } from "../identity.js";
import type { MetricFn, NormalizedCommit, RegisteredMetric } from "../model.js";
import { compareCodeUnits } from "../model.js";
import { gini, round } from "../stats.js";

// — [ASSUMPTION] thresholds (catalog-owned domain knowledge, like Group A's dormancy gap) —
const DAY_MS = 86_400_000;
const ACTIVE_WINDOW_DAYS = 90; // "currently active" = committed within this window of the analysis time
const ONBOARD_WINDOW_DAYS = 90; // "new" = first commit within this window of the analysis time
const DEPART_WINDOW_DAYS = 180; // "departed" = no commit within this window of the analysis time
const BUS_FACTOR_THRESHOLD = 0.5; // bus factor = fewest authors covering ≥ this share of commits
const HOTSPOT_TOP_DIRS = 10;
const HOTSPOT_TOP_FILES = 20;

export const CONTRIBUTOR_COUNT: MetricSpec = { id: "b-contributor-count", group: "B", title: "Contributor count" };
export const CONTRIBUTION_DISTRIBUTION: MetricSpec = { id: "b-contribution-distribution", group: "B", title: "Contribution distribution" };
export const BUS_FACTOR: MetricSpec = { id: "b-bus-factor", group: "B", title: "Bus-factor / knowledge concentration" };
export const NEW_DEPARTED: MetricSpec = { id: "b-new-departed", group: "B", title: "New vs. departed contributors" };
export const OWNERSHIP_BY_AREA: MetricSpec = { id: "b-ownership-by-area", group: "B", title: "Ownership by area" };
export const CO_AUTHORSHIP: MetricSpec = { id: "b-co-authorship", group: "B", title: "Co-authorship / collaboration signal" };

/** Internal-only identity key (never emitted) — matches the model's canonical key. */
function identityKey(id: CanonicalIdentity): string {
  return `${id.email}\x00${id.name}`;
}

/** Per-author commit + line tallies, computed internally and never emitted with identity. */
interface AuthorTally {
  commits: number;
  lines: number;
}

function tallyByAuthor(commits: readonly NormalizedCommit[]): Map<string, AuthorTally> {
  const byAuthor = new Map<string, AuthorTally>();
  for (const commit of commits) {
    const key = identityKey(commit.author);
    const tally = byAuthor.get(key) ?? { commits: 0, lines: 0 };
    tally.commits += 1;
    tally.lines += commit.additions + commit.deletions;
    byAuthor.set(key, tally);
  }
  return byAuthor;
}

/** Percentage shares (0..100, 2 dp) of each part in the total, sorted DESCENDING (anonymized). */
function sharesDescending(parts: readonly number[], total: number): number[] {
  if (total === 0) {
    return parts.map(() => 0);
  }
  return parts.map((part) => round((part / total) * 100)).sort((a, b) => b - a);
}

export const contributorCount: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(CONTRIBUTOR_COUNT, "No commits in the analyzed history.");
  }
  const activeCutoff = model.analysisTimestampMs - ACTIVE_WINDOW_DAYS * DAY_MS;
  const active = model.authors.filter((a) => a.lastCommittedAtMs >= activeCutoff).length;
  return computed(CONTRIBUTOR_COUNT, {
    total: model.authors.length,
    active,
    activeWindowDays: ACTIVE_WINDOW_DAYS,
  });
};

export const contributionDistribution: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(CONTRIBUTION_DISTRIBUTION, "No commits in the analyzed history.");
  }
  const tallies = [...tallyByAuthor(model.commits).values()];
  const commitCounts = tallies.map((t) => t.commits);
  const lineCounts = tallies.map((t) => t.lines);
  const totalCommits = commitCounts.reduce((s, v) => s + v, 0);
  const totalLines = lineCounts.reduce((s, v) => s + v, 0);

  const commitShares = sharesDescending(commitCounts, totalCommits);
  const lineShares = sharesDescending(lineCounts, totalLines);

  return computed(CONTRIBUTION_DISTRIBUTION, {
    authorCount: tallies.length,
    commitShares,
    lineShares,
    giniCommits: round(gini(commitCounts) ?? 0, 4),
    giniLines: round(gini(lineCounts) ?? 0, 4),
    topCommitSharePct: commitShares[0] ?? 0,
    top3CommitSharePct: round(commitShares.slice(0, 3).reduce((s, v) => s + v, 0)),
  });
};

export const busFactor: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(BUS_FACTOR, "No commits in the analyzed history.");
  }
  const counts = [...tallyByAuthor(model.commits).values()]
    .map((t) => t.commits)
    .sort((a, b) => b - a);
  const total = counts.reduce((s, v) => s + v, 0);

  let cumulative = 0;
  let factor = 0;
  for (const count of counts) {
    cumulative += count;
    factor += 1;
    if (cumulative / total >= BUS_FACTOR_THRESHOLD) {
      break;
    }
  }
  return computed(BUS_FACTOR, {
    busFactor: factor,
    thresholdPct: BUS_FACTOR_THRESHOLD * 100,
    topAuthorSharePct: round(((counts[0] ?? 0) / total) * 100),
    totalAuthors: counts.length,
  });
};

export const newDepartedContributors: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(NEW_DEPARTED, "No commits in the analyzed history.");
  }
  const onboardCutoff = model.analysisTimestampMs - ONBOARD_WINDOW_DAYS * DAY_MS;
  const departCutoff = model.analysisTimestampMs - DEPART_WINDOW_DAYS * DAY_MS;
  const newContributors = model.authors.filter((a) => a.firstCommittedAtMs >= onboardCutoff).length;
  const departedContributors = model.authors.filter((a) => a.lastCommittedAtMs < departCutoff).length;
  return computed(NEW_DEPARTED, {
    totalContributors: model.authors.length,
    newContributors,
    departedContributors,
    onboardWindowDays: ONBOARD_WINDOW_DAYS,
    departWindowDays: DEPART_WINDOW_DAYS,
  });
};

/** The directory of a file path (everything before the last "/"); root files → ".". */
function directoryOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

/** Per-area accumulator: total touches + per-author touch counts (authors never emitted). */
interface AreaTouches {
  total: number;
  byAuthor: Map<string, number>;
}

function addTouch(areas: Map<string, AreaTouches>, area: string, authorKey: string): void {
  const entry = areas.get(area) ?? { total: 0, byAuthor: new Map<string, number>() };
  entry.total += 1;
  entry.byAuthor.set(authorKey, (entry.byAuthor.get(authorKey) ?? 0) + 1);
  areas.set(area, entry);
}

/** Anonymized per-area concentration row: path, touch count, distinct authors, top author's SHARE (no identity). */
type AreaConcentration = {
  path: string;
  touchCount: number;
  authorCount: number;
  topAuthorSharePct: number;
};

/** Reduce-based max (avoids `Math.max(...arr)` argument-spread overflow). */
function maxOf(values: Iterable<number>): number {
  let max = 0;
  for (const v of values) {
    if (v > max) {
      max = v;
    }
  }
  return max;
}

/** Top-N hotspot areas by touch count (tie-break: path ascending), each anonymized. */
function topAreas(areas: Map<string, AreaTouches>, limit: number): AreaConcentration[] {
  return [...areas.entries()]
    .map(([path, t]) => ({
      path,
      touchCount: t.total,
      authorCount: t.byAuthor.size,
      topAuthorSharePct: round((maxOf(t.byAuthor.values()) / t.total) * 100),
    }))
    .sort((a, b) => (b.touchCount - a.touchCount) || compareCodeUnits(a.path, b.path))
    .slice(0, limit);
}

export const ownershipByArea: MetricFn = (model) => {
  const fileAreas = new Map<string, AreaTouches>();
  const dirAreas = new Map<string, AreaTouches>();
  let touches = 0;
  for (const commit of model.commits) {
    const authorKey = identityKey(commit.author);
    for (const file of commit.files) {
      touches += 1;
      addTouch(fileAreas, file.path, authorKey);
      addTouch(dirAreas, directoryOf(file.path), authorKey);
    }
  }
  if (touches === 0) {
    return notAvailable(OWNERSHIP_BY_AREA, "No changed-file data in the analyzed history.");
  }
  return computed(OWNERSHIP_BY_AREA, {
    topDirectories: topAreas(dirAreas, HOTSPOT_TOP_DIRS),
    topFiles: topAreas(fileAreas, HOTSPOT_TOP_FILES),
  });
};

/** Match a `Co-authored-by:` git trailer line (case-insensitive, line-anchored). */
const CO_AUTHOR_TRAILER = /^[ \t]*co-authored-by:[ \t]*(.+?)[ \t]*$/gim;

/** Normalize a trailer to its identity key for distinct-counting (email if present, else the whole line). */
function coAuthorKey(trailer: string): string {
  const angle = /<([^<>]+)>/.exec(trailer);
  return (angle ? angle[1] : trailer).trim().toLowerCase();
}

export const coAuthorship: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(CO_AUTHORSHIP, "No commits in the analyzed history.");
  }
  let commitsWithCoAuthors = 0;
  let totalCoAuthorTrailers = 0;
  const distinct = new Set<string>();
  for (const commit of model.commits) {
    let commitHasCoAuthor = false;
    for (const match of commit.message.matchAll(CO_AUTHOR_TRAILER)) {
      const key = coAuthorKey(match[1]);
      if (key === "") {
        continue; // a `Co-authored-by:` line with no identity is malformed — not a signal
      }
      totalCoAuthorTrailers += 1;
      commitHasCoAuthor = true;
      distinct.add(key);
    }
    if (commitHasCoAuthor) {
      commitsWithCoAuthors += 1;
    }
  }
  return computed(CO_AUTHORSHIP, {
    commitsWithCoAuthors,
    coAuthoredSharePct: round((commitsWithCoAuthors / model.commits.length) * 100),
    totalCoAuthorTrailers,
    distinctCoAuthors: distinct.size,
  });
};

/** Group B in stable registry order. */
export const GROUP_B_METRICS: RegisteredMetric[] = [
  { spec: CONTRIBUTOR_COUNT, fn: contributorCount },
  { spec: CONTRIBUTION_DISTRIBUTION, fn: contributionDistribution },
  { spec: BUS_FACTOR, fn: busFactor },
  { spec: NEW_DEPARTED, fn: newDepartedContributors },
  { spec: OWNERSHIP_BY_AREA, fn: ownershipByArea },
  { spec: CO_AUTHORSHIP, fn: coAuthorship },
];
