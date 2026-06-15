import { describe, it, expect } from "vitest";

import {
  mostChanged,
  churnOverTime,
  addDeleteRatio,
  fileAge,
  largeChangeEvents,
  GROUP_E_METRICS,
} from "./e-churn.js";
import { buildModel, type AnalysisContext } from "../model.js";
import { emptyMailmap } from "../identity.js";
import type { RepoHistory, RawCommit, ChangedFile } from "../../retrieve/retrieve.port.js";

function ctx(): AnalysisContext {
  return { analysisTimestamp: "2024-06-01T00:00:00.000Z", timezone: "UTC", mailmap: emptyMailmap() };
}

const ALICE = { name: "Alice", email: "alice@example.com" };
const BOB = { name: "Bob", email: "bob@example.com" };
let seq = 0;
function commit(committedAt: string, files: ChangedFile[], author = ALICE): RawCommit {
  seq += 1;
  return {
    sha: `c${seq}`,
    author,
    committer: author,
    authoredAt: committedAt,
    committedAt,
    message: `commit ${seq}`,
    parents: [],
    files,
  };
}

/**
 * A churn/hotspot corpus:
 *  - src/app.ts touched 3× (a hotspot), src/util.ts 2×, README.md 1×
 *  - a BINARY asset (logo.png, null add/del) touched 2× — counts as touches, no churn
 *  - commits span Jan + Mar 2024 (two month buckets)
 *  - one large commit (≥1000 lines), plus normal commits
 *  - README.md seen once (age 0); src/app.ts seen Jan→Mar (long age)
 */
const HISTORY: RepoHistory = {
  repoTarget: "/repo",
  commits: [
    commit("2024-01-01T10:00:00.000Z", [
      { path: "src/app.ts", additions: 50, deletions: 0 },
      { path: "README.md", additions: 10, deletions: 0 },
    ]),
    commit("2024-01-10T10:00:00.000Z", [
      { path: "src/app.ts", additions: 20, deletions: 5 },
      { path: "src/util.ts", additions: 15, deletions: 0 },
      { path: "assets/logo.png", additions: null, deletions: null }, // binary
    ]),
    commit("2024-03-01T10:00:00.000Z", [
      { path: "src/app.ts", additions: 800, deletions: 250 }, // large: 1050 lines ≥ 1000
      { path: "src/util.ts", additions: 10, deletions: 30 },
      { path: "assets/logo.png", additions: null, deletions: null }, // binary again
    ]),
  ],
};

const EMPTY: RepoHistory = { repoTarget: "/x", commits: [] };
const NO_FILES: RepoHistory = { repoTarget: "/x", commits: [commit("2024-05-01T00:00:00.000Z", [])] };
const model = (h: RepoHistory) => buildModel(h, ctx());

