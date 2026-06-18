/**
 * The launchpad — the single interactive entry point (Story 6.1).
 *
 * Reached ONLY by the bare zero-argument `commit-whisper` in an interactive TTY
 * (the STRICT truth table's one prompting row); any argument bypasses this for
 * strict single-shot. This module is the calm, line-oriented discovery menu: a
 * persistent header readiness line, a state-aware action list (license rows vary
 * by effective tier), keyboard navigation (via `@clack/prompts` `select`), and a
 * clean Esc/Quit that prints a short flags cheatsheet.
 *
 * Design: the MODEL is pure (`formatReadinessLine`, `buildLaunchpadOptions`) and
 * the DRIVER (`runLaunchpad`) loops over an INJECTED `select` so the whole thing
 * is unit-testable with no TTY. All chrome is written to the injected `output`
 * (default `process.stderr`) — stdout stays clean for machine data (`cli/` is
 * under `no-console`, so we write via the stream, never `console.*`).
 *
 * Story 6.2 turns the two Analyze rows into live GUIDED RUNS: infer the target
 * (cwd `.` or a prompted remote URL), ask only the optional scoping inputs
 * (limit · date range · output format) with defaults, run the pipeline through
 * an INJECTED `runAnalysis` executor, then echo the equivalent strict
 * single-shot command (`▸ Next time: …`) — the self-teaching bridge. Status
 * (6.3) · Settings (6.5) · license actions (Epic 7) stay "coming soon"
 * placeholders. All prompt chrome is stderr, so the stdout report never bleeds.
 */

import { Writable } from "node:stream";

import { isCancel, multiselect as clackMultiselect, select as clackSelect, text as clackText } from "@clack/prompts";

import type { EnvVarStatus } from "../config/env.js";
import { aiKeyEnvVar } from "../config/env.js";
import type { SettingsData } from "../config/config-store.js";
import type { AiMode, Branch, OutputFormat, PartialRunConfig, Provider, Tier } from "../config/run-config.js";
import type { ActivationOutcome, DeactivationOutcome } from "../license/actions.js";
import { ExitCode } from "./exit-codes.js";

/** A launchpad row's stable identity (the value returned by the menu). */
export type LaunchpadAction =
  | "analyze-cwd"
  | "analyze-remote"
  | "settings"
  | "status"
  | "help"
  | "activate"
  | "buy"
  | "restore"
  | "coffee"
  | "deactivate"
  | "quit";

/**
 * A fully-resolved presentation snapshot — the menu does NO I/O of its own. The
 * caller (`cli/`) reads the env-configured AI, the entitlement, and the repo
 * context, and hands them here already resolved.
 */
export interface LaunchpadState {
  tier: Tier;
  licensed: boolean;
  provider?: Provider;
  llmModel?: string;
  cwdLabel: string;
  isRepo: boolean;
  branch?: string;
}

/** A single menu row. `label` is always present — selection never relies on color (AC4). */
export interface LaunchpadOption {
  value: LaunchpadAction;
  label: string;
  hint?: string;
}

/** The injected menu primitive: resolve to the chosen action, or `null` on cancel (Esc/Ctrl-C). */
export type LaunchpadSelect = (opts: {
  message: string;
  options: LaunchpadOption[];
}) => Promise<LaunchpadAction | null>;

/** A single-line text prompt's options (a `@clack` `text` subset). */
export interface GuidedTextOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  /** Pre-fills the editable input so a saved value is visible (and editable) on open. */
  initialValue?: string;
  validate?: (value: string) => string | undefined;
}

/** A multi-select prompt's options (the output-format picker). */
export interface GuidedMultiselectOptions {
  message: string;
  options: { value: OutputFormat; label: string }[];
  initialValues?: OutputFormat[];
}

/** A single-select prompt's options (the Settings provider + default-format pickers). */
export interface GuidedSelectOneOptions {
  message: string;
  options: { value: string; label: string; hint?: string }[];
  initialValue?: string;
}

/** The injected guided-prompt primitives (cancel → `null`, mirroring `LaunchpadSelect`). */
export interface GuidedPrompts {
  text(opts: GuidedTextOptions): Promise<string | null>;
  multiselect(opts: GuidedMultiselectOptions): Promise<OutputFormat[] | null>;
  selectOne(opts: GuidedSelectOneOptions): Promise<string | null>;
}

/** Provider reachability for the Status/doctor view (Story 6.3). */
export type Reachability =
  | { kind: "not-configured" }
  | { kind: "reachable" }
  | { kind: "unreachable"; reason: string };

/**
 * The effective NON-SECRET config knobs surfaced in the Status/doctor "Config"
 * and "Operational" blocks — the everyday options not already on the
 * AI/License/Repository lines. Each scope/AI knob is the resolver-precedence
 * value (config < env) or `undefined` when unset, so the view can show the
 * configured value or the documented default. `logLevel`/`color` are the already
 * resolved operational state (env + TTY), injected by `cli/`.
 */
export interface DoctorConfig {
  branch?: Branch;
  authorFilter?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  noMerges?: boolean;
  outputFormats?: OutputFormat[];
  outputPath?: string;
  maxCommits?: number;
  aiMode?: AiMode;
  llmBaseUrl?: string;
  logLevel?: string;
  color?: boolean;
}

/** The injected async reachability probe (cli wraps `preflightProvider`). */
export type ProbeReachability = () => Promise<Reachability>;

