/**
 * The CLI shell — commander wiring + STRICT single-shot + error mapping (Story 1.8).
 *
 * `main` is the testable entry (`index.ts` is a 2-line bootstrap around it). It:
 *   1. parses argv with commander (any ≥1-arg invocation is STRICT single-shot —
 *      non-interactive regardless of TTY; the only interactive entry point, the
 *      0-arg TTY guided menu, is Epic 6),
 *   2. resolves the frozen `RunConfig` (the one real clock read happens here and
 *      is injected, keeping the pipeline pure) and reads the env-only LLM key,
 *   3. drives `runPipeline` and returns its exit code,
 *   4. maps any thrown `CommitWhisperError` to its exit code + a stderr message —
 *      and, for a missing-required-input failure, appends the redirect to bare
 *      `commit-whisper` for guided setup (AC4) so a hard fail is never a dead end.
 *
 * The shell may touch argv / TTY / cwd, but NOT `process.env` directly (the
 * hexagonal lint boundary) — it captures the environment via `config`'s
 * `readProcessEnv` and injects it.
 */

import { hostname } from "node:os";

import { Command, CommanderError } from "commander";

import { readAiKey, readEnvDiagnostics, readEnvLayer, readGitToken, readLicenseKey, readProcessEnv } from "../config/env.js";
import { readSettings, writeSettings } from "../config/config-store.js";
import { resolveRunConfig } from "../config/resolve-run-config.js";
import { detectCapability } from "../config/capability.js";
import type { Entitlement, OutputFormat, PartialRunConfig, Provider, RunConfig } from "../config/run-config.js";
import type { NarrateConfig } from "../narrate/narrate.port.js";
import { preflightProvider } from "../narrate/preflight.js";
import { resolveEntitlement, type EntitlementResolution } from "../license/gate.js";
import {
  activateLicense,
  deactivateLicense,
  type ActivationOutcome,
  type DeactivationOutcome,
} from "../license/actions.js";
import {
  createLemonSqueezyActivator,
  createLemonSqueezyDeactivator,
  createLemonSqueezyValidator,
} from "../license/lemonsqueezy.js";
import {
  clearLicenseCache,
  readActivationInstanceId,
  readCachedLicenseKey,
  writeLicenseCache,
} from "../license/store.js";
import { FREE_ENTITLEMENT } from "../license/tiers.js";
import { execFileGitRunner, type GitRunner } from "../retrieve/git.js";
import { defaultOpenBrowser } from "./open-browser.js";
import { LicenseError, MissingRequiredConfigError, UsageError } from "../shared/errors.js";
import { createUi, resolveColor, resolveLogLevel, type Ui } from "../shared/ui.js";
import { exitCodeForError, ExitCode, messageForError } from "./exit-codes.js";
import { runLaunchpad, type LaunchpadState, type Reachability } from "./interactive.js";
import { readRepoContext } from "./repo-context.js";
import { runPipeline, type RunDeps } from "./run.js";
import { formatShowConfig } from "./show-config.js";
import { VERSION } from "./version.js";

const PROVIDERS: readonly Provider[] = ["ollama", "openai", "gemini", "anthropic", "openai-compatible"];
const OUTPUT_FORMATS: readonly OutputFormat[] = ["terminal", "html", "markdown", "json"];

interface CliOptions {
  ai?: boolean; // undefined = resolver default; true = required; false = off
  provider?: string;
  model?: string;
  baseUrl?: string;
  timezone?: string;
  // — output (Story 4.4) —
  format?: string; // comma-separated list, parsed + validated in buildFlags
  output?: string; // file path for the single file format; "-" = stdout
  open?: boolean; // commander `--no-open` negation: false ⟺ --no-open passed (Story 4.5)
  // — commit-selection inputs (Story 2.6) —
  merges?: boolean; // commander `--no-merges` negation: false ⟺ --no-merges passed
  maxCommits?: string; // parsed to a positive int in buildFlags
  author?: string;
  since?: string;
  until?: string;
  // — operational flags (Story 6.4) —
  showConfig?: boolean; // print the resolved config (+ provenance) and exit
  nonInteractive?: boolean; // force strict single-shot (the gate closed even in a TTY)
  verbose?: boolean; // more detailed stderr logging
  quiet?: boolean; // errors + warnings only on stderr
}

