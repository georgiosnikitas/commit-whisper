/**
 * The typed error hierarchy (Story 1.3).
 *
 * Every operational failure is a `CommitSageError` subclass carrying a stable
 * machine `code` and a numeric `exitCode` (the C4 model). The CLI shell maps a
 * thrown error to its `exitCode` and prints its `message` to stderr; any
 * non-`CommitSageError` throwable maps to exit 1 (internal). See
 * `cli/exit-codes.ts` for the canonical enum + the error->exit/message
 * resolvers, `shared/secret.ts` for `Secret<string>`, and `shared/ui.ts` for
 * the single stderr writer.
 *
 * Codes 0 (success) and 9 (degraded) are terminal STATES the shell sets, never
 * thrown -- so there is no error class for them. The exit-code literals here are
 * cross-checked against the `ExitCode` enum by `cli/exit-codes.test.ts` (the
 * enum lives in `cli/` and `shared/` must not import it).
 */

/** The user-facing message for an unexpected/internal failure (exit 1). */
export const GENERIC_INTERNAL_MESSAGE = "An unexpected internal error occurred.";

/** Optional constructor extras shared by the hierarchy (ES2022 error `cause`). */
export interface ErrorOptions {
  cause?: unknown;
}

/** Base class for every operational failure mapped to a machine-readable exit code. */
export class CommitSageError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, code: string, exitCode: number, options?: ErrorOptions) {
    super(message, options);
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

/** Exit 1 — an unexpected / internal error (also the fallback for unknown throwables). */
export class InternalError extends CommitSageError {
  constructor(message = GENERIC_INTERNAL_MESSAGE) {
    super(message, "INTERNAL", 1);
  }
}

/** Exit 2 — a usage / validation error (e.g. a bad flag). */
export class UsageError extends CommitSageError {
  constructor(message: string) {
    super(message, "USAGE", 2);
  }
}

/** Exit 4 — a retrieve / git failure. Wraps the underlying git/spawn error as `cause`. */
export class RetrieveError extends CommitSageError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "RETRIEVE", 4, options);
  }
}

/** Exit 5 — a metrics-engine failure. */
export class MetricsError extends CommitSageError {
  constructor(message: string) {
    super(message, "METRICS", 5);
  }
}

/** Exit 6 — a narration / LLM failure (thrown only when `aiMode: required`). */
export class NarrationError extends CommitSageError {
  constructor(message: string) {
    super(message, "NARRATION", 6);
  }
}

/** Exit 7 — a render failure. */
export class RenderError extends CommitSageError {
  constructor(message: string) {
    super(message, "RENDER", 7);
  }
}

/** Exit 8 — a license-gate failure. */
export class LicenseError extends CommitSageError {
  constructor(message: string) {
    super(message, "LICENSE", 8);
  }
}