export interface LaunchpadDeps {
  state: LaunchpadState;
  /** The full flag reference (commander's help text), shown by "Help / show all flags". */
  helpText: string;
  /** Where all chrome is written. Default `process.stderr`. */
  output?: Writable;
  /** The menu primitive. Default: a `@clack/prompts` `select` wired to `output`. */
  select?: LaunchpadSelect;
  /** The guided-run prompt primitives. Default: `@clack` `text`/`multiselect` wired to `output`. */
  prompts?: GuidedPrompts;
  /** The pipeline executor for a guided Analyze run; injected by `cli/`. Absent ⇒ echo-only. */
  runAnalysis?: (flags: PartialRunConfig) => Promise<number>;
  /** Whether a git token is set in the environment (for the AC3 private-remote hint). */
  gitTokenConfigured?: boolean;
  /** Env-var presence diagnostics for Status/doctor (names + booleans only); injected by `cli/`. */
  envDiagnostics?: EnvVarStatus[];
  /** The effective non-secret config knobs for the Status/doctor "Config" block; injected by `cli/`. */
  doctorConfig?: DoctorConfig;
  /** The async provider reachability probe for Status/doctor; injected by `cli/`. */
  probeReachability?: ProbeReachability;
  /** Load the persisted Settings (Story 6.5); injected by `cli/`. Absent ⇒ Settings starts blank. */
  loadSettings?: () => Promise<SettingsData>;
  /** Persist the Settings (Story 6.5) — returns the saved path; injected by `cli/`. Absent ⇒ Settings is read-only. */
  saveSettings?: (data: SettingsData) => Promise<string>;
  /**
   * Re-resolve the live AI provider/model (persisted config overlaid by env, the
   * resolver's precedence) after a Settings save; injected by `cli/`. Lets a
   * mid-session provider change cure the no-AI state and refresh the header
   * WITHOUT restarting the launchpad. Absent ⇒ the header is left as-is.
   */
  reloadAiState?: () => Promise<{ provider?: Provider; llmModel?: string }>;
  /** Activate a license key (Story 7.2) — the only in-app key entry; injected by `cli/`. */
  activateLicense?: (licenseKey: string) => Promise<ActivationOutcome>;
  /** Deactivate this device's license (Story 7.2) — frees the activation; injected by `cli/`. */
  deactivateLicense?: () => Promise<DeactivationOutcome>;
  /** Open a URL in the browser (Story 7.2 Buy/Restore + Coffee); injected by `cli/`. */
  openUrl?: (url: string) => Promise<void>;
  /** The Buy (store / checkout) hand-off URL; injected by `cli/`. */
  storeUrl?: string;
  /** The Restore-purchase hand-off URL (the customer's orders page); injected by `cli/`. */
  restoreUrl?: string;
  /** The voluntary Buy-Me-a-Coffee URL; injected by `cli/`. */
  coffeeUrl?: string;
  /**
   * Whether to clear the screen and re-pin the header + menu at the top before
   * every prompt (the interactive full-screen posture). Default: auto-detected
   * from whether `output` is a TTY. Injected mainly so tests can drive the
   * full-screen path without a real terminal.
   */
  repaint?: boolean;
  /**
   * Hold the just-rendered action output on screen until the user presses a key,
   * then resolve `"quit"` (Ctrl-C / Esc) or `"continue"`. Only used when
   * `repaint` is on. Default: a single raw keystroke read from `process.stdin`.
   */
  waitForKey?: (output: Writable) => Promise<"quit" | "continue">;
}

/** The locked product tagline (brief.md / DESIGN.md). */
export const LAUNCHPAD_TAGLINE = "commit-whisper · 🕵️  I know what you did last commit";

/** The short, copyable cheatsheet printed on Esc/Quit (AC4). */
export const FLAGS_CHEATSHEET = [
  "Common commands:",
  "  commit-whisper .              analyze the current repository",
  "  commit-whisper <path|url>     analyze a local path or remote URL",
  "  --no-ai                    metrics only — no LLM call",
  "  --format html,json         choose one or more output formats",
  "  --help                     the full flag reference",
].join("\n");

/**
 * The shared first-run-no-AI fix copy (Story 6.3, AC2 + AC3): names the cloud
 * env-var path AND the zero-cost local Ollama path (with its must-be-running
 * note). commit-whisper narrates every run, so a provider is required — these are
 * the two concrete cures.
 */
export const NO_AI_FIX = [
  "Two zero-config paths:",
  "  • Local & free — run Ollama, then set COMMIT_WHISPER_PROVIDER=ollama.",
  "    It must be running: `ollama serve`, then `ollama pull <model>`.",
  "    Nothing leaves your machine.",
  "  • Cloud — set a provider key in your environment, e.g. OPENAI_API_KEY",
  "    (commit-whisper never stores keys).",
].join("\n");

/** The calm no-AI interstitial shown when an Analyze action is chosen with no provider (AC3 — teach, never wall). */
export const NO_AI_INTERSTITIAL = ["Analysis needs an AI provider — every run narrates with an LLM.", NO_AI_FIX].join(
  "\n",
);

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  "single-device": "Single-device",
  unlimited: "Unlimited",
};

/** The output-format picker rows (the resolver tokens — `markdown`, not the `md` extension). */
const OUTPUT_FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "terminal", label: "terminal" },
  { value: "html", label: "html" },
  { value: "markdown", label: "markdown" },
  { value: "json", label: "json" },
];

