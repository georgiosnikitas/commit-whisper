/**
 * `Secret<string>` — a redaction wrapper for sensitive values (Story 1.3).
 *
 * Secrets (the LLM key, the git PAT) are env-only and must NEVER reach Report
 * JSON, logs, or any output. `Secret` redacts to `***` in every stringification
 * path — `toString`, `toJSON` (so `JSON.stringify` is safe), and the Node
 * `util.inspect` custom hook (so `console.log` / inspect are safe). The value is
 * held in a true private field so it does not enumerate (spreading yields `{}`)
 * and is readable only via the explicit `reveal()` accessor, called at the point
 * of use (e.g. handing the key to the LLM SDK in Story 1.6, or git auth in Epic 5).
 */

const REDACTED = "***";

export class Secret<T = string> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  /** The single intended read path. Call only at the point of use. */
  reveal(): T {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return REDACTED;
  }
}
