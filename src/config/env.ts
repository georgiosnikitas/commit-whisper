/**
 * The single reader of `process.env` (Story 1.2).
 *
 * Parses the NON-SECRET `COMMIT_SAGE_*` variables into the `env` resolver layer.
 * `env` is injected (defaulting to `process.env`) so parsing stays pure and
 * table-testable. Per the hexagonal boundary, this is the only place
 * `process.env` is read.
 *
 * SECRET env vars are deliberately NOT read here yet: the LLM key
 * (`OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY` / ...)
 * lands in Story 1.6, and the git PAT (`COMMIT_SAGE_GIT_TOKEN` / host fallbacks)
 * in Epic 5. They are env-only and bypass the merge.
 */

import type { AiMode, Branch, OutputFormat, PartialRunConfig, Provider } from "./run-config.js";

const PROVIDERS = new Set<string>(["ollama", "openai", "gemini", "anthropic", "openai-compatible"]);
const OUTPUT_FORMATS = new Set<string>(["html", "markdown", "terminal", "json"]);
const AI_MODES = new Set<string>(["required", "auto", "off"]);

/** Trim to a non-empty string, or `undefined`. */
function str(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const v = raw.trim();
  return v === "" ? undefined : v;
}

function parseBoolean(raw: string | undefined): boolean | undefined {
  const v = str(raw)?.toLowerCase();
  if (v === "1" || v === "true" || v === "yes") {
    return true;
  }
  if (v === "0" || v === "false" || v === "no") {
    return false;
  }
  return undefined;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  const v = str(raw);
  if (v === undefined) {
    return undefined;
  }
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parseBranch(raw: string | undefined): Branch | undefined {
  const v = str(raw);
  if (v === undefined) {
    return undefined;
  }
  return v === "all" ? { kind: "all" } : { kind: "named", name: v };
}

function parseFormats(raw: string | undefined): OutputFormat[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const valid = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is OutputFormat => OUTPUT_FORMATS.has(s));
  return valid.length > 0 ? valid : undefined;
}

function parseProvider(raw: string | undefined): Provider | undefined {
  const v = str(raw);
  return v !== undefined && PROVIDERS.has(v) ? (v as Provider) : undefined;
}

/** `COMMIT_SAGE_NO_AI` (truthy) wins as `off`; else a valid `COMMIT_SAGE_AI_MODE`. */
function parseAiMode(env: NodeJS.ProcessEnv): AiMode | undefined {
  if (parseBoolean(env.COMMIT_SAGE_NO_AI) === true) {
    return "off";
  }
  const mode = str(env.COMMIT_SAGE_AI_MODE);
  return mode !== undefined && AI_MODES.has(mode) ? (mode as AiMode) : undefined;
}

/** Drop keys whose value is `undefined`, yielding a clean partial layer. */
function pruneUndefined(candidates: PartialRunConfig): PartialRunConfig {
  const layer: PartialRunConfig = {};
  for (const [key, value] of Object.entries(candidates)) {
    if (value !== undefined) {
      (layer as Record<string, unknown>)[key] = value;
    }
  }
  return layer;
}

export function readEnvLayer(env: NodeJS.ProcessEnv = process.env): PartialRunConfig {
  return pruneUndefined({
    repoTarget: str(env.COMMIT_SAGE_REPO),
    branch: parseBranch(env.COMMIT_SAGE_BRANCH),
    startDate: str(env.COMMIT_SAGE_START_DATE),
    endDate: str(env.COMMIT_SAGE_END_DATE),
    timezone: str(env.COMMIT_SAGE_TZ),
    authorFilter: str(env.COMMIT_SAGE_AUTHOR),
    maxCommits: parsePositiveInt(env.COMMIT_SAGE_MAX_COMMITS),
    noMerges: parseBoolean(env.COMMIT_SAGE_NO_MERGES),
    outputFormats: parseFormats(env.COMMIT_SAGE_FORMAT),
    outputPath: str(env.COMMIT_SAGE_OUT),
    aiMode: parseAiMode(env),
    provider: parseProvider(env.COMMIT_SAGE_PROVIDER),
    llmBaseUrl: str(env.COMMIT_SAGE_LLM_BASE_URL),
    llmModel: str(env.COMMIT_SAGE_LLM_MODEL),
  });
}
