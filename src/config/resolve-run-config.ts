/**
 * Two-phase resolver orchestration (Story 1.2).
 *
 * Composes the pure pieces into a single frozen `RunConfig`:
 *   capability gate -> channel-aware defaults -> merge(defaults, configFile, env,
 *   flags) -> Phase-2 gap handling + freeze.
 *
 * All I/O is INJECTED at this boundary (cwd, env, TTY signals, analysisTimestamp,
 * flags), keeping the resolver testable and the pipeline hexagonally clean. Two
 * layers are stubbed until their owning stories land:
 *   - `configFile` defaults to `{}` (real `~/.commit-sage` reading is Epic 6).
 *   - `flags` is supplied by the caller (real commander parsing is `cli/`, 1.8).
 * `entitlement` defaults to the Free tier (the license gate is Epic 7).
 */

import type { Entitlement, IsoDate, PartialRunConfig, RunConfig } from "./run-config.js";
import { buildDefaults } from "./sources.js";
import { detectCapability } from "./capability.js";
import { readEnvLayer } from "./env.js";
import { mergeLayers } from "./resolver.js";
import { finalizeRunConfig } from "./gaps.js";

export interface ResolveInput {
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdinIsTTY: boolean | undefined;
  stdoutIsTTY: boolean | undefined;
  nonInteractive: boolean;
  analysisTimestamp: IsoDate;
  /** Parsed-CLI non-secret layer (highest precedence). Injected by `cli/` (Story 1.8). */
  flags?: PartialRunConfig;
  /** Config-file layer. Injected by Epic 6's `~/.commit-sage` reader; `{}` until then. */
  configFile?: PartialRunConfig;
  /** Resolved by the license gate (Epic 7); defaults to Free. */
  entitlement?: Entitlement;
}

export function resolveRunConfig(input: ResolveInput): RunConfig {
  const capability = detectCapability({
    nonInteractive: input.nonInteractive,
    stdinIsTTY: input.stdinIsTTY,
    stdoutIsTTY: input.stdoutIsTTY,
    env: input.env,
  });

  const defaults = buildDefaults({ interactive: capability.interactive, cwd: input.cwd });

  const { config, provenance } = mergeLayers({
    defaults,
    configFile: input.configFile ?? {},
    env: readEnvLayer(input.env),
    flags: input.flags ?? {},
  });

  return finalizeRunConfig(config, provenance, {
    interactive: capability.interactive,
    analysisTimestamp: input.analysisTimestamp,
    // Build a fresh default per call — `finalizeRunConfig` deep-freezes the
    // entitlement, so a shared module constant would be permanently frozen.
    entitlement: input.entitlement ?? { tier: "free" },
  });
}
