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

import { SummarySchema, ExplanationSchema, CoachingSchema, MetricExplanationSchema, ConfidenceSchema } from "../narrate/schema.js";

export const SCHEMA_VERSION = "1.0.0";

/**
 * The AI provider / license tier enums — the schema equivalents of `RunConfig`'s
 * `Provider` / `Tier` string-literal unions (kept in lockstep with
 * `config/run-config.ts`). Defined inline (house style; cf. `MetricSchema`'s
 * group enum) rather than imported, so the read-back boundary owns its own closed
 * vocabulary.
 */
const ProviderSchema = z.enum(["ollama", "openai", "gemini", "anthropic", "openai-compatible"]);
const TierSchema = z.enum(["free", "single-device", "unlimited"]);

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
 * The Report-JSON `narrative` subtree (C1 read-back trust boundary, `.strict()`).
 * Carries the three REQUIRED narrative parts (Summary · Explanation · Coaching —
 * Story 3.1) plus the per-metric Metric Explanation map (Story 3.2) keyed by
 * metric id and the confidence self-assessment (Story 3.5) — both OPTIONAL, since
 * a narrated run carries them but the shape predates their population. The
 * four-facet `MetricExplanationSchema` and `ConfidenceSchema` are the canonical
 * AI-output schemas, imported from `narrate/schema.ts` (single source of truth);
 * they are lenient there but `.strict()` HERE — the read-back boundary rejects an
 * explanation or confidence carrying unknown keys.
 */
export const NarrativeSchema = z
  .object({
    summary: SummarySchema,
    explanation: ExplanationSchema,
    coaching: CoachingSchema,
    explanations: z.record(z.string(), MetricExplanationSchema.strict()).optional(),
    confidence: ConfidenceSchema.strict()
      .refine((c) => (c.level === "low") === (c.escalation !== undefined), {
        message: "escalation must be present exactly when the confidence level is 'low'",
      })
      .optional(),
  })
  .strict();

/**
 * The Report-JSON `provenance` subtree (Story 4.7 — FR-17): an OPTIONAL third
 * sibling of `analysis` and `narrative` carrying the run's contextual facts (repo
 * identity, scale, AI provider/model, run timestamp/version, entitlement) so every
 * renderer can display them without re-deriving them from the pipeline.
 *
 * Provenance is RUN METADATA, NOT ANALYSIS: the run-varying fields (the timestamp
 * especially, and provider/model) live HERE so the byte-stable `analysis`
 * trend-diff target stays clean — provenance is excluded from any analysis diff.
 * Every group is independently optional and the whole subtree may be absent, so a
 * Report assembled before this FR still validates and still renders. `.strict()`
 * at every level (the C1 read-back boundary rejects unknown keys), and it NEVER
 * carries a secret — a remote `repo.target` is credential-stripped upstream.
 */
export const ProvenanceSchema = z
  .object({
    repo: z
      .object({
        name: z.string(),
        target: z.string(), // credential-stripped — never a token-bearing URL
        source: z.enum(["local", "remote"]),
        branch: z.string().optional(),
      })
      .strict()
      .optional(),
    scale: z
      .object({
        totalCommits: z.number().optional(),
        analyzedCommits: z.number().optional(),
        contributors: z.number().optional(),
      })
      .strict()
      .optional(),
    // Present ONLY when narration ran (absent on `--no-ai` / fail-open degraded),
    // mirroring the `narrative`-subtree presence rule exactly.
    ai: z
      .object({
        provider: ProviderSchema,
        model: z.string(),
      })
      .strict()
      .optional(),
    run: z
      .object({
        generatedAt: z.string(), // == RunConfig.analysisTimestamp, never Date.now()
        toolVersion: z.string(),
      })
      .strict()
      .optional(),
    entitlement: z
      .object({
        tier: TierSchema,
        commitCap: z.number().optional(), // present only on the Free tier
      })
      .strict()
      .optional(),
  })
  .strict();

export const ReportSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    degraded: z.boolean(),
    analysis: AnalysisSchema,
    narrative: NarrativeSchema.optional(),
    provenance: ProvenanceSchema.optional(),
  })
  .strict();

export type Report = z.infer<typeof ReportSchema>;
export type ReportAnalysis = z.infer<typeof AnalysisSchema>;
export type ReportNarrative = z.infer<typeof NarrativeSchema>;
export type ReportProvenance = z.infer<typeof ProvenanceSchema>;
export type MetricExplanation = z.infer<typeof MetricExplanationSchema>;
