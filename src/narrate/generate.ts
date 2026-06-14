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
import { buildNarrativePrompt } from "./prompt.js";
import { NarrativeSchema, type Narrative } from "./schema.js";

export interface GenerateNarrativeDeps {
  generateObject?: typeof sdkGenerateObject;
}

export async function generateNarrative(
  model: LanguageModel,
  analysis: Analysis,
  deps: GenerateNarrativeDeps = {},
): Promise<Narrative> {
  const generate = deps.generateObject ?? sdkGenerateObject;
  const { object } = await generate({
    model,
    schema: NarrativeSchema,
    temperature: 0,
    prompt: buildNarrativePrompt(analysis),
  });
  return object;
}
