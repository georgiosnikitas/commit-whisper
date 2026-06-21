/**
 * The single human-output module (Story 1.3; verbosity + colour added 6.4).
 *
 * ALL human chrome — messages, warnings, errors, progress — goes to STDERR via
 * this module. stdout is reserved for machine data (Report JSON, the
 * `--show-config` dump), so `commit-whisper --format json > report.json` stays
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
 * over `--verbose`, then `COMMIT_WHISPER_LOG_LEVEL` (quiet|verbose|normal), else
 * `normal`. Pure — `env` is a parameter, never `process.env`.
 */
export function resolveLogLevel(input: { verbose?: boolean; quiet?: boolean; env: NodeJS.ProcessEnv }): LogLevel {
  if (input.quiet === true) {
    return "quiet";
  }
  if (input.verbose === true) {
    return "verbose";
  }
  const envLevel = nonEmpty(input.env.COMMIT_WHISPER_LOG_LEVEL)?.toLowerCase();
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

/**
 * A live, single-line STAGE PROGRESS reporter for the long-running pipeline
 * (retrieve → analyze → narrate → render). Like `ui`, ALL of its chrome is
 * stderr-only, so stdout stays machine-clean while a spinner animates.
 *
 * The driver advances stages with `start`/`update` and closes each with
 * `done`/`fail`; `clear` wipes any in-flight animation without a verdict line
 * (used on an unexpected throw). On a TTY it animates a braille spinner with a
 * `[n/total]` counter, rewriting one line in place; off a TTY (CI, pipes) it
 * degrades to plain one-line-per-stage status so logs stay readable.
 */
export interface Progress {
  /** Begin the next stage with this status label (advances the `[n/total]` counter). */
  start(label: string): void;
  /** Replace the active stage's status label in place (no counter advance). */
  update(label: string): void;
  /** Close the active stage as succeeded (✓), optionally with a final label. */
  done(label?: string): void;
  /** Close the active stage as failed (✗), optionally with a final label. */
  fail(label?: string): void;
  /** Stop any animation and wipe the line WITHOUT a verdict (used on an unexpected throw). */
  clear(): void;
}

export interface ProgressOptions extends UiOptions {
  /** Whether stderr is a TTY — animation only runs when true (else plain status lines). */
  tty?: boolean;
  /** Total number of stages, used to render a `[n/total]` counter. Omit for no counter. */
  total?: number;
}

/** The braille spinner frames (one rewritten line on a TTY). */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;
/** Carriage-return + ANSI "erase whole line" — rewrite the spinner line in place. */
const CLEAR_LINE = "\r\u001b[2K";

/**
 * A compact unicode progress bar (`▰▰▰▱▱▱`) for `completed/total`, clamped to
 * `[0, 1]`. Pure + deterministic — used to enrich a stage's status label (e.g.
 * the multi-step AI-narrative generation) on both a TTY and in plain logs.
 */
export function progressBar(completed: number, total: number, width = 12): string {
  if (total <= 0 || width <= 0) {
    return "";
  }
  const ratio = Math.min(1, Math.max(0, completed / total));
  const filled = Math.min(width, Math.round(ratio * width));
  return "▰".repeat(filled) + "▱".repeat(width - filled);
}

/** A no-op `Progress` — the default the pipeline uses unless a real one is injected (and the off-TTY/quiet fallback). */
export const noopProgress: Progress = {
  start() {},
  update() {},
  done() {},
  fail() {},
  clear() {},
};

/**
 * Build a stderr `Progress`. `quiet` returns the no-op (parity with `ui.info`
 * suppression). A TTY animates a spinner; otherwise each `start`/`update` writes
 * one plain status line and `done`/`fail` print only when given a final label.
 */
export function createProgress(
  stream: NodeJS.WritableStream = process.stderr,
  opts: ProgressOptions = {},
): Progress {
  const level = opts.level ?? "normal";
  if (level === "quiet") {
    return noopProgress; // quiet keeps only error + warn
  }
  const colors = pc.createColors(opts.color ?? false);
  const animate = opts.tty === true;
  const total = opts.total;

  let label = "";
  let step = 0;
  let frame = 0;
  let active = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const counter = (): string => (total === undefined ? "" : `[${Math.min(step, total)}/${total}] `);

  const render = (): void => {
    const spinner = colors.cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
    stream.write(`${CLEAR_LINE}${spinner} ${counter()}${label}`);
  };

  const stopTimer = (): void => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  const finish = (symbol: string, finalLabel?: string): void => {
    if (!active) {
      // Already closed (or never started): only an explicit final label prints.
      if (finalLabel !== undefined) {
        stream.write(`${symbol} ${counter()}${finalLabel}\n`);
      }
      return;
    }
    active = false;
    stopTimer();
    const text = finalLabel ?? label;
    stream.write(animate ? `${CLEAR_LINE}${symbol} ${counter()}${text}\n` : `${symbol} ${counter()}${text}\n`);
  };

  return {
    start(next: string): void {
      step += 1;
      label = next;
      active = true;
      if (animate) {
        frame = 0;
        render();
        stopTimer();
        timer = setInterval(() => {
          frame += 1;
          render();
        }, SPINNER_INTERVAL_MS);
        // Never keep the event loop alive for the animation alone.
        timer.unref?.();
      } else {
        stream.write(`${counter()}${label}\n`);
      }
    },
    update(next: string): void {
      label = next;
      if (!active) {
        return;
      }
      if (animate) {
        render();
      } else {
        stream.write(`${counter()}${label}\n`);
      }
    },
    done(finalLabel?: string): void {
      finish(colors.green("✓"), finalLabel);
    },
    fail(finalLabel?: string): void {
      finish(colors.red("✗"), finalLabel);
    },
    clear(): void {
      stopTimer();
      if (active && animate) {
        stream.write(CLEAR_LINE);
      }
      active = false;
    },
  };
}

