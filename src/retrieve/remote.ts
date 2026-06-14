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
import { RetrieveError } from "../shared/errors.js";
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

/** An auth-rejection signal in git's clone stderr (the auth dimension only; 5.3 owns the rest). */
const AUTH_FAILURE =
  /Authentication failed|could not read Username|terminal prompts disabled|invalid username or password|\b40[13]\b|Permission denied/i;

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
        await runner(cloneArgs(url, dest, gitToken !== undefined), { cwd: dir, extraEnv: cloneEnv(gitToken) });
      } catch (cause) {
        throw cloneError(url, gitToken !== undefined, cause);
      }
      return readGitHistory(runner, dest, url); // read the local clone (no auth/env needed)
    }, workspaceDeps);
  };
}

/**
 * Map a clone failure to a token-REDACTED `RetrieveError`. The auth dimension is
 * classified here (token-present ⇒ scope hint; token-absent ⇒ set-the-var hint);
 * any other failure stays the generic message (Story 5.3 refines the taxonomy).
 * The crafted message never contains the token; git's raw error rides `cause`
 * (never rendered — `messageForError` shows only `err.message`).
 */
function cloneError(url: string, authenticated: boolean, cause: unknown): RetrieveError {
  if (isAuthFailure(cause)) {
    const message = authenticated
      ? `Authentication failed cloning "${url}". The token (COMMIT_SAGE_GIT_TOKEN) may lack the scope to read this repository — a private repo needs read access to its contents (e.g. the "repo" scope on GitHub, "read_repository" on GitLab). Verify the token's permissions.`
      : `Authentication is required to clone "${url}". Set COMMIT_SAGE_GIT_TOKEN (or GITHUB_TOKEN / GITLAB_TOKEN / BITBUCKET_TOKEN) to a token that can read this repository.`;
    return new RetrieveError(message, { cause });
  }
  return new RetrieveError(`Failed to clone "${url}".`, { cause });
}

/** True iff the error's text carries an auth-rejection signal. */
function isAuthFailure(cause: unknown): boolean {
  const err = cause as { stderr?: unknown; message?: unknown } | null;
  if (err === null || typeof err !== "object") {
    return false;
  }
  const stderr = typeof err.stderr === "string" ? err.stderr : "";
  const message = typeof err.message === "string" ? err.message : "";
  return AUTH_FAILURE.test(`${stderr}\n${message}`);
}
