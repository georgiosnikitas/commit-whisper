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
import type { MetricGroup } from "../analyze/metric.js";
import { buildNarrativePrompt, buildExplanationsPrompt } from "./prompt.js";
import {
  NarrativeSchema,
  ExplanationBatchSchema,
  type NarrativeParts,
  type MetricExplanation,
  type MetricExplanations,
  type MetricExplanationEntry,
} from "./schema.js";

/** The Metric Groups, in stable batch order (matches the registry's A→F order). */
export const METRIC_GROUPS: readonly MetricGroup[] = ["A", "B", "C", "D", "E", "F"];

export interface GenerateNarrativeDeps {
  generateObject?: typeof sdkGenerateObject;
}

/** `generateExplanations` deps: the SDK hook plus an optional per-Group completion callback (for a live progress bar). */
export interface GenerateExplanationsDeps extends GenerateNarrativeDeps {
  /** Called once per Group batch as it settles (succeeded OR failed), in completion order — drives the narrate progress bar. */
  onGroup?: (group: MetricGroup) => void;
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
 * Generate the four-facet per-metric explanations (Story 3.2) batched **per Metric
 * Group** (Story 3.3): one `generateObject` call per non-empty Group (A–F ⇒ up to
 * six batches), each over only that group's metrics. This bounds each response so a
 * modest/local model survives its context window, and the batches are independent
 * and parallelizable.
 *
 * The batches run with `Promise.allSettled`, so a SINGLE failing group degrades
 * gracefully — its metrics are simply absent from the result while every other
 * group's explanations are still produced (AC2). Because that handling is internal,
 * this function does not throw for a single group's failure; the orchestrator only
 * fails the whole narration if the (separate) repo-level narrative call fails.
 *
 * The merge iterates `METRIC_GROUPS` in fixed order (not completion order) and
 * `buildExplanationsRecord` emits within a group in analysis order, so the merged
 * map is keyed in stable Group-then-metric order — deterministic regardless of
 * which batch resolved first (AC3).
 */
export async function generateExplanations(
  model: LanguageModel,
  analysis: Analysis,
  deps: GenerateExplanationsDeps = {},
): Promise<MetricExplanations> {
  const batches = METRIC_GROUPS.map((group) => ({
    group,
    metrics: analysis.metrics.filter((metric) => metric.group === group),
  })).filter((batch) => batch.metrics.length > 0);

  const settled = await Promise.allSettled(
    batches.map((batch) =>
      generateGroupExplanations(model, { metrics: batch.metrics }, deps)
        // Advance the progress bar as each Group settles — whether it produced
        // explanations or degraded (a failed group still completes a phase).
        .finally(() => deps.onGroup?.(batch.group)),
    ),
  );

  // Merge in batch (Group) order — independent of which settled first — so the
  // result is deterministic. A rejected group is dropped (graceful degradation).
  const merged: Record<string, MetricExplanation> = {};
  for (const result of settled) {
    if (result.status === "fulfilled") {
      Object.assign(merged, result.value);
    }
  }
  return merged;
}

/**
 * One per-Group explanation batch: a single `generateObject` call over a
 * group-filtered analysis, keyed by id via `buildExplanationsRecord`. Anchoring
 * holds per batch — `buildExplanationsRecord`'s `validIds` is this group's ids, so
 * a cross-group hallucinated id is dropped. `temperature: 0` pinned, as elsewhere.
 */
export async function generateGroupExplanations(
  model: LanguageModel,
  groupAnalysis: Analysis,
  deps: GenerateNarrativeDeps = {},
): Promise<MetricExplanations> {
  const generate = deps.generateObject ?? sdkGenerateObject;
  const { object } = await generate({
    model,
    schema: ExplanationBatchSchema,
    temperature: 0,
    prompt: buildExplanationsPrompt(groupAnalysis),
  });
  return buildExplanationsRecord(object.explanations, groupAnalysis);
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
