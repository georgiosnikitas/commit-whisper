/**
 * Provider factory — gemini only (Story 1.6).
 *
 * Maps the `gemini` provider enum value to the `@ai-sdk/google` package (a
 * cosmetic name difference, not two providers) and builds a `LanguageModel`. The
 * API key is `reveal()`ed ONLY here, at the point of constructing the client —
 * never in a prompt, log, or serialized output. Constructing the model makes no
 * network call (that happens only on `generateObject`).
 *
 * Full BYOK breadth (openai / anthropic / openai-compatible / base URL) is Story
 * 3.6; those providers throw `NarrationError` here for now.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

import { NarrationError } from "../shared/errors.js";
import type { NarrateConfig } from "./narrate.port.js";

export function resolveModel(config: NarrateConfig): LanguageModel {
  if (config.provider !== "gemini") {
    throw new NarrationError(
      `Provider "${config.provider ?? "(none)"}" is not yet supported. ` +
        `This is the single-provider slice (gemini only); full BYOK breadth lands in Story 3.6.`,
    );
  }
  if (config.aiKey === undefined) {
    throw new NarrationError(
      "No LLM API key configured. Set the GOOGLE_GENERATIVE_AI_API_KEY environment variable (or the GEMINI_API_KEY alias).",
    );
  }
  if (config.llmModel === undefined) {
    throw new NarrationError("No LLM model configured. Set the model (e.g. via COMMIT_SAGE_LLM_MODEL).");
  }
  const google = createGoogleGenerativeAI({ apiKey: config.aiKey.reveal() });
  return google(config.llmModel);
}
