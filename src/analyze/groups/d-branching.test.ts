import { describe, it, expect } from "vitest";

import {
  topologySummary,
  mergeVsRebase,
  directToDefault,
  longLivedBranches,
  averageChangesPerMerge,
  GROUP_D_METRICS,
} from "./d-branching.js";
import { buildModel, type AnalysisContext } from "../model.js";
import { emptyMailmap } from "../identity.js";
import type { RepoHistory, RawCommit, ChangedFile } from "../../retrieve/retrieve.port.js";

function ctx(): AnalysisContext {
  return { analysisTimestamp: "2024-06-01T00:00:00.000Z", timezone: "UTC", mailmap: emptyMailmap() };
}

const AUTHOR = { name: "A", email: "a@example.com" };
function commit(sha: string, parents: string[], committedAt: string, files: ChangedFile[] = []): RawCommit {
  return {
    sha,
    author: AUTHOR,
    committer: AUTHOR,
    authoredAt: committedAt,
    committedAt,
    message: parents.length >= 2 ? `Merge ${sha}` : sha,
    parents,
    files,
  };
}

/**
 * A feature-branch topology:
 *   mainline: c1 (root) → c2 → m1 (merge)
 *   feature:  f1 → f2 (branched off c2, merged at m1)
 * f1 is committed ~40 days before m1 (long-lived). The merge m1 has NO numstat
 * (git omits merge diffs), but the branch commits carry real churn.
 */
const FEATURE: RepoHistory = {
  repoTarget: "/repo",
  commits: [
    commit("c1", [], "2024-01-01T10:00:00.000Z", [{ path: "a.ts", additions: 10, deletions: 0 }]),
    commit("c2", ["c1"], "2024-01-05T10:00:00.000Z", [{ path: "a.ts", additions: 5, deletions: 1 }]),
    commit("f1", ["c2"], "2024-02-01T10:00:00.000Z", [{ path: "b.ts", additions: 30, deletions: 0 }]), // branch start, 40d before merge
    commit("f2", ["f1"], "2024-03-10T10:00:00.000Z", [{ path: "b.ts", additions: 20, deletions: 5 }]),
    commit("m1", ["c2", "f2"], "2024-03-12T10:00:00.000Z", []), // merge: empty numstat by design
  ],
};

// A purely linear history (no merges).
const LINEAR: RepoHistory = {
  repoTarget: "/repo",
  commits: [
    commit("a1", [], "2024-01-01T10:00:00.000Z", [{ path: "x.ts", additions: 4, deletions: 0 }]),
    commit("a2", ["a1"], "2024-01-02T10:00:00.000Z", [{ path: "x.ts", additions: 2, deletions: 1 }]),
    commit("a3", ["a2"], "2024-01-03T10:00:00.000Z", [{ path: "x.ts", additions: 1, deletions: 1 }]),
  ],
};

const EMPTY: RepoHistory = { repoTarget: "/x", commits: [] };
const model = (h: RepoHistory) => buildModel(h, ctx());