export interface CliDeps {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  stderrIsTTY?: boolean;
  analysisTimestamp?: string;
  ui?: Ui;
  writeStdout?: (text: string) => void;
  /** Inject a fake pipeline to isolate shell logic; defaults to the real `runPipeline`. */
  run?: typeof runPipeline;
  /** Inject pipeline collaborators (used by the e2e test to exercise the real `runPipeline`). */
  runDeps?: RunDeps;
  /** Inject a fake git for the launchpad header's branch read; defaults to `execFileGitRunner`. */
  gitRunner?: GitRunner;
  /** Inject a fake launchpad to isolate the 0-arg shell wiring; defaults to the real `runLaunchpad`. */
  launchpad?: typeof runLaunchpad;
  /** Inject a fake provider preflight for the Status/doctor probe; defaults to the real `preflightProvider`. */
  preflight?: typeof preflightProvider;
  /** Inject the persisted config-file layer (Story 6.5); defaults to reading `~/.commit-whisper`. */
  configFile?: PartialRunConfig;
  /** Inject the resolved license outcome (Story 7.1/7.3); defaults to the online Lemon Squeezy gate. */
  resolveEntitlement?: (env: NodeJS.ProcessEnv) => Promise<EntitlementResolution>;
  /** Inject the launchpad's license-activate action (Story 7.2); defaults to the online activate + cache. */
  activateLicense?: (env: NodeJS.ProcessEnv, licenseKey: string) => Promise<ActivationOutcome>;
  /** Inject the launchpad's license-deactivate action (Story 7.2); defaults to the online deactivate + clear. */
  deactivateLicense?: (env: NodeJS.ProcessEnv) => Promise<DeactivationOutcome>;
  /** Inject the browser opener for the license hand-offs (Story 7.2); defaults to `defaultOpenBrowser`. */
  openUrl?: (url: string) => Promise<void>;
}

/**
 * The default license gate (Story 7.1 · cached-key read Story 7.2): the online
 * Lemon Squeezy validator. No license key ⇒ resolved Free with no network call;
 * a key (env, else the cached key from a one-time Activate) ⇒ validate + map the
 * tier; an unconfirmable key ⇒ `unverified` (the shell decides fail-closed vs
 * degrade, Story 7.3).
 */
async function defaultResolveEntitlement(env: NodeJS.ProcessEnv): Promise<EntitlementResolution> {
  return resolveEntitlement({
    licenseKey: readLicenseKey(env) ?? (await readCachedLicenseKey(env)),
    validate: createLemonSqueezyValidator(),
    readInstanceId: () => readActivationInstanceId(env),
  });
}

/**
 * The headless fail-closed message (Story 7.3 AC1). Carries the CI
 * validate-not-activate guidance: the key is supplied via the env var and
 * validated (never re-activated), so a multi-repo matrix does not exhaust
 * activations.
 */
function licenseFailClosedMessage(reason: string): string {
  return (
    `License validation failed: ${reason} ` +
    "commit-whisper did not run because it could not confirm your license. " +
    "Set a valid COMMIT_WHISPER_LICENSE_KEY — in CI the key is validated via the " +
    "environment variable and never consumes a device activation."
  );
}

/** The interactive degrade notice (Story 7.3 AC2) — friendly, never refuses to run. */
const LICENSE_DEGRADE_NOTICE =
  "Could not validate your license right now — running under the Free 100-commit cap. " +
  "Paid features resume once validation succeeds.";

