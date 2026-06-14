/**
 * `generateObject` narrative generation (Story 1.6 Summary → Story 3.1 full).
 *
 * Drives the Vercel AI SDK `generateObject` bound to the `NarrativeSchema`,
 * producing the structured three-part `Narrative` (Summary · Explanation ·
 * Coaching) from the metrics-only prompt. `temperature: 0` is pinned internally
 * for the tightest determinism the non-deterministic narrative layer allows; it
 * is not exposed as a user input.
 *
 * `generateObject` is injectable (default the real SDK function) so the wrapper's
 * contract — schema binding, temperature pin, metrics-only prompt — is unit-
 * testable offline without driving a real model or the network.
 *
 * NOTE: `ai@6` marks `generateObject` `@deprecated` in favour of `generateText`
 * with an `output` setting. We use `generateObject` because the AC/architecture
 * name it explicitly and it remains functional; migrating is tracked for review.
 */

import { generateObject as sdkGenerateObject } from "ai";
import type { LanguageModel } from "ai";

import type { Analysis } from "../analyze/engine.js";
import { buildNarrativePrompt, buildExplanationsPrompt } from "./prompt.js";
import {
  NarrativeSchema,
  ExplanationBatchSchema,
  type NarrativeParts,
  type MetricExplanation,
  type MetricExplanations,
  type MetricExplanationEntry,
} from "./schema.js";

export interface GenerateNarrativeDeps {
  generateObject?: typeof sdkGenerateObject;
}

export async function generateNarrative(
  model: LanguageModel,
  analysis: Analysis,
  deps: GenerateNarrativeDeps = {},
): Promise<NarrativeParts> {
  const generate = deps.generateObject ?? sdkGenerateObject;
  const { object } = await generate({
    model,
    schema: NarrativeSchema,
    temperature: 0,
    prompt: buildNarrativePrompt(analysis),
  });
  return object;
}

/**
 * Generate the four-facet per-metric explanations (Story 3.2) in ONE batched
 * `generateObject` call (FR-8's "single request"; Story 3.3 splits this into six
 * per-Group batches). The model returns an array of entries each tagged with its
 * `metricId`; `buildExplanationsRecord` maps them to the keyed-by-id record,
 * dropping any ungrounded id. `temperature: 0` is pinned, as for the narrative.
 */
export async function generateExplanations(
  model: LanguageModel,
  analysis: Analysis,
  deps: GenerateNarrativeDeps = {},
): Promise<MetricExplanations> {
  const generate = deps.generateObject ?? sdkGenerateObject;
  const { object } = await generate({
    model,
    schema: ExplanationBatchSchema,
    temperature: 0,
    prompt: buildExplanationsPrompt(analysis),
  });
  return buildExplanationsRecord(object.explanations, analysis);
}

/**
 * Pure transform: the AI's array of `{ metricId, …four facets }` entries → the
 * `MetricExplanations` record keyed by metric id. Emitted in **analysis order**
 * (the byte-stable metric order), so the map is deterministic and aligned with
 * the metrics regardless of the order the model returned. ANCHORING (AC3): only
 * ids present in the analysis are emitted — an entry whose `metricId` is not a
 * metric in the analysis is DROPPED (never carried; no invented anchors). The
 * FIRST occurrence of a duplicate id wins; `metricId` is stripped from the stored
 * value (the record key carries it). A metric the model omitted is simply absent
 * (a gap that Story 3.4 / 3.5 surface — 3.2 does not fabricate).
 */
export function buildExplanationsRecord(
  entries: readonly MetricExplanationEntry[],
  analysis: Analysis,
): MetricExplanations {
  // Index the model output by id (first occurrence wins) — a Map is safe for any
  // key (e.g. "__proto__") and gives O(1) lookup.
  const byId = new Map<string, MetricExplanation>();
  for (const entry of entries) {
    const { metricId, ...facets } = entry;
    if (!byId.has(metricId)) {
      byId.set(metricId, facets);
    }
  }
  // Emit in analysis order, keeping only metrics the model actually explained.
  const record: Record<string, MetricExplanation> = {};
  for (const metric of analysis.metrics) {
    const facets = byId.get(metric.id);
    if (facets !== undefined) {
      record[metric.id] = facets;
    }
  }
  return record;
}
