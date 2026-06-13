/**
 * Minimal typed-error seam for the configuration resolver.
 *
 * Story 1.2 plants only what the Phase-2 gap handler needs: a `CommitSageError`
 * base carrying a machine `code` + numeric `exitCode`, and the single
 * `MissingRequiredConfigError` (exit code 3 = "required input missing,
 * non-interactive"). Story 1.3 expands this into the full error hierarchy, the
 * `cli/exit-codes.ts` enum (0-9), stream discipline, and `Secret<string>`.
 */

/** Base class for every operational failure mapped to a machine-readable exit code. */
export class CommitSageError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, code: string, exitCode: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.exitCode = exitCode;
    // Keep a clean stack pointing at the throw site (V8 only).
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, new.target);
    }
  }
}

/**
 * Thrown by Phase-2 gap handling when a required config field is missing in a
 * non-interactive context. It is a typed error, never a prompt (FR-15).
 */
export class MissingRequiredConfigError extends CommitSageError {
  readonly field: string;

  constructor(field: string, envVar?: string) {
    const hint = envVar
      ? ` Set the ${envVar} environment variable or pass the corresponding flag.`
      : "";
    // exitCode 3 = "Required input missing (non-interactive)".
    // The canonical 0-9 enum lands in cli/exit-codes.ts (Story 1.3).
    super(`Required configuration "${field}" is missing.${hint}`, "CONFIG_REQUIRED_MISSING", 3);
    this.field = field;
  }
}
