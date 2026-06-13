/**
 * The frozen `RunConfig` contract + provenance types (Story 1.2).
 *
 * `RunConfig` is the single immutable input the hexagonal pipeline
 * (retrieve -> analyze -> narrate -> assemble -> render) consumes; it has no
 * access to argv/env/prompts. Only the NON-SECRET, user-supplyable fields flow
 * through the two-phase resolver merge (see `resolver.ts`). The secret fields
 * (`gitPat`, `aiKey`: `Secret<string>`) are deliberately ABSENT here -- they are
 * env-only, bypass the merge, and arrive with `Secret<string>` in Story 1.3
 * (`aiKey` wired in 1.6, `gitPat` in Epic 5).
 */

export type Provider = "ollama" | "openai" | "gemini" | "anthropic" | "openai-compatible";
export type OutputFormat = "html" | "markdown" | "terminal" | "json";
export type AiMode = "required" | "auto" | "off";
export type Tier = "free" | "single-device" | "unlimited";

/** ISO-8601 date/timestamp string. Branded later if stricter typing is wanted. */
export type IsoDate = string;

/** Which resolver layer supplied a given field (P7 provenance). */
export type Source = "default" | "configFile" | "env" | "flag" | "interactive";

/**
 * Branch selection sentinel -- never a magic empty string.
 * `head` is the default sentinel meaning "the repo's HEAD"; Story 1.4 reads HEAD
 * history, so the sentinel needs no resolution there. Named/all branch selection
 * is Epic 2 (Group D branch/merge metrics).
 */
export type Branch =
  | { kind: "named"; name: string }
  | { kind: "all" }
  | { kind: "head" };

export interface Entitlement {
  tier: Tier;
  commitCap?: number;
}

/**
 * The non-secret, user-supplyable config-data fields -- the surface the
 * two-phase merge operates over.
 */
export interface ConfigData {
  // -- repository --
  repoTarget: string; // local path | remote HTTPS URL; defaults to cwd
  branch: Branch; // sentinel, never ""
  // -- scope / filters (optional => unbounded) --
  startDate?: IsoDate;
  endDate?: IsoDate;
  timezone: string; // IANA tz; default "UTC"
  authorFilter?: string;
  maxCommits?: number; // positive int
  noMerges: boolean; // default false; changes the analyzed commit set
  // -- output --
  outputFormats: OutputFormat[]; // multi-select, >= 1; default ["terminal"]
  outputPath?: string; // file formats only; "-" = stdout
  // -- AI (runs per aiMode) --
  aiMode: AiMode; // default: interactive->auto, headless/CI->off
  provider?: Provider; // required unless aiMode === "off"
  llmBaseUrl?: string; // required for ollama / openai-compatible when AI runs
  llmModel?: string; // required when AI runs
}

/** Per-field provenance map (one entry per resolved config-data field). */
export type Provenance = Partial<Record<keyof ConfigData, Source>>;

/** Phase-1 output: every config-data field optional, before gap handling. */
export type PartialRunConfig = Partial<ConfigData>;

/**
 * The frozen contract handed across the hexagonal boundary. Extends the
 * config-data surface with the three fields INJECTED by the config/license
 * layer (not user inputs, not merged).
 */
export interface RunConfig extends ConfigData {
  analysisTimestamp: IsoDate; // C2 determinism anchor (never Date.now())
  entitlement: Entitlement; // resolved by the license gate (Epic 7)
  provenance: Provenance; // P7: which layer set each config-data field
}

/**
 * Recursively freeze an object graph (depth-first) so the returned value is
 * deeply immutable. Used to freeze the assembled `RunConfig` before it crosses
 * the hexagonal boundary.
 */
export function deepFreeze<T>(value: T): Readonly<T> {
  freezeRecursive(value);
  return value;
}

function freezeRecursive(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return;
  }
  // Freeze BEFORE descending so a reference cycle short-circuits on the
  // `Object.isFrozen` guard rather than recursing without bound.
  Object.freeze(value);
  for (const child of Object.values(value)) {
    freezeRecursive(child);
  }
}
