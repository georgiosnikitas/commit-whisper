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
 *   4. maps any thrown `CommitSageError` to its exit code + a stderr message —
 *      and, for a missing-required-input failure, appends the redirect to bare
 *      `commit-sage` for guided setup (AC4) so a hard fail is never a dead end.
 *
 * The shell may touch argv / TTY / cwd, but NOT `process.env` directly (the
 * hexagonal lint boundary) — it captures the environment via `config`'s
 * `readProcessEnv` and injects it.
 */

import { Command, CommanderError } from "commander";

import { readAiKey, readEnvLayer, readGitToken, readProcessEnv } from "../config/env.js";
import { resolveRunConfig } from "../config/resolve-run-config.js";
import { detectCapability } from "../config/capability.js";
import type { OutputFormat, PartialRunConfig, Provider } from "../config/run-config.js";
import { execFileGitRunner, type GitRunner } from "../retrieve/git.js";
import { MissingRequiredConfigError, UsageError } from "../shared/errors.js";
import { ui as defaultUi, type Ui } from "../shared/ui.js";
import { exitCodeForError, ExitCode, messageForError } from "./exit-codes.js";
import { runLaunchpad, type LaunchpadState } from "./interactive.js";
import { readRepoContext } from "./repo-context.js";
import { runPipeline, type RunDeps } from "./run.js";

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
}

export interface CliDeps {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
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
}

export async function main(argv: string[], deps: CliDeps = {}): Promise<number> {
  const ui = deps.ui ?? defaultUi;
  const env = deps.env ?? readProcessEnv();
  const cwd = deps.cwd ?? process.cwd();
  const stdinIsTTY = deps.stdinIsTTY ?? process.stdin.isTTY;
  const stdoutIsTTY = deps.stdoutIsTTY ?? process.stdout.isTTY;
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
    return await resolveAndRun({
      flags,
      env,
      cwd,
      stdinIsTTY,
      stdoutIsTTY,
      analysisTimestamp: deps.analysisTimestamp ?? new Date().toISOString(),
      nonInteractive: true, // STRICT single-shot — never prompts
      openAllowed: opts.open !== false, // honoured only when interactive (false here)
      deps,
      ui,
    });
  } catch (err) {
    ui.error(messageForError(err));
    if (err instanceof MissingRequiredConfigError) {
      // AC4 — name the gap (above) AND redirect to the guided path, never a cliff.
      ui.error("Run `commit-sage` with no arguments for guided setup.");
    }
    return exitCodeForError(err);
  }
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
  deps: CliDeps;
  ui: Ui;
}

/**
 * The shared resolve → read-keys → run-pipeline tail used by BOTH the strict
 * single-shot path (`nonInteractive: true`) and the guided interactive run
 * (`nonInteractive: false`, Story 6.2). `autoOpen = interactive && openAllowed`,
 * so single-shot (never interactive) never auto-opens — behaviour-preserving.
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
  });
  const aiKey = readAiKey(input.env, config.provider);
  const gitToken = readGitToken(input.env); // env-only PAT for a private remote (Story 5.2)
  const { interactive } = detectCapability({
    nonInteractive: input.nonInteractive,
    stdinIsTTY: input.stdinIsTTY,
    stdoutIsTTY: input.stdoutIsTTY,
    env: input.env,
  });
  const autoOpen = interactive && input.openAllowed;
  const run = input.deps.run ?? runPipeline;
  return await run(config, {
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
      "commit-sage needs a repository argument when it is not run in an interactive terminal — " +
        "e.g. `commit-sage . --no-ai`, or `commit-sage --help` for all options.",
    );
    return ExitCode.Usage;
  }

  // The launchpad does no I/O: resolve the header snapshot here (env-configured
  // AI, repo context) and hand it over already resolved. Tier is Free / unlicensed
  // until the Epic 7 license gate supplies the real entitlement.
  const aiLayer = readEnvLayer(ctx.env);
  const repo = await readRepoContext(ctx.deps.gitRunner ?? execFileGitRunner, ctx.cwd);
  const state: LaunchpadState = {
    tier: "free",
    licensed: false,
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
      return await resolveAndRun({
        flags,
        env: ctx.env,
        cwd: ctx.cwd,
        stdinIsTTY: ctx.stdinIsTTY,
        stdoutIsTTY: ctx.stdoutIsTTY,
        analysisTimestamp: ctx.deps.analysisTimestamp ?? new Date().toISOString(),
        nonInteractive: false,
        openAllowed: true,
        deps: ctx.deps,
        ui: ctx.ui,
      });
    } catch (err) {
      ctx.ui.error(messageForError(err));
      return exitCodeForError(err);
    }
  };

  const launchpad = ctx.deps.launchpad ?? runLaunchpad;
  return await launchpad({
    state,
    helpText: buildProgram().helpInformation(),
    runAnalysis,
    gitTokenConfigured: readGitToken(ctx.env) !== undefined,
  });
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
    .name("commit-sage")
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
    .allowExcessArguments(false)
    .exitOverride() // the shell owns process exit, not commander
    .configureOutput({
      writeOut: (text) => {
        process.stderr.write(text); // help is human chrome → stderr (stdout stays machine-only)
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
