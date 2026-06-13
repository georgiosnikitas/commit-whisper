import { describe, it, expect } from "vitest";

import { selectCommits, projectSelection, type SelectionCriteria } from "./select.js";
import type { RepoHistory, RawCommit } from "../retrieve/retrieve.port.js";
import { resolveRunConfig } from "../config/resolve-run-config.js";

const ALICE = { name: "Alice", email: "alice@example.com" };
const BOB = { name: "Bob", email: "bob@example.com" };

function commit(sha: string, committedAt: string, over: Partial<RawCommit> = {}): RawCommit {
  return {
    sha,
    author: ALICE,
    committer: ALICE,
    authoredAt: committedAt,
    committedAt,
    message: sha,
    parents: ["p"],
    files: [],
    ...over,
  };
}

/**
 * A mixed corpus:
 *  - c1 Alice (Jan 1), c2 Bob (Jan 10), c3 Alice (Feb 1, MERGE), c4 Bob (Mar 1),
 *    c5 Alice (Mar 15), c6 Bob (Mar 31 23:30 UTC — crosses a day boundary in +tz)
 */
const HISTORY: RepoHistory = {
  repoTarget: "/repo",
  commits: [
    commit("c1", "2024-01-01T10:00:00.000Z", { author: ALICE }),
    commit("c2", "2024-01-10T10:00:00.000Z", { author: BOB }),
    commit("c3", "2024-02-01T10:00:00.000Z", { author: ALICE, parents: ["c2", "x"] }), // merge
    commit("c4", "2024-03-01T10:00:00.000Z", { author: BOB }),
    commit("c5", "2024-03-15T10:00:00.000Z", { author: ALICE }),
    commit("c6", "2024-03-31T23:30:00.000Z", { author: BOB }), // 2024-04-01 in UTC+1
  ],
};

function criteria(over: Partial<SelectionCriteria> = {}): SelectionCriteria {
  return { noMerges: false, timezone: "UTC", ...over };
}

const shas = (h: RepoHistory) => h.commits.map((c) => c.sha);