/**
 * Apply the headless fail-closed policy to a gate outcome (Story 7.3 AC1). An
 * `unverified` license in a headless/CI run THROWS `LicenseError` (exit 8) —
 * no analysis, no rendering. A `resolved` outcome yields its entitlement. The
 * interactive path does NOT use this (it degrades instead — see `runZeroArg`).
 */
function entitlementForHeadlessRun(resolution: EntitlementResolution): Entitlement {
  if (resolution.kind === "unverified") {
    throw new LicenseError(licenseFailClosedMessage(resolution.reason));
  }
  return resolution.entitlement;
}

/** Default Activate (Story 7.2): activate online + cache the instance id & key. */
function defaultActivateLicense(env: NodeJS.ProcessEnv, licenseKey: string): Promise<ActivationOutcome> {
  return activateLicense({
    licenseKey,
    instanceName: hostname(),
    activate: createLemonSqueezyActivator(),
    persist: (cache) => writeLicenseCache(env, cache).then(() => undefined),
  });
}

/** Default Deactivate (Story 7.2): free the activation online + clear the cache. */
async function defaultDeactivateLicense(env: NodeJS.ProcessEnv): Promise<DeactivationOutcome> {
  return deactivateLicense({
    licenseKey: readLicenseKey(env) ?? (await readCachedLicenseKey(env)),
    instanceId: await readActivationInstanceId(env),
    deactivate: createLemonSqueezyDeactivator(),
    clear: () => clearLicenseCache(env),
  });
}

export async function main(argv: string[], deps: CliDeps = {}): Promise<number> {
  const env = deps.env ?? readProcessEnv();
  const cwd = deps.cwd ?? process.cwd();
  const stdinIsTTY = deps.stdinIsTTY ?? process.stdin.isTTY;
  const stdoutIsTTY = deps.stdoutIsTTY ?? process.stdout.isTTY;
  const stderrIsTTY = deps.stderrIsTTY ?? process.stderr.isTTY;
  // The bootstrap `ui` honours env-only chrome policy (NO_COLOR/FORCE_COLOR,
  // COMMIT_WHISPER_LOG_LEVEL) — used for the 0-arg launchpad and any pre-parse
  // error. The single-shot run rebuilds a flag-aware `ui` after parsing.
  const ui =
    deps.ui ??
    createUi(process.stderr, {
      level: resolveLogLevel({ env }),
      color: resolveColor({ env, isTTY: Boolean(stderrIsTTY) }),
    });
  try {
    if (argv.length === 0) {
      // The sole interactive entry point: the bare zero-arg command in a TTY
      // opens the launchpad (Story 6.1); a non-TTY / CI 0-arg fails fast.
      return await runZeroArg({ deps, ui, env, cwd, stdinIsTTY, stdoutIsTTY });
    }

    const program = buildProgram();
    try {
      program.parse(argv, { from: "user" });
    } catch (err) {
      return resolveCommanderError(err);
    }

    const opts = program.opts<CliOptions>();
    const flags = buildFlags(program.args[0], opts);
    const analysisTimestamp = deps.analysisTimestamp ?? new Date().toISOString();
    // The persisted Settings (Story 6.5) re-enter at the config-file layer; the
    // resolver precedence (defaults < configFile < env < flags) is unchanged.
    const configFile = deps.configFile ?? (await readSettings(env));
    // Gate band (Story 7.1/7.3): resolve the license outcome online at startup.
    // No key ⇒ resolved Free (no network). An unconfirmable key ⇒ `unverified`,
    // which the HEADLESS single-shot run fails closed on (exit 8) below — but
    // `--show-config` stays lenient (it dumps the degraded Free tier).
    const resolution = await (deps.resolveEntitlement ?? defaultResolveEntitlement)(env);

    // `--show-config`: dump the resolved config + provenance to stdout and exit
    // WITHOUT running (AC1). Resolved LENIENTLY so it always dumps — even when a
    // required field is missing (the very thing a user runs it to diagnose);
    // missing fields render as `(unset)`. Secrets render as `***`. An unverified
    // license is NOT a fail-closed here — it dumps as the degraded `tier = free`.
    if (opts.showConfig === true) {
      const entitlement = resolution.kind === "resolved" ? resolution.entitlement : FREE_ENTITLEMENT;
      const config = resolveRunConfig({
        cwd,
        env,
        stdinIsTTY,
        stdoutIsTTY,
        nonInteractive: true,
        analysisTimestamp,
        flags,
        configFile,
        entitlement,
        lenient: true,
      });
      const dump = formatShowConfig(config, {
        aiKey: readAiKey(env, config.provider),
        gitPat: readGitToken(env),
      });
      writeStdout(deps, `${dump}\n`);
      return ExitCode.Success;
    }

    // STRICT single-shot is headless: an unverified license FAILS CLOSED (exit 8,
    // no analysis/rendering) — `entitlementForHeadlessRun` throws `LicenseError`,
    // which the outer catch maps to its code (AC1). A resolved outcome runs.
    const entitlement = entitlementForHeadlessRun(resolution);

    // The run `ui` honours the verbosity flags (`--verbose`/`--quiet`) on top of
    // the env colour policy — stderr only, never stdout.
    const runUi =
      deps.ui ??
      createUi(process.stderr, {
        level: resolveLogLevel({ verbose: opts.verbose, quiet: opts.quiet, env }),
        color: resolveColor({ env, isTTY: Boolean(stderrIsTTY) }),
      });

    const config = resolveRunConfig({
      cwd,
      env,
      stdinIsTTY,
      stdoutIsTTY,
      nonInteractive: true, // STRICT single-shot — never prompts (--non-interactive only confirms this)
      analysisTimestamp,
      flags,
      configFile,
      entitlement,
    });

    return await runResolved({
      config,
      env,
      stdinIsTTY,
      stdoutIsTTY,
      nonInteractive: true, // STRICT single-shot — the gate stays closed
      openAllowed: opts.open !== false, // honoured only when interactive (false here)
      deps,
      ui: runUi,
    });
  } catch (err) {
    ui.error(messageForError(err));
    if (err instanceof MissingRequiredConfigError) {
      // AC4 — name the gap (above) AND redirect to the guided path, never a cliff.
      ui.error("Run `commit-whisper` with no arguments for guided setup.");
    }
    return exitCodeForError(err);
  }
}

