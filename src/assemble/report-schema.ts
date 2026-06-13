/**
 * The canonical Report JSON schema (Story 1.7 — C1, `schemaVersion: "1.0.0"`).
 *
 * The contract splits along the determinism seam: `analysis` (the deterministic,
 * byte-stable metric envelopes — the trend-diff target) is ALWAYS present, while
 * `narrative` (the AI layer's output) is OPTIONAL — absent on an intentional
 * metrics-only run and on a fail-open degraded run. A top-level `degraded`
 * boolean makes the two narrative-absent cases machine-distinguishable in-band.
 * Per-metric explanations are keyed by metric id under `narrative.explanations`
 * (shape pinned at 1.0.0 now; populated in Epic 3) — never welded into the
 * metric envelope.
 *
 * This schema is the C1 "Report-JSON-in" validation checkpoint: `parseReport`
 * validates a previously emitted report on read-back / re-render.
 */

import { z } from "zod";

import { SummarySchema } from "../narrate/schema.js";

export const SCHEMA_VERSION = "1.0.0";

/** A JSON-serializable value — the permissive shape a metric `value` may take. */
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    // zod 4's `z.number()` already rejects NaN/±Infinity (the values JSON.stringify
    // would rewrite to `null`), so a non-finite metric value cannot pass read-back.
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

/** Mirrors the 1.5 metric envelope (`analyze/metric.ts`) exactly. */
export const MetricSchema = z
  .object({
    id: z.string(),
    group: z.enum(["A", "B", "C", "D", "E", "F"]),
    title: z.string(),
    status: z.enum(["computed", "not_available"]),
    value: JsonValueSchema.optional(),
    reason: z.string().optional(),
  })
  .strict();

export const AnalysisSchema = z
  .object({
    metrics: z.array(MetricSchema),
  })
  .strict();

/**
 * A per-metric explanation (four facets, keyed by metric id under
 * `narrative.explanations`). The SHAPE is pinned at 1.0.0; it is not populated
 * until Epic 3 (Story 3.2), so it is optional everywhere it appears.
 */
export const ExplanationSchema = z
  .object({
    explanation: z.string(),
    goodBehaviours: z.array(z.string()),
    needsImprovement: z.array(z.string()),
    suggestions: z.array(z.string()),
  })
  .strict();

export const NarrativeSchema = z
  .object({
    summary: SummarySchema,
    explanations: z.record(z.string(), ExplanationSchema).optional(),
  })
  .strict();

export const ReportSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    degraded: z.boolean(),
    analysis: AnalysisSchema,
    narrative: NarrativeSchema.optional(),
  })
  .strict();

export type Report = z.infer<typeof ReportSchema>;
export type ReportAnalysis = z.infer<typeof AnalysisSchema>;
export type ReportNarrative = z.infer<typeof NarrativeSchema>;
export type Explanation = z.infer<typeof ExplanationSchema>;
