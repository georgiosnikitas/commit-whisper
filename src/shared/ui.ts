/**
 * The single human-output module (Story 1.3; verbosity + colour added 6.4).
 *
 * ALL human chrome — messages, warnings, errors, progress — goes to STDERR via
 * this module. stdout is reserved for machine data (Report JSON, the
 * `--show-config` dump), so `commit-sage --format json > report.json` stays
 * clean under every condition.
 *
 * Story 6.4 adds two stderr-only behaviour modifiers, both wired in by the CLI
 * shell from flags/env and NEVER touching stdout:
 *   - a `LogLevel` gate (`quiet` < `normal` < `verbose`): `error`/`warn` always
 *     show; `info`/`plain` are suppressed by `quiet`; `debug` shows only on
 *     `verbose`.
 *   - colour via `picocolors` (`NO_COLOR`/`FORCE_COLOR`-aware): `error` red,
 *     `warn` yellow; everything else stays plain (the calm posture).
 *
 * `src/shared/**` is under the `no-console` lint rule, so this writes via
 * `stream.write` rather than `console.*`. The stream + options are injectable so
 * the module is unit-testable against a fake `WritableStream`.
 */

import pc from "picocolors";

export type LogLevel = "quiet" | "normal" | "verbose";

export interface Ui {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  plain(message: string): void;
  /** Verbose-only detail. Optional so existing `{ error, warn, info, plain }` recorders still satisfy `Ui`. */
  debug?(message: string): void;
}

export interface UiOptions {
  level?: LogLevel;
  color?: boolean;
}

export function createUi(stream: NodeJS.WritableStream = process.stderr, opts: UiOptions = {}): Ui {
  const level = opts.level ?? "normal";
  const colors = pc.createColors(opts.color ?? false);
  const write = (message: string): void => {
    stream.write(`${message}\n`);
  };
  const showInfo = level !== "quiet"; // quiet keeps only error + warn
  const showDebug = level === "verbose";
  return {
    error: (m) => write(colors.red(m)),
    warn: (m) => write(colors.yellow(m)),
    info: (m) => {
      if (showInfo) {
        write(m);
      }
    },
    plain: (m) => {
      if (showInfo) {
        write(m);
      }
    },
    debug: (m) => {
      if (showDebug) {
        write(m);
      }
    },
  };
}

/** Trim to a non-empty string, or `undefined` (local copy — `config/env.ts` owns the canonical one). */
function nonEmpty(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const v = raw.trim();
  return v === "" ? undefined : v;
}

/**
 * Resolve the stderr log level (AC2). A flag beats the env var: `--quiet` wins
 * over `--verbose`, then `COMMIT_SAGE_LOG_LEVEL` (quiet|verbose|normal), else
 * `normal`. Pure — `env` is a parameter, never `process.env`.
 */
export function resolveLogLevel(input: { verbose?: boolean; quiet?: boolean; env: NodeJS.ProcessEnv }): LogLevel {
  if (input.quiet === true) {
    return "quiet";
  }
  if (input.verbose === true) {
    return "verbose";
  }
  const envLevel = nonEmpty(input.env.COMMIT_SAGE_LOG_LEVEL)?.toLowerCase();
  if (envLevel === "quiet" || envLevel === "verbose" || envLevel === "normal") {
    return envLevel;
  }
  return "normal";
}

/**
 * Resolve whether to colourise stderr chrome (AC2): a non-empty `NO_COLOR` wins
 * (→ no colour); else a non-empty `FORCE_COLOR` forces colour unless it is
 * `"0"`/`"false"`; else mirror the TTY. Pure — `env` is a parameter.
 */
export function resolveColor(input: { env: NodeJS.ProcessEnv; isTTY: boolean }): boolean {
  if (nonEmpty(input.env.NO_COLOR) !== undefined) {
    return false; // NO_COLOR wins
  }
  const force = nonEmpty(input.env.FORCE_COLOR)?.toLowerCase();
  if (force !== undefined) {
    return force !== "0" && force !== "false";
  }
  return input.isTTY;
}

/** The default `ui` instance (normal level, no colour), writing to `process.stderr`. */
export const ui = createUi();

