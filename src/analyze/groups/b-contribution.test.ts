import { describe, it, expect } from "vitest";

import {
  contributorCount,
  contributionDistribution,
  busFactor,
  newDepartedContributors,
  ownershipByArea,
  coAuthorship,
  GROUP_B_METRICS,
} from "./b-contribution.js";
import { buildModel, type AnalysisContext } from "../model.js";
import { emptyMailmap } from "../identity.js";
import type { RepoHistory, RawCommit } from "../../retrieve/retrieve.port.js";

// Fixed analysis time → deterministic active/new/departed windows.
// active/onboard cutoff = 2024-03-03 (90d); depart cutoff = 2023-12-04 (180d).
function ctx(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    analysisTimestamp: "2024-06-01T00:00:00.000Z",
    timezone: "UTC",
    mailmap: emptyMailmap(),
    ...overrides,
  };
}

function commit(over: Partial<RawCommit> & Pick<RawCommit, "sha" | "author" | "committedAt">): RawCommit {
  return {
    committer: over.author,
    authoredAt: over.committedAt,
    message: "m",
    parents: [],
    files: [],
    ...over,
  };
}

const ALICE = { name: "Alice", email: "alice@example.com" };
const BOB = { name: "Bob", email: "bob@example.com" };
const CAROL = { name: "Carol", email: "carol@example.com" };
const DAVE = { name: "Dave", email: "dave@example.com" };

// Skewed distribution (Alice 3 / Bob 1 / Carol 1 / Dave 1), a departed author (Carol),
// a new author (Dave), src/ hotspot, and co-author trailers.
const HISTORY: RepoHistory = {
  repoTarget: "/repo",
  commits: [
    commit({ sha: "k1", author: CAROL, committedAt: "2023-06-01T10:00:00.000Z", files: [{ path: "legacy/old.ts", additions: 20, deletions: 0 }] }),
    commit({ sha: "k2", author: ALICE, committedAt: "2024-01-05T10:00:00.000Z", files: [{ path: "src/app.ts", additions: 30, deletions: 0 }, { path: "src/util.ts", additions: 10, deletions: 0 }] }),
    commit({ sha: "k3", author: BOB, committedAt: "2024-01-20T10:00:00.000Z", files: [{ path: "src/util.ts", additions: 5, deletions: 2 }] }),
    commit({ sha: "k4", author: ALICE, committedAt: "2024-04-15T10:00:00.000Z", files: [{ path: "src/app.ts", additions: 8, deletions: 3 }] }),
    commit({ sha: "k5", author: ALICE, committedAt: "2024-05-01T10:00:00.000Z", message: "Refactor\n\nCo-authored-by: Bob <bob@example.com>", files: [{ path: "src/app.ts", additions: 4, deletions: 1 }] }),
    commit({ sha: "k6", author: DAVE, committedAt: "2024-05-20T10:00:00.000Z", message: "Docs\n\nCo-authored-by: Alice <alice@example.com>\nCo-authored-by: Carol <carol@example.com>", files: [{ path: "docs/readme.md", additions: 15, deletions: 0 }] }),
  ],
};

const EMPTY: RepoHistory = { repoTarget: "/x", commits: [] };
const model = (h: RepoHistory = HISTORY, c: AnalysisContext = ctx()) => buildModel(h, c);