/** The provider picker rows for Settings (the closed enum; Ollama leads as the zero-cost local path). */
const PROVIDER_OPTIONS: { value: string; label: string; hint?: string }[] = [
  { value: "ollama", label: "Ollama", hint: "local, free" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai-compatible", label: "OpenAI-compatible" },
];

/** Providers that need a base URL (local / custom endpoints). */
const BASE_URL_PROVIDERS = new Set<string>(["ollama", "openai-compatible"]);

/**
 * The closing note after a Settings save — provider-aware: for `ollama`, the
 * must-be-running local caveat (no key); for any cloud provider, the EXACT
 * native env var it reads (never entered here). Prevents naming an irrelevant
 * provider's path (e.g. an Ollama tip after saving Anthropic).
 */
export function settingsSavedNote(provider: Provider): string {
  const keyVar = aiKeyEnvVar(provider);
  if (keyVar === undefined) {
    // ollama — local, no key, but the server must be running.
    return [
      "Ollama runs locally — no key needed, but it must be running:",
      "  `ollama serve`, then `ollama pull <model>`. Saving selects it; it doesn't start it.",
    ].join("\n");
  }
  return `This provider reads its key from your environment (${keyVar}) — never entered here.`;
}

function aiSegment(state: LaunchpadState): string {
  if (state.provider === undefined) {
    return "⚠ not configured";
  }
  if (state.llmModel === undefined) {
    return state.provider;
  }
  return `${state.provider} (${state.llmModel})`;
}

function cwdSegment(state: LaunchpadState): string {
  if (!state.isRepo) {
    return "— (not a git repo)";
  }
  return `${state.cwdLabel} (${state.branch ?? "detached"})`;
}

/**
 * The persistent header readiness line (AC2): `<tier> · AI: <provider (model) |
 * ⚠ not configured> · cwd: <path> (<branch>) | — (not a git repo)`.
 */
export function formatReadinessLine(state: LaunchpadState): string {
  return `${TIER_LABEL[state.tier]} · AI: ${aiSegment(state)} · cwd: ${cwdSegment(state)}`;
}

/**
 * The ordered, grouped, state-aware menu (AC1, AC3): ACT (analyze cwd/remote) →
 * ORIENT (settings/status/help) → LICENSE (by effective state) → Quit (always
 * last). Every option carries a non-empty text `label`.
 */
export function buildLaunchpadOptions(state: LaunchpadState): LaunchpadOption[] {
  const options: LaunchpadOption[] = [
    { value: "analyze-cwd", label: "Analyze this repository", hint: "the current directory" },
    { value: "analyze-remote", label: "Analyze a remote repository", hint: "clone a URL" },
    { value: "settings", label: "Settings", hint: "provider, model, default format" },
    { value: "status", label: "Status / doctor" },
    { value: "help", label: "Help / show all flags" },
  ];
  if (state.licensed) {
    options.push({ value: "deactivate", label: "Deactivate license", hint: "free this device" });
  } else {
    options.push(
      { value: "activate", label: "Activate license", hint: "enter your license key" },
      { value: "buy", label: "Buy a license", hint: "opens the store in your browser" },
      { value: "restore", label: "Restore a purchase", hint: "opens your Lemon Squeezy orders" },
      { value: "coffee", label: "Buy Me a Coffee" },
    );
  }
  options.push({ value: "quit", label: "Quit", hint: "esc" });
  return options;
}

// ── Status / doctor (Story 6.3) ─────────────────────────────────────────────

/**
 * Column where the primary Status/doctor values begin — the longest label
 * ("Repository", 10) plus a 2-space gutter — so the License / AI / Repository
 * values line up in one straight vertical column.
 */
const STATUS_LABEL_WIDTH = 12;

/** Left-justify a Status/doctor label to the shared value column. */
function statusLabel(text: string): string {
  return text.padEnd(STATUS_LABEL_WIDTH);
}

/** The reachability annotation appended to the AI line's trailing column. */
function reachabilityAnnotation(reachability: Reachability): string {
  switch (reachability.kind) {
    case "reachable":
      return "✓ reachable";
    case "unreachable":
      return `⚠ unreachable — ${reachability.reason}`;
    default:
      return "⚠ not configured";
  }
}

/** The Environment block: each var by NAME + set/missing glyph + word (never color alone), never a value. */
function environmentBlock(envVars: EnvVarStatus[]): string[] {
  // Align the set/missing words into one column: pad every "glyph NAME" prefix
  // to the longest plus a 2-space gutter (the var names vary in length).
  const prefixes = envVars.map((v) => `  ${v.set ? "✓" : "✗"} ${v.name}`);
  const stateColumn = Math.max(0, ...prefixes.map((p) => p.length)) + 2;
  const rows = envVars.map((v, i) => {
    const state = v.set ? "set" : "missing";
    const note = v.note === undefined ? "" : `   (${v.note})`;
    return `${prefixes[i].padEnd(stateColumn)}${state}${note}`;
  });
  return ["Environment", ...rows];
}

/** The Repository block: label + branch, or the not-a-repo notice. */
function repositoryLine(state: LaunchpadState): string {
  return state.isRepo
    ? `${statusLabel("Repository")}✓ ${cwdSegment(state)}`
    : `${statusLabel("Repository")}— not a git repo`;
}

/** Indent + pad a Config row's label so the values line up under one column. */
const CONFIG_LABEL_WIDTH = 14;

/** A single doctor key/value row, optionally annotated with the env var that sets it. */
interface DoctorRow {
  label: string;
  value: string;
  envVar?: string;
}

/**
 * Render doctor rows with two aligned columns: `label → value`, then (when
 * present) the env var NAME that controls it, aligned into one trailing column
 * (longest `label+value` prefix + a 3-space gutter) so the var names form a
 * straight vertical column the user can copy.
 */
function renderRows(rows: DoctorRow[]): string[] {
  const prefixes = rows.map((r) => `  ${r.label.padEnd(CONFIG_LABEL_WIDTH)}${r.value}`);
  const envColumn = Math.max(0, ...prefixes.map((p) => p.length)) + 3;
  return rows.map((r, i) => (r.envVar === undefined ? prefixes[i] : `${prefixes[i].padEnd(envColumn)}${r.envVar}`));
}

/** The configured branch scope (all / a named branch / the checked-out HEAD), or the default. */
function branchValue(branch: Branch | undefined): string {
  if (branch === undefined) {
    return "HEAD (default)";
  }
  switch (branch.kind) {
    case "all":
      return "all branches";
    case "head":
      return "HEAD";
    default:
      return branch.name;
  }
}

/** The configured output formats, or the documented `terminal` default. */
function formatValue(formats: OutputFormat[] | undefined): string {
  return formats !== undefined && formats.length > 0 ? formats.join(", ") : "terminal (default)";
}

/**
 * The Settings block: the NON-SECRET knobs that the interactive Settings screen
 * actually persists to `~/.commit-whisper` (timezone, default format, max
 * commits, base URL) — distinct from the env/flag-only run scope below. Each row
 * is annotated with the env var that also sets it. The base-URL row appears only
 * when set (meaningful only for local/custom endpoints). `[]` when no config is
 * supplied.
 */
function settingsBlock(config: DoctorConfig | undefined): string[] {
  if (config === undefined) {
    return [];
  }
  const baseUrlRow: DoctorRow[] =
    config.llmBaseUrl === undefined
      ? []
      : [{ label: "Base URL", value: config.llmBaseUrl, envVar: "COMMIT_WHISPER_LLM_BASE_URL" }];
  const rows: DoctorRow[] = [
    { label: "Timezone", value: config.timezone ?? "UTC (default)", envVar: "COMMIT_WHISPER_TZ" },
    { label: "Format", value: formatValue(config.outputFormats), envVar: "COMMIT_WHISPER_FORMAT" },
    {
      label: "Max commits",
      value: config.maxCommits === undefined ? "unbounded" : String(config.maxCommits),
      envVar: "COMMIT_WHISPER_MAX_COMMITS",
    },
    ...baseUrlRow,
  ];
  return ["", "Settings (saved in ~/.commit-whisper)", ...renderRows(rows)];
}

/**
 * The Run scope block: the per-run scope inputs that are NOT persisted — they
 * come only from the `COMMIT_WHISPER_*` env vars (or CLI flags on a
 * non-interactive run), never the Settings file. Each row is annotated with the
 * env var that sets it. `[]` when no config is supplied.
 */
function runScopeBlock(config: DoctorConfig | undefined): string[] {
  if (config === undefined) {
    return [];
  }
  const rows: DoctorRow[] = [
    { label: "Branch", value: branchValue(config.branch), envVar: "COMMIT_WHISPER_BRANCH" },
    { label: "Author", value: config.authorFilter ?? "any (default)", envVar: "COMMIT_WHISPER_AUTHOR" },
    { label: "Since", value: config.startDate ?? "— (unbounded)", envVar: "COMMIT_WHISPER_START_DATE" },
    { label: "Until", value: config.endDate ?? "— (unbounded)", envVar: "COMMIT_WHISPER_END_DATE" },
    { label: "No-merges", value: config.noMerges === true ? "on" : "off (default)", envVar: "COMMIT_WHISPER_NO_MERGES" },
    { label: "Output path", value: config.outputPath ?? "— (auto)", envVar: "COMMIT_WHISPER_OUT" },
    { label: "AI mode", value: config.aiMode ?? "auto (default)", envVar: "COMMIT_WHISPER_AI_MODE" },
  ];
  return ["", "Run scope (env vars / flags only — not saved)", ...renderRows(rows)];
}

/** Render the resolved color state as a word (never color alone): on / off / auto when unresolved. */
function colorState(color: boolean | undefined): string {
  if (color === undefined) {
    return "auto";
  }
  return color ? "on" : "off";
}

/** The Operational block: the resolved color + log-level state (env + TTY), each annotated with its env var. Omitted when neither is supplied. */
function operationalBlock(config: DoctorConfig | undefined): string[] {
  if (config === undefined || (config.logLevel === undefined && config.color === undefined)) {
    return [];
  }
  const rows: DoctorRow[] = [
    { label: "Log level", value: config.logLevel ?? "normal (default)", envVar: "COMMIT_WHISPER_LOG_LEVEL" },
    { label: "Color", value: colorState(config.color), envVar: "NO_COLOR / FORCE_COLOR" },
  ];
  return ["", "Operational", ...renderRows(rows)];
}

/**
 * The read-only Status/doctor report (Story 6.3, AC1/AC2). Line-oriented (the
 * calm 6.1/6.2 posture). Distinguishes *configured* from *reachable* (the probe
 * result), reports env vars by NAME + set/missing only, and — when no provider
 * is configured — names the concrete fix (AC2: `OPENAI_API_KEY` / Ollama).
 */
export function formatStatusReport(
  state: LaunchpadState,
  envVars: EnvVarStatus[],
  reachability: Reachability,
  config?: DoctorConfig,
): string {
  // License tier + AI provider/model share a trailing column (the free-tier cap
  // note / the reachability status), aligned to whichever head is longer + a
  // 3-space gutter so both annotations begin in one straight vertical column.
  const licenseHead = `${statusLabel("License")}${TIER_LABEL[state.tier]}`;
  const aiHead = `${statusLabel("AI")}${aiSegment(state)}`;
  const annotationColumn = Math.max(licenseHead.length, aiHead.length) + 3;
  const licenseLine =
    state.tier === "free" ? `${licenseHead.padEnd(annotationColumn)}100-commit cap` : licenseHead;
  const aiLine = `${aiHead.padEnd(annotationColumn)}${reachabilityAnnotation(reachability)}`;
  const lines = [
    "Status / doctor",
    "",
    licenseLine,
    aiLine,
    ...environmentBlock(envVars),
    repositoryLine(state),
    ...settingsBlock(config),
    ...runScopeBlock(config),
    ...operationalBlock(config),
  ];
  if (reachability.kind === "not-configured") {
    lines.push("", NO_AI_FIX);
  }
  return lines.join("\n");
}

// ── Guided run: pure command echo + input interpreters (Story 6.2) ──────────

/** A YYYY-MM-DD date, optionally with an ISO time tail (mirrors cli.ts `validateDateFlag`). */
const GUIDED_DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * The equivalent strict single-shot command for a guided run (AC2) — the
 * self-teaching `▸ Next time:` bridge. Emits ONLY flags the CLI actually has
 * (`--max-commits`/`--since`/`--until`/`--format`) plus the inferred positional
 * target; never `--branch` (no such flag). `--format` is emitted only when the
 * selection differs from the default `["terminal"]`.
 */
export function formatEquivalentCommand(target: string, flags: PartialRunConfig): string {
  const parts = ["commit-whisper", quoteArg(target)];
  if (flags.maxCommits !== undefined) {
    parts.push("--max-commits", String(flags.maxCommits));
  }
  if (flags.startDate !== undefined) {
    parts.push("--since", flags.startDate);
  }
  if (flags.endDate !== undefined) {
    parts.push("--until", flags.endDate);
  }
  if (flags.outputFormats !== undefined && !isDefaultFormats(flags.outputFormats)) {
    parts.push("--format", flags.outputFormats.join(","));
  }
  return parts.join(" ");
}

function isDefaultFormats(formats: OutputFormat[]): boolean {
  return formats.length === 1 && formats[0] === "terminal";
}

function quoteArg(value: string): string {
  // Leave shell-neutral tokens bare (`.`, `/path/to/repo`, `https://host/x.git`);
  // otherwise POSIX single-quote — closing/escaping/reopening any embedded single
  // quote — so the echoed command is faithful and copy-paste-safe even with
  // spaces or shell metacharacters (the echo is a teaching aid the user pastes).
  if (value !== "" && /^[A-Za-z0-9_./:@%+=-]+$/.test(value)) {
    return value;
  }
  const escaped = value.replaceAll("'", String.raw`'\''`);
  return `'${escaped}'`;
}

/**
 * Interpret the "Limit" input — dual-purpose (a `@clack` validator AND the
 * parser). Empty ⇒ all history; a decimal positive integer ⇒ the cap; anything
 * else ⇒ an error string. Mirrors cli.ts `applySelectionFlags`.
 */
export function interpretLimit(raw: string): { error: string } | { maxCommits?: number } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return {};
  }
  const error = { error: "Enter a positive whole number, or leave blank for all history." };
  if (!/^\d+$/.test(trimmed)) {
    return error;
  }
  const value = Number(trimmed);
  // Reject 0 and anything beyond the safe-integer range — `String(1e21)` would
  // echo as `1e+21`, which the CLI's `/^\d+$/` flag parser then rejects (the
  // self-teaching command must stay runnable).
  if (value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    return error;
  }
  return { maxCommits: value };
}

