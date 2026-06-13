/**
 * The single human-output module (Story 1.3).
 *
 * ALL human chrome — messages, warnings, errors (and later: spinner, prompts,
 * update notices) — goes to STDERR via this module. stdout is reserved for
 * machine data (Report JSON, written by the renderers in later stories), so
 * `commit-sage --format json > report.json` stays clean under every condition.
 *
 * `src/shared/**` is under the `no-console` lint rule, so this writes via
 * `process.stderr.write` rather than `console.*`. Color (`NO_COLOR` /
 * `FORCE_COLOR` / picocolors), the spinner, and prompts are Epic 6 and a later
 * expansion of this surface — intentionally absent here.
 *
 * The severity methods share one stderr writer today; the distinct entry points
 * give callers stable, intention-revealing names that can gain per-level
 * formatting later without changing call sites. The stream is injectable so the
 * module is unit-testable against a fake `WritableStream`.
 */

export interface Ui {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  plain(message: string): void;
}

export function createUi(stream: NodeJS.WritableStream = process.stderr): Ui {
  const writeLine = (message: string): void => {
    stream.write(`${message}\n`);
  };
  return {
    error: writeLine,
    warn: writeLine,
    info: writeLine,
    plain: writeLine,
  };
}

/** The default `ui` instance, writing to `process.stderr`. */
export const ui = createUi();
