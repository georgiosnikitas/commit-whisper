import { describe, it, expect } from "vitest";

import { buildModel, type AnalysisContext } from "./model.js";
import { emptyMailmap, parseMailmap } from "./identity.js";
import type { RepoHistory } from "../retrieve/retrieve.port.js";
import { MetricsError } from "../shared/errors.js";
import { SYNTHETIC_HISTORY, SYNTHETIC_MAILMAP } from "./sample-history.js";

function ctx(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    analysisTimestamp: "2024-03-01T00:00:00.000Z",
    timezone: "UTC",
    mailmap: emptyMailmap(),
    ...overrides,
  };
}

describe("buildModel", () => {
  it("orders commits by [committerDate, sha] regardless of input order", () => {
    const shuffled: RepoHistory = {
      repoTarget: "/x",
      commits: [...SYNTHETIC_HISTORY.commits].reverse(),
    };
    const model = buildModel(shuffled, ctx());
    expect(model.commits.map((c) => c.sha)).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("breaks a committer-date tie by sha", () => {
    const sameInstant = "2024-01-01T00:00:00.000Z";
    const history: RepoHistory = {
      repoTarget: "/x",
      commits: ["c2", "c1", "c3"].map((sha) => ({
        sha,
        author: { name: "A", email: "a@x.com" },
        committer: { name: "A", email: "a@x.com" },
        authoredAt: sameInstant,
        committedAt: sameInstant,
        message: "m",
        parents: [],
        files: [],
      })),
    };
    expect(buildModel(history, ctx()).commits.map((c) => c.sha)).toEqual(["c1", "c2", "c3"]);
  });

  it("canonicalizes identities via the injected mailmap (Alice collapse)", () => {
    const model = buildModel(SYNTHETIC_HISTORY, ctx({ mailmap: parseMailmap(SYNTHETIC_MAILMAP) }));
    const aliceCommits = model.commits.filter((c) => c.author.email === "alice@example.com");
    expect(aliceCommits.map((c) => c.sha).sort((a, b) => a.localeCompare(b))).toEqual(["c1", "c3"]);
    // Two distinct authors after canonicalization: alice + bob.
    expect(model.authors.map((a) => a.identity.email)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("excludes binary files from line totals but counts them in changedFileCount", () => {
    const model = buildModel(SYNTHETIC_HISTORY, ctx());
    const c2 = model.commits.find((c) => c.sha === "c2");
    expect(c2?.additions).toBe(40); // binary logo.png excluded
    expect(c2?.deletions).toBe(2);
    expect(c2?.changedFileCount).toBe(2); // but counted as a changed file
  });

  it("returns empty arrays for empty history", () => {
    const model = buildModel({ repoTarget: "/x", commits: [] }, ctx());
    expect(model.commits).toEqual([]);
    expect(model.authors).toEqual([]);
  });

  it("throws MetricsError (exit 5) on an unparseable commit timestamp (fail loud, not NaN)", () => {
    const bad: RepoHistory = {
      repoTarget: "/x",
      commits: [
        {
          sha: "c1",
          author: { name: "A", email: "a@x.com" },
          committer: { name: "A", email: "a@x.com" },
          authoredAt: "not-a-date",
          committedAt: "not-a-date",
          message: "m",
          parents: [],
          files: [],
        },
      ],
    };
    expect(() => buildModel(bad, ctx())).toThrow(MetricsError);
    try {
      buildModel(bad, ctx());
    } catch (e) {
      expect((e as MetricsError).exitCode).toBe(5);
    }
  });

  it("throws MetricsError on an unparseable analysisTimestamp", () => {
    expect(() => buildModel(SYNTHETIC_HISTORY, ctx({ analysisTimestamp: "bogus" }))).toThrow(
      MetricsError,
    );
  });
});
