/**
 * The single reader of `process.env` (Story 1.2; AI key added Story 1.6).
 *
 * `readEnvLayer` parses the NON-SECRET `COMMIT_WHISPER_*` variables into the `env`
 * resolver layer. `readAiKey` reads the SECRET LLM key (env-only, wrapped in
 * `Secret`, bypassing the merge). `env` is injected (defaulting to `process.env`)
 * so parsing stays pure and table-testable. Per the hexagonal boundary, this is
 * the only place `process.env` is read.
 *
 * Remaining SECRET env vars are still deferred: the git PAT
 * (`COMMIT_WHISPER_GIT_TOKEN` / host fallbacks) lands in Epic 5. The LLM key now
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

/** `COMMIT_WHISPER_NO_AI` (truthy) wins as `off`; else a valid `COMMIT_WHISPER_AI_MODE`. */
function parseAiMode(env: NodeJS.ProcessEnv): AiMode | undefined {
  if (parseBoolean(env.COMMIT_WHISPER_NO_AI) === true) {
    return "off";
  }
  const mode = str(env.COMMIT_WHISPER_AI_MODE);
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
    repoTarget: str(env.COMMIT_WHISPER_REPO),
    branch: parseBranch(env.COMMIT_WHISPER_BRANCH),
    startDate: str(env.COMMIT_WHISPER_START_DATE),
    endDate: str(env.COMMIT_WHISPER_END_DATE),
    timezone: str(env.COMMIT_WHISPER_TZ),
    authorFilter: str(env.COMMIT_WHISPER_AUTHOR),
    maxCommits: parsePositiveInt(env.COMMIT_WHISPER_MAX_COMMITS),
    noMerges: parseBoolean(env.COMMIT_WHISPER_NO_MERGES),
    outputFormats: parseFormats(env.COMMIT_WHISPER_FORMAT),
    outputPath: str(env.COMMIT_WHISPER_OUT),
    aiMode: parseAiMode(env),
    provider: parseProvider(env.COMMIT_WHISPER_PROVIDER),
    llmBaseUrl: str(env.COMMIT_WHISPER_LLM_BASE_URL),
    llmModel: str(env.COMMIT_WHISPER_LLM_MODEL),
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
 * LLM key). `COMMIT_WHISPER_GIT_TOKEN` takes precedence over the host-specific
 * `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN` fallbacks, then wraps the
 * value in `Secret` (so it redacts to `***` everywhere). `undefined` when none is
 * set — a local path or public remote needs no token (its absence is never an
 * error). Note the GitHub-Actions footgun: the auto-injected `GITHUB_TOKEN` is
 * scoped to the workflow's OWN repo, so analyzing a different private repo from
 * Actions needs an explicit `COMMIT_WHISPER_GIT_TOKEN` (which takes precedence).
 */
export function readGitToken(env: NodeJS.ProcessEnv): Secret<string> | undefined {
  const token =
    str(env.COMMIT_WHISPER_GIT_TOKEN) ??
    str(env.GITHUB_TOKEN) ??
    str(env.GITLAB_TOKEN) ??
    str(env.BITBUCKET_TOKEN);
  return wrapKey(token);
}

/**
 * Read the license key from the environment (Story 7.1). The license key is a
 * CREDENTIAL, not a user secret (architecture I3): it is NOT wrapped in `Secret`
 * (it may be cached/entered in-app), but it never enters `RunConfig`,
 * `--show-config`, or any log — only the gate reads it, and only the resolved
 * `entitlement` crosses the hexagonal boundary. `undefined` ⇒ the Free tier.
 */
export function readLicenseKey(env: NodeJS.ProcessEnv): string | undefined {
  return str(env.COMMIT_WHISPER_LICENSE_KEY);
}

/** One environment variable's diagnostic status — NAME + presence only, never the value. */
export interface EnvVarStatus {
  name: string;
  set: boolean;
  note?: string;
}

/** The AI-key environment variable a given provider reads (none for local Ollama). */
export function aiKeyEnvVar(provider: Provider | undefined): string | undefined {
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
 * Every cloud provider's key env var, in a stable display order. Ollama is local
 * (no key) so it has no row. `openai-compatible` shares `OPENAI_API_KEY` with
 * `openai`, so it is not a separate row — it is folded into the `openai` row's
 * "active provider" annotation below.
 */
const PROVIDER_KEY_VARS: { provider: Provider; name: string }[] = [
  { provider: "openai", name: "OPENAI_API_KEY" },
  { provider: "anthropic", name: "ANTHROPIC_API_KEY" },
  { provider: "gemini", name: "GOOGLE_GENERATIVE_AI_API_KEY" },
];

/** Whether `active` is the provider that reads the given row's key var (folds in `openai-compatible`). */
function isActiveKeyRow(rowProvider: Provider, active: Provider | undefined): boolean {
  if (active === rowProvider) {
    return true;
  }
  // openai-compatible reads OPENAI_API_KEY, so it lights up the openai row.
  return active === "openai-compatible" && rowProvider === "openai";
}

/**
 * Diagnostics for the Doctor view (Story 6.3): EVERY provider's key env
 * var, the git token, and the license key — reported by NAME + set/missing only,
 * never the value. Listing all providers lets a user see at a glance which
 * providers they could switch to; the currently-configured provider's row is
 * annotated "active provider". `set` is derived from the SAME
 * `readAiKey`/`readGitToken`/`readLicenseKey` logic those keys already use, so
 * the displayed presence can never drift from the real key resolution (e.g. the
 * gemini `GEMINI_API_KEY` alias, the git-token host fallbacks).
 */
export function readEnvDiagnostics(env: NodeJS.ProcessEnv, provider: Provider | undefined): EnvVarStatus[] {
  return [
    ...PROVIDER_KEY_VARS.map(({ provider: p, name }) => ({
      name,
      set: readAiKey(env, p) !== undefined,
      note: isActiveKeyRow(p, provider) ? "active provider" : undefined,
    })),
    {
      name: "COMMIT_WHISPER_GIT_TOKEN",
      set: readGitToken(env) !== undefined,
      note: "only needed for private remotes",
    },
    {
      name: "COMMIT_WHISPER_LICENSE_KEY",
      set: readLicenseKey(env) !== undefined,
      note: "unlocks paid tiers when valid",
    },
  ];
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