/**
 * Interpret the "Date range" input — dual-purpose. Empty ⇒ all history;
 * `since..until` (either side optional) ⇒ the bounds; a bare date ⇒ `since`.
 * Each non-empty side must be YYYY-MM-DD (an ISO time tail allowed).
 */
export function interpretDateRange(
  raw: string,
): { error: string } | { startDate?: string; endDate?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return {};
  }
  const rangeError = {
    error: "Use YYYY-MM-DD..YYYY-MM-DD (either side optional), or leave blank for all history.",
  };
  const parts = trimmed.split("..");
  if (parts.length > 2) {
    return rangeError; // `a..b..c` is malformed — never silently drop the extra parts.
  }
  const [sinceRaw, untilRaw = ""] = parts;
  const since = sinceRaw.trim();
  const until = untilRaw.trim();
  if ((since !== "" && !GUIDED_DATE.test(since)) || (until !== "" && !GUIDED_DATE.test(until))) {
    return rangeError;
  }
  const bounds: { startDate?: string; endDate?: string } = {};
  if (since !== "") {
    bounds.startDate = since;
  }
  if (until !== "") {
    bounds.endDate = until;
  }
  return bounds;
}

function writeLine(output: Writable, text: string): void {
  output.write(text.endsWith("\n") ? text : `${text}\n`);
}

