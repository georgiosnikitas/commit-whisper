/**
 * The git shell-out primitive (Story 1.4; `extraEnv` added Story 5.2).
 *
 * A `GitRunner` runs the system `git` with an args array and returns stdout. The
 * default `execFileGitRunner` uses `node:child_process` `execFile` — array args,
 * NEVER a shell — so there is no metacharacter expansion (no command injection)
 * and the call is read-only by construction (the adapter only ever passes read
 * subcommands). The runner is an injectable seam so adapters and unit tests do
 * not need a real repository.
 *
 * `extraEnv` (Story 5.2) is the git-AUTH channel: it carries `GIT_TERMINAL_PROMPT`
 * and the credential-helper token variable into the `git` child WITHOUT putting
 * the token in `argv`/`ps`. It is set only on the authenticated remote clone; a
 * local read passes no `extraEnv` and inherits the environment cleanly.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Generous buffer for large histories; `spawn`-streaming is a future perf refinement. */
const MAX_BUFFER = 256 * 1024 * 1024;

export type GitRunner = (
  args: readonly string[],
  options: { cwd: string; extraEnv?: Record<string, string> },
) => Promise<string>;

export const execFileGitRunner: GitRunner = async (args, options) => {
  const { stdout } = await execFileAsync("git", [...args], {
    cwd: options.cwd,
    // execFile already inherits `process.env` by default; we make that explicit
    // ONLY to ADD the git-auth vars (GIT_TERMINAL_PROMPT + the credential-helper
    // token channel) when cloning a private remote. This is not reading
    // application configuration (the hexagonal `process.env` rule's intent) — it
    // propagates the OS env to the git child — so the scoped disable is honest.
    // eslint-disable-next-line no-restricted-properties -- propagate OS env to the git child + add auth vars (not config reading)
    env: options.extraEnv === undefined ? undefined : { ...process.env, ...options.extraEnv },
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });
  return stdout;
};
