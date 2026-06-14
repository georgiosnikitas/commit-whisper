/**
 * Local/remote retrieve dispatcher (Story 5.1).
 *
 * The pipeline's default `RetrievePort`: routes a remote HTTPS URL to the remote
 * clone-into-temp adapter and a local filesystem path to the local adapter,
 * sharing one `GitRunner` and the same history reader — so a remote and a local
 * analysis of the same history are identical. The choice is per-run, driven by
 * the frozen `RunConfig.repoTarget`.
 */

import type { RetrievePort } from "./retrieve.port.js";
import type { GitRunner } from "./git.js";
import { execFileGitRunner } from "./git.js";
import { isRemoteTarget } from "./target.js";
import { createLocalRetrieve } from "./local.js";
import { createRemoteRetrieve } from "./remote.js";
import type { TempWorkspaceDeps } from "./temp-workspace.js";

export interface RetrieveDeps {
  /** The git shell-out (shared by both adapters). Default: the real `execFile` runner. */
  runner?: GitRunner;
  /** Temp-workspace side-effect seams for the remote adapter (offline-testable). */
  workspace?: TempWorkspaceDeps;
}

/** Build the dispatching retriever: remote URL ⇒ clone-into-temp, else local path. */
export function createRetrieve(deps: RetrieveDeps = {}): RetrievePort {
  const runner = deps.runner ?? execFileGitRunner;
  const local = createLocalRetrieve(runner);
  const remote = createRemoteRetrieve(runner, deps.workspace);
  return async (config) => (isRemoteTarget(config.repoTarget) ? remote : local)(config);
}
