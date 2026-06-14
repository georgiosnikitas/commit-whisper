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

export type Narrative = z.infer<typeof NarrativeSchema>;
