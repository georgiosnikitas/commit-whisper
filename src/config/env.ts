/**
 * The single reader of `process.env` (Story 1.2; AI key added Story 1.6).
 *
 * `readEnvLayer` parses the NON-SECRET `COMMIT_SAGE_*` variables into the `env`
 * resolver layer. `readAiKey` reads the SECRET LLM key (env-only, wrapped in
 * `Secret`, bypassing the merge). `env` is injected (defaulting to `process.env`)
 * so parsing stays pure and table-testable. Per the hexagonal boundary, this is
 * the only place `process.env` is read.
 *
 * Remaining SECRET env vars are still deferred: the git PAT
 * (`COMMIT_SAGE_GIT_TOKEN` / host fallbacks) lands in Epic 5. The LLM key now
 * reads every provider's native variable (Story 3.6).
 */

import type { AiMode, Branch, OutputFormat, PartialRunConfig, Provider } from "./run-config.js";
import { Secret } from "../shared/secret.js";

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

/**
 * Read the LLM API key for the given provider from its native environment
 * variable, wrapped in `Secret` (env-only; bypasses the resolver merge). Each
 * provider reads its SDK-native variable — `OPENAI_API_KEY` (`openai`),
 * `ANTHROPIC_API_KEY` (`anthropic`), `GOOGLE_GENERATIVE_AI_API_KEY` (with
 * `GEMINI_API_KEY` accepted as an explicitly-read friendly alias, `gemini`), and
 * `OPENAI_API_KEY` (optional, for the OpenAI-compatible `openai-compatible`
 * endpoint). `ollama` (local) needs no key. Returns `undefined` when the variable
 * is unset (the narrate layer decides whether that is an error per provider).
 */
export function readAiKey(
  env: NodeJS.ProcessEnv,
  provider: Provider | undefined,
): Secret<string> | undefined {
  switch (provider) {
    case "gemini": {
      const key = str(env.GOOGLE_GENERATIVE_AI_API_KEY) ?? str(env.GEMINI_API_KEY);
      return wrapKey(key);
    }
    case "openai":
    case "openai-compatible":
      return wrapKey(str(env.OPENAI_API_KEY));
    case "anthropic":
      return wrapKey(str(env.ANTHROPIC_API_KEY));
    default:
      // ollama (no key), undefined provider, or aiMode "off".
      return undefined;
  }
}

/** Wrap a present key in `Secret`; `undefined` passes through. */
function wrapKey(key: string | undefined): Secret<string> | undefined {
  return key === undefined ? undefined : new Secret(key);
}

/**
 * Read the git PAT for a private remote from the environment (env-only, like the
 * LLM key). `COMMIT_SAGE_GIT_TOKEN` takes precedence over the host-specific
 * `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` fallbacks, then wraps the
 * value in `Secret` (so it redacts to `***` everywhere). `undefined` when none is
 * set — a local path or public remote needs no token (its absence is never an
 * error). Note the GitHub-Actions footgun: the auto-injected `GITHUB_TOKEN` is
 * scoped to the workflow's OWN repo, so analyzing a different private repo from
 * Actions needs an explicit `COMMIT_SAGE_GIT_TOKEN` (which takes precedence).
 */
export function readGitToken(env: NodeJS.ProcessEnv): Secret<string> | undefined {
  const token =
    str(env.COMMIT_SAGE_GIT_TOKEN) ??
    str(env.GITHUB_TOKEN) ??
    str(env.GITLAB_TOKEN) ??
    str(env.BITBUCKET_TOKEN);
  return wrapKey(token);
}

/** One environment variable's diagnostic status — NAME + presence only, never the value. */
export interface EnvVarStatus {
  name: string;
  set: boolean;
  note?: string;
}

/** The AI-key environment variable a given provider reads (none for local Ollama). */
function aiKeyEnvVar(provider: Provider | undefined): string | undefined {
  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "gemini":
      return "GOOGLE_GENERATIVE_AI_API_KEY";
    case "ollama":
      return undefined; // local — no key needed
    default:
      // openai / openai-compatible, and the "no provider configured" first-run case,
      // all point at OPENAI_API_KEY (the canonical cloud example named in the fix).
      return "OPENAI_API_KEY";
  }
}

/**
 * Diagnostics for the Status/doctor view (Story 6.3): the env vars relevant to
 * the current provider, reported by NAME + set/missing only — never the value.
 * `set` is derived from the SAME `readAiKey`/`readGitToken` logic those keys
 * already use, so the displayed presence can never drift from the real key
 * resolution (e.g. the gemini `GEMINI_API_KEY` alias, the git-token host
 * fallbacks). For "no provider configured", the AI row names `OPENAI_API_KEY`
 * with its real presence so a user who already exported a key still sees `✓`.
 */
export function readEnvDiagnostics(env: NodeJS.ProcessEnv, provider: Provider | undefined): EnvVarStatus[] {
  const diagnostics: EnvVarStatus[] = [];
  const keyVar = aiKeyEnvVar(provider);
  if (keyVar !== undefined) {
    diagnostics.push({ name: keyVar, set: readAiKey(env, provider ?? "openai") !== undefined });
  }
  diagnostics.push({
    name: "COMMIT_SAGE_GIT_TOKEN",
    set: readGitToken(env) !== undefined,
    note: "only needed for private remotes",
  });
  return diagnostics;
}

/**
 * The single ambient `process.env` accessor (Story 1.8). The CLI shell
 * (`cli/`, `index.ts`) is forbidden by the hexagonal lint boundary from naming
 * `process.env` directly, so it captures the environment through this
 * config-owned reader and injects it into `resolveRunConfig` / `readAiKey`.
 */
export function readProcessEnv(): NodeJS.ProcessEnv {
  return process.env;
}
