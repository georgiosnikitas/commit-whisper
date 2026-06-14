/**
 * Unified provider factory (Story 1.6 gemini-only → Story 3.6 full BYOK breadth).
 *
 * Maps each `Provider` enum value to its Vercel AI SDK package and builds a
 * `LanguageModel` — `@ai-sdk/google` for `gemini`, `@ai-sdk/openai` for `openai`,
 * `@ai-sdk/anthropic` for `anthropic`, and `@ai-sdk/openai-compatible` for both
 * `openai-compatible` and `ollama` (Ollama exposes an OpenAI-compatible API at
 * `{baseUrl}/v1`). The single `generateObject`/`generateText` interface drives
 * all of them, so generation/grounding/confidence stay provider-agnostic.
 *
 * The API key is `reveal()`ed ONLY here, at the point of constructing the client
 * — never in a prompt, log, URL, or serialized output. Constructing the model
 * makes NO network call (that happens only on `generateObject`), so this is
 * synchronous and unit-testable offline for every provider.
 *
 * Base URL: required for `ollama` (defaulted to the local endpoint) and
 * `openai-compatible` (no default — a hard error); optional for the hosted
 * providers (vendor default). Key: required for `openai`/`anthropic`/`gemini`;
 * optional for `openai-compatible`; none for `ollama`.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { NarrationError } from "../shared/errors.js";
import type { NarrateConfig } from "./narrate.port.js";

/** The local Ollama endpoint the `ollama` provider defaults to (its OpenAI-compatible API is at `/v1`). */
const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";

export function resolveModel(config: NarrateConfig): LanguageModel {
  const model = requireModel(config);
  switch (config.provider) {
    case "gemini": {
      const apiKey = requireKey(config, "GOOGLE_GENERATIVE_AI_API_KEY (or the GEMINI_API_KEY alias)");
      return createGoogleGenerativeAI({ apiKey })(model);
    }
    case "openai": {
      const apiKey = requireKey(config, "OPENAI_API_KEY");
      return createOpenAI({ apiKey, baseURL: cleanBaseUrl(config.llmBaseUrl) })(model);
    }
    case "anthropic": {
      const apiKey = requireKey(config, "ANTHROPIC_API_KEY");
      return createAnthropic({ apiKey, baseURL: cleanBaseUrl(config.llmBaseUrl) })(model);
    }
    case "openai-compatible": {
      const baseURL = requireBaseUrl(config);
      return createOpenAICompatible({ name: "openai-compatible", baseURL, apiKey: config.aiKey?.reveal() })(model);
    }
    case "ollama": {
      const baseURL = `${cleanBaseUrl(config.llmBaseUrl) ?? OLLAMA_DEFAULT_BASE_URL}/v1`.replace(/(\/v1)+$/, "/v1");
      return createOpenAICompatible({ name: "ollama", baseURL })(model);
    }
    case undefined:
      throw new NarrationError(
        "No LLM provider configured. Set the provider (e.g. via COMMIT_SAGE_PROVIDER).",
      );
    default:
      return assertNeverProvider(config.provider);
  }
}

/** The configured model id, or a typed error naming how to set it. */
function requireModel(config: NarrateConfig): string {
  if (config.llmModel === undefined) {
    throw new NarrationError("No LLM model configured. Set the model (e.g. via COMMIT_SAGE_LLM_MODEL).");
  }
  return config.llmModel;
}

/** The revealed API key, or a typed error naming the provider's native env var. */
function requireKey(config: NarrateConfig, envVar: string): string {
  if (config.aiKey === undefined) {
    throw new NarrationError(`No LLM API key configured. Set the ${envVar} environment variable.`);
  }
  return config.aiKey.reveal();
}

/** The required base URL (openai-compatible), or a typed error naming the env var. */
function requireBaseUrl(config: NarrateConfig): string {
  const baseUrl = cleanBaseUrl(config.llmBaseUrl);
  if (baseUrl === undefined) {
    throw new NarrationError(
      'No base URL configured for the "openai-compatible" provider. Set the COMMIT_SAGE_LLM_BASE_URL environment variable.',
    );
  }
  return baseUrl;
}

/**
 * Normalize a base URL: trim surrounding whitespace + trailing slashes so
 * `{baseUrl}/path` never double-slashes, and map a blank/empty value to
 * `undefined` ("unset") so it cannot slip past a presence check into a broken,
 * relative-URL client.
 */
function cleanBaseUrl(baseUrl: string | undefined): string | undefined {
  if (baseUrl === undefined) {
    return undefined;
  }
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed === "" ? undefined : trimmed;
}

/** Exhaustiveness guard: a new `Provider` enum value becomes a compile error here. */
function assertNeverProvider(provider: never): never {
  throw new NarrationError(`Unsupported provider: ${String(provider)}`);
}
