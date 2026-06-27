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
 *
 * Structured outputs: the `openai-compatible` model is built with structured
 * outputs ENABLED (so the bound Zod schema is sent as a real `json_schema`
 * response format — without it the SDK silently drops the schema and unguided
 * output fails validation), but NON-strict (our `min(1)` schemas use
 * `minLength`/`minItems`, which OpenAI's strict mode rejects with a 400).
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { NarrationError } from "../shared/errors.js";
import { stripTrailingSlashes } from "../shared/url.js";
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
      return createOpenAICompatible({
        name: "openai-compatible",
        baseURL,
        apiKey: config.aiKey?.reveal(),
        // Send the bound schema as a real `json_schema` response format. Without
        // this the SDK silently DROPS the schema (falling back to `json_object`
        // mode) and the model's unguided output fails `generateObject`'s
        // validation — exactly the "narrative unavailable" degrade we hit.
        supportsStructuredOutputs: true,
        // …but emit it NON-strict: our narration schemas use `min(1)` (⇒
        // `minLength`/`minItems`), keywords OpenAI's STRICT structured outputs
        // reject with a 400. Non-strict still hands the model the schema while
        // tolerating those keywords; `generateObject` re-validates against Zod.
        transformRequestBody: relaxStructuredOutputsStrictness,
      })(model);
    }
    case "ollama": {
      // Append exactly one `/v1`, collapsing any the base already ends with so a
      // user base of `…/v1` does not become `…/v1/v1` (which 404s at generation).
      // Linear endsWith loop — avoids the super-linear `replace(/(\/v1)+$/)` (S5852).
      let base = cleanBaseUrl(config.llmBaseUrl) ?? OLLAMA_DEFAULT_BASE_URL;
      while (base.endsWith("/v1")) {
        base = base.slice(0, -3);
      }
      const baseURL = `${base}/v1`;
      return createOpenAICompatible({ name: "ollama", baseURL })(model);
    }
    case undefined:
      throw new NarrationError(
        "No LLM provider configured. Set the provider (e.g. via COMMIT_WHISPER_PROVIDER).",
      );
    default:
      return assertNeverProvider(config.provider);
  }
}

/** The configured model id, or a typed error naming how to set it. */
function requireModel(config: NarrateConfig): string {
  if (config.llmModel === undefined) {
    throw new NarrationError("No LLM model configured. Set the model (e.g. via COMMIT_WHISPER_LLM_MODEL).");
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
      'No base URL configured for the "openai-compatible" provider. Set the COMMIT_WHISPER_LLM_BASE_URL environment variable.',
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
  const trimmed = stripTrailingSlashes(baseUrl.trim());
  return trimmed === "" ? undefined : trimmed;
}

/** Exhaustiveness guard: a new `Provider` enum value becomes a compile error here. */
function assertNeverProvider(provider: never): never {
  throw new NarrationError(`Unsupported provider: ${String(provider)}`);
}

/** A `json_schema` response format as it appears on the outgoing OpenAI-compatible request body. */
interface JsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: Record<string, unknown>;
}

/** Narrow an outgoing `response_format` to the `json_schema` shape we relax. */
function isJsonSchemaResponseFormat(value: unknown): value is JsonSchemaResponseFormat {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { type?: unknown; json_schema?: unknown };
  return (
    candidate.type === "json_schema" &&
    typeof candidate.json_schema === "object" &&
    candidate.json_schema !== null
  );
}

/**
 * Drop `strict` to `false` on an OpenAI-compatible `json_schema` request body.
 *
 * With `supportsStructuredOutputs` the SDK emits the schema with `strict: true`
 * by default. OpenAI's STRICT structured outputs forbid the `minLength` /
 * `minItems` keywords our narration schemas carry (every content string/array is
 * `min(1)`), so a strict request 400s. Non-strict still hands the model the
 * schema (so it conforms) while tolerating those keywords; correctness is
 * unchanged because `generateObject` re-validates the response against Zod.
 *
 * Returns the body untouched when it carries no `json_schema` response format.
 */
function relaxStructuredOutputsStrictness(body: Record<string, unknown>): Record<string, unknown> {
  const responseFormat = body.response_format;
  if (!isJsonSchemaResponseFormat(responseFormat)) {
    return body;
  }
  return {
    ...body,
    response_format: {
      ...responseFormat,
      json_schema: { ...responseFormat.json_schema, strict: false },
    },
  };
}