/** Is this stream an interactive terminal? (the injected test stream / a pipe is not). */
function isInteractive(output: Writable): boolean {
  return (output as NodeJS.WriteStream).isTTY === true;
}

/**
 * Wipe the visible screen AND the scrollback buffer, then home the cursor — so a
 * re-pinned menu starts from a truly clean slate (`2J` clears the screen, `3J`
 * the scrollback, `H` homes). TTY-only; never emitted to a pipe or the test
 * stream (where the ANSI bytes would corrupt captured output).
 */
function clearScreen(output: Writable): void {
  output.write("\u001B[2J\u001B[3J\u001B[H");
}

/**
 * Hold the just-rendered action output on screen until the user presses a key,
 * so it is readable before the next loop clears and re-pins the menu. Resolves
 * `"quit"` when the user interrupts (Ctrl-C / Esc) so the caller can exit
 * cleanly, else `"continue"`. TTY-only — guarded by the caller; reads a single
 * raw keystroke from `process.stdin`.
 */
async function waitForKey(output: Writable): Promise<"quit" | "continue"> {
  writeLine(output, "");
  output.write("Press any key to return to the menu… (Esc to quit)");
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw === true;
  stdin.setRawMode?.(true);
  stdin.resume();
  return await new Promise<"quit" | "continue">((resolve) => {
    stdin.once("data", (data: Buffer) => {
      stdin.setRawMode?.(wasRaw);
      stdin.pause();
      const key = data.toString("utf8");
      // Ctrl-C (ETX) or Esc → treat as quit so raw mode never traps the user.
      resolve(key === "\u0003" || key === "\u001B" ? "quit" : "continue");
    });
  });
}

/** The default menu primitive: a `@clack/prompts` `select` wired to `output`; cancel → `null`. */
function clackLaunchpadSelect(output: Writable): LaunchpadSelect {
  return async ({ message, options }) => {
    const result = await clackSelect<LaunchpadAction>({ message, options, output });
    return isCancel(result) ? null : result;
  };
}

/** The default guided-prompt primitives: `@clack` `text`/`multiselect` wired to `output`; cancel → `null`. */
function clackGuidedPrompts(output: Writable): GuidedPrompts {
  return {
    async text(opts) {
      const validate = opts.validate;
      const result = await clackText({
        message: opts.message,
        placeholder: opts.placeholder,
        defaultValue: opts.defaultValue,
        initialValue: opts.initialValue,
        // `@clack` may pass `undefined` (empty input); our validators are total over strings.
        validate: validate === undefined ? undefined : (value) => validate(value ?? ""),
        output,
      });
      return isCancel(result) ? null : result;
    },
    async multiselect(opts) {
      const result = await clackMultiselect<OutputFormat>({
        message: opts.message,
        options: opts.options,
        initialValues: opts.initialValues,
        required: false,
        output,
      });
      return isCancel(result) ? null : result;
    },
    async selectOne(opts) {
      const result = await clackSelect<string>({
        message: opts.message,
        options: opts.options,
        initialValue: opts.initialValue,
        output,
      });
      return isCancel(result) ? null : result;
    },
  };
}

