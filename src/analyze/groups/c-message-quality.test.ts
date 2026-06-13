import { describe, it, expect } from "vitest";

import {
  messageLengthDistribution,
  conventionalCommits,
  imperativeMood,
  lowInformationRate,
  issueReferenceRate,
  revertFixupSignal,
  GROUP_C_METRICS,
} from "./c-message-quality.js";
import { buildModel, type AnalysisContext } from "../model.js";
import { emptyMailmap } from "../identity.js";
import type { RepoHistory, RawCommit } from "../../retrieve/retrieve.port.js";

function ctx(): AnalysisContext {
  return { analysisTimestamp: "2024-06-01T00:00:00.000Z", timezone: "UTC", mailmap: emptyMailmap() };
}

let seq = 0;
function commit(message: string): RawCommit {
  seq += 1;
  const author = { name: "A", email: "a@example.com" };
  return {
    sha: `c${seq}`,
    author,
    committer: author,
    authoredAt: "2024-05-01T10:00:00.000Z",
    committedAt: `2024-05-01T10:${String(seq).padStart(2, "0")}:00.000Z`,
    message,
    parents: [],
    files: [],
  };
}

// A purpose-built message corpus exercising every Group C branch.
const HISTORY: RepoHistory = {
  repoTarget: "/repo",
  commits: [
    commit("feat(auth): add login flow"), // conventional, imperative, no period
    commit("fix: correct null check\n\nDetails about the fix in #42."), // conventional, body, issue #
    commit("Fixed the broken pipeline"), // non-conventional, PAST TENSE (non-imperative), capitalized
    commit("Refactoring the parser"), // GERUND (non-imperative)
    commit("wip"), // single-word boilerplate (low-info)
    commit(""), // empty message
    commit('Revert "feat(auth): add login flow"'), // revert
    commit("fixup! fix: correct null check"), // fixup
    commit("Implement PROJ-123 ticket handling."), // imperative, JIRA ref, trailing period
    commit("update"), // boilerplate single word
  ],
};

const EMPTY: RepoHistory = { repoTarget: "/x", commits: [] };
const model = (h: RepoHistory = HISTORY) => buildModel(h, ctx());

