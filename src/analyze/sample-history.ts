/**
 * Shared synthetic git history fixture (Story 1.5).
 *
 * Hand-built `RepoHistory` with enough variety to exercise all six Group A
 * metrics and the determinism harness: multiple authors (incl. a
 * mailmap-collapsible pair), a root commit and a merge commit, binary + text
 * files, and commits spread across several days and hours. Timestamps are fixed
 * (UTC) so analysis is reproducible.
 *
 * Lives under `src/analyze/` (not `tests/fixtures/`) so the `rootDir: "src"`
 * typecheck stays clean for the co-located unit tests; the `tests/determinism`
 * harness imports it downward from `src/`. It is not reachable from the build
 * entrypoint, so it never lands in the bundle.
 */

import type { RepoHistory } from "../retrieve/retrieve.port.js";

export const SYNTHETIC_HISTORY: RepoHistory = {
  repoTarget: "/synthetic/repo",
  commits: [
    {
      sha: "c1",
      author: { name: "Alice", email: "alice@example.com" },
      committer: { name: "Alice", email: "alice@example.com" },
      authoredAt: "2024-01-01T09:00:00.000Z",
      committedAt: "2024-01-01T09:00:00.000Z",
      message: "Initial commit",
      parents: [],
      files: [{ path: "README.md", additions: 10, deletions: 0 }],
    },
    {
      sha: "c2",
      author: { name: "Bob", email: "bob@example.com" },
      committer: { name: "Bob", email: "bob@example.com" },
      authoredAt: "2024-01-02T14:30:00.000Z",
      committedAt: "2024-01-02T14:30:00.000Z",
      message: "Add feature",
      parents: ["c1"],
      files: [
        { path: "src/feature.ts", additions: 40, deletions: 2 },
        { path: "assets/logo.png", additions: null, deletions: null }, // binary
      ],
    },
    {
      sha: "c3",
      author: { name: "alice", email: "ALICE@example.com" }, // collapses to Alice
      committer: { name: "alice", email: "ALICE@example.com" },
      authoredAt: "2024-01-03T23:15:00.000Z",
      committedAt: "2024-01-03T23:15:00.000Z",
      message: "Fix bug\n\nDetailed body.",
      parents: ["c2"],
      files: [{ path: "src/feature.ts", additions: 3, deletions: 5 }],
    },
    {
      sha: "c4",
      author: { name: "Bob", email: "bob@example.com" },
      committer: { name: "Bob", email: "bob@example.com" },
      authoredAt: "2024-02-01T08:00:00.000Z", // a long gap (dormant period)
      committedAt: "2024-02-01T08:00:00.000Z",
      message: "Merge branch 'x'",
      parents: ["c3", "c2"], // merge commit
      files: [{ path: "src/feature.ts", additions: 1, deletions: 1 }],
    },
  ],
};

/** A mailmap collapsing `ALICE@example.com` → `alice@example.com`. */
export const SYNTHETIC_MAILMAP = "Alice <alice@example.com> <ALICE@example.com>";