/** Write to stdout via the injected sink, or `process.stdout`. */
function writeStdout(deps: CliDeps, text: string): void {
  if (deps.writeStdout !== undefined) {
    deps.writeStdout(text);
    return;
  }
  process.stdout.write(text);
}

interface ResolveAndRunInput {
  flags: PartialRunConfig;
  env: NodeJS.ProcessEnv;
  cwd: string;
  stdinIsTTY: boolean | undefined;
  stdoutIsTTY: boolean | undefined;
  analysisTimestamp: string;
  nonInteractive: boolean;
  /** Allow HTML auto-open — honoured only when the run resolves interactive. */
  openAllowed: boolean;
  /** The persisted config-file layer (Story 6.5). */
  configFile?: PartialRunConfig;
  /** The resolved license entitlement (Story 7.1). */
  entitlement?: Entitlement;
  deps: CliDeps;
  ui: Ui;
}

/**
 * Resolve the `RunConfig` from `flags`, then run the pipeline. Used by the
 * guided interactive run (`nonInteractive: false`, Story 6.2). The single-shot
 * path resolves the config itself (so `--show-config` can dump it without
 * running) and calls `runResolved` directly.
 */
async function resolveAndRun(input: ResolveAndRunInput): Promise<number> {
  const config = resolveRunConfig({
    cwd: input.cwd,
    env: input.env,
    stdinIsTTY: input.stdinIsTTY,
    stdoutIsTTY: input.stdoutIsTTY,
    nonInteractive: input.nonInteractive,
    analysisTimestamp: input.analysisTimestamp,
    flags: input.flags,
    configFile: input.configFile,
    entitlement: input.entitlement,
  });
  return await runResolved({
    config,
    env: input.env,
    stdinIsTTY: input.stdinIsTTY,
    stdoutIsTTY: input.stdoutIsTTY,
    nonInteractive: input.nonInteractive,
    openAllowed: input.openAllowed,
    deps: input.deps,
    ui: input.ui,
  });
}

