/**
 * Remote-clone failure classification (Story 5.3 — FR-3; the architecture's `retrieve/errors.ts`).
 *
 * A `git clone` can fail for distinct reasons that deserve distinct, actionable
 * messages. `classifyCloneFailure` reads git's stderr/message text and buckets it
 * into a `CloneFailureKind`; `cloneFailureError` maps that to a token-REDACTED
 * `RetrieveError` (exit 4) naming the likely fix. Generalizes the Story 5.2
 * auth-only seed into the full taxonomy (auth · network · not-found · rate-limit).
 *
 * No-retry posture (FR-3): this module only CLASSIFIES + REPORTS a failure — the
 * remote adapter makes a single clone attempt and throws; there is no retry/backoff
 * anywhere. A transient/rate-limit failure is reported and raised, never looped.
 *
 * Security: every crafted message takes only the URL + the auth booleans — never
 * the token; git's raw error rides `RetrieveError.cause` (never rendered —
 * `messageForError` shows only `err.message`). Pure: text in, classification/error
 * out (no clock/I/O/random); the regexes are alternation-only (no ReDoS).
 */

import { RetrieveError } from "../shared/errors.js";

/** The distinct classes a remote clone failure is bucketed into. */
export type CloneFailureKind = "auth" | "network" | "not-found" | "rate-limit" | "unknown";

interface FailureSignal {
  kind: CloneFailureKind;
  pattern: RegExp;
}

/**
 * Ordered most-specific-first so overlapping signals resolve deliberately:
 * a throttle (`429`) is rate-limit (not auth); an explicit reject (`401`/`403`)
 * is auth (not not-found); a `404` is not-found. Case-insensitive, alternation
 * only (no nested quantifiers → no catastrophic backtracking).
 */
const SIGNALS: readonly FailureSignal[] = [
  { kind: "rate-limit", pattern: /rate limit|too many requests|\b429\b/i },
  {
    kind: "auth",
    pattern: /Authentication failed|could not read Username|terminal prompts disabled|invalid username or password|\b40[13]\b|Permission denied/i,
  },
  { kind: "not-found", pattern: /not found|does not exist|\b404\b/i },
  {
    kind: "network",
    pattern: /could not resolve host|couldn't resolve|unable to access|failed to connect|could not connect|connection (refused|reset|timed out)|network is unreachable|operation timed out|\bSSL\b|\bTLS\b/i,
  },
];

/** Pull the searchable text (stderr + message) from an unknown thrown cause. */
function failureText(cause: unknown): string {
  const err = cause as { stderr?: unknown; message?: unknown } | null;
  if (err === null || typeof err !== "object") {
    return "";
  }
  const stderr = typeof err.stderr === "string" ? err.stderr : "";
  const message = typeof err.message === "string" ? err.message : "";
  return `${stderr}\n${message}`;
}

/** Classify a clone failure by its git stderr/message text (pure; `"unknown"` if no signal matches). */
export function classifyCloneFailure(cause: unknown): CloneFailureKind {
  const text = failureText(cause);
  for (const { kind, pattern } of SIGNALS) {
    if (pattern.test(text)) {
      return kind;
    }
  }
  return "unknown";
}

/**
 * Map a clone failure to a token-REDACTED `RetrieveError` (exit 4) with a
 * class-specific, actionable message. The message NEVER contains the token (it
 * takes only the URL + booleans); git's raw error rides `cause` (never rendered).
 * The URL is redacted of any `user:secret@` userinfo a user may have embedded, so
 * a credential mistakenly placed in the URL can't leak through the echoed target.
 */
export function cloneFailureError(url: string, authenticated: boolean, cause: unknown): RetrieveError {
  return new RetrieveError(failureMessage(classifyCloneFailure(cause), redactUrl(url), authenticated), { cause });
}

/** Strip any `user:password@` userinfo from a URL so an embedded credential never echoes. */
function redactUrl(url: string): string {
  return url.replace(/\/\/[^/@]*@/, "//***@");
}

/** The actionable, token-free message for a failure class. */
function failureMessage(kind: CloneFailureKind, url: string, authenticated: boolean): string {
  switch (kind) {
    case "auth":
      return authenticated
        ? `Authentication failed cloning "${url}". The token (COMMIT_SAGE_GIT_TOKEN) may lack the scope to read this repository — a private repo needs read access to its contents (e.g. the "repo" scope on GitHub, "read_repository" on GitLab). Verify the token's permissions.`
        : `Authentication is required to clone "${url}". Set COMMIT_SAGE_GIT_TOKEN (or GITHUB_TOKEN / GITLAB_TOKEN / BITBUCKET_TOKEN) to a token that can read this repository.`;
    case "network":
      return `Could not reach the remote to clone "${url}". Check the URL and your network connection, then re-run.`;
    case "not-found":
      return `Repository not found cloning "${url}". It may not exist, or it may be private and your token lacks access — check the URL and the repository's visibility.`;
    case "rate-limit":
      return `Rate limited while cloning "${url}". The host is throttling requests; commit-sage does not retry — wait a while and re-run.`;
    case "unknown":
    default:
      return `Failed to clone "${url}".`;
  }
}
