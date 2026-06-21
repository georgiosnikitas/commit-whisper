/**
 * Narrate port + result contract (Story 1.6).
 *
 * The narrate stage turns the deterministic `Analysis` (Story 1.5) into an AI
 * `Narrative`. Its ONLY input is the analysis — never `RepoHistory` — so commit
 * messages, raw diffs, and tokens are structurally absent from anything sent to
 * the LLM (privacy by construction). The frozen `RunConfig`'s AI fields plus the
 * env-read key are projected into `NarrateConfig` (Story 1.8 does the mapping;
 * `RunConfig` is not reshaped here).
 *
 * The stage returns a `NarrateOutcome`; it does NOT set exit codes or render.
 * The CLI shell (Story 1.8) maps the outcome:
 *   - `narrated`  → showpiece render, exit 0
 *   - `skipped`   → substrate render, exit 0 (intentional metrics-only)
 *   - `degraded`  → substrate render, exit 9 (fail-open)
 *   - thrown `NarrationError` (required-mode failure) → exit 6
 */

import type { Analysis } from "../analyze/engine.js";
import type { AiMode, Provider } from "../config/run-config.js";
import type { Secret } from "../shared/secret.js";
import type { Narrative } from "./schema.js";

export type {
  Summary,
  Explanation,
  Chapter,
  Coaching,
  Narrative,
  NarrativeParts,
  MetricExplanation,
  MetricExplanations,
  Confidence,
  ConfidenceLevel,
} from "./schema.js";

/** The AI-relevant subset of `RunConfig` + the env-only secret key. */
export interface NarrateConfig {
  aiMode: AiMode;
  provider?: Provider;
  llmModel?: string;
  llmBaseUrl?: string;
  aiKey?: Secret<string>;
}

/** What the narrate stage returns. `required`-mode failures throw instead. */
export type NarrateOutcome =
  | { kind: "narrated"; narrative: Narrative }
  | { kind: "skipped" }
  | { kind: "degraded"; reason: string };

/** A single step of the multi-phase narration, for a live progress bar (stderr chrome only). */
export interface NarrateProgress {
  /** Completed phases so far (0..total). */
  completed: number;
  /** Total phases in this narration (model connect → narrative → per-group explanations → grounding). */
  total: number;
  /** A human label for the phase just reached (e.g. "Explained Group C metrics"). */
  label: string;
}

/** A sink the narrate stage calls as each phase completes; purely advisory (never affects the outcome). */
export type NarrateProgressFn = (progress: NarrateProgress) => void;

export type NarratePort = (
  analysis: Analysis,
  config: NarrateConfig,
  onProgress?: NarrateProgressFn,
) => Promise<NarrateOutcome>;
