/**
 * Provider reachability preflight (Story 1.6 — `aiMode`-aware).
 *
 * One cheap round-trip to surface an unreachable/misconfigured provider early —
 * NEVER a paid `generateObject` dry run. The CLI shell (Story 1.8) runs this in
 * the pre-pipeline gate band (license -> preflight -> retrieve) and branches on
 * `aiMode`: `off` skips, `required` hard-fails (exit 6) before any clone, `auto`
 * proceeds to the substrate (exit 9) when not reachable. This module only
 * performs the probe and reports reachability; it sets no exit code.
 *
 * `fetchImpl` is injectable so the suite runs offline. Distinguishes "configured"
 * (provider/model set) from "reachable" (probe passed).
 */

import type { NarrateConfig } from "./narrate.port.js";

export type PreflightResult = { reachable: true } | { reachable: false; reason: string };

export interface PreflightDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";
const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
const ANTHROPIC_DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 5000;

export async function preflightProvider(
  config: NarrateConfig,
  deps: PreflightDeps = {},
): Promise<PreflightResult> {
  if (config.aiMode === "off") {
    return { reachable: true }; // no provider needed; the shell skips this anyway
  }
  const doFetch = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  switch (config.provider) {
    case "gemini":
      return preflightGemini(config, doFetch, timeoutMs);
    case "ollama":
      return preflightOllama(config, doFetch, timeoutMs);
    case "openai":
      return preflightOpenAi(config, doFetch, timeoutMs);
    case "anthropic":
      return preflightAnthropic(config, doFetch, timeoutMs);
    case "openai-compatible":
      return preflightOpenAiCompatible(config, doFetch, timeoutMs);
    default:
      return {
        reachable: false,
        reason: `Provider "${config.provider ?? "(none)"}" is not configured for narration. Set COMMIT_WHISPER_PROVIDER.`,
      };
  }
}

/** Normalize a base URL: trim whitespace + trailing slashes; a blank value is `undefined` ("unset"). */
function cleanBaseUrl(baseUrl: string | undefined): string | undefined {
  if (baseUrl === undefined) {
    return undefined;
  }
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed === "" ? undefined : trimmed;
}

/** Map a fetched models-list response to a reachability result (shared by the OpenAI-shaped providers). */
function classifyModelsResponse(res: Response, providerLabel: string): PreflightResult {
  if (res.ok) {
    return { reachable: true };
  }
  if (res.status === 401 || res.status === 403) {
    return { reachable: false, reason: "Authentication failed — the LLM API key was rejected." };
  }
  return { reachable: false, reason: `${providerLabel} responded with HTTP ${res.status}.` };
}

async function preflightGemini(
  config: NarrateConfig,
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<PreflightResult> {
  const key = config.aiKey;
  if (key === undefined) {
    return { reachable: false, reason: "No API key configured (set GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY)." };
  }
  try {
    // The key travels in the request HEADER, never the URL — keeps it out of
    // proxy/access logs, crash reports, and any error that echoes the URL.
    const res = await doFetch(GEMINI_MODELS_URL, {
      method: "GET",
      headers: { "x-goog-api-key": key.reveal() },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      return { reachable: true };
    }
    if (res.status === 401 || res.status === 403) {
      return { reachable: false, reason: "Authentication failed — the LLM API key was rejected." };
    }
    return { reachable: false, reason: `Provider responded with HTTP ${res.status}.` };
  } catch (err) {
    return { reachable: false, reason: reachFailureReason(err, key.reveal()) };
  }
}

async function preflightOllama(
  config: NarrateConfig,
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<PreflightResult> {
  const baseUrl = (cleanBaseUrl(config.llmBaseUrl) ?? OLLAMA_DEFAULT_BASE_URL);
  try {
    const res = await doFetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok
      ? { reachable: true }
      : { reachable: false, reason: `Ollama responded with HTTP ${res.status}.` };
  } catch (err) {
    return { reachable: false, reason: reachFailureReason(err) };
  }
}

async function preflightOpenAi(
  config: NarrateConfig,
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<PreflightResult> {
  const key = config.aiKey;
  if (key === undefined) {
    return { reachable: false, reason: "No API key configured (set OPENAI_API_KEY)." };
  }
  const baseUrl = cleanBaseUrl(config.llmBaseUrl) ?? OPENAI_DEFAULT_BASE_URL;
  try {
    const res = await doFetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key.reveal()}` }, // key in the HEADER, never the URL
      signal: AbortSignal.timeout(timeoutMs),
    });
    return classifyModelsResponse(res, "Provider");
  } catch (err) {
    return { reachable: false, reason: reachFailureReason(err, key.reveal()) };
  }
}

async function preflightAnthropic(
  config: NarrateConfig,
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<PreflightResult> {
  const key = config.aiKey;
  if (key === undefined) {
    return { reachable: false, reason: "No API key configured (set ANTHROPIC_API_KEY)." };
  }
  const baseUrl = cleanBaseUrl(config.llmBaseUrl) ?? ANTHROPIC_DEFAULT_BASE_URL;
  try {
    const res = await doFetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { "x-api-key": key.reveal(), "anthropic-version": ANTHROPIC_VERSION },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return classifyModelsResponse(res, "Provider");
  } catch (err) {
    return { reachable: false, reason: reachFailureReason(err, key.reveal()) };
  }
}

async function preflightOpenAiCompatible(
  config: NarrateConfig,
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<PreflightResult> {
  const baseUrl = cleanBaseUrl(config.llmBaseUrl);
  if (baseUrl === undefined) {
    return {
      reachable: false,
      reason: 'No base URL configured for the "openai-compatible" provider (set COMMIT_WHISPER_LLM_BASE_URL).',
    };
  }
  const key = config.aiKey;
  // The key is OPTIONAL for a custom endpoint — only send the auth header when set.
  const headers = key === undefined ? undefined : { Authorization: `Bearer ${key.reveal()}` };
  try {
    const res = await doFetch(`${baseUrl}/models`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return classifyModelsResponse(res, "Provider");
  } catch (err) {
    return { reachable: false, reason: reachFailureReason(err, key?.reveal()) };
  }
}

/**
 * Build a user-safe failure reason. Defensively scrubs the secret (if provided)
 * from the error text so a fetch implementation whose error message embeds the
 * request URL can never write the live key into output.
 */
function reachFailureReason(err: unknown, secret?: string): string {
  let detail = err instanceof Error ? err.message : "unknown error";
  if (secret !== undefined && secret !== "") {
    detail = detail.split(secret).join("***");
  }
  return `Provider endpoint is unreachable: ${detail}`;
}