describe("messageLengthDistribution", () => {
  it("computes subject-length distribution, empty count, and body share", () => {
    const v = messageLengthDistribution(model(), ctx()).value as {
      subjectLength: { min: number; max: number };
      emptyMessageCount: number;
      withBodySharePct: number;
      commitCount: number;
    };
    expect(v.commitCount).toBe(10);
    expect(v.emptyMessageCount).toBe(1); // the "" commit
    expect(v.subjectLength.min).toBe(0); // empty subject
    expect(v.withBodySharePct).toBe(10); // only the "fix:" commit has a body (1/10)
  });

  it("is not_available for empty history", () => {
    expect(messageLengthDistribution(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("conventionalCommits", () => {
  it("counts adherent subjects and buckets them by type (key-sorted)", () => {
    const v = conventionalCommits(model(), ctx()).value as {
      adherentCount: number;
      byType: Record<string, number>;
      subjectsConsidered: number;
    };
    // Adherent: "feat(auth): …", "fix: …" → feat 1, fix 1. ("Revert \"feat…\"" is not `type:` form.)
    expect(v.byType).toEqual({ feat: 1, fix: 1 });
    expect(v.adherentCount).toBe(2);
    expect(v.subjectsConsidered).toBe(9); // 10 commits − 1 empty subject
  });

  it("accepts a breaking-change scope form feat(scope)!: x", () => {
    const v = conventionalCommits(model({ repoTarget: "/x", commits: [commit("feat(api)!: drop v1")] }), ctx()).value as { adherentCount: number };
    expect(v.adherentCount).toBe(1);
  });

  it("is not_available when there are no non-empty subjects", () => {
    const m = conventionalCommits(model({ repoTarget: "/x", commits: [commit(""), commit("   ")] }), ctx());
    expect(m.status).toBe("not_available");
    expect(m.reason).toContain("non-empty");
  });
});

describe("imperativeMood (documented heuristic)", () => {
  it("counts past-tense/gerund first words as non-imperative", () => {
    const v = imperativeMood(model(), ctx()).value as { imperativeMoodSharePct: number; capitalizedSubjectSharePct: number; subjectsConsidered: number };
    // "Fixed…" (past) and "Refactoring…" (gerund) are non-imperative; the rest count imperative.
    expect(v.subjectsConsidered).toBe(9);
    // 7 of 9 imperative (excludes Fixed + Refactoring) → 77.78
    expect(v.imperativeMoodSharePct).toBe(77.78);
  });

  it('"Fixed the bug" is non-imperative but "Fix the bug" is imperative', () => {
    const past = imperativeMood(model({ repoTarget: "/x", commits: [commit("Fixed the bug")] }), ctx()).value as { imperativeMoodSharePct: number };
    const imp = imperativeMood(model({ repoTarget: "/x", commits: [commit("Fix the bug")] }), ctx()).value as { imperativeMoodSharePct: number };
    expect(past.imperativeMoodSharePct).toBe(0);
    expect(imp.imperativeMoodSharePct).toBe(100);
  });

  it("is not_available when there are no non-empty subjects", () => {
    expect(imperativeMood(model({ repoTarget: "/x", commits: [commit("")] }), ctx()).status).toBe("not_available");
  });
});

describe("lowInformationRate", () => {
  it("flags empty, single-word, and boilerplate subjects", () => {
    const v = lowInformationRate(model(), ctx()).value as { lowInfoCount: number; emptyCount: number; boilerplateCount: number; singleWordCount: number };
    // low-info: "" (empty), "wip", "update" → 3
    expect(v.emptyCount).toBe(1);
    expect(v.boilerplateCount).toBe(2); // wip, update
    expect(v.lowInfoCount).toBe(3);
  });

  it('"add login" is not low-info but "wip" is', () => {
    const ok = lowInformationRate(model({ repoTarget: "/x", commits: [commit("add login")] }), ctx()).value as { lowInfoCount: number };
    const bad = lowInformationRate(model({ repoTarget: "/x", commits: [commit("wip")] }), ctx()).value as { lowInfoCount: number };
    expect(ok.lowInfoCount).toBe(0);
    expect(bad.lowInfoCount).toBe(1);
  });

  it("is not_available for empty history", () => {
    expect(lowInformationRate(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("issueReferenceRate (documented heuristic)", () => {
  it("matches #123, JIRA keys, and forge URLs but not bare tokens", () => {
    const v = issueReferenceRate(model(), ctx()).value as { withReferenceCount: number; commitCount: number };
    // "#42" (body) and "PROJ-123" → 2 of 10
    expect(v.withReferenceCount).toBe(2);
    expect(v.commitCount).toBe(10);
  });

  it('"PROJ-123" matches but "ABC" (no number) does not', () => {
    const hit = issueReferenceRate(model({ repoTarget: "/x", commits: [commit("Do PROJ-123")] }), ctx()).value as { withReferenceCount: number };
    const miss = issueReferenceRate(model({ repoTarget: "/x", commits: [commit("Do ABC work")] }), ctx()).value as { withReferenceCount: number };
    expect(hit.withReferenceCount).toBe(1);
    expect(miss.withReferenceCount).toBe(0);
  });

  it("matches a forge URL path", () => {
    const v = issueReferenceRate(model({ repoTarget: "/x", commits: [commit("See https://github.com/o/r/issues/9")] }), ctx()).value as { withReferenceCount: number };
    expect(v.withReferenceCount).toBe(1);
  });

  it("is not_available for empty history", () => {
    expect(issueReferenceRate(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("revertFixupSignal", () => {
  it("counts revert/fixup/squash subjects as churn-of-intent", () => {
    const v = revertFixupSignal(model(), ctx()).value as { revertCount: number; fixupCount: number; squashCount: number; churnOfIntentCount: number };
    expect(v.revertCount).toBe(1); // Revert "…"
    expect(v.fixupCount).toBe(1); // fixup! …
    expect(v.squashCount).toBe(0);
    expect(v.churnOfIntentCount).toBe(2);
  });

  it("is not_available for empty history", () => {
    expect(revertFixupSignal(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("Group C determinism / serialization", () => {
  it("emits only JSON-serializable values (no Map/Set/Date) and is stable across runs", () => {
    const m = model();
    const a = GROUP_C_METRICS.map((e) => JSON.stringify(e.fn(m, ctx()).value)).join("\n");
    const b = GROUP_C_METRICS.map((e) => JSON.stringify(e.fn(m, ctx()).value)).join("\n");
    expect(a).toBe(b);
    expect(a).not.toContain("[object");
  });
});