describe("mostChanged", () => {
  it("ranks hotspot files and directories by touch count, with churn (binary counts as touch)", () => {
    const v = mostChanged(model(HISTORY), ctx()).value as {
      topFiles: { path: string; touchCount: number; churn: number }[];
      topDirectories: { path: string; touchCount: number; churn: number }[];
      totalFilesTouched: number;
    };
    expect(v.topFiles[0]).toEqual({ path: "src/app.ts", touchCount: 3, churn: 1125 }); // 50+20+5+800+250
    expect(v.topFiles.find((f) => f.path === "assets/logo.png")).toEqual({ path: "assets/logo.png", touchCount: 2, churn: 0 }); // binary: touched, no churn
    expect(v.topDirectories[0].path).toBe("src"); // src touched most
    expect(v.totalFilesTouched).toBe(4);
  });

  it("is not_available when no files were touched", () => {
    const m = mostChanged(model(NO_FILES), ctx());
    expect(m.status).toBe("not_available");
    expect(m.reason).toContain("changed-file");
  });

  it("is not_available for empty history", () => {
    expect(mostChanged(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("churnOverTime", () => {
  it("buckets churn by month (key-sorted), excluding binary from line sums", () => {
    const v = churnOverTime(model(HISTORY), ctx()).value as {
      perMonth: Record<string, { additions: number; deletions: number; churn: number; commitCount: number }>;
      totalChurn: number;
    };
    expect(Object.keys(v.perMonth)).toEqual(["2024-01", "2024-03"]); // sorted
    expect(v.perMonth["2024-01"]).toEqual({ additions: 95, deletions: 5, churn: 100, commitCount: 2 }); // 50+10+20+15 adds, 5 dels
    expect(v.perMonth["2024-03"]).toEqual({ additions: 810, deletions: 280, churn: 1090, commitCount: 1 });
    expect(v.totalChurn).toBe(1190);
  });

  it("is not_available for empty history", () => {
    expect(churnOverTime(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("addDeleteRatio", () => {
  it("computes the additions/deletions ratio and net lines", () => {
    const v = addDeleteRatio(model(HISTORY), ctx()).value as { totalAdditions: number; totalDeletions: number; addDeleteRatio: number; netLines: number };
    expect(v.totalAdditions).toBe(905); // 60 + 35 + 810
    expect(v.totalDeletions).toBe(285); // 0 + 5 + 280
    expect(v.addDeleteRatio).toBe(round3(905 / 285));
    expect(v.netLines).toBe(620);
  });

  it("emits null (not Infinity) when there are no deletions", () => {
    const onlyAdds: RepoHistory = { repoTarget: "/x", commits: [commit("2024-05-01T00:00:00.000Z", [{ path: "a", additions: 5, deletions: 0 }])] };
    const v = addDeleteRatio(model(onlyAdds), ctx()).value as { addDeleteRatio: number | null };
    expect(v.addDeleteRatio).toBeNull();
  });

  it("is not_available for empty history", () => {
    expect(addDeleteRatio(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("fileAge", () => {
  it("computes median/max age (days) and documents the HEAD-presence approximation", () => {
    const v = fileAge(model(HISTORY), ctx()).value as {
      medianAgeDays: number; maxAgeDays: number; filesConsidered: number; singleTouchFileCount: number; presenceApproximation: string;
    };
    expect(v.filesConsidered).toBe(4);
    expect(v.singleTouchFileCount).toBe(1); // README.md touched once
    // src/app.ts: Jan 1 → Mar 1 ≈ 60 days (the max age)
    expect(v.maxAgeDays).toBeGreaterThan(59);
    expect(v.presenceApproximation).toBe("seen-in-history");
  });

  it("is not_available when no files were touched", () => {
    expect(fileAge(model(NO_FILES), ctx()).status).toBe("not_available");
  });

  it("is not_available for empty history", () => {
    expect(fileAge(model(EMPTY), ctx()).status).toBe("not_available");
  });
});

describe("largeChangeEvents", () => {
  it("flags commits over the threshold and emits top events with date/churn/fileCount only", () => {
    const v = largeChangeEvents(model(HISTORY), ctx()).value as {
      thresholdLines: number; largeChangeCount: number; events: { date: string; churn: number; changedFileCount: number }[];
    };
    expect(v.thresholdLines).toBe(1000);
    expect(v.largeChangeCount).toBe(1); // the Mar commit (800+250+10+30 = 1090 ≥ 1000)
    expect(v.events[0]).toEqual({ date: "2024-03-01T10:00:00.000Z", churn: 1090, changedFileCount: 3 });
    expect(v.events).toHaveLength(3); // all 3 commits have positive churn
  });

  it("is not_available for empty history", () => {
    expect(largeChangeEvents(model(EMPTY), ctx()).status).toBe("not_available");
  });

  it("caps events at the top-10 limit even with more positive-churn commits", () => {
    const many: RepoHistory = {
      repoTarget: "/x",
      commits: Array.from({ length: 15 }, (_, i) =>
        commit(`2024-01-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`, [{ path: `f${i}`, additions: i + 1, deletions: 0 }]),
      ),
    };
    const v = largeChangeEvents(model(many), ctx()).value as { events: unknown[]; largeChangeCount: number };
    expect(v.events).toHaveLength(10); // LARGE_EVENT_LIMIT
    expect(v.largeChangeCount).toBe(0); // none reach the 1000-line threshold
  });

  it("emits events even when no commit reaches the large threshold (dual measure)", () => {
    const small: RepoHistory = { repoTarget: "/x", commits: [commit("2024-01-01T10:00:00.000Z", [{ path: "a", additions: 5, deletions: 0 }])] };
    const v = largeChangeEvents(model(small), ctx()).value as { events: { churn: number }[]; largeChangeCount: number };
    expect(v.largeChangeCount).toBe(0);
    expect(v.events).toHaveLength(1); // the small commit is still the top change event
    expect(v.events[0].churn).toBe(5);
  });
});

describe("Group E — all-merge history (file-level vs commit-level split)", () => {
  // A history of only merge commits: empty files (git omits merge numstat), churn 0.
  const allMerges: RepoHistory = {
    repoTarget: "/x",
    commits: [
      { sha: "m1", author: ALICE, committer: ALICE, authoredAt: "2024-01-01T10:00:00.000Z", committedAt: "2024-01-01T10:00:00.000Z", message: "Merge 1", parents: ["a", "b"], files: [] },
      { sha: "m2", author: ALICE, committer: ALICE, authoredAt: "2024-01-02T10:00:00.000Z", committedAt: "2024-01-02T10:00:00.000Z", message: "Merge 2", parents: ["c", "d"], files: [] },
    ],
  };

  it("file-level metrics are not_available, commit-level metrics compute with zero churn", () => {
    const m = model(allMerges);
    // file-level → no changed-file data
    expect(mostChanged(m, ctx()).status).toBe("not_available");
    expect(fileAge(m, ctx()).status).toBe("not_available");
    // commit-level → computed over the (zero-churn) commits
    const churn = churnOverTime(m, ctx());
    expect(churn.status).toBe("computed");
    expect((churn.value as { totalChurn: number }).totalChurn).toBe(0);
    const large = largeChangeEvents(m, ctx());
    expect(large.status).toBe("computed");
    expect((large.value as { events: unknown[]; largeChangeCount: number }).events).toHaveLength(0); // zero-churn merges are not events
    expect((large.value as { largeChangeCount: number }).largeChangeCount).toBe(0);
  });
});

describe("NFR-8 — large-change events carry no author identity", () => {
  it("emits no author name or email in the large-change-events value", () => {
    const mixed: RepoHistory = {
      repoTarget: "/x",
      commits: [
        commit("2024-01-01T10:00:00.000Z", [{ path: "a", additions: 1200, deletions: 0 }], ALICE),
        commit("2024-02-01T10:00:00.000Z", [{ path: "b", additions: 50, deletions: 0 }], BOB),
      ],
    };
    const serialized = JSON.stringify(largeChangeEvents(model(mixed), ctx()).value);
    for (const sentinel of ["Alice", "alice@example.com", "Bob", "bob@example.com"]) {
      expect(serialized).not.toContain(sentinel);
    }
  });
});

describe("Group E determinism / serialization", () => {
  it("emits only JSON-serializable values (no Map/Set/Date) and is stable across runs", () => {
    const m = model(HISTORY);
    const a = GROUP_E_METRICS.map((e) => JSON.stringify(e.fn(m, ctx()).value)).join("\n");
    const b = GROUP_E_METRICS.map((e) => JSON.stringify(e.fn(m, ctx()).value)).join("\n");
    expect(a).toBe(b);
    expect(a).not.toContain("[object");
  });
});

function round3(n: number): number {
  return Math.round(n * 100) / 100;
}
