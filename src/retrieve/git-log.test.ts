import { describe, it, expect } from "vitest";

import { parseGitLog } from "./git-log.js";

const RS = "\x1e";
const US = "\x1f";

interface Fields {
  H: string;
  an: string;
  ae: string;
  aI: string;
  cn: string;
  ce: string;
  cI: string;
  P: string;
  B: string;
  numstat?: string;
}

/** Build one record exactly as `git log --numstat` (our format) emits it. */
function rec(f: Fields): string {
  const head = [f.H, f.an, f.ae, f.aI, f.cn, f.ce, f.cI, f.P, f.B].join(US);
  return `${RS}${head}${US}${f.numstat ?? ""}`;
}

const ALICE = {
  an: "Alice",
  ae: "alice@example.com",
  aI: "2024-01-02T10:00:00+00:00",
  cn: "Alice",
  ce: "alice@example.com",
  cI: "2024-01-02T10:00:00+00:00",
};

describe("parseGitLog", () => {
  it("returns [] for empty stdout", () => {
    expect(parseGitLog("")).toEqual([]);
  });

  it("parses a normal commit with all fields and numstat", () => {
    const stdout = rec({
      ...ALICE,
      H: "aaa111",
      P: "parent000",
      B: "Add feature\n\nLonger body line.\n",
      numstat: "\n\n10\t2\tsrc/a.ts\n3\t0\tsrc/b.ts\n",
    });
    expect(parseGitLog(stdout)).toEqual([
      {
        sha: "aaa111",
        author: { name: "Alice", email: "alice@example.com" },
        committer: { name: "Alice", email: "alice@example.com" },
        authoredAt: "2024-01-02T10:00:00+00:00",
        committedAt: "2024-01-02T10:00:00+00:00",
        message: "Add feature\n\nLonger body line.",
        parents: ["parent000"],
        files: [
          { path: "src/a.ts", additions: 10, deletions: 2 },
          { path: "src/b.ts", additions: 3, deletions: 0 },
        ],
      },
    ]);
  });

  it("parses a merge commit (two parents, no numstat) with empty files", () => {
    const [commit] = parseGitLog(
      rec({ ...ALICE, H: "merge222", P: "p1 p2", B: "Merge branch 'x'\n", numstat: "" }),
    );
    expect(commit.parents).toEqual(["p1", "p2"]);
    expect(commit.files).toEqual([]);
  });

  it("parses a root commit (no parents) and a binary file (null/null)", () => {
    const [commit] = parseGitLog(
      rec({ ...ALICE, H: "root333", P: "", B: "Initial commit\n", numstat: "\n\n-\t-\timage.png\n5\t0\tREADME.md\n" }),
    );
    expect(commit.parents).toEqual([]);
    expect(commit.files).toEqual([
      { path: "image.png", additions: null, deletions: null },
      { path: "README.md", additions: 5, deletions: 0 },
    ]);
  });

  it("preserves a multi-line message (proves body delimiting against the numstat block)", () => {
    const [commit] = parseGitLog(
      rec({
        ...ALICE,
        H: "multi444",
        P: "p0",
        B: "Subject line\n\nBody paragraph one.\nBody paragraph two.\n",
        numstat: "\n\n1\t1\tx.ts\n",
      }),
    );
    expect(commit.message).toBe("Subject line\n\nBody paragraph one.\nBody paragraph two.");
    expect(commit.files).toEqual([{ path: "x.ts", additions: 1, deletions: 1 }]);
  });

  it("resolves rename paths (brace form and plain form)", () => {
    const [commit] = parseGitLog(
      rec({
        ...ALICE,
        H: "rename555",
        P: "p0",
        B: "Rename files\n",
        numstat: "\n\n4\t2\tsrc/{old => new}.ts\n0\t0\tdocs/old.md => docs/new.md\n",
      }),
    );
    expect(commit.files).toEqual([
      { path: "src/new.ts", additions: 4, deletions: 2 },
      { path: "docs/new.md", additions: 0, deletions: 0 },
    ]);
  });

  it("parses multiple commits in order", () => {
    const stdout = [
      rec({ ...ALICE, H: "c1", P: "c0", B: "First\n", numstat: "\n\n1\t0\ta\n" }),
      rec({ ...ALICE, H: "c2", P: "c1", B: "Second\n", numstat: "\n\n2\t0\tb\n" }),
    ].join("\n");
    expect(parseGitLog(stdout).map((c) => c.sha)).toEqual(["c1", "c2"]);
  });

  it("skips a malformed record defensively", () => {
    expect(parseGitLog(`${RS}only${US}three${US}fields`)).toEqual([]);
  });

  it("tolerates CRLF line endings (no trailing carriage return on path or message)", () => {
    const stdout = rec({
      ...ALICE,
      H: "crlf666",
      P: "p0",
      B: "Subject\r\n\r\nBody.\r\n",
      numstat: "\r\n\r\n2\t1\tsrc/c.ts\r\n",
    });
    const [commit] = parseGitLog(stdout);
    expect(commit.message).toBe("Subject\r\n\r\nBody.");
    expect(commit.files).toEqual([{ path: "src/c.ts", additions: 2, deletions: 1 }]);
  });
});
