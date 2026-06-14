/**
 * Shared git-history reader (Story 5.1 — extracted from the Story 1.4 local adapter).
 *
 * Reads a work tree's HEAD history via the system `git` and emits a raw
 * `RepoHistory`. STRICTLY READ-ONLY: only `rev-parse` + `log` subcommands through
 * the injected `GitRunner` (`execFile`, no shell). A directory that is not a git
 * work tree fails with a `RetrieveError` (exit 4); an initialized repo with no
 * commits is a successful empty read.
 *
 * The `workdir` is where git runs; the `repoTargetLabel` is stamped on the result
 * — so a LOCAL read labels it with the path, and a REMOTE read labels it with the
 * URL while running git inside the disposable clone. Both share this one reader,
 * so a local and a remote analysis of the same history are byte-identical.
 */

import type { RepoHistory } from "./retrieve.port.js";
import type { GitRunner } from "./git.js";
import { gitLogArgs, parseGitLog } from "./git-log.js";
import { RetrieveError } from "../shared/errors.js";

/** Read HEAD history from `workdir`, labelling the result with `repoTargetLabel`. */
export async function readGitHistory(
  runner: GitRunner,
  workdir: string,
  repoTargetLabel: string,
): Promise<RepoHistory> {
  await assertGitRepo(runner, workdir, repoTargetLabel);

  if (!(await hasCommits(runner, workdir, repoTargetLabel))) {
    return { repoTarget: repoTargetLabel, commits: [] }; // initialized repo, no commits yet
  }

  let stdout: string;
  try {
    stdout = await runner(gitLogArgs(), { cwd: workdir });
  } catch (cause) {
    throw new RetrieveError(`Failed to read git history from "${repoTargetLabel}".`, { cause });
  }
  return { repoTarget: repoTargetLabel, commits: parseGitLog(stdout) };
}

/**
 * Verify `workdir` is a git work tree (read-only); throw an actionable
 * RetrieveError otherwise. The error names `label` (the user-facing path/URL),
 * never the disposable clone path — so a remote failure points at the URL.
 */
async function assertGitRepo(runner: GitRunner, workdir: string, label: string): Promise<void> {
  let out: string;
  try {
    out = await runner(["rev-parse", "--is-inside-work-tree"], { cwd: workdir });
  } catch (cause) {
    throw new RetrieveError(
      `Cannot read "${label}": not a git repository, the path does not exist, or git is not installed.`,
      { cause },
    );
  }
  if (out.trim() !== "true") {
    throw new RetrieveError(`"${label}" is not a git repository.`);
  }
}

/** True if HEAD resolves to a commit; false for a freshly initialized (unborn) repo. */
async function hasCommits(runner: GitRunner, workdir: string, label: string): Promise<boolean> {
  try {
    await runner(["rev-parse", "--verify", "--quiet", "HEAD"], { cwd: workdir });
    return true;
  } catch (cause) {
    // `rev-parse --verify --quiet` exits 1 with no output ONLY for an unborn
    // HEAD (empty repo). Any other failure (permissions, corruption, missing
    // git) is a real error and must not be laundered into an empty history.
    if (isUnbornHead(cause)) {
      return false;
    }
    throw new RetrieveError(`Failed to inspect git history in "${label}".`, { cause });
  }
}

/** An unborn-HEAD failure: git exit code 1 with empty stdout/stderr. */
function isUnbornHead(cause: unknown): boolean {
  const err = cause as { code?: unknown; stderr?: unknown } | null;
  if (err === null || typeof err !== "object") {
    return false;
  }
  const stderr = typeof err.stderr === "string" ? err.stderr.trim() : "";
  return err.code === 1 && stderr === "";
}
