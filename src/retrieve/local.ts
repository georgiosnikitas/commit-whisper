/**
 * Local repository retrieve adapter (Story 1.4; reader extracted in Story 5.1).
 *
 * Reads the current repository's HEAD history via the system `git` and emits a
 * raw `RepoHistory`. STRICTLY READ-ONLY. The read logic now lives in the shared
 * `readGitHistory` (so the remote adapter reads identically); this adapter is the
 * thin "the work tree IS the target path" binding: `config.repoTarget` is both
 * the directory git runs in and the label stamped on the result.
 *
 * Commit-selection filters (author / max-count / no-merges / dates) are Story
 * 2.6; the normalized model + `.mailmap` canonicalization + deterministic
 * ordering are Story 1.5 — this adapter emits raw records in git's emit order.
 */

import type { RetrievePort } from "./retrieve.port.js";
import type { GitRunner } from "./git.js";
import { execFileGitRunner } from "./git.js";
import { readGitHistory } from "./read-history.js";

export function createLocalRetrieve(runner: GitRunner = execFileGitRunner): RetrievePort {
  return async (config) => readGitHistory(runner, config.repoTarget, config.repoTarget);
}