describe("contributorCount", () => {
  it("counts total distinct authors and those active within the window", () => {
    const v = contributorCount(model(), ctx()).value as { total: number; active: number; activeWindowDays: number };
    expect(v.total).toBe(4);
    expect(v.active).toBe(2); // Alice (May) + Dave (May); Bob (Jan) & Carol (2023) inactive
    expect(v.activeWindowDays).toBe(90);
  });

  it("is not_available for empty history", () => {
    expect(contributorCount(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("contributionDistribution", () => {
  it("emits anonymized descending shares + concentration coefficients", () => {
    const v = contributionDistribution(model(), ctx()).value as {
      authorCount: number;
      commitShares: number[];
      giniCommits: number;
      topCommitSharePct: number;
      top3CommitSharePct: number;
    };
    expect(v.authorCount).toBe(4);
    expect(v.commitShares).toEqual([50, 16.67, 16.67, 16.67]);
    expect(v.topCommitSharePct).toBe(50);
    expect(v.giniCommits).toBe(0.25);
  });

  it("is not_available for empty history", () => {
    expect(contributionDistribution(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("busFactor", () => {
  it("is the fewest authors covering ≥50% of commits", () => {
    const v = busFactor(model(), ctx()).value as { busFactor: number; topAuthorSharePct: number; totalAuthors: number };
    expect(v.busFactor).toBe(1); // Alice alone = 50%
    expect(v.topAuthorSharePct).toBe(50);
    expect(v.totalAuthors).toBe(4);
  });

  it("is not_available for empty history", () => {
    expect(busFactor(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("newDepartedContributors", () => {
  it("counts onboarding and attrition at team level", () => {
    const v = newDepartedContributors(model(), ctx()).value as { totalContributors: number; newContributors: number; departedContributors: number };
    expect(v.totalContributors).toBe(4);
    expect(v.newContributors).toBe(1); // Dave (first commit May 2024)
    expect(v.departedContributors).toBe(1); // Carol (last commit June 2023)
  });

  it("is not_available for empty history", () => {
    expect(newDepartedContributors(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("ownershipByArea", () => {
  it("ranks hotspot directories + files with anonymized concentration", () => {
    const v = ownershipByArea(model(), ctx()).value as {
      topDirectories: { path: string; touchCount: number; authorCount: number; topAuthorSharePct: number }[];
      topFiles: { path: string; touchCount: number; authorCount: number; topAuthorSharePct: number }[];
    };
    expect(v.topDirectories[0]).toEqual({ path: "src", touchCount: 5, authorCount: 2, topAuthorSharePct: 80 });
    expect(v.topFiles[0]).toEqual({ path: "src/app.ts", touchCount: 3, authorCount: 1, topAuthorSharePct: 100 });
    // tie-break at touchCount 1 is path-ascending (docs before legacy)
    expect(v.topDirectories.map((d) => d.path)).toEqual(["src", "docs", "legacy"]);
  });

  it("is not_available when no file-change data exists", () => {
    const noFiles: RepoHistory = { repoTarget: "/x", commits: [commit({ sha: "z", author: ALICE, committedAt: "2024-05-01T00:00:00.000Z", files: [] })] };
    expect(ownershipByArea(model(noFiles), ctx()).status).toBe("not_available");
  });
});

describe("coAuthorship", () => {
  it("counts Co-authored-by trailers as a team collaboration signal", () => {
    const v = coAuthorship(model(), ctx()).value as { commitsWithCoAuthors: number; coAuthoredSharePct: number; totalCoAuthorTrailers: number; distinctCoAuthors: number };
    expect(v.commitsWithCoAuthors).toBe(2);
    expect(v.totalCoAuthorTrailers).toBe(3);
    expect(v.distinctCoAuthors).toBe(3);
    expect(v.coAuthoredSharePct).toBe(33.33);
  });

  it("computes zeros (not not_available) when commits exist but carry no trailers", () => {
    const noTrailers: RepoHistory = { repoTarget: "/x", commits: [commit({ sha: "z", author: ALICE, committedAt: "2024-05-01T00:00:00.000Z" })] };
    const m = coAuthorship(model(noTrailers), ctx());
    expect(m.status).toBe("computed");
    expect((m.value as { totalCoAuthorTrailers: number }).totalCoAuthorTrailers).toBe(0);
  });

  it("skips a malformed Co-authored-by trailer with no identity (no phantom co-author)", () => {
    const malformed: RepoHistory = {
      repoTarget: "/x",
      commits: [
        commit({
          sha: "z",
          author: ALICE,
          committedAt: "2024-05-01T00:00:00.000Z",
          message: "Fix\n\nCo-authored-by:   \nCo-authored-by: Bob <bob@example.com>",
        }),
      ],
    };
    const v = coAuthorship(model(malformed), ctx()).value as { totalCoAuthorTrailers: number; distinctCoAuthors: number; commitsWithCoAuthors: number };
    expect(v.distinctCoAuthors).toBe(1); // Bob only — the empty trailer is not a phantom
    expect(v.totalCoAuthorTrailers).toBe(1); // the malformed line is not counted as a trailer
    expect(v.commitsWithCoAuthors).toBe(1);
  });

  it("is not_available for empty history", () => {
    expect(coAuthorship(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("NFR-8 — no author identity leaks into any Group B value (the absolute guardrail)", () => {
  it("emits no author name or email anywhere in the serialized Group B output", () => {
    const m = model();
    const serialized = GROUP_B_METRICS.map((entry) => JSON.stringify(entry.fn(m, ctx()).value)).join("\n");
    const sentinels = [
      "Alice", "alice@example.com",
      "Bob", "bob@example.com",
      "Carol", "carol@example.com",
      "Dave", "dave@example.com",
    ];
    for (const sentinel of sentinels) {
      expect(serialized).not.toContain(sentinel);
    }
  });
});