interface RunResolvedInput {
  config: RunConfig;
  env: NodeJS.ProcessEnv;
  stdinIsTTY: boolean | undefined;
  stdoutIsTTY: boolean | undefined;
  nonInteractive: boolean;
  /** Allow HTML auto-open — honoured only when the run resolves interactive. */
  openAllowed: boolean;
  deps: CliDeps;
  ui: Ui;
}

/**
 * The read-keys → run-pipeline tail over an ALREADY-RESOLVED config.
 * `autoOpen = interactive && openAllowed`, so the strict single-shot path (whose
 * capability gate is closed) never auto-opens — behaviour-preserving.
 */
async function runResolved(input: RunResolvedInput): Promise<number> {
  const aiKey = readAiKey(input.env, input.config.provider);
  const gitToken = readGitToken(input.env); // env-only PAT for a private remote (Story 5.2)
  const { interactive } = detectCapability({
    nonInteractive: input.nonInteractive,
    stdinIsTTY: input.stdinIsTTY,
    stdoutIsTTY: input.stdoutIsTTY,
    env: input.env,
  });
  const autoOpen = interactive && input.openAllowed;
  const run = input.deps.run ?? runPipeline;
  return await run(input.config, {
    aiKey,
    gitToken,
    ui: input.ui,
    writeStdout: input.deps.writeStdout,
    autoOpen,
    ...input.deps.runDeps,
  });
}

interface ZeroArgContext {
  deps: CliDeps;
  ui: Ui;
  env: NodeJS.ProcessEnv;
  cwd: string;
  stdinIsTTY: boolean | undefined;
  stdoutIsTTY: boolean | undefined;
}

/**
 * The bare zero-argument path (Story 6.1). In an interactive TTY it opens the
 * launchpad; in a non-TTY / CI context it fails fast with a typed usage error
 * (the STRICT truth table's "0 args + non-TTY" row), naming the fix. This is the
 * ONLY path in the product allowed to go interactive (`nonInteractive: false`).
 */
