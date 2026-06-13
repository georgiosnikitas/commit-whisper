/**
 * Input source matrix + channel-aware defaults (Story 1.2).
 *
 * The single source of truth for: which env var feeds each field, each field's
 * requiredness (incl. the conditional AI-cluster rules), the stable field-key
 * order the merge iterates, and the `defaults` layer the resolver merges first.
 */

import type { ConfigData, PartialRunConfig } from "./run-config.js";

/**
 * Field requiredness, evaluated against the resolved config during Phase-2 gap
 * handling. `whenAi*` variants encode the `aiMode: "off"` short-circuit.
 */
export type Requiredness =
  | { kind: "always" } // required regardless (always defaulted, so never missing)
  | { kind: "optional" } // optional or defaulted
  | { kind: "whenAi" } // required iff aiMode !== "off"
  | { kind: "whenAiBaseUrl" }; // required iff aiMode !== "off" && provider in {ollama, openai-compatible}

export interface FieldSpec {
  envVar: string;
  requiredness: Requiredness;
}

/** Per-field source/requiredness inventory (non-secret config-data only). */
export const FIELD_SPECS: Record<keyof ConfigData, FieldSpec> = {
  repoTarget: { envVar: "COMMIT_SAGE_REPO", requiredness: { kind: "always" } },
  branch: { envVar: "COMMIT_SAGE_BRANCH", requiredness: { kind: "optional" } },
  startDate: { envVar: "COMMIT_SAGE_START_DATE", requiredness: { kind: "optional" } },
  endDate: { envVar: "COMMIT_SAGE_END_DATE", requiredness: { kind: "optional" } },
  timezone: { envVar: "COMMIT_SAGE_TZ", requiredness: { kind: "optional" } },
  authorFilter: { envVar: "COMMIT_SAGE_AUTHOR", requiredness: { kind: "optional" } },
  maxCommits: { envVar: "COMMIT_SAGE_MAX_COMMITS", requiredness: { kind: "optional" } },
  noMerges: { envVar: "COMMIT_SAGE_NO_MERGES", requiredness: { kind: "optional" } },
  outputFormats: { envVar: "COMMIT_SAGE_FORMAT", requiredness: { kind: "optional" } },
  outputPath: { envVar: "COMMIT_SAGE_OUT", requiredness: { kind: "optional" } },
  aiMode: { envVar: "COMMIT_SAGE_AI_MODE", requiredness: { kind: "optional" } },
  provider: { envVar: "COMMIT_SAGE_PROVIDER", requiredness: { kind: "whenAi" } },
  llmBaseUrl: { envVar: "COMMIT_SAGE_LLM_BASE_URL", requiredness: { kind: "whenAiBaseUrl" } },
  llmModel: { envVar: "COMMIT_SAGE_LLM_MODEL", requiredness: { kind: "whenAi" } },
};

/** Stable, exhaustive field-key order for deterministic merge iteration. */
export const CONFIG_FIELD_KEYS = Object.keys(FIELD_SPECS) as (keyof ConfigData)[];

/**
 * The `defaults` layer (lowest precedence). Channel-aware: `aiMode` defaults to
 * `auto` when interactive, `off` headless/CI. `cwd` and `interactive` are
 * injected so this stays a pure function (no `process.cwd()` / TTY reads).
 */
export function buildDefaults(input: { interactive: boolean; cwd: string }): PartialRunConfig {
  return {
    repoTarget: input.cwd,
    branch: { kind: "head" },
    timezone: "UTC",
    noMerges: false,
    outputFormats: ["terminal"],
    aiMode: input.interactive ? "auto" : "off",
  };
}
