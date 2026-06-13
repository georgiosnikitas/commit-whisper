/**
 * Group C — Commit Message Quality metrics (Story 2.2, PRD §4.2).
 *
 * Six pure metric functions over the shared `RepoModel`, reading ONLY
 * `commit.message` (the full raw `%B`). Each returns the uniform `Metric`
 * envelope; an uncomputable metric returns `not_available` with a precise
 * reason (never throws, never omitted). The heuristic metrics (Conventional
 * Commits, imperative-mood, issue-reference, revert/fixup) DOCUMENT their rule
 * as commented module constants below, per AC2.
 *
 * Determinism: pure function of the message text; map-like values are emitted as
 * key-sorted plain objects; regexes used for boolean checks are NON-GLOBAL (a
 * `/g` regex carries a stateful `lastIndex` across `.test()` calls) and counting
 * uses `String.matchAll`. Shares are rounded for stable JSON.
 */

import type { MetricSpec } from "../metric.js";
import { computed, notAvailable } from "../metric.js";
import type { MetricFn, NormalizedCommit, RegisteredMetric } from "../model.js";
import { compareCodeUnits } from "../model.js";
import { mean, median, percentile, round } from "../stats.js";

// ── Documented heuristic rules (AC2) — each rule lives here as a named constant ──

/** Conventional Commits types (the Angular convention set). [ASSUMPTION] */
const CONVENTIONAL_TYPES = [
  "feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert",
] as const;

/** A subject is adherent iff it matches `type(scope)?!?: description` (non-global — used with `.test`). */
const CONVENTIONAL_RE = new RegExp(String.raw`^(${CONVENTIONAL_TYPES.join("|")})(\([^)]+\))?!?: .+`);

/** Strip a Conventional-Commits prefix to isolate the description (non-global). */
const CONVENTIONAL_PREFIX_RE = new RegExp(String.raw`^(${CONVENTIONAL_TYPES.join("|")})(\([^)]+\))?!?:\s*`);

/**
 * Issue/ticket references (each non-global). [ASSUMPTION]
 *   - `#123`                    GitHub / GitLab numeric reference
 *   - `PROJ-123`                JIRA-style project key (≥2 leading caps, then digits)
 *   - `/issues|pull|merge_requests/123`  a forge URL path
 */
const ISSUE_REF_RES = [
  /#\d+/,
  /\b[A-Z][A-Z0-9]+-\d+\b/,
  /\/(?:issues|pull|merge_requests)\/\d+/,
];

/** Closed low-information single-token subject set (lowercased). */
const BOILERPLATE_SUBJECTS = new Set<string>([
  "wip", "fix", "fixes", "fixed", "update", "updates", "updated", "changes", "change",
  "stuff", "misc", "tmp", "temp", "test", "tests", "minor", "cleanup", "cleanups", ".", "...",
]);

/**
 * Revert/fixup/squash markers (subject prefixes). NOTE: a plain `git commit
 * --amend` rewrites a commit in place and leaves NO message marker, so amends
 * are intentionally not message-detectable here.
 */
const REVERT_PREFIXES = ['revert "', "revert:", "revert "];
const FIXUP_PREFIX = "fixup!";
const SQUASH_PREFIX = "squash!";

// ── Pure message-parsing helpers (mirror Group A's local helpers) ──

/** The first line of a message, trimmed (`""` for an empty/whitespace message). */
function subjectOf(message: string): string {
  const newline = message.indexOf("\n");
  return (newline === -1 ? message : message.slice(0, newline)).trim();
}

/** Everything after the first line, trimmed (`""` when there is no body). */
function bodyOf(message: string): string {
  const newline = message.indexOf("\n");
  return newline === -1 ? "" : message.slice(newline + 1).trim();
}

/** Count of whitespace-separated non-empty tokens. */
function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Reduce-based min/max (avoids `Math.min(...arr)` argument-spread overflow on
 * large repos). Self-safe: returns `0` for an empty array so the function holds
 * its own precondition even if a future caller forgets the empty-history guard.
 */
