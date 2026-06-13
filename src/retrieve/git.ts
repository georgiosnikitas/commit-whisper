/**
 * The git shell-out primitive (Story 1.4).
 *
 * A `GitRunner` runs the system `git` with an args array and returns stdout. The
 * default `execFileGitRunner` uses `node:child_process` `execFile` — array args,
 * NEVER a shell — so there is no metacharacter expansion (no command injection)
 * and the call is read-only by construction (the adapter only ever passes read
 * subcommands). The runner is an injectable seam so adapters and unit tests do
 * not need a real repository.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Generous buffer for large histories; `spawn`-streaming is a future perf refinement. */
const MAX_BUFFER = 256 * 1024 * 1024;

export type GitRunner = (
  args: readonly string[],
  options: { cwd: string },
) => Promise<string>;

export const execFileGitRunner: GitRunner = async (args, options) => {
  const { stdout } = await execFileAsync("git", [...args], {
    cwd: options.cwd,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });
  return stdout;
};
