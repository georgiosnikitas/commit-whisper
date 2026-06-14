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

import { readAiKey, readProcessEnv } from "../config/env.js";
import { resolveRunConfig } from "../config/resolve-run-config.js";
import type { OutputFormat, PartialRunConfig, Provider } from "../config/run-config.js";
import { MissingRequiredConfigError, UsageError } from "../shared/errors.js";
import { ui as defaultUi, type Ui } from "../shared/ui.js";
import { exitCodeForError, ExitCode, messageForError } from "./exit-codes.js";
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
}

export async function main(argv: string[], deps: CliDeps = {}): Promise<number> {
  const ui = deps.ui ?? defaultUi;
  try {
    if (argv.length === 0) {
      // STRICT: the sole interactive entry point (0-arg TTY guided setup) is Epic 6.
      ui.info(
        "commit-sage: interactive guided setup is not yet available. " +
          "Run with arguments — e.g. `commit-sage . --no-ai` — or `commit-sage --help`.",
      );
      return ExitCode.Usage;
    }

    const program = buildProgram();
    try {
      program.parse(argv, { from: "user" });
    } catch (err) {
      return resolveCommanderError(err);
    }

    const opts = program.opts<CliOptions>();
    const flags = buildFlags(program.args[0], opts);
    const env = deps.env ?? readProcessEnv();
    const config = resolveRunConfig({
      cwd: deps.cwd ?? process.cwd(),
      env,
      stdinIsTTY: deps.stdinIsTTY ?? process.stdin.isTTY,
      stdoutIsTTY: deps.stdoutIsTTY ?? process.stdout.isTTY,
      nonInteractive: true, // STRICT single-shot — never prompts
      analysisTimestamp: deps.analysisTimestamp ?? new Date().toISOString(),
      flags,
    });
    const aiKey = readAiKey(env, config.provider);
    const run = deps.run ?? runPipeline;
    return await run(config, { aiKey, ui, writeStdout: deps.writeStdout, ...deps.runDeps });
  } catch (err) {
    ui.error(messageForError(err));
    if (err instanceof MissingRequiredConfigError) {
      // AC4 — name the gap (above) AND redirect to the guided path, never a cliff.
      ui.error("Run `commit-sage` with no arguments for guided setup.");
    }
    return exitCodeForError(err);
  }
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
