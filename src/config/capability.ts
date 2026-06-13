/**
 * Capability gate (Story 1.2, AC2).
 *
 * Computes whether the run may go interactive and the channel `aiMode` default.
 * `interactive = stdin.isTTY && stdout.isTTY && !isCI && !nonInteractive`, and
 * it FAILS CLOSED: if a usable TTY cannot be proven (or CI / `--non-interactive`),
 * the run behaves headlessly. The pure `computeCapability` takes a fully-resolved
 * snapshot so it is table-testable; the thin `detectCapability` adapter coerces
 * the real `process` signals into that snapshot.
 */

export interface CapabilitySnapshot {
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
  isCI: boolean;
  nonInteractive: boolean;
}

export interface Capability {
  interactive: boolean;
  aiModeDefault: "auto" | "off";
}

/** Pure capability gate. Fails closed toward non-interactive. */
export function computeCapability(snapshot: CapabilitySnapshot): Capability {
  const interactive =
    snapshot.stdinIsTTY && snapshot.stdoutIsTTY && !snapshot.isCI && !snapshot.nonInteractive;
  return {
    interactive,
    aiModeDefault: interactive ? "auto" : "off",
  };
}

/**
 * Lightweight CI detection by env sniffing. Virtually every CI provider sets
 * `CI` (GitHub Actions, GitLab CI, CircleCI, Travis, ...). Kept injectable; the
 * `ci-info` package is an available future hardening if this proves too coarse.
 */
export function detectCI(env: NodeJS.ProcessEnv): boolean {
  const ci = env.CI;
  if (ci === undefined || ci === "" || ci === "0" || ci === "false") {
    return false;
  }
  return true;
}

/**
 * Thin adapter: coerce `process.stdin.isTTY` / `process.stdout.isTTY` (which are
 * `true | undefined` in Node) to booleans, derive `isCI`, and delegate to the
 * pure gate.
 */
export function detectCapability(input: {
  nonInteractive: boolean;
  stdinIsTTY: boolean | undefined;
  stdoutIsTTY: boolean | undefined;
  env: NodeJS.ProcessEnv;
}): Capability {
  return computeCapability({
    stdinIsTTY: Boolean(input.stdinIsTTY),
    stdoutIsTTY: Boolean(input.stdoutIsTTY),
    isCI: detectCI(input.env),
    nonInteractive: input.nonInteractive,
  });
}