function minOf(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((m, v) => (v < m ? v : m), values[0]);
}
function maxOf(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((m, v) => (v > m ? v : m), values[0]);
}

/** Percentage of `part` in `total`, rounded (2 dp); `0` when the total is zero. */
function sharePct(part: number, total: number): number {
  return total === 0 ? 0 : round((part / total) * 100);
}

export const LENGTH_DIST: MetricSpec = { id: "c-message-length-distribution", group: "C", title: "Message length distribution" };
export const CONVENTIONAL: MetricSpec = { id: "c-conventional-commits", group: "C", title: "Conventional Commits adherence" };
export const IMPERATIVE: MetricSpec = { id: "c-imperative-mood", group: "C", title: "Imperative-mood / style signal" };
export const LOW_INFO: MetricSpec = { id: "c-low-information-rate", group: "C", title: "Low-information message rate" };
export const ISSUE_REF: MetricSpec = { id: "c-issue-reference-rate", group: "C", title: "Issue/ticket reference rate" };
export const REVERT_FIXUP: MetricSpec = { id: "c-revert-fixup-signal", group: "C", title: "Revert / fixup / amend signal" };

export const messageLengthDistribution: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(LENGTH_DIST, "No commits in the analyzed history.");
  }
  const subjectLengths = model.commits.map((c) => subjectOf(c.message).length);
  const emptyMessageCount = subjectLengths.filter((len) => len === 0).length;
  const withBody = model.commits.filter((c) => bodyOf(c.message) !== "").length;
  return computed(LENGTH_DIST, {
    subjectLength: {
      min: minOf(subjectLengths),
      median: round(median(subjectLengths) ?? 0),
      p90: round(percentile(subjectLengths, 90) ?? 0),
      max: maxOf(subjectLengths),
      mean: round(mean(subjectLengths) ?? 0),
    },
    emptyMessageCount,
    withBodySharePct: sharePct(withBody, model.commits.length),
    commitCount: model.commits.length,
  });
};

/** Non-empty subjects only — the denominator for the subject-style heuristics. */
function nonEmptySubjects(commits: readonly NormalizedCommit[]): string[] {
  return commits.map((c) => subjectOf(c.message)).filter((s) => s !== "");
}

export const conventionalCommits: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(CONVENTIONAL, "No commits in the analyzed history.");
  }
  const subjects = nonEmptySubjects(model.commits);
  if (subjects.length === 0) {
    return notAvailable(CONVENTIONAL, "No non-empty commit subjects to assess.");
  }
  const counts = new Map<string, number>();
  let adherentCount = 0;
  for (const subject of subjects) {
    const match = CONVENTIONAL_RE.exec(subject);
    if (match !== null) {
      adherentCount += 1;
      const type = match[1];
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  const byType: Record<string, number> = {};
  for (const type of [...counts.keys()].sort(compareCodeUnits)) {
    byType[type] = counts.get(type) ?? 0;
  }
  return computed(CONVENTIONAL, {
    adherentCount,
    adherenceSharePct: sharePct(adherentCount, subjects.length),
    byType,
    subjectsConsidered: subjects.length,
  });
};

/** The description after stripping any Conventional-Commits prefix. */
function descriptionOf(subject: string): string {
  return subject.replace(CONVENTIONAL_PREFIX_RE, "").trim();
}

export const imperativeMood: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(IMPERATIVE, "No commits in the analyzed history.");
  }
  const subjects = nonEmptySubjects(model.commits);
  if (subjects.length === 0) {
    return notAvailable(IMPERATIVE, "No non-empty commit subjects to assess.");
  }
  let imperative = 0;
  let capitalized = 0;
  let noTrailingPeriod = 0;
  for (const subject of subjects) {
    const description = descriptionOf(subject);
    const firstWord = description.split(/\s+/)[0] ?? "";
    // Documented heuristic: a description is NON-imperative when its first word
    // ends in "ed" (past tense) or "ing" (gerund) — the two reliable signals.
    const lower = firstWord.toLowerCase();
    const isNonImperative = lower.length > 3 && (lower.endsWith("ed") || lower.endsWith("ing"));
    if (!isNonImperative && firstWord !== "") {
      imperative += 1;
    }
    if (/^[A-Z]/.test(description)) {
      capitalized += 1;
    }
    if (!subject.endsWith(".")) {
      noTrailingPeriod += 1;
    }
  }
  return computed(IMPERATIVE, {
    subjectsConsidered: subjects.length,
    imperativeMoodSharePct: sharePct(imperative, subjects.length),
    capitalizedSubjectSharePct: sharePct(capitalized, subjects.length),
    noTrailingPeriodSharePct: sharePct(noTrailingPeriod, subjects.length),
  });
};

