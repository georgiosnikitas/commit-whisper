/**
 * Privacy-safe Summary prompt builder (Story 1.6).
 *
 * Serializes ONLY the deterministic metric envelopes (`id`, `group`, `title`,
 * `status`, `value`, `reason`). Because the narrate stage receives only
 * `Analysis` — never `RepoHistory` — commit messages, file paths, raw diffs, and
 * the API key are structurally absent from the prompt. Privacy is enforced by
 * the call signature, not by filtering.
 */

import type { Analysis } from "../analyze/engine.js";

const INSTRUCTION = [
  "You are a senior engineering analyst. Summarize the health and activity of a git",
  "repository for its maintainers, using ONLY the deterministic metrics provided below.",
  "Do not invent numbers; ground every observation in the given metrics. Metrics marked",
  '"not_available" should be acknowledged as not measurable, not guessed.',
].join(" ");

export function buildSummaryPrompt(analysis: Analysis): string {
  const metricsJson = JSON.stringify(analysis.metrics, null, 2);
  return `${INSTRUCTION}\n\nMetrics:\n${metricsJson}`;
}