describe("selectCommits — no-op", () => {
  it("returns the history unchanged when no criteria are set", () => {
    const out = selectCommits(HISTORY, criteria());
    expect(shas(out)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6"]);
    expect(out.repoTarget).toBe("/repo");
  });
});

describe("selectCommits — no-merges", () => {
  it("drops commits with two or more parents", () => {
    const out = selectCommits(HISTORY, criteria({ noMerges: true }));
    expect(shas(out)).toEqual(["c1", "c2", "c4", "c5", "c6"]); // c3 (merge) dropped
  });
});

describe("selectCommits — author filter", () => {
  it("matches a case-insensitive substring of the author name", () => {
    expect(shas(selectCommits(HISTORY, criteria({ authorFilter: "alice" })))).toEqual(["c1", "c3", "c5"]);
  });

  it("matches a case-insensitive substring of the author email", () => {
    expect(shas(selectCommits(HISTORY, criteria({ authorFilter: "BOB@EXAMPLE" })))).toEqual(["c2", "c4", "c6"]);
  });

  it("returns no commits when the filter matches no author", () => {
    expect(shas(selectCommits(HISTORY, criteria({ authorFilter: "carol" })))).toEqual([]);
  });

  it("ignores a whitespace-only filter (no narrowing)", () => {
    expect(shas(selectCommits(HISTORY, criteria({ authorFilter: "  " })))).toHaveLength(6);
  });
});

describe("selectCommits — date range (inclusive, tz-aware)", () => {
  it("filters by a start date only (unbounded end)", () => {
    expect(shas(selectCommits(HISTORY, criteria({ startDate: "2024-03-01" })))).toEqual(["c4", "c5", "c6"]);
  });

  it("filters by an end date only (unbounded start)", () => {
    expect(shas(selectCommits(HISTORY, criteria({ endDate: "2024-01-31" })))).toEqual(["c1", "c2"]);
  });

  it("filters by both bounds and includes a commit exactly on a bound day", () => {
    expect(shas(selectCommits(HISTORY, criteria({ startDate: "2024-01-10", endDate: "2024-03-01" })))).toEqual(["c2", "c3", "c4"]);
  });

  it("interprets the date bound in the configured timezone (c6 crosses midnight in UTC+1)", () => {
    // c6 is 2024-03-31T23:30Z = 2024-04-01 00:30 in Europe/Berlin (UTC+1) → excluded by end 2024-03-31.
    const utc = shas(selectCommits(HISTORY, criteria({ endDate: "2024-03-31", timezone: "UTC" })));
    const berlin = shas(selectCommits(HISTORY, criteria({ endDate: "2024-03-31", timezone: "Europe/Berlin" })));
    expect(utc).toContain("c6"); // 2024-03-31 in UTC
    expect(berlin).not.toContain("c6"); // 2024-04-01 in Berlin
  });

  it("accepts a full ISO timestamp bound at day granularity", () => {
    expect(shas(selectCommits(HISTORY, criteria({ startDate: "2024-03-15T00:00:00.000Z" })))).toEqual(["c5", "c6"]);
  });

  it("treats a malformed/partial date bound as unbounded (no silent wrong filter)", () => {
    // "2024-03" / "garbage" are not well-formed YYYY-MM-DD → unbounded, not a wrong lexical compare.
    expect(shas(selectCommits(HISTORY, criteria({ startDate: "2024-03" })))).toHaveLength(6);
    expect(shas(selectCommits(HISTORY, criteria({ endDate: "garbage" })))).toHaveLength(6);
  });
});

describe("selectCommits — max-commits (most recent N)", () => {
  it("keeps the most-recent N by committed date", () => {
    expect(shas(selectCommits(HISTORY, criteria({ maxCommits: 2 })))).toEqual(["c5", "c6"]);
  });

  it("is a no-op when N is at least the commit count", () => {
    expect(shas(selectCommits(HISTORY, criteria({ maxCommits: 10 })))).toHaveLength(6);
  });

  it("breaks a committed-date tie by sha (deterministic, order-independent)", () => {
    const tied: RepoHistory = {
      repoTarget: "/x",
      commits: [
        commit("zzz", "2024-05-01T00:00:00.000Z"),
        commit("aaa", "2024-05-01T00:00:00.000Z"),
        commit("mmm", "2024-04-01T00:00:00.000Z"),
      ],
    };
    // most-recent 2 of the May tie → keep both May commits; the tie order is [aaa, zzz].
    expect(shas(selectCommits(tied, criteria({ maxCommits: 2 })))).toEqual(["aaa", "zzz"]);
    const reversed: RepoHistory = { repoTarget: "/x", commits: [...tied.commits].reverse() };
    expect(shas(selectCommits(reversed, criteria({ maxCommits: 2 })))).toEqual(["aaa", "zzz"]);
  });
});

describe("selectCommits — combination + ordering (date before cap)", () => {
  it("applies no-merges + author + date, then caps to the most-recent N", () => {
    // Bob, from 2024-01-01, non-merge → c2, c4, c6; cap 2 → most recent c4, c6.
    const out = selectCommits(HISTORY, criteria({ noMerges: true, authorFilter: "bob", startDate: "2024-01-01", maxCommits: 2 }));
    expect(shas(out)).toEqual(["c4", "c6"]);
  });

  it("is deterministic and input-order-independent", () => {
    const c = criteria({ authorFilter: "alice", maxCommits: 2 });
    const forward = shas(selectCommits(HISTORY, c));
    const reversed = shas(selectCommits({ repoTarget: "/repo", commits: [...HISTORY.commits].reverse() }, c));
    expect(forward).toEqual(reversed);
  });

  it("does not mutate the input history", () => {
    const before = shas(HISTORY);
    selectCommits(HISTORY, criteria({ noMerges: true, maxCommits: 1 }));
    expect(shas(HISTORY)).toEqual(before);
  });
});

describe("projectSelection", () => {
  it("maps the resolved RunConfig's selection fields into criteria", () => {
    const config = resolveRunConfig({
      cwd: "/repo",
      env: {},
      stdinIsTTY: false,
      stdoutIsTTY: false,
      nonInteractive: true,
      analysisTimestamp: "2024-06-01T00:00:00.000Z",
      flags: { noMerges: true, maxCommits: 50, timezone: "Europe/Berlin", authorFilter: "alice" },
    });
    expect(projectSelection(config)).toMatchObject({ noMerges: true, maxCommits: 50, timezone: "Europe/Berlin", authorFilter: "alice" });
  });
});
