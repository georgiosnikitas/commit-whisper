/**
 * Remote HTTPS repository retrieve adapter (Story 5.1; private-auth added 5.2).
 *
 * Clones a remote HTTPS repository into a disposable OS temp dir via the system
 * `git`, reads its HEAD history with the SAME `readGitHistory` the local adapter
 * uses (so a remote analysis is byte-identical to a local one), and removes the
 * temp dir on every exit path via `withTempWorkspace`.
 *
 * Private-remote auth (5.2): an optional `Secret` PAT (env-only, resolved in
 * `config/env.ts`) is supplied to the clone via a credential helper FED FROM THE
 * CHILD ENVIRONMENT — the helper script in `argv` names the env var
 * (`$COMMIT_SAGE_GIT_PAT`), never the token value, so the secret never appears in
 * `argv`/`ps`/logs/output. `GIT_TERMINAL_PROMPT=0` + a cleared credential helper
 * make a private-no-token clone fail fast instead of hanging on a prompt. An
 * auth-rejected clone yields a token-redacted, actionable `RetrieveError`.
 *
 * READ-ONLY: `git clone` reads the remote; commit-sage never pushes. `execFile`
 * array args + a `--` end-of-options guard (no shell from us). Failure
 * classification beyond the auth dimension is Story 5.3.
 */

import { join } from "node:path";

import type { RetrievePort } from "./retrieve.port.js";
import type { GitRunner } from "./git.js";
import { execFileGitRunner } from "./git.js";
import { readGitHistory } from "./read-history.js";
import { withTempWorkspace, type TempWorkspaceDeps } from "./temp-workspace.js";
import { cloneFailureError } from "./errors.js";
import type { Secret } from "../shared/secret.js";

/** The child-env variable the credential helper reads the token from (never in argv). */
const TOKEN_ENV_VAR = "COMMIT_SAGE_GIT_PAT";
/** A username that authenticates a PAT on GitHub + GitLab (PAT-as-password). */
const AUTH_USERNAME = "x-access-token";

/**
 * The inline credential helper: a literal `sh` snippet git runs for a `get`. It
 * echoes the username + the password from `$COMMIT_SAGE_GIT_PAT` — the env var
 * NAME (expanded by git's shell at runtime), never the token value. Neither the
 * token nor the URL is interpolated into this constant, so there is no injection.
 */
const CREDENTIAL_HELPER = `!f() { test "$1" = get && echo username=${AUTH_USERNAME} && echo "password=$${TOKEN_ENV_VAR}"; }; f`;

/**
 * Read-only `git clone` args. `--` guards the URL/dest from option parsing.
 * Always clears inherited credential helpers (`-c credential.helper=`) so no
 * system/GUI helper prompts; when authenticated, adds the env-fed inline helper.
 */
function cloneArgs(url: string, dest: string, authenticated: boolean): string[] {
  const clearHelper = ["-c", "credential.helper="]; // reset any inherited helper list
  const helper = authenticated ? ["-c", `credential.helper=${CREDENTIAL_HELPER}`] : [];
  return [...clearHelper, ...helper, "clone", "--quiet", "--", url, dest];
}

/** The git-auth env for the clone: prompts off always; the token channel when present. */
function cloneEnv(gitToken: Secret<string> | undefined): Record<string, string> {
  const env: Record<string, string> = { GIT_TERMINAL_PROMPT: "0" };
  if (gitToken !== undefined) {
    env[TOKEN_ENV_VAR] = gitToken.reveal(); // revealed only here, only into the child env
  }
  return env;
}

export function createRemoteRetrieve(
  runner: GitRunner = execFileGitRunner,
  workspaceDeps: TempWorkspaceDeps = {},
  gitToken?: Secret<string>,
): RetrievePort {
  return async (config) => {
    const url = config.repoTarget;
    return withTempWorkspace(async (dir) => {
      const dest = join(dir, "repo");
      try {
        // A SINGLE clone attempt — no retry/backoff (FR-3 no-retry posture).
        await runner(cloneArgs(url, dest, gitToken !== undefined), { cwd: dir, extraEnv: cloneEnv(gitToken) });
      } catch (cause) {
        throw cloneFailureError(url, gitToken !== undefined, cause); // classified, token-redacted (Story 5.3)
      }
      return readGitHistory(runner, dest, url); // read the local clone (no auth/env needed)
    }, workspaceDeps);
  };
}
