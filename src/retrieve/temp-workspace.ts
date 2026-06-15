/**
 * Bounded temp workspace with guaranteed cleanup (Story 5.1).
 *
 * `withTempWorkspace` creates a fresh, unique OS temp directory, runs the caller's
 * work in it, and ALWAYS removes it — on success, on a thrown error, and on an
 * interrupt (SIGINT/SIGTERM). Node's default signal handling terminates the
 * process WITHOUT running a `finally`, so a bare Ctrl-C would leak the temp dir;
 * the one-shot signal handlers here close that gap (clean up, then exit with the
 * conventional 128+signo code) and are deregistered when the scope exits (no
 * cross-run listener leak). Cleanup is idempotent, so the handler-then-finally
 * double path removes the dir exactly once.
 *
 * Every side effect (`mkdtemp`, `rmrf`, the signal table) is injectable, so the
 * whole thing is offline-/deterministically-testable without touching the real
 * filesystem or the process signal handlers.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The process signal seam (a tiny slice of `process`), injectable for tests. */
export interface SignalHub {
  once(event: "SIGINT" | "SIGTERM", handler: () => void): void;
  removeListener(event: "SIGINT" | "SIGTERM", handler: () => void): void;
  exit(code: number): void;
}

export interface TempWorkspaceDeps {
  /** Create a fresh unique temp dir, returning its path. Default: `mkdtemp` under the OS tmpdir. */
  mkdtemp?: () => string;
  /** Recursively remove a directory (best-effort). Default: `rmSync(dir, { recursive, force })`. */
  rmrf?: (dir: string) => void;
  /** The signal table. Default: the real `process`. */
  signals?: SignalHub;
}

/** Conventional exit codes for a terminating signal: 128 + signal number. */
const EXIT_ON_SIGINT = 130; // 128 + 2
const EXIT_ON_SIGTERM = 143; // 128 + 15

function defaultMkdtemp(): string {
  return mkdtempSync(join(tmpdir(), "commit-whisper-"));
}

function defaultRmrf(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/** The default signal hub: the real `process` (note — only `process.env` is lint-banned, not `process`). */
const defaultSignals: SignalHub = {
  once: (event, handler) => {
    process.once(event, handler);
  },
  removeListener: (event, handler) => {
    process.removeListener(event, handler);
  },
  exit: (code) => {
    process.exit(code);
  },
};

/**
 * Run `work` in a fresh temp dir, guaranteeing the dir is removed on success,
 * failure, and SIGINT/SIGTERM. Returns whatever `work` returns; rethrows whatever
 * `work` throws (after cleaning up).
 */
export async function withTempWorkspace<T>(
  work: (dir: string) => Promise<T>,
  deps: TempWorkspaceDeps = {},
): Promise<T> {
  const mkdtemp = deps.mkdtemp ?? defaultMkdtemp;
  const rmrf = deps.rmrf ?? defaultRmrf;
  const signals = deps.signals ?? defaultSignals;

  const dir = mkdtemp();

  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    try {
      rmrf(dir);
    } catch {
      // Best-effort: a cleanup failure must never mask the real result or error.
    }
  };

  // Ctrl-C / kill mid-work: clean the temp dir, then exit with the conventional code.
  const onSigint = (): void => {
    cleanup();
    signals.exit(EXIT_ON_SIGINT);
  };
  const onSigterm = (): void => {
    cleanup();
    signals.exit(EXIT_ON_SIGTERM);
  };
  signals.once("SIGINT", onSigint);
  signals.once("SIGTERM", onSigterm);

  try {
    return await work(dir);
  } finally {
    cleanup();
    signals.removeListener("SIGINT", onSigint);
    signals.removeListener("SIGTERM", onSigterm);
  }
}
