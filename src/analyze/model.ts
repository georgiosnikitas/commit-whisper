/**
 * The shared normalized model, built once (Story 1.5 — C2 hybrid topology).
 *
 * `buildModel` is the single expensive pass over the raw `RepoHistory`: it
 * canonicalizes identities, derives per-commit totals, and imposes the
 * deterministic total order `[committerDate, sha]`. Every metric is then a pure
 * function over this model. All time/identity inputs are injected via
 * `AnalysisContext` (never `Date.now()`, never the filesystem) so the result is
 * a pure function of `(history, ctx)` — the precondition for byte-identical
 * determinism.
 */

import type { RepoHistory } from "../retrieve/retrieve.port.js";
import type { Metric, MetricSpec } from "./metric.js";
import type { CanonicalIdentity, MailmapIndex } from "./identity.js";
import { canonicalizeIdentity } from "./identity.js";
import { MetricsError } from "../shared/errors.js";

export interface AnalysisContext {
  analysisTimestamp: string; // ISO-8601; the C2 determinism anchor
  timezone: string; // IANA tz; governs bucketing display (default "UTC")
  mailmap: MailmapIndex;
}

/** A normalized per-file change record. `null` add/del marks a binary file (git `-`). */
export interface FileChange {
  path: string;
  additions: number | null;
  deletions: number | null;
}

export interface NormalizedCommit {
  sha: string;
  author: CanonicalIdentity;
  committer: CanonicalIdentity;
  authoredAtMs: number; // epoch ms (UTC)
  committedAtMs: number; // epoch ms (UTC); primary sort key
  message: string;
  parents: string[];
  additions: number; // text-file line additions (binary excluded)
  deletions: number; // text-file line deletions (binary excluded)
  changedFileCount: number; // all changed files, incl. binary
  files: FileChange[]; // per-file records (raw git order); powers Group B ownership + Group E hotspots
}

export interface AuthorSummary {
  identity: CanonicalIdentity;
  commitCount: number;
  firstCommittedAtMs: number;
  lastCommittedAtMs: number;
}

export interface RepoModel {
  repoTarget: string;
  analysisTimestampMs: number;
  timezone: string;
  commits: NormalizedCommit[]; // ordered by [committedAtMs, sha]
  authors: AuthorSummary[]; // ordered by canonical identity
}

/** A pure metric computation over the shared model. */
export type MetricFn = (model: RepoModel, ctx: AnalysisContext) => Metric;

/** A metric paired with its identity, so the engine knows it even if `fn` throws. */
export interface RegisteredMetric {
  spec: MetricSpec;
  fn: MetricFn;
}

function identityKey(id: CanonicalIdentity): string {
  return `${id.email}\x00${id.name}`;
}

/**
 * Deterministic code-unit string comparison. Deliberately NOT `localeCompare`,
 * whose ordering depends on the runtime locale and would break byte-identical
 * determinism (AC2).
 */
export function compareCodeUnits(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** Total order `[committerDate, sha]`: committer date ascending, sha as tiebreaker. */
function byCommitterDateThenSha(a: NormalizedCommit, b: NormalizedCommit): number {
  if (a.committedAtMs !== b.committedAtMs) {
    return a.committedAtMs - b.committedAtMs;
  }
  return compareCodeUnits(a.sha, b.sha);
}

/**
 * Parse an ISO-8601 timestamp to epoch ms, failing LOUD on a non-finite result.
 * Git emits strict `%cI`/`%aI` (offset-qualified) so this never fires in the real
 * pipeline; a bad value from any future input source becomes a typed, scriptable
 * `MetricsError` (exit 5) instead of a silent `NaN` that would corrupt ordering
 * and propagate `NaN -> null` through every metric (determinism integrity).
 */
function parseInstant(iso: string, label: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new MetricsError(`Unparseable ${label} timestamp: "${iso}".`);
  }
  return ms;
}

export function buildModel(history: RepoHistory, ctx: AnalysisContext): RepoModel {
  const commits: NormalizedCommit[] = history.commits.map((c) => {
    let additions = 0;
    let deletions = 0;
    for (const file of c.files) {
      if (file.additions !== null) {
        additions += file.additions;
      }
      if (file.deletions !== null) {
        deletions += file.deletions;
      }
    }
    return {
      sha: c.sha,
      author: canonicalizeIdentity(c.author, ctx.mailmap),
      committer: canonicalizeIdentity(c.committer, ctx.mailmap),
      authoredAtMs: parseInstant(c.authoredAt, "author"),
      committedAtMs: parseInstant(c.committedAt, "committer"),
      message: c.message,
      parents: c.parents,
      additions,
      deletions,
      changedFileCount: c.files.length,
      files: c.files.map((f) => ({ path: f.path, additions: f.additions, deletions: f.deletions })),
    };
  });

  commits.sort(byCommitterDateThenSha);

  return {
    repoTarget: history.repoTarget,
    analysisTimestampMs: parseInstant(ctx.analysisTimestamp, "analysis"),
    timezone: ctx.timezone,
    commits,
    authors: summarizeAuthors(commits),
  };
}

function summarizeAuthors(commits: NormalizedCommit[]): AuthorSummary[] {
  const byKey = new Map<string, AuthorSummary>();
  for (const commit of commits) {
    const key = identityKey(commit.author);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {
        identity: commit.author,
        commitCount: 1,
        firstCommittedAtMs: commit.committedAtMs,
        lastCommittedAtMs: commit.committedAtMs,
      });
    } else {
      existing.commitCount += 1;
      existing.firstCommittedAtMs = Math.min(existing.firstCommittedAtMs, commit.committedAtMs);
      existing.lastCommittedAtMs = Math.max(existing.lastCommittedAtMs, commit.committedAtMs);
    }
  }
  // Sort by canonical identity (email then name) — never Map insertion order.
  return [...byKey.values()].sort((a, b) =>
    compareCodeUnits(identityKey(a.identity), identityKey(b.identity)),
  );
}