async function runZeroArg(ctx: ZeroArgContext): Promise<number> {
  const { interactive } = detectCapability({
    nonInteractive: false,
    stdinIsTTY: ctx.stdinIsTTY,
    stdoutIsTTY: ctx.stdoutIsTTY,
    env: ctx.env,
  });
  if (!interactive) {
    ctx.ui.error(
      "commit-whisper needs a repository argument when it is not run in an interactive terminal — " +
        "e.g. `commit-whisper . --no-ai`, or `commit-whisper --help` for all options.",
    );
    return ExitCode.Usage;
  }

  // The launchpad does no I/O of its own: resolve the header snapshot here (the
  // configured AI = the persisted Settings overlaid by env, the resolver's
  // precedence) and the real license tier (Story 7.1 — Free if no key/offline).
  const configFile = ctx.deps.configFile ?? (await readSettings(ctx.env));
  // Gate band (Story 7.1/7.3): the interactive path NEVER fails closed — an
  // unverified license DEGRADES to the Free cap with a clear notice, so the
  // launchpad always opens (AC2). The subsequent guided run then surfaces the
  // existing 2.7 "Analyzed N of M — Free tier cap" line.
  const resolution = await (ctx.deps.resolveEntitlement ?? defaultResolveEntitlement)(ctx.env);
  const entitlement = resolution.kind === "resolved" ? resolution.entitlement : FREE_ENTITLEMENT;
  if (resolution.kind === "unverified") {
    ctx.ui.warn(LICENSE_DEGRADE_NOTICE);
  }
  const envLayer = readEnvLayer(ctx.env);
  // config < env: a saved provider/model shows in the header (and cures the
  // no-AI state), but an env var still wins — mirroring the resolver.
  const aiLayer = {
    provider: envLayer.provider ?? configFile.provider,
    llmModel: envLayer.llmModel ?? configFile.llmModel,
    llmBaseUrl: envLayer.llmBaseUrl ?? configFile.llmBaseUrl,
  };
  const repo = await readRepoContext(ctx.deps.gitRunner ?? execFileGitRunner, ctx.cwd);
  const state: LaunchpadState = {
    tier: entitlement.tier,
    licensed: entitlement.tier !== "free",
    provider: aiLayer.provider,
    llmModel: aiLayer.llmModel,
    cwdLabel: collapseHome(ctx.cwd, ctx.env.HOME),
    isRepo: repo.isRepo,
    branch: repo.branch,
  };

  // The guided-run executor (Story 6.2): resolve + run the pipeline per guided
  // run (interactive ⇒ aiMode auto, autoOpen on). A pipeline throw surfaces
  // calmly and returns its exit code so the menu never dead-ends.
  const runAnalysis = async (flags: PartialRunConfig): Promise<number> => {
    try {
      // Re-read the persisted Settings per run so a provider/model chosen in this
      // same session's Settings screen takes effect immediately (no restart).
      const liveConfigFile = ctx.deps.configFile ?? (await readSettings(ctx.env));
      return await resolveAndRun({
        flags,
        env: ctx.env,
        cwd: ctx.cwd,
        stdinIsTTY: ctx.stdinIsTTY,
        stdoutIsTTY: ctx.stdoutIsTTY,
        analysisTimestamp: ctx.deps.analysisTimestamp ?? new Date().toISOString(),
        nonInteractive: false,
        openAllowed: true,
        configFile: liveConfigFile,
        entitlement,
        deps: ctx.deps,
        ui: ctx.ui,
      });
    } catch (err) {
      ctx.ui.error(messageForError(err));
      return exitCodeForError(err);
    }
  };

  // Status/doctor diagnostics (Story 6.3): the env-var presence list (names only)
  // and an async reachability probe wrapping `preflightProvider`. `aiMode: "auto"`
  // forces a real probe regardless of the user's resolved mode.
  const envDiagnostics = readEnvDiagnostics(ctx.env, aiLayer.provider);
  const probeReachability = async (): Promise<Reachability> => {
    const narrateConfig: NarrateConfig = {
      aiMode: "auto",
      provider: aiLayer.provider,
      llmModel: aiLayer.llmModel,
      llmBaseUrl: aiLayer.llmBaseUrl,
      aiKey: readAiKey(ctx.env, aiLayer.provider),
    };
    const result = await (ctx.deps.preflight ?? preflightProvider)(narrateConfig, {});
    return result.reachable ? { kind: "reachable" } : { kind: "unreachable", reason: result.reason };
  };

  const launchpad = ctx.deps.launchpad ?? runLaunchpad;
  return await launchpad({
    state,
    helpText: buildProgram().helpInformation(),
    runAnalysis,
    gitTokenConfigured: readGitToken(ctx.env) !== undefined,
    envDiagnostics,
    probeReachability,
    loadSettings: () => readSettings(ctx.env),
    saveSettings: (data) => writeSettings(ctx.env, data),
    // Re-resolve the live AI provider/model after a Settings save (config < env,
    // mirroring the resolver) so a mid-session change cures the no-AI state and
    // refreshes the header without restarting the launchpad.
    reloadAiState: async () => {
      const liveConfigFile = ctx.deps.configFile ?? (await readSettings(ctx.env));
      const liveEnv = readEnvLayer(ctx.env);
      return {
        provider: liveEnv.provider ?? liveConfigFile.provider,
        llmModel: liveEnv.llmModel ?? liveConfigFile.llmModel,
      };
    },
    // License actions (Story 7.2): the only in-app key entry + the browser hand-offs.
    activateLicense: (key) => (ctx.deps.activateLicense ?? defaultActivateLicense)(ctx.env, key),
    deactivateLicense: () => (ctx.deps.deactivateLicense ?? defaultDeactivateLicense)(ctx.env),
    openUrl: ctx.deps.openUrl ?? defaultOpenBrowser,
    storeUrl: readUrl(ctx.env.COMMIT_WHISPER_STORE_URL),
    restoreUrl: readUrl(ctx.env.COMMIT_WHISPER_RESTORE_URL),
    coffeeUrl: readUrl(ctx.env.COMMIT_WHISPER_COFFEE_URL),
  });
}

