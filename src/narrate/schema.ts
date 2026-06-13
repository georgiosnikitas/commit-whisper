/**
 * The Summary Zod schema (Story 1.6 — C1/C3).
 *
 * `generateObject` binds this **standard zod** schema to constrain the model's
 * structured output — no fragile string-parsing. The `zod/mini` lean-SEA
 * optimization is reserved for the config / Report-JSON schemas (later); the AI
 * structured-output schema uses standard `zod` (what the AI SDK binds).
 *
 * This is the MINIMAL narrative payload (Epic 3 expands to the full three-part
 * Narrative + Coaching + per-metric explanations).
 */

import { z } from "zod";

export const SummarySchema = z.object({
  headline: z.string().describe("A single-sentence TL;DR of the repository's activity and health."),
  overview: z
    .string()
    .describe("A short paragraph summarizing what the metrics reveal about this repository."),
  keyFindings: z
    .array(z.string())
    .describe("3-6 concise bullet observations grounded in the provided metrics."),
});

export type Summary = z.infer<typeof SummarySchema>;
