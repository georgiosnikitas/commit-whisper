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

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Generous buffer for large histories on the buffered path; the streamed path has no limit. */
const MAX_BUFFER = 256 * 1024 * 1024;

export type GitRunner = (
  args: readonly string[],
  options: {
    cwd: string;
    extraEnv?: Record<string, string>;
    /**
     * When provided, the call STREAMS stdout (via `spawn`) and invokes this with
     * each decoded chunk as it arrives — used to report live progress (e.g. a
     * commit count) for a long `git log` on a big repo. The full stdout is still
     * returned. Omit it for the default buffered `execFile` read.
     */
    onChunk?: (chunk: string) => void;
  },
) => Promise<string>;

export const execFileGitRunner: GitRunner = async (args, options) => {
  if (options.onChunk !== undefined) {
    return spawnGitRunner(args, options.cwd, options.extraEnv, options.onChunk);
  }
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

/**
 * Streamed `git` read: `spawn`s the child, decodes stdout incrementally (calling
 * `onChunk` per chunk for live progress), accumulates the full stdout, and
 * resolves it. A non-zero exit rejects with an Error carrying `code`/`stderr` —
 * the SAME shape the `execFile` rejection has — so callers' error classification
 * is unaffected. No `maxBuffer` cap (streaming), so very large histories are safe.
 */
function spawnGitRunner(
  args: readonly string[],
  cwd: string,
  extraEnv: Record<string, string> | undefined,
  onChunk: (chunk: string) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("git", [...args], {
      cwd,
      // eslint-disable-next-line no-restricted-properties -- propagate OS env to the git child + add auth vars (not config reading)
      env: extraEnv === undefined ? undefined : { ...process.env, ...extraEnv },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      onChunk(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const err = new Error(`git exited with code ${code ?? "unknown"}`) as Error & { code?: number | null; stderr?: string };
      err.code = code;
      err.stderr = stderr;
      reject(err);
    });
  });
}