/** A trimmed non-empty URL override, or `undefined` (the launchpad uses its default). */
function readUrl(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  return v === undefined || v === "" ? undefined : v;
}

/** Collapse a leading `$HOME` to `~` for a calmer cwd display. Pure; passthrough when unset. */
function collapseHome(cwd: string, home: string | undefined): string {
  if (home !== undefined && home !== "" && (cwd === home || cwd.startsWith(`${home}/`))) {
    return `~${cwd.slice(home.length)}`;
  }
  return cwd;
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name("commit-whisper")
    .description("Deterministic git history analysis with a grounded, BYOK AI narrative.")
    .argument("[repoTarget]", "local repo path or remote URL (defaults to the current directory)")
    .option("--ai", "require AI narration (fail hard if the provider is unavailable)")
    .option("--no-ai", "skip AI narration; render the metrics-only substrate")
    .option("--provider <name>", "AI provider (e.g. gemini, ollama)")
    .option("--model <name>", "LLM model id")
    .option("--base-url <url>", "LLM base URL (ollama / openai-compatible)")
    .option("--timezone <tz>", "IANA timezone for bucketing + date bounds (default UTC)")
    .option("--format <list>", "one or more of terminal,html,markdown,json (comma-separated)")
    .option("-o, --output <path>", "output path for the single file format ('-' = stdout)")
    .option("--no-open", "do not auto-open the HTML report in a browser")
    .option("--no-merges", "exclude merge commits from the analysis")
    .option("--max-commits <count>", "analyze only the most-recent N commits")
    .option("--author <text>", "only commits whose author name or email contains this text")
    .option("--since <date>", "only commits on or after this date (YYYY-MM-DD)")
    .option("--until <date>", "only commits on or before this date (YYYY-MM-DD)")
    .option("--show-config", "print the resolved configuration (with provenance) and exit")
    .option("--non-interactive", "force strict single-shot even in a TTY")
    .option("--verbose", "more detailed stderr logging")
    .option("--quiet", "errors and warnings only on stderr")
    .version(VERSION, "--version", "print the version and exit")
    .allowExcessArguments(false)
    .exitOverride() // the shell owns process exit, not commander
    .configureOutput({
      writeOut: (text) => {
        process.stderr.write(text); // help/version are human chrome → stderr (stdout stays machine-only)
      },
      writeErr: () => {}, // suppressed — the shell surfaces a typed UsageError instead
    });
  return program;
}

function buildFlags(repoTarget: string | undefined, opts: CliOptions): PartialRunConfig {
  const flags: PartialRunConfig = {};
  if (repoTarget !== undefined) {
    flags.repoTarget = repoTarget;
  }
  applyAiFlags(flags, opts);
  applyOutputFlags(flags, opts);
  applySelectionFlags(flags, opts);
  return flags;
}

