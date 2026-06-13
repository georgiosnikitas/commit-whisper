/**
 * Commit-selection stage (Story 2.6, FR-1).
 *
 * A PURE filter inserted between retrieve and analyze: it narrows the raw
 * `RepoHistory` BEFORE `buildModel`, so all 32 catalog metrics (Groups A–F)
 * automatically compute over exactly the selected set — `no-merges` and the rest
 * change every group's values consistently with zero per-metric change (AC3).
 *
 * Filters apply in a FIXED, documented order so Story 2.7's Free cap composes
 * cleanly after: (1) no-merges → (2) author → (3) date range → (4) max-commits.
 * The cap is LAST (date-then-cap), keeping the most-recent N by the model's total
 * order `[committedAtMs, sha]`. Date bounds are interpreted at DAY granularity in
 * the configured timezone (reusing Group A's `dayBucket`); an empty bound is
 * unbounded on that side. No I/O, no clock, no env — deterministic by construction.
 */

import type { RepoHistory, RawCommit } from "../retrieve/retrieve.port.js";
import type { RunConfig } from "../config/run-config.js";
import { compareCodeUnits } from "./model.js";
import { dayBucket } from "./time.js";

export interface SelectionCriteria {
  authorFilter?: string;
  maxCommits?: number;
  noMerges: boolean;
  startDate?: string;
  endDate?: string;
  timezone: string;
}

/** Project the frozen `RunConfig`'s selection fields into criteria (no env/argv access). */
export function projectSelection(config: RunConfig): SelectionCriteria {
  return {
    authorFilter: config.authorFilter,
    maxCommits: config.maxCommits,
    noMerges: config.noMerges,
    startDate: config.startDate,
    endDate: config.endDate,
    timezone: config.timezone,
  };
}

/** A merge commit has two or more parents (consistent with Group D's `isMerge`). */
function isMerge(commit: RawCommit): boolean {
  return commit.parents.length >= 2;
}

/** Case-insensitive substring match of the author's name OR email against `query`. */
function matchesAuthor(commit: RawCommit, query: string): boolean {
  return (
    commit.author.name.toLowerCase().includes(query) ||
    commit.author.email.toLowerCase().includes(query)
  );
}

/**
 * The commit's day bucket in the timezone is within `[startDay, endDay]` (inclusive).
 * A bound is the date component (`YYYY-MM-DD`) of the criteria string; an empty/absent
 * bound is unbounded on that side. Lexical compare of `YYYY-MM-DD` = chronological.
 */
function withinDateRange(commit: RawCommit, startDay: string | undefined, endDay: string | undefined, timezone: string): boolean {
  if (startDay === undefined && endDay === undefined) {
    return true;
  }
  const ms = Date.parse(commit.committedAt);
  if (!Number.isFinite(ms)) {
    return false; // cannot place an unparseable date in range (defensive; git emits valid %cI)
  }
  const commitDay = dayBucket(ms, timezone);
  if (startDay !== undefined && commitDay < startDay) {
    return false;
  }
  if (endDay !== undefined && commitDay > endDay) {
    return false;
  }
  return true;
}

/**
 * The date component (`YYYY-MM-DD`) of a bound, or `undefined` for an empty/absent
 * or MALFORMED bound. Requiring a well-formed `YYYY-MM-DD` shape prevents a partial
 * bound (`"2024-03"`) or garbage (`"hello"`) from silently producing a wrong
 * lexical comparison — such a bound is treated as unbounded (the flag path rejects
 * it with a usage error; full semantic date validation is the deferred Zod story).
 */
function dayBound(bound: string | undefined): string | undefined {
  const trimmed = bound?.trim();
  if (trimmed === undefined || trimmed === "") {
    return undefined;
  }
  const day = trimmed.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
}

/** Keep the most-recent N commits by the model's total order `[committedAtMs, sha]`. */
function capMostRecent(commits: RawCommit[], maxCommits: number | undefined): RawCommit[] {
  if (maxCommits === undefined || maxCommits <= 0 || commits.length <= maxCommits) {
    return commits;
  }
  const ordered = [...commits].sort((a, b) => {
    // A non-finite (unparseable) date sorts deterministically to the oldest end;
    // git emits valid %cI so this is defensive — `buildModel` remains the authority
    // that fails loud on a truly bad timestamp. The comparator stays TOTAL.
    const am = Date.parse(a.committedAt);
    const bm = Date.parse(b.committedAt);
    const af = Number.isFinite(am) ? am : Number.NEGATIVE_INFINITY;
    const bf = Number.isFinite(bm) ? bm : Number.NEGATIVE_INFINITY;
    if (af !== bf) {
      return af < bf ? -1 : 1;
    }
    return compareCodeUnits(a.sha, b.sha);
  });
  return ordered.slice(-maxCommits);
}

/**
 * Narrow a raw `RepoHistory` per the selection criteria (pure). Order: no-merges →
 * author → date range → max-commits cap. Returns a new history; the input is untouched.
 */
export function selectCommits(history: RepoHistory, criteria: SelectionCriteria): RepoHistory {
  const authorQuery = criteria.authorFilter?.trim().toLowerCase();
  const startDay = dayBound(criteria.startDate);
  const endDay = dayBound(criteria.endDate);

  let commits = history.commits;
  if (criteria.noMerges) {
    commits = commits.filter((c) => !isMerge(c));
  }
  if (authorQuery !== undefined && authorQuery !== "") {
    commits = commits.filter((c) => matchesAuthor(c, authorQuery));
  }
  if (startDay !== undefined || endDay !== undefined) {
    commits = commits.filter((c) => withinDateRange(c, startDay, endDay, criteria.timezone));
  }
  commits = capMostRecent(commits, criteria.maxCommits);

  return { repoTarget: history.repoTarget, commits };
}