/** A simple HTTPS-URL validator for the remote-repository prompt (clone targets are http(s)). */
function validateRemoteUrl(value: string): string | undefined {
  return /^https?:\/\/\S+/i.test(value.trim()) ? undefined : "Enter a repository URL starting with https://.";
}

/** Adapt an interpreter result into a `@clack` validator return (the error string, or `undefined`). */
function errorOf(
  result: { error: string } | { maxCommits?: number } | { startDate?: string; endDate?: string },
): string | undefined {
  return "error" in result ? result.error : undefined;
}

/**
 * Collect the optional scoping inputs (AC1) — limit · date range · output
 * format — each defaulted so the user mostly confirms. Returns the assembled
 * flags (no `repoTarget`), or `null` if any prompt is cancelled. Branch is NOT
 * asked (the CLI has no `--branch` flag).
 */
async function collectGuidedInputs(
  prompts: GuidedPrompts,
  initialFormats: OutputFormat[] = ["terminal"],
): Promise<PartialRunConfig | null> {
  const limitRaw = await prompts.text({
    message: "Limit — most-recent commits to analyze",
    placeholder: "all history",
    validate: (v) => errorOf(interpretLimit(v)),
  });
  if (limitRaw === null) {
    return null;
  }

  const rangeRaw = await prompts.text({
    message: "Date range — since..until (absolute, optional)",
    placeholder: "all history",
    validate: (v) => errorOf(interpretDateRange(v)),
  });
  if (rangeRaw === null) {
    return null;
  }

  const formats = await prompts.multiselect({
    message: "Output — one or more formats",
    options: OUTPUT_FORMAT_OPTIONS,
    initialValues: initialFormats,
  });
  if (formats === null) {
    return null;
  }

  const flags: PartialRunConfig = {};
  const limit = interpretLimit(limitRaw);
  if ("maxCommits" in limit && limit.maxCommits !== undefined) {
    flags.maxCommits = limit.maxCommits;
  }
  const range = interpretDateRange(rangeRaw);
  if ("startDate" in range && range.startDate !== undefined) {
    flags.startDate = range.startDate;
  }
  if ("endDate" in range && range.endDate !== undefined) {
    flags.endDate = range.endDate;
  }
  flags.outputFormats = formats.length > 0 ? formats : ["terminal"];
  return flags;
}

/**
 * The persisted default output format, used to pre-select the guided picker so
 * a saved Settings choice is honored in interactive runs (not only strict
 * single-shot CLI runs). Absent `loadSettings`, a load failure, or an empty
 * saved list all fall back to `["terminal"]` — the never-dead-end posture.
 */
async function loadDefaultFormats(deps: LaunchpadDeps): Promise<OutputFormat[]> {
  if (deps.loadSettings === undefined) {
    return ["terminal"];
  }
  try {
    const saved = (await deps.loadSettings()).outputFormats;
    return saved !== undefined && saved.length > 0 ? saved : ["terminal"];
  } catch {
    return ["terminal"];
  }
}

/**
 * Drive one guided Analyze run (AC1, AC2, AC3): infer the target (cwd `.` or a
 * prompted remote URL), name a needed secret's env var (never collect it),
 * collect the scoping inputs, execute via the injected `runAnalysis`, then echo
 * the equivalent command. Always returns to the menu — cancel is never a
 * dead-end.
 */
async function runGuidedAnalyze(deps: LaunchpadDeps, mode: "cwd" | "remote", output: Writable): Promise<void> {
  // Story 6.3 AC3 (teach, never wall): with no provider configured, a guided run
  // would resolve aiMode `auto` and hard-fail (exit 3). Pre-empt that with the
  // calm no-AI interstitial — the row stays enabled, the user is taught the fix.
  if (deps.state.provider === undefined) {
    writeLine(output, NO_AI_INTERSTITIAL);
    return;
  }

  const prompts = deps.prompts ?? clackGuidedPrompts(output);

  let target = ".";
  if (mode === "remote") {
    const url = await prompts.text({ message: "Repository URL", validate: validateRemoteUrl });
    if (url === null) {
      return;
    }
    target = url.trim();
    if (deps.gitTokenConfigured !== true) {
      // AC3: name the env var for a private remote — never a collect field.
      writeLine(
        output,
        "If this repository is private, set COMMIT_WHISPER_GIT_TOKEN in your environment first — commit-whisper never collects it.",
      );
    }
  }

  const inputs = await collectGuidedInputs(prompts, await loadDefaultFormats(deps));
  if (inputs === null) {
    return;
  }
  const flags: PartialRunConfig = { repoTarget: target, ...inputs };

  if (deps.runAnalysis !== undefined) {
    await deps.runAnalysis(flags);
  }
  // AC2: the self-teaching bridge — echo the equivalent strict single-shot command.
  writeLine(output, `▸ Next time: ${formatEquivalentCommand(target, flags)}`);
}

/**
 * Render the read-only Status/doctor view (Story 6.3, AC1). Probes reachability
 * only when a provider is configured (selection alone is not reachability);
 * otherwise reports `not-configured` and the formatter appends the fix (AC2).
 */
async function runStatusDoctor(deps: LaunchpadDeps, output: Writable): Promise<void> {
  let reachability: Reachability = { kind: "not-configured" };
  if (deps.state.provider !== undefined && deps.probeReachability !== undefined) {
    try {
      reachability = await deps.probeReachability();
    } catch (err) {
      // A probe throw must never end the interactive session — degrade to an
      // unreachable verdict and stay in the menu (the never-dead-end posture).
      reachability = { kind: "unreachable", reason: err instanceof Error ? err.message : "probe failed" };
    }
  }
  writeLine(output, formatStatusReport(deps.state, deps.envDiagnostics ?? [], reachability, deps.doctorConfig));
}

/**
 * The Settings screen (Story 6.5): collect the NON-SECRET everyday choices —
 * provider (closed enum), model, base URL (only for ollama / openai-compatible),
 * default output format, timezone, max-commits — and persist them via the
 * injected `saveSettings` (atomic write). A cancel at any prompt saves nothing.
 * No secret is ever collected — a cloud key stays env-only (named in the note).
 */
