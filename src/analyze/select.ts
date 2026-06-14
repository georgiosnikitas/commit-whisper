/**
 * Commit-selection stage (Story 2.6, FR-1).
 *
 * A PURE filter inserted between retrieve and analyze: it narrows the raw
 * `RepoHistory` BEFORE `buildModel`, so all 32 catalog metrics (Groups A–F)
 * automatically compute over exactly the selected set — `no-merges` and the rest
 * change every group's values consistently with zero per-metric change (AC3).
 *
 * Filters apply in a FIXED, documented order so the tier cap composes cleanly at
 * the final step: (1) no-merges → (2) author → (3) date range → (4) cap, where the
 * cap is the SMALLER of `maxCommits` and the entitlement `commitCap` (the Free-tier
 * 100-cap; `min`, each absent/≤0 imposing no limit — Story 2.7). The cap is LAST
 * (date-then-cap), keeping the most-recent N by the model's total order
 * `[committedAtMs, sha]`. Date bounds are interpreted at DAY granularity in
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
  /**
   * The resolved entitlement commit cap (Free tier ⇒ 100); `undefined` on paid
   * tiers (no tier cap). Composed with `maxCommits` as `min(...)` at the cap step.
   */
  commitCap?: number;
}

/**
 * A truncation signal for the shell to surface as stderr chrome: the tier cap kept
 * the most-recent `analyzed` of `total` in-scope (post-filter, pre-cap) commits.
 */
export interface TruncationNotice {
  analyzed: number;
  total: number;
}

/** The selection outcome: the narrowed history + an optional tier-cap truncation notice. */
export interface SelectionResult {
  history: RepoHistory;
  truncation?: TruncationNotice;
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
    commitCap: config.entitlement.commitCap,
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

/** Keep the most-recent `cap` commits by the model's total order `[committedAtMs, sha]`. */
function capMostRecent(commits: RawCommit[], cap: number | undefined): RawCommit[] {
  if (cap === undefined || cap <= 0 || commits.length <= cap) {
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
  return ordered.slice(-cap);
}

/**
 * Apply the three set-narrowing filters (no-merges → author → date range) WITHOUT
 * the cap, so both the capped result and the in-scope `total` count derive from a
 * SINGLE filter implementation (no drift). Returns a new array; the input is untouched.
 */
function applyFilters(history: RepoHistory, criteria: SelectionCriteria): RawCommit[] {
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
  return commits;
}

/**
 * Normalize a cap to a whole positive limit, or `undefined` for "no limit". A cap
 * is a COUNT of commits, so a non-integer is floored (`2.5 → 2`) — keeping the
 * reported `analyzed` an integer and `capMostRecent`'s `slice(-cap)` well-defined —
 * and any value `< 1` (incl. ≤0, NaN, ±Infinity) imposes no limit. Defensive: the
 * resolved `commitCap` is the integer 100 and `--max-commits` is CLI-validated, but
 * env/config-file or a future license response could still supply a float.
 */
function realCap(cap: number | undefined): number | undefined {
  if (cap === undefined || !Number.isFinite(cap)) {
    return undefined;
  }
  const whole = Math.floor(cap);
  return whole > 0 ? whole : undefined;
}

/** The smaller of two optional caps; `undefined` means "no limit" on that side. */
function minCap(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return a < b ? a : b;
}

/**
 * Narrow a raw `RepoHistory` per the criteria AND report any tier-cap truncation
 * (pure). Order: no-merges → author → date range → cap, where the cap is the
 * SMALLER of `maxCommits` and the entitlement `commitCap` (`min`; each absent/≤0
 * imposes no limit — Story 2.7). The cap is LAST (date-then-cap), so it acts only
 * within the date window and never reshapes it.
 *
 * A `truncation` notice is returned ONLY when the entitlement cap is the BINDING
 * cap (real, and not beaten by a smaller `maxCommits`) AND it STRICTLY truncated
 * the in-scope set (`total > cap`) — so an explicit smaller `--max-commits`, or an
 * in-scope count at-or-below the cap (incl. exactly equal), surfaces nothing
 * (no misleading "Analyzed N of N"). The input history is untouched.
 */
export function selectCommitsWithNotice(history: RepoHistory, criteria: SelectionCriteria): SelectionResult {
  const filtered = applyFilters(history, criteria);
  const total = filtered.length;

  const userCap = realCap(criteria.maxCommits);
  const tierCap = realCap(criteria.commitCap);
  const commits = capMostRecent(filtered, minCap(userCap, tierCap));

  const truncation: TruncationNotice | undefined =
    tierCap !== undefined && total > tierCap && (userCap === undefined || tierCap <= userCap)
      ? { analyzed: tierCap, total }
      : undefined;

  return { history: { repoTarget: history.repoTarget, commits }, truncation };
}

/**
 * Narrow a raw `RepoHistory` per the selection criteria (pure). A convenience that
 * discards the truncation signal — see `selectCommitsWithNotice` for the shell path
 * that surfaces it. Returns a new history; the input is untouched.
 */
export function selectCommits(history: RepoHistory, criteria: SelectionCriteria): RepoHistory {
  return selectCommitsWithNotice(history, criteria).history;
}