export const lowInformationRate: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(LOW_INFO, "No commits in the analyzed history.");
  }
  let emptyCount = 0;
  let singleWordCount = 0;
  let boilerplateCount = 0;
  let lowInfoCount = 0;
  for (const commit of model.commits) {
    const subject = subjectOf(commit.message);
    const words = wordCount(subject);
    const isEmpty = subject === "";
    const isSingleWord = words === 1;
    const isBoilerplate = words === 1 && BOILERPLATE_SUBJECTS.has(subject.toLowerCase());
    if (isEmpty) {
      emptyCount += 1;
    }
    if (isSingleWord) {
      singleWordCount += 1;
    }
    if (isBoilerplate) {
      boilerplateCount += 1;
    }
    if (isEmpty || isSingleWord || isBoilerplate) {
      lowInfoCount += 1;
    }
  }
  return computed(LOW_INFO, {
    lowInfoCount,
    lowInfoSharePct: sharePct(lowInfoCount, model.commits.length),
    emptyCount,
    singleWordCount,
    boilerplateCount,
    commitCount: model.commits.length,
  });
};

/** True if the full message references an issue/ticket (any documented pattern). */
function referencesIssue(message: string): boolean {
  return ISSUE_REF_RES.some((re) => re.test(message));
}

export const issueReferenceRate: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(ISSUE_REF, "No commits in the analyzed history.");
  }
  const withReferenceCount = model.commits.filter((c) => referencesIssue(c.message)).length;
  return computed(ISSUE_REF, {
    withReferenceCount,
    referenceSharePct: sharePct(withReferenceCount, model.commits.length),
    commitCount: model.commits.length,
  });
};

export const revertFixupSignal: MetricFn = (model) => {
  if (model.commits.length === 0) {
    return notAvailable(REVERT_FIXUP, "No commits in the analyzed history.");
  }
  let revertCount = 0;
  let fixupCount = 0;
  let squashCount = 0;
  for (const commit of model.commits) {
    const lower = subjectOf(commit.message).toLowerCase();
    if (REVERT_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
      revertCount += 1;
    }
    if (lower.startsWith(FIXUP_PREFIX)) {
      fixupCount += 1;
    }
    if (lower.startsWith(SQUASH_PREFIX)) {
      squashCount += 1;
    }
  }
  const churnOfIntentCount = revertCount + fixupCount + squashCount;
  return computed(REVERT_FIXUP, {
    revertCount,
    fixupCount,
    squashCount,
    churnOfIntentCount,
    churnOfIntentSharePct: sharePct(churnOfIntentCount, model.commits.length),
    commitCount: model.commits.length,
  });
};

/** Group C in stable registry order. */
export const GROUP_C_METRICS: RegisteredMetric[] = [
  { spec: LENGTH_DIST, fn: messageLengthDistribution },
  { spec: CONVENTIONAL, fn: conventionalCommits },
  { spec: IMPERATIVE, fn: imperativeMood },
  { spec: LOW_INFO, fn: lowInformationRate },
  { spec: ISSUE_REF, fn: issueReferenceRate },
  { spec: REVERT_FIXUP, fn: revertFixupSignal },
];
