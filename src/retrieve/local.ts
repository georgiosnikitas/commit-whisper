/**
 * Local repository retrieve adapter (Story 1.4).
 *
 * Reads the current repository's HEAD history via the system `git` and emits a
 * raw `RepoHistory`. STRICTLY READ-ONLY: it only ever issues read subcommands
 * (`rev-parse`, `log`) through the injected `GitRunner`, which uses `execFile`
 * with an args array and no shell. A directory that is not a git work tree
 * fails with a `RetrieveError` (exit 4); an initialized repo with no commits is
 * a successful empty read.
 *
 * Commit-selection filters (author / max-count / no-merges / dates) are Story
 * 2.6; the normalized model + `.mailmap` canonicalization + deterministic
 * ordering are Story 1.5 — this adapter emits raw records in git's emit order.
 */

import type { RepoHistory, RetrievePort } from "./retrieve.port.js";
import type { GitRunner } from "./git.js";
import { execFileGitRunner } from "./git.js";
import { gitLogArgs, parseGitLog } from "./git-log.js";
import { RetrieveError } from "../shared/errors.js";

export function createLocalRetrieve(runner: GitRunner = execFileGitRunner): RetrievePort {
  return async (config): Promise<RepoHistory> => {
    const cwd = config.repoTarget;
    await assertGitRepo(runner, cwd);

    if (!(await hasCommits(runner, cwd))) {
      return { repoTarget: cwd, commits: [] }; // initialized repo, no commits yet
    }

    let stdout: string;
    try {
      stdout = await runner(gitLogArgs(), { cwd });
    } catch (cause) {
      throw new RetrieveError(`Failed to read git history from "${cwd}".`, { cause });
    }
    return { repoTarget: cwd, commits: parseGitLog(stdout) };
  };
}

/** Verify `cwd` is a git work tree (read-only); throw an actionable RetrieveError otherwise. */
async function assertGitRepo(runner: GitRunner, cwd: string): Promise<void> {
  let out: string;
  try {
    out = await runner(["rev-parse", "--is-inside-work-tree"], { cwd });
  } catch (cause) {
    throw new RetrieveError(
      `Cannot read "${cwd}": not a git repository, the path does not exist, or git is not installed.`,
      { cause },
    );
  }
  if (out.trim() !== "true") {
    throw new RetrieveError(`"${cwd}" is not a git repository.`);
  }
}

/** True if HEAD resolves to a commit; false for a freshly initialized (unborn) repo. */
async function hasCommits(runner: GitRunner, cwd: string): Promise<boolean> {
  try {
    await runner(["rev-parse", "--verify", "--quiet", "HEAD"], { cwd });
    return true;
  } catch (cause) {
    // `rev-parse --verify --quiet` exits 1 with no output ONLY for an unborn
    // HEAD (empty repo). Any other failure (permissions, corruption, missing
    // git) is a real error and must not be laundered into an empty history.
    if (isUnbornHead(cause)) {
      return false;
    }
    throw new RetrieveError(`Failed to inspect git history in "${cwd}".`, { cause });
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