describe("topologySummary", () => {
  it("counts merges, roots, and classifies a merge-based workflow", () => {
    const v = topologySummary(model(FEATURE), ctx()).value as {
      totalCommits: number; mergeCommitCount: number; rootCommitCount: number; octopusMergeCount: number; workflow: string;
    };
    expect(v.totalCommits).toBe(5);
    expect(v.mergeCommitCount).toBe(1);
    expect(v.rootCommitCount).toBe(1);
    expect(v.octopusMergeCount).toBe(0);
    expect(v.workflow).toBe("merge-based");
  });

  it("classifies a linear workflow", () => {
    const v = topologySummary(model(LINEAR), ctx()).value as { workflow: string; mergeCommitCount: number };
    expect(v.mergeCommitCount).toBe(0);
    expect(v.workflow).toBe("linear");
  });

  it("is not_available for empty history", () => {
    expect(topologySummary(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("mergeVsRebase", () => {
  it("reports linear tendency for a no-merge history", () => {
    const v = mergeVsRebase(model(LINEAR), ctx()).value as { tendency: string; firstParentLinearityPct: number };
    expect(v.tendency).toBe("linear");
    expect(v.firstParentLinearityPct).toBe(100); // every commit on the first-parent chain
  });

  it("reports a merge-heavy tendency when merge share is high", () => {
    const v = mergeVsRebase(model(FEATURE), ctx()).value as { tendency: string; mergeSharePct: number };
    // 1 merge of 5 commits = 20% ≥ 15% threshold
    expect(v.mergeSharePct).toBe(20);
    expect(v.tendency).toBe("merge-heavy");
  });

  it("is not_available for empty history", () => {
    expect(mergeVsRebase(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("directToDefault", () => {
  it("counts non-merge mainline commits as direct, branch commits as via-merge", () => {
    const v = directToDefault(model(FEATURE), ctx()).value as {
      directToDefaultCount: number; viaMergeCount: number; mainlineCommitCount: number; totalCommits: number;
    };
    // mainline = m1, c2, c1 (first-parent chain). Non-merge mainline = c1, c2 → 2 direct.
    expect(v.mainlineCommitCount).toBe(3); // m1, c2, c1
    expect(v.directToDefaultCount).toBe(2); // c1, c2 (m1 is a merge)
    expect(v.viaMergeCount).toBe(3); // m1 + f1 + f2
    expect(v.totalCommits).toBe(5);
  });

  it("is 100% direct for a linear history", () => {
    const v = directToDefault(model(LINEAR), ctx()).value as { directToDefaultSharePct: number };
    expect(v.directToDefaultSharePct).toBe(100);
  });
});

describe("longLivedBranches", () => {
  it("detects the 40-day feature branch", () => {
    const v = longLivedBranches(model(FEATURE), ctx()).value as {
      longLivedBranchCount: number; mergesAnalyzed: number; branchesWithUniqueCommits: number; longestBranchDays: number;
    };
    expect(v.mergesAnalyzed).toBe(1);
    expect(v.branchesWithUniqueCommits).toBe(1);
    expect(v.longLivedBranchCount).toBe(1); // f1 (Feb 1) → m1 (Mar 12) ≈ 40d > 30d
    expect(v.longestBranchDays).toBeGreaterThan(30);
  });

  it("is not_available when there are no merge commits", () => {
    const m = longLivedBranches(model(LINEAR), ctx());
    expect(m.status).toBe("not_available");
    expect(m.reason).toContain("merge");
  });

  it("is not_available for empty history", () => {
    expect(longLivedBranches(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("averageChangesPerMerge", () => {
  it("measures the INTEGRATED branch churn, not the merge's own (empty) numstat", () => {
    const v = averageChangesPerMerge(model(FEATURE), ctx()).value as {
      mergeCount: number; averageIntegratedChanges: number; maxIntegratedChanges: number; mergesWithNoUniqueCommits: number;
    };
    // Branch f1 (30+0) + f2 (20+5) = 55 integrated changes. The merge m1's own numstat is empty (0).
    expect(v.mergeCount).toBe(1);
    expect(v.averageIntegratedChanges).toBe(55); // NOT 0 — the regression guard
    expect(v.maxIntegratedChanges).toBe(55);
    expect(v.mergesWithNoUniqueCommits).toBe(0);
  });

  it("is not_available when there are no merge commits", () => {
    expect(averageChangesPerMerge(model(LINEAR), ctx()).status).toBe("not_available");
  });
});

describe("Group D determinism / serialization", () => {
  it("emits only JSON-serializable values (no Map/Set/Date) and is stable across runs", () => {
    const m = model(FEATURE);
    const a = GROUP_D_METRICS.map((e) => JSON.stringify(e.fn(m, ctx()).value)).join("\n");
    const b = GROUP_D_METRICS.map((e) => JSON.stringify(e.fn(m, ctx()).value)).join("\n");
    expect(a).toBe(b);
    expect(a).not.toContain("[object");
  });

  it("handles a degenerate merge whose second parent is already on the mainline (0 integrated)", () => {
    // c1 → c2 → c3, with m = merge(c3, c2): c2 is already an ancestor on the mainline.
    const degenerate: RepoHistory = {
      repoTarget: "/x",
      commits: [
        commit("c1", [], "2024-01-01T10:00:00.000Z", [{ path: "a", additions: 1, deletions: 0 }]),
        commit("c2", ["c1"], "2024-01-02T10:00:00.000Z", [{ path: "a", additions: 1, deletions: 0 }]),
        commit("c3", ["c2"], "2024-01-03T10:00:00.000Z", [{ path: "a", additions: 1, deletions: 0 }]),
        commit("m", ["c3", "c2"], "2024-01-04T10:00:00.000Z", []),
      ],
    };
    const v = averageChangesPerMerge(model(degenerate), ctx()).value as { mergesWithNoUniqueCommits: number; averageIntegratedChanges: number };
    expect(v.mergesWithNoUniqueCommits).toBe(1);
    expect(v.averageIntegratedChanges).toBe(0); // no unique commits integrated, no NaN/throw
  });

  it("picks the tip deterministically when there are multiple leaves (order-independent)", () => {
    // Two independent roots/leaves; the later-by-[committedAtMs,sha] leaf is the tip.
    // d2 (Feb) is later than b2 (Jan), so the mainline is d2's chain → direct count reflects d2's branch.
    const twoLeaves: RepoHistory = {
      repoTarget: "/x",
      commits: [
        commit("b1", [], "2024-01-01T10:00:00.000Z", [{ path: "a", additions: 1, deletions: 0 }]),
        commit("b2", ["b1"], "2024-01-02T10:00:00.000Z", [{ path: "a", additions: 1, deletions: 0 }]),
        commit("d1", [], "2024-02-01T10:00:00.000Z", [{ path: "b", additions: 1, deletions: 0 }]),
        commit("d2", ["d1"], "2024-02-02T10:00:00.000Z", [{ path: "b", additions: 1, deletions: 0 }]),
      ],
    };
    const forward = directToDefault(buildModel(twoLeaves, ctx()), ctx()).value as { mainlineCommitCount: number };
    const reversed = directToDefault(
      buildModel({ repoTarget: "/x", commits: [...twoLeaves.commits].reverse() }, ctx()),
      ctx(),
    ).value as { mainlineCommitCount: number };
    // Tip = d2 → mainline {d2, d1} = 2 commits, regardless of input order.
    expect(forward.mainlineCommitCount).toBe(2);
    expect(reversed.mainlineCommitCount).toBe(2);
  });
});
