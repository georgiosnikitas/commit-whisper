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
 *   - `configFile` defaults to `{}` (real `~/.commit-whisper` reading is Epic 6).
 *   - `flags` is supplied by the caller (real commander parsing is `cli/`, 1.8).
 * `entitlement` defaults to the Free tier (the license gate is Epic 7).
 */

import type { Entitlement, IsoDate, PartialRunConfig, RunConfig } from "./run-config.js";
import { buildDefaults } from "./sources.js";
import { detectCapability } from "./capability.js";
import { readEnvLayer } from "./env.js";
import { mergeLayers } from "./resolver.js";
import { finalizeRunConfig } from "./gaps.js";

/**
 * The Free-tier commit cap (FR-16 / FR-3). The pipeline only ever sees the
 * RESOLVED `entitlement.commitCap`; this is the value the (Epic 7) license gate
 * will vary by tier — Single-device / Unlimited resolve to no cap. Keeping the
 * policy literal here (not in the pure `select` stage) holds the determinism/
 * selection layer free of license policy. [Source: architecture.md#Date × Free-Cap]
 */
export const FREE_TIER_COMMIT_CAP = 100;

export interface ResolveInput {
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdinIsTTY: boolean | undefined;
  stdoutIsTTY: boolean | undefined;
  nonInteractive: boolean;
  analysisTimestamp: IsoDate;
  /** Parsed-CLI non-secret layer (highest precedence). Injected by `cli/` (Story 1.8). */
  flags?: PartialRunConfig;
  /** Config-file layer. Injected by Epic 6's `~/.commit-whisper` reader; `{}` until then. */
  configFile?: PartialRunConfig;
  /** Resolved by the license gate (Epic 7); defaults to Free. */
  entitlement?: Entitlement;
  /** Skip the required-field gap check so the resolve always succeeds (`--show-config`, Story 6.4). */
  lenient?: boolean;
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
    entitlement: input.entitlement ?? { tier: "free", commitCap: FREE_TIER_COMMIT_CAP },
    lenient: input.lenient,
  });
}
