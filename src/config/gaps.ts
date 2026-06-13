/**
 * Phase-2 gap handling + freeze (Story 1.2, AC2/AC3).
 *
 * Validates that every required field is present (honoring the `aiMode: "off"`
 * short-circuit), assembles the `RunConfig` with the injected non-merged fields
 * (`analysisTimestamp`, `entitlement`, `provenance`), and deep-freezes it.
 *
 * In a non-interactive context a required-missing field throws a typed
 * `MissingRequiredConfigError` -- NEVER a prompt (FR-15). Interactive
 * gap-filling (the 0-arg-TTY guided prompts) is Epic 6 and inserts a prompt step
 * BEFORE this finalizer; under STRICT single-shot every Epic-1 run is
 * non-interactive, so the typed-error branch is the one exercised here.
 *
 * Precondition: `partial` has been merged with the `defaults` layer, so the
 * always-required + defaulted fields (repoTarget, branch, timezone, noMerges,
 * outputFormats, aiMode) are present. The orchestrator guarantees this.
 */

import type {
  ConfigData,
  Entitlement,
  IsoDate,
  PartialRunConfig,
  Provenance,
  RunConfig,
} from "./run-config.js";
import { deepFreeze } from "./run-config.js";
import { CONFIG_FIELD_KEYS, FIELD_SPECS } from "./sources.js";
import { MissingRequiredConfigError } from "../shared/errors.js";

export interface FinalizeContext {
  interactive: boolean;
  analysisTimestamp: IsoDate;
  entitlement: Entitlement;
}

/** Resolve a field's requiredness against the merged config (AI-cluster aware). */
function isFieldRequired(key: keyof ConfigData, config: PartialRunConfig): boolean {
  const { requiredness } = FIELD_SPECS[key];
  switch (requiredness.kind) {
    case "always":
      return true;
    case "optional":
      return false;
    case "whenAi":
      return config.aiMode !== "off";
    case "whenAiBaseUrl":
      return (
        config.aiMode !== "off" &&
        (config.provider === "ollama" || config.provider === "openai-compatible")
      );
  }
}

export function finalizeRunConfig(
  partial: PartialRunConfig,
  provenance: Provenance,
  ctx: FinalizeContext,
): RunConfig {
  for (const key of CONFIG_FIELD_KEYS) {
    if (isFieldRequired(key, partial) && partial[key] === undefined) {
      throw new MissingRequiredConfigError(key, FIELD_SPECS[key].envVar);
    }
  }

  // Required fields validated; the `defaults` layer guarantees the always-present
  // non-optional fields, so the assembled object satisfies the RunConfig contract.
  const config = {
    ...partial,
    analysisTimestamp: ctx.analysisTimestamp,
    entitlement: ctx.entitlement,
    provenance,
  } as RunConfig;

  return deepFreeze(config);
}
