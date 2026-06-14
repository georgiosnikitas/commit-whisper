/**
 * The AI Narrative Zod schemas (Story 1.6 Summary → Story 3.1 full three-part).
 *
 * `generateObject` binds `NarrativeSchema` to constrain the model's structured
 * output — no fragile string-parsing. The `zod/mini` lean-SEA optimization is
 * reserved for the config / Report-JSON schemas (later); the AI structured-output
 * schema uses standard `zod` (what the AI SDK binds).
 *
 * The Narrative has EXACTLY three parts, in order (FR-8): `summary` (TL;DR),
 * `explanation` (what the metrics show and why), and `coaching` (a structured
 * improvement report — introduction → themed chapters of prioritized steps →
 * closing summary, never a flat list). Per-metric four-facet explanations are a
 * SEPARATE concern (Story 3.2), keyed by metric id in the Report `narrative`
 * subtree — not part of this object.
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

/** The repo-level Explanation part: plain-language interpretation of the metrics. */
export const ExplanationSchema = z.object({
  paragraphs: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      "1-4 plain-language paragraphs interpreting what the metrics show and WHY, evidence-first and grounded in the provided metric values.",
    ),
});

export type Explanation = z.infer<typeof ExplanationSchema>;

/** One themed chapter of the Coaching report: a theme + prioritized steps. */
export const ChapterSchema = z.object({
  theme: z
    .string()
    .min(1)
    .describe("The theme grouping these related improvements (e.g. commit-message hygiene, branching discipline, churn/hotspots)."),
  steps: z
    .array(z.string().min(1))
    .min(1)
    .describe("Prescriptive, prioritized steps for this theme — most impactful first; each references the repo's own metrics."),
});

export type Chapter = z.infer<typeof ChapterSchema>;

/**
 * The Coaching part: a STRUCTURED improvement report (not a flat list). The
 * `.min(1)` on chapters + steps (and on each content string) is the schema-level
 * guarantee of structure — no chapterless, stepless, or empty-content coaching.
 */
export const CoachingSchema = z.object({
  introduction: z
    .string()
    .min(1)
    .describe("Framing of the repository's current state and what this improvement plan addresses."),
  chapters: z
    .array(ChapterSchema)
    .min(1)
    .describe("One or more themed chapters of prioritized steps — never a flat list."),
  closingSummary: z
    .string()
    .min(1)
    .describe("The top priorities and the recommended order of action."),
});

export type Coaching = z.infer<typeof CoachingSchema>;

/**
 * The full AI Narrative: exactly three parts, in order. This is the object
 * `generateObject` produces (Story 3.1). Plain `z.object` (model-output leniency,
 * consistent with `SummarySchema`); the Report-JSON read-back schema
 * (`assemble/report-schema.ts`) is the `.strict()` trust boundary.
 */
export const NarrativeSchema = z.object({
  summary: SummarySchema,
  explanation: ExplanationSchema,
  coaching: CoachingSchema,
});

/** The three generated repo-level parts `generateNarrative` produces (Story 3.1). */
export type NarrativeParts = z.infer<typeof NarrativeSchema>;

/**
 * A per-metric Metric Explanation: the four facets (Story 3.2). DISTINCT from the
 * repo-level `explanation` PART above (same English word, different thing — FR-8 /
 * §3.2). The `explanation` (meaning) facet is always a non-empty string; the three
 * facet arrays hold non-empty strings but MAY be empty (an empty list is an honest
 * "none for this facet" — e.g. a healthy metric's `needsImprovement`, or a
 * `not_available` metric's `goodBehaviours`). Canonical home: the AI-output schema;
 * `assemble/report-schema.ts` imports this for the Report read-back.
 */
export const MetricExplanationSchema = z.object({
  explanation: z
    .string()
    .min(1)
    .describe(
      "What this metric's value(s) MEAN for this repo. For a not_available metric, state it could not be computed and why (from its reason).",
    ),
  goodBehaviours: z
    .array(z.string().min(1))
    .describe("Good behaviours this metric reveals; an explicit entry where notable, or empty where there are none."),
  needsImprovement: z
    .array(z.string().min(1))
    .describe("What needs improvement; an explicit entry where applicable, or empty where the metric is already healthy."),
  suggestions: z
    .array(z.string().min(1))
    .describe("Concrete suggestions to improve, grounded in this repo's own metric values."),
});

export type MetricExplanation = z.infer<typeof MetricExplanationSchema>;

/** The per-metric explanation map carried in the report, keyed by metric id. */
export const MetricExplanationsSchema = z.record(z.string(), MetricExplanationSchema);

export type MetricExplanations = z.infer<typeof MetricExplanationsSchema>;

/**
 * One AI-output entry: a four-facet explanation TAGGED with the metric id it is
 * anchored to (an explicit id ⇒ reliable structured output + the AC3 anchoring /
 * grounding seam). Transformed to the keyed `MetricExplanations` record by
 * `buildExplanationsRecord` (which drops any id not present in the analysis).
 */
export const MetricExplanationEntrySchema = MetricExplanationSchema.extend({
  metricId: z
    .string()
    .min(1)
    .describe("The id of the metric this explanation is anchored to — MUST match a metric in the provided analysis."),
});

export type MetricExplanationEntry = z.infer<typeof MetricExplanationEntrySchema>;

/** The object `generateObject` binds for the batched per-metric explanations (Story 3.2). */
export const ExplanationBatchSchema = z.object({
  explanations: z
    .array(MetricExplanationEntrySchema)
    .min(1)
    .describe("One four-facet explanation per metric in the analysis, including not_available metrics; each tagged with its metricId."),
});

export type ExplanationBatch = z.infer<typeof ExplanationBatchSchema>;

/**
 * The full AI Narrative carried in the Report `narrative` subtree: the three
 * generated parts (Story 3.1) plus the OPTIONAL per-metric explanation map
 * (Story 3.2, keyed by metric id). This is the shape that flows through the
 * narrate outcome into the assembled report.
 */
export const FullNarrativeSchema = NarrativeSchema.extend({
  explanations: MetricExplanationsSchema.optional(),
});

export type Narrative = z.infer<typeof FullNarrativeSchema>;
