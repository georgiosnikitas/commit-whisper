/**
 * Cross-platform browser opener (Story 4.5).
 *
 * Isolates the post-render "open the HTML report in a browser" side effect behind
 * an injectable seam so `runPipeline` stays offline-testable (tests inject a fake
 * `OpenBrowser`; the default wires the real `node:child_process` shell-out). Lives
 * in `cli/` (the shell that owns side effects).
 *
 * Security: the opener uses `execFile` with ARRAY args — never a shell string — so
 * a file path containing spaces / `;` / `&&` / `$(...)` is passed as a single argv
 * element and can never be interpreted as a command (the same injection-safe
 * discipline as `retrieve/git.ts`). The pure `browserCommand` mapping is unit-
 * tested without spawning.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Don't let a missing / hung opener stall the run — the artifact is already on disk. */
const OPEN_TIMEOUT_MS = 5000;

/** Open a path/URL in the OS default browser. Rejects if the opener fails. */
export type OpenBrowser = (target: string) => Promise<void>;

/** The platform → `{ command, args }` mapping (pure; `target` is always a standalone argv element). */
export function browserCommand(platform: NodeJS.Platform, target: string): { command: string; args: string[] } {
  if (platform === "darwin") {
    return { command: "open", args: [target] };
  }
  if (platform === "win32") {
    // `start` is a `cmd` builtin; the empty "" is its title arg, guarding a quoted path.
    return { command: "cmd", args: ["/c", "start", "", target] };
  }
  return { command: "xdg-open", args: [target] };
}

/** The real opener: shells out (array args, never a shell) to the platform browser launcher. */
export const defaultOpenBrowser: OpenBrowser = async (target) => {
  const { command, args } = browserCommand(process.platform, target);
  await execFileAsync(command, args, { timeout: OPEN_TIMEOUT_MS, windowsHide: true });
};
