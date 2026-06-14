/**
 * Remote HTTPS repository retrieve adapter (Story 5.1).
 *
 * Clones a remote HTTPS repository into a disposable OS temp dir via the system
 * `git`, reads its HEAD history with the SAME `readGitHistory` the local adapter
 * uses (so a remote analysis is byte-identical to a local one), and removes the
 * temp dir on every exit path (success / failure / Ctrl-C) via `withTempWorkspace`
 * — stateless by construction, nothing persists between runs.
 *
 * READ-ONLY: `git clone` reads the remote; commit-sage never pushes. The clone is
 * `execFile` array args with a `--` end-of-options guard, so a hostile URL can
 * never be parsed as a `git` option (and `isRemoteTarget` already requires an
 * `https?://` prefix). Private-remote auth is Story 5.2; failure classification
 * (network / auth / not-found, no-retry) is Story 5.3 — a clone failure here is a
 * single `RetrieveError` (exit 4).
 */

import { join } from "node:path";

import type { RetrievePort } from "./retrieve.port.js";
import type { GitRunner } from "./git.js";
import { execFileGitRunner } from "./git.js";
import { readGitHistory } from "./read-history.js";
import { withTempWorkspace, type TempWorkspaceDeps } from "./temp-workspace.js";
import { RetrieveError } from "../shared/errors.js";

/** Read-only `git clone` args. `--` guards the URL/dest from option parsing; `--quiet` hushes progress. */
function cloneArgs(url: string, dest: string): string[] {
  return ["clone", "--quiet", "--", url, dest];
}

export function createRemoteRetrieve(
  runner: GitRunner = execFileGitRunner,
  workspaceDeps: TempWorkspaceDeps = {},
): RetrievePort {
  return async (config) => {
    const url = config.repoTarget;
    return withTempWorkspace(async (dir) => {
      const dest = join(dir, "repo");
      try {
        await runner(cloneArgs(url, dest), { cwd: dir });
      } catch (cause) {
        throw new RetrieveError(`Failed to clone "${url}".`, { cause });
      }
      return readGitHistory(runner, dest, url); // label the result with the URL, not the temp path
    }, workspaceDeps);
  };
}