async function runSettings(deps: LaunchpadDeps, output: Writable): Promise<void> {
  const prompts = deps.prompts ?? clackGuidedPrompts(output);
  // A load failure must never end the interactive session — start from blank.
  let current: SettingsData = {};
  if (deps.loadSettings !== undefined) {
    try {
      current = await deps.loadSettings();
    } catch {
      current = {};
    }
  }

  const provider = await prompts.selectOne({
    message: "AI provider",
    options: PROVIDER_OPTIONS,
    initialValue: current.provider,
  });
  if (provider === null) {
    return;
  }

  const model = await prompts.text({
    message: "Model",
    placeholder: "e.g. llama3 / gpt-4o",
    initialValue: current.llmModel,
    // A model is REQUIRED: every run narrates with it, and there is no default —
    // saving a provider without one persists a config that fails at run time
    // ("llmModel is missing"). Require it here so Settings can't save a dead config.
    validate: (v) => (v.trim() === "" ? "A model is required — every run narrates with it (e.g. gpt-4o, llama3)." : undefined),
  });
  if (model === null) {
    return;
  }

  let baseUrl: string | null = "";
  if (BASE_URL_PROVIDERS.has(provider)) {
    baseUrl = await prompts.text({
      message: "Base URL",
      placeholder: "e.g. http://localhost:11434",
      initialValue: current.llmBaseUrl,
    });
    if (baseUrl === null) {
      return;
    }
  }

  const formats = await prompts.multiselect({
    message: "Default output — one or more formats",
    options: OUTPUT_FORMAT_OPTIONS,
    initialValues: current.outputFormats,
  });
  if (formats === null) {
    return;
  }

  const timezone = await prompts.text({
    message: "Timezone (optional)",
    placeholder: "e.g. UTC / Europe/Athens",
    initialValue: current.timezone,
  });
  if (timezone === null) {
    return;
  }

  const limitRaw = await prompts.text({
    message: "Default max-commits (optional)",
    placeholder: "blank = all history",
    initialValue: optionalNumberText(current.maxCommits),
    validate: (v) => errorOf(interpretLimit(v)),
  });
  if (limitRaw === null) {
    return;
  }

  const data = assembleSettings({ provider, model, baseUrl, formats, timezone, limitRaw });
  if (deps.saveSettings === undefined) {
    return;
  }
  // A write failure must never end the interactive session — report it and
  // return to the menu (the never-dead-end posture, like 6.3's probe guard).
  try {
    const path = await deps.saveSettings(data);
    writeLine(output, `✓ Saved to ${path}`);
    writeLine(output, settingsSavedNote(provider as Provider));
    await refreshAiState(deps);
  } catch (err) {
    writeLine(output, `⚠ Could not save settings: ${err instanceof Error ? err.message : "write failed"}`);
  }
}

/**
 * Refresh the in-session AI state after a Settings save so a just-saved provider
 * immediately cures the no-AI gate (runGuidedAnalyze) and the header — no restart
 * required. A refresh failure is non-fatal: the save already succeeded and the
 * persisted change still applies on the next run.
 */
async function refreshAiState(deps: LaunchpadDeps): Promise<void> {
  if (deps.reloadAiState === undefined) {
    return;
  }
  try {
    const ai = await deps.reloadAiState();
    deps.state.provider = ai.provider;
    deps.state.llmModel = ai.llmModel;
  } catch {
    // Leave the header as-is — the persisted change still applies next run.
  }
}