/** AI-cluster flags: `--ai`/`--no-ai`, `--provider`, `--model`, `--base-url`, `--timezone`. */
function applyAiFlags(flags: PartialRunConfig, opts: CliOptions): void {
  if (opts.ai === true) {
    flags.aiMode = "required";
  } else if (opts.ai === false) {
    flags.aiMode = "off";
  }
  if (opts.provider !== undefined) {
    if (!PROVIDERS.includes(opts.provider as Provider)) {
      throw new UsageError(`Unknown provider "${opts.provider}". Expected one of: ${PROVIDERS.join(", ")}.`);
    }
    flags.provider = opts.provider as Provider;
  }
  if (opts.model !== undefined) {
    flags.llmModel = opts.model;
  }
  if (opts.baseUrl !== undefined) {
    flags.llmBaseUrl = opts.baseUrl;
  }
  if (opts.timezone !== undefined) {
    flags.timezone = opts.timezone;
  }
}

/** Output flags (Story 4.4): `--format <list>`, `--output <path>`. */
function applyOutputFlags(flags: PartialRunConfig, opts: CliOptions): void {
  if (opts.format !== undefined) {
    flags.outputFormats = parseFormats(opts.format);
  }
  if (opts.output !== undefined) {
    const trimmed = opts.output.trim();
    if (trimmed === "") {
      throw new UsageError("Invalid --output: expected a file path or '-' for stdout.");
    }
    flags.outputPath = trimmed;
  }
}

/** Commit-selection inputs (Story 2.6): `--no-merges`, `--max-commits`, `--author`, `--since`, `--until`. */
function applySelectionFlags(flags: PartialRunConfig, opts: CliOptions): void {
  if (opts.merges === false) {
    flags.noMerges = true; // `--no-merges` passed (default `true` means not negated)
  }
  if (opts.maxCommits !== undefined) {
    // Decimal positive integer only (reject `abc`, `1.5`, `0x10`, `1e3`, `-3`, `0`).
    if (!/^\d+$/.test(opts.maxCommits.trim()) || Number(opts.maxCommits) <= 0) {
      throw new UsageError(`Invalid --max-commits "${opts.maxCommits}". Expected a positive integer.`);
    }
    flags.maxCommits = Number(opts.maxCommits.trim());
  }
  if (opts.author !== undefined) {
    flags.authorFilter = opts.author;
  }
  if (opts.since !== undefined) {
    flags.startDate = validateDateFlag("--since", opts.since);
  }
  if (opts.until !== undefined) {
    flags.endDate = validateDateFlag("--until", opts.until);
  }
}

/** Require a `YYYY-MM-DD`-shaped date flag (a full ISO timestamp is allowed); else a usage error. */
function validateDateFlag(flag: string, value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    throw new UsageError(`Invalid ${flag} "${value}". Expected a date in YYYY-MM-DD format.`);
  }
  return value;
}

/** Parse + validate the `--format` comma list against the closed enum (de-duped, ≥1). */
function parseFormats(raw: string): OutputFormat[] {
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token !== "");
  const formats: OutputFormat[] = [];
  for (const token of tokens) {
    if (!OUTPUT_FORMATS.includes(token as OutputFormat)) {
      throw new UsageError(`Unknown format "${token}". Expected one or more of: ${OUTPUT_FORMATS.join(", ")}.`);
    }
    if (!formats.includes(token as OutputFormat)) {
      formats.push(token as OutputFormat);
    }
  }
  if (formats.length === 0) {
    throw new UsageError(`Invalid --format: expected one or more of: ${OUTPUT_FORMATS.join(", ")}.`);
  }
  return formats;
}

/** Help / version are clean exits; any other commander error is a usage error (exit 2). */
function resolveCommanderError(err: unknown): number {
  if (err instanceof CommanderError) {
    if (
      err.code === "commander.helpDisplayed" ||
      err.code === "commander.help" ||
      err.code === "commander.version"
    ) {
      return ExitCode.Success;
    }
    throw new UsageError(err.message.trim() === "" ? "Invalid usage." : err.message);
  }
  throw err;
}
