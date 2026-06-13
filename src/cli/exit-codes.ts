/**
 * Canonical exit-code enum + error resolution (Story 1.3 — the C4 model).
 *
 * `ExitCode` is the single named source for the 0-9 codes the CLI shell exits
 * with. `cli/` may import `shared/` (correct layering), so the resolvers below
 * translate a thrown value into the code + human message the shell emits. The
 * error subclasses in `shared/errors.ts` carry their exit-code as a numeric
 * literal (shared must not import cli); `exit-codes.test.ts` cross-checks those
 * literals against this enum so the two cannot drift.
 *
 * Codes 0 (success) and 9 (degraded) are terminal STATES the shell sets — never
 * thrown — so they have no error class. The actual `process.exit()` call site is
 * the CLI shell (`cli/run.ts` + `src/index.ts`, Story 1.8); this module only
 * provides the pure mapping pieces it will use.
 */

import { CommitSageError, GENERIC_INTERNAL_MESSAGE } from "../shared/errors.js";

export const ExitCode = {
  Success: 0,
  Internal: 1,
  Usage: 2,
  MissingInput: 3,
  Retrieve: 4,
  Metrics: 5,
  Narration: 6,
  Render: 7,
  License: 8,
  Degraded: 9,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Resolve the exit code for any thrown value: a `CommitSageError` yields its own
 * `exitCode` (1-8); anything else is an unexpected internal failure (1).
 */
export function exitCodeForError(err: unknown): number {
  return err instanceof CommitSageError ? err.exitCode : ExitCode.Internal;
}

/**
 * Resolve the human message for any thrown value. A `CommitSageError` carries an
 * actionable message; an unknown throwable (or a typed error with a blank
 * message) is reported generically so a raw stack / internal detail never
 * reaches the user surface and the shell never prints a blank line.
 */
export function messageForError(err: unknown): string {
  if (err instanceof CommitSageError && err.message.trim() !== "") {
    return err.message;
  }
  return GENERIC_INTERNAL_MESSAGE;
}