/** Render an optional saved number as pre-fill text for a text prompt (absent ⇒ no pre-fill). */
function optionalNumberText(value: number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

/** Assemble a non-secret `SettingsData` from the collected Settings answers (omitting blanks). */
function assembleSettings(input: {
  provider: string;
  model: string;
  baseUrl: string;
  formats: OutputFormat[];
  timezone: string;
  limitRaw: string;
}): SettingsData {
  const outputFormats = input.formats.length > 0 ? input.formats : ["terminal" as OutputFormat];
  const data: SettingsData = { provider: input.provider as Provider, outputFormats };
  const model = input.model.trim();
  if (model !== "") {
    data.llmModel = model;
  }
  const baseUrl = input.baseUrl.trim();
  if (baseUrl !== "") {
    data.llmBaseUrl = baseUrl;
  }
  const timezone = input.timezone.trim();
  if (timezone !== "") {
    data.timezone = timezone;
  }
  const limit = interpretLimit(input.limitRaw);
  if ("maxCommits" in limit && limit.maxCommits !== undefined) {
    data.maxCommits = limit.maxCommits;
  }
  return data;
}

// ── License screens (Story 7.2) ─────────────────────────────────────────────

/**
 * Activate license (AC2) — the ONLY in-app key entry. Prompt for the key (not a
 * secret — entered in-app), activate online, and report the outcome. A cancel
 * saves nothing; an action throw degrades to a calm message (never crash the menu).
 */
async function runActivate(deps: LaunchpadDeps, output: Writable): Promise<void> {
  const prompts = deps.prompts ?? clackGuidedPrompts(output);
  const key = await prompts.text({ message: "License key", placeholder: "from the store or your purchase email" });
  if (key === null) {
    return;
  }
  if (deps.activateLicense === undefined) {
    return;
  }
  try {
    const outcome = await deps.activateLicense(key);
    if (outcome.ok) {
      // Reflect the new entitlement in the live state so the menu re-pins the
      // deactivation row (and the header tier) on the next loop — no restart.
      deps.state.licensed = true;
      deps.state.tier = outcome.tier;
      writeLine(output, `✓ License activated — ${TIER_LABEL[outcome.tier]} tier.`);
    } else {
      writeLine(output, `⚠ ${outcome.reason}`);
    }
  } catch (err) {
    writeLine(output, `⚠ Could not activate: ${err instanceof Error ? err.message : "request failed"}`);
  }
}

/**
 * Deactivate license (AC3) — free this device's activation so the license can
 * move. A confirm guards it; a throw degrades to a calm message.
 */
async function runDeactivate(deps: LaunchpadDeps, output: Writable): Promise<void> {
  const prompts = deps.prompts ?? clackGuidedPrompts(output);
  const choice = await prompts.selectOne({
    message: "Deactivate this device's license? It frees the activation so you can move machines.",
    options: [
      { value: "deactivate", label: "Deactivate" },
      { value: "cancel", label: "Cancel" },
    ],
    initialValue: "cancel",
  });
  if (choice === null || choice === "cancel") {
    return;
  }
  if (deps.deactivateLicense === undefined) {
    return;
  }
  try {
    const outcome = await deps.deactivateLicense();
    if (outcome.ok) {
      // Drop back to the free tier in the live state so the menu re-pins the
      // activation rows (and the header tier) on the next loop — no restart.
      deps.state.licensed = false;
      deps.state.tier = "free";
      writeLine(output, "✓ License deactivated — freed on this device. Re-activate anytime with your key.");
    } else {
      writeLine(output, `⚠ ${outcome.reason}`);
    }
  } catch (err) {
    writeLine(output, `⚠ Could not deactivate: ${err instanceof Error ? err.message : "request failed"}`);
  }
}

/**
 * A browser hand-off (Buy/Restore AC1 + Buy-Me-a-Coffee): open a URL, never
 * collect anything. On any open failure the URL is printed plainly so it stays
 * copyable (never a dead-end).
 */
async function runOpenUrl(deps: LaunchpadDeps, url: string, label: string, note: string, output: Writable): Promise<void> {
  writeLine(output, `Opening ${label} in your browser…`);
  if (note !== "") {
    writeLine(output, note);
  }
  if (deps.openUrl === undefined) {
    writeLine(output, url);
    return;
  }
  try {
    await deps.openUrl(url);
  } catch {
    writeLine(output, `Could not open a browser — visit: ${url}`);
  }
}

const BUY_NOTE =
  "commit-whisper never handles payment — checkout happens in your browser. After buying, return and choose “Activate license”.";
const RESTORE_NOTE =
  "commit-whisper never handles payment. Find your license key in your Lemon Squeezy orders, then return and choose “Activate license”.";

/** Default browser hand-off URLs (deployment-overridable via `cli/` from the environment). */
export const DEFAULT_STORE_URL = "https://georgiosnikitas.lemonsqueezy.com/";
export const DEFAULT_RESTORE_URL = "https://app.lemonsqueezy.com/my-orders";
export const DEFAULT_COFFEE_URL = "https://buymeacoffee.com/georgiosnikitas";

/**
 * Dispatch one chosen launchpad action. Returns `"quit"` to end the session
 * (Esc/Quit), or `"continue"` to re-prompt. Each action delegates to its screen;
 * keeping the switch here (not inline in the loop) holds `runLaunchpad`'s
 * cognitive complexity within budget.
 */
async function dispatchAction(deps: LaunchpadDeps, action: LaunchpadAction, output: Writable): Promise<"quit" | "continue"> {
  switch (action) {
    case "quit":
      writeLine(output, FLAGS_CHEATSHEET);
      return "quit";
    case "help":
      writeLine(output, deps.helpText);
      return "continue";
    case "analyze-cwd":
    case "analyze-remote":
      await runGuidedAnalyze(deps, action === "analyze-cwd" ? "cwd" : "remote", output);
      return "continue";
    case "status":
      await runStatusDoctor(deps, output);
      return "continue";
    case "settings":
      await runSettings(deps, output);
      return "continue";
    case "activate":
      await runActivate(deps, output);
      return "continue";
    case "deactivate":
      await runDeactivate(deps, output);
      return "continue";
    case "buy":
      await runOpenUrl(deps, deps.storeUrl ?? DEFAULT_STORE_URL, "the store", BUY_NOTE, output);
      return "continue";
    case "restore":
      await runOpenUrl(deps, deps.restoreUrl ?? DEFAULT_RESTORE_URL, "your Lemon Squeezy orders", RESTORE_NOTE, output);
      return "continue";
    case "coffee": // the voluntary support link.
      await runOpenUrl(deps, deps.coffeeUrl ?? DEFAULT_COFFEE_URL, "Buy Me a Coffee", "", output);
      return "continue";
    default:
      return assertNeverAction(action);
  }
}

/** Exhaustiveness guard — a new `LaunchpadAction` without a `dispatchAction` case is a compile error. */
function assertNeverAction(action: never): never {
  throw new Error(`Unhandled launchpad action: ${String(action)}`);
}

/**
 * Render the launchpad and loop until the user quits (AC1, AC4). Returns
 * `ExitCode.Success` on a clean Esc/Quit. In an interactive terminal the screen
 * is cleared and the header + menu re-pinned at the top before every prompt, and
 * each action's output is held until a keypress so it stays readable; otherwise
 * (pipe / tests) the header is written once and output simply accumulates.
 */
export async function runLaunchpad(deps: LaunchpadDeps): Promise<number> {
  const output = deps.output ?? process.stderr;
  const select = deps.select ?? clackLaunchpadSelect(output);
  const repaint = deps.repaint ?? isInteractive(output);
  const pause = deps.waitForKey ?? waitForKey;

  const writeHeader = (): void => {
    writeLine(output, LAUNCHPAD_TAGLINE);
    writeLine(output, formatReadinessLine(deps.state));
  };

  if (!repaint) {
    writeHeader();
  }

  for (;;) {
    if (repaint) {
      clearScreen(output);
      writeHeader();
    }
    // Rebuild every loop: a license activate/deactivate mutates `deps.state`, so
    // the menu rows (and header tier) must re-derive from the current state.
    const options = buildLaunchpadOptions(deps.state);
    const action = (await select({ message: "What would you like to do?", options })) ?? "quit";
    if ((await dispatchAction(deps, action, output)) === "quit") {
      return ExitCode.Success;
    }
    // Hold the action's output on screen until a keypress, before the next loop
    // wipes the screen and re-pins the menu at the top (interactive only).
    if (repaint && (await pause(output)) === "quit") {
      writeLine(output, "");
      writeLine(output, FLAGS_CHEATSHEET);
      return ExitCode.Success;
    }
  }
}
