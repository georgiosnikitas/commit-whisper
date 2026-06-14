/**
 * Repo context for the launchpad header (Story 6.1).
 *
 * A read-only, never-throwing probe of the cwd for the header readiness line:
 * is it a git work tree, and on which branch? It reuses the injected `GitRunner`
 * (`retrieve/git.ts` — `execFile`, array args, no shell) so it inherits the 1.4
 * injection-safety posture and is unit-testable without a real repository.
 *
 * Unlike the retrieval reader, a non-repo cwd is NOT an error here — the menu
 * must still open (the header simply shows "not a git repo"), so every failure
 * resolves to a calm `{ isRepo: false }` rather than a thrown `RetrieveError`.
 */

import type { GitRunner } from "../retrieve/git.js";

export interface RepoContext {
  isRepo: boolean;
  /** The current branch; `undefined` for a detached HEAD (or when unreadable). */
  branch?: string;
}

/** Probe `cwd` for the header: work-tree membership + current branch. Never throws. */
export async function readRepoContext(runner: GitRunner, cwd: string): Promise<RepoContext> {
  let insideWorkTree: string;
  try {
    insideWorkTree = (await runner(["rev-parse", "--is-inside-work-tree"], { cwd })).trim();
  } catch {
    return { isRepo: false };
  }
  if (insideWorkTree !== "true") {
    return { isRepo: false };
  }

  try {
    const current = (await runner(["branch", "--show-current"], { cwd })).trim();
    // `--show-current` prints nothing for a detached HEAD; map "" → undefined.
    return { isRepo: true, branch: current === "" ? undefined : current };
  } catch {
    return { isRepo: true };
  }
}
