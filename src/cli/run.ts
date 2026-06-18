/**
 * Pipeline orchestration + pre-pipeline gate band (Story 1.8).
 *
 * `runPipeline` takes the frozen `RunConfig` (no argv/env/prompts) plus injected
 * impure deps and drives `retrieve → analyze → narrate → assemble → render`,
 * writing the terminal report to stdout. It owns the two degraded-success exit
 * states the architecture reserves for the shell:
 *   - clean completion (narrated showpiece OR intentional metrics-only) → 0
 *   - substrate fallback (fail-open, narrative lost in `auto`)          → 9
 * Stage failures throw a typed `CommitWhisperError` (retrieve 4 · metrics 5 ·
 * narration-required 6 · render 7) and are mapped to an exit code at the CLI
 * shell (`cli.ts`).
 *
 * Gate band (license → preflight → retrieve), `aiMode`-gated:
 *   - `off`      → preflight skipped; narration not run (metrics-only)
 *   - `required` → an unreachable provider is a HARD fail (exit 6) before clone
 *   - `auto`     → an unreachable provider NEVER blocks; warn up front, skip the
 *                  doomed narrate call, and fail open to the substrate (exit 9)
 * The license slot is Epic 7 — `entitlement` already resolves to Free upstream,
 * so it is a no-op pass here.
 *
 * Every impure collaborator is injectable so the whole pipeline runs offline in
 * tests with fakes; the defaults wire the real adapters.
 */

import { analyze } from "../analyze/engine.js";
import { canonicalizeIdentity, emptyMailmap } from "../analyze/identity.js";
import type { MailmapIndex } from "../analyze/identity.js";
import type { AnalysisContext } from "../analyze/model.js";
import { projectSelection, selectCommitsWithNotice } from "../analyze/select.js";
import { reportFromOutcome } from "../assemble/report.js";
import type { RunConfig } from "../config/run-config.js";
import { createNarrate } from "../narrate/narrate.js";
import type { NarrateConfig, NarrateOutcome, NarratePort } from "../narrate/narrate.port.js";
import { preflightProvider } from "../narrate/preflight.js";
import { renderFormat } from "../render/render.js";
import { planOutputs, type OutputTarget } from "../render/output-plan.js";
import { createRetrieve } from "../retrieve/retrieve.js";
import type { RetrievePort, RawCommit } from "../retrieve/retrieve.port.js";
import { NarrationError, RenderError } from "../shared/errors.js";
import type { Secret } from "../shared/secret.js";
import { ui as defaultUi, type Ui } from "../shared/ui.js";
import { ExitCode } from "./exit-codes.js";
import { buildProvenance } from "./provenance.js";
import { VERSION } from "./version.js";
import { defaultWriteFile, type WriteFile } from "./write-file.js";
import { defaultOpenBrowser, type OpenBrowser } from "./open-browser.js";

export interface RunDeps {
  retrieve?: RetrievePort;
  narrate?: NarratePort;
  preflight?: typeof preflightProvider;
  /** The env-only LLM key, read by the shell (`config/env.ts`) and injected here. */
  aiKey?: Secret<string>;
  /** The env-only git PAT (Story 5.2), used only to authenticate a remote clone. */
  gitToken?: Secret<string>;
  fetchImpl?: typeof fetch;
  writeStdout?: (text: string) => void;
  /** Injected file writer (defaults to the real `node:fs/promises` writer) — the one new I/O edge. */
  writeFile?: WriteFile;
  /** Injected browser opener (defaults to the real cross-platform shell-out). */
  openBrowser?: OpenBrowser;
  /** Whether to auto-open a written HTML report (the shell sets this from `interactive && !--no-open`). */
  autoOpen?: boolean;
  ui?: Ui;
}

export async function runPipeline(config: RunConfig, deps: RunDeps = {}): Promise<number> {
  const retrieve = deps.retrieve ?? createRetrieve({ gitToken: deps.gitToken });
  const narrate = deps.narrate ?? createNarrate();
  const preflight = deps.preflight ?? preflightProvider;
  const ui = deps.ui ?? defaultUi;
  const writeStdout =
    deps.writeStdout ??
    ((text: string): void => {
      process.stdout.write(text);
    });
  const writeFile = deps.writeFile ?? defaultWriteFile;
  const openBrowser = deps.openBrowser ?? defaultOpenBrowser;
  const autoOpen = deps.autoOpen ?? false; // fail-closed: never open unless the shell enabled it

  const narrateConfig: NarrateConfig = {
    aiMode: config.aiMode,
    provider: config.provider,
    llmModel: config.llmModel,
    llmBaseUrl: config.llmBaseUrl,
    aiKey: deps.aiKey,
  };

  // — Gate band: license (Epic 7, Free no-op) → aiMode-gated preflight —
  const preflightReason = await runPreflight(config, narrateConfig, preflight, deps.fetchImpl, ui);

  // Headless metrics-only nudge (Story 6.4 AC3): when aiMode DEFAULTED to off
  // (headless/CI), not an explicit `--no-ai`, point the way to the narrative.
  if (config.aiMode === "off" && config.provenance.aiMode === "default") {
    ui.info("Running metrics-only — for the AI narrative, run interactively or set a provider key.");
  }

  // — Pipeline —
  const history = await retrieve(config); // RetrieveError → exit 4
  ui.debug?.(`Retrieved ${history.commits.length} commit(s) from ${history.repoTarget}.`);
  // Narrow the analyzed commit set per the selection inputs BEFORE analyze, so all
  // 32 catalog metrics compute over exactly the selected slice (Story 2.6); the
  // tier cap (Free 100) is composed into the same step and any truncation is
  // surfaced as stderr chrome — never into the byte-stable Report JSON (Story 2.7).
  const selection = selectCommitsWithNotice(history, projectSelection(config));
  if (selection.truncation !== undefined) {
    const { analyzed, total } = selection.truncation;
    ui.info(`Analyzed ${analyzed} of ${total} commits — Free tier cap`);
  }
  const ctx: AnalysisContext = {
    analysisTimestamp: config.analysisTimestamp,
    timezone: config.timezone,
    mailmap: emptyMailmap(), // real .mailmap ingestion is deferred
  };
  const analysis = analyze(selection.history, ctx); // MetricsError → exit 5
  ui.debug?.(`Analyzed ${selection.history.commits.length} commit(s); aiMode=${config.aiMode}.`);

  const outcome = await narrateOutcome(config, narrateConfig, analysis, narrate, preflightReason);
  // Build the FR-17 run-metadata subtree from facts the pipeline already holds.
  // It is sourced once here and emitted verbatim in the JSON; the assembler keeps
  // the `ai` field only when narration actually ran. Never touches `analysis`.
  const provenance = buildProvenance({
    target: config.repoTarget,
    branch: config.branch,
    totalCommits: history.commits.length,
    analyzedCommits: selection.history.commits.length,
    contributors: countContributors(selection.history.commits, ctx.mailmap),
    provider: config.provider,
    model: config.llmModel,
    generatedAt: config.analysisTimestamp,
    toolVersion: VERSION,
    tier: config.entitlement.tier,
    commitCap: config.entitlement.commitCap,
  });
  const report = reportFromOutcome(analysis, outcome, provenance);

  // — Render every selected format from the ONE report (no re-analysis, no second
  // LLM call) and emit each to its planned destination (Story 4.4). The default
  // ["terminal"] selection is one stdout target — back-compatible with 1.8. —
  const targets = planOutputs(config.outputFormats, config.outputPath); // UsageError (2) on ambiguous path
  const htmlFilePath = await emitOutputs(report, targets, { writeStdout, writeFile, ui });

  // — Auto-open the written HTML in a browser (Story 4.5) — only when the shell
  // enabled it (interactive && !--no-open) and an HTML FILE was actually written.
  // NON-FATAL: the file is on disk, so a browser that won't launch never fails the
  // run — it just prints the path. Runs AFTER all writes (a write failure pre-empts it).
  if (autoOpen && htmlFilePath !== undefined) {
    await tryOpen(openBrowser, htmlFilePath, ui);
  }

  return report.degraded ? ExitCode.Degraded : ExitCode.Success;
}

/**
 * Render every planned target from the ONE report and emit each to its destination
 * (Story 4.4); returns the written HTML path (if any) for the optional auto-open.
 */
async function emitOutputs(
  report: ReturnType<typeof reportFromOutcome>,
  targets: readonly OutputTarget[],
  io: { writeStdout: (text: string) => void; writeFile: WriteFile; ui: Ui },
): Promise<string | undefined> {
  let htmlFilePath: string | undefined;
  for (const target of targets) {
    const text = renderOne(report, target);
    if (target.destination.kind === "stdout") {
      io.writeStdout(text.endsWith("\n") ? text : `${text}\n`);
    } else {
      await writeOne(io.writeFile, target.destination.path, text, target.format, io.ui);
      if (target.format === "html") {
        htmlFilePath = target.destination.path; // the showpiece to auto-open (at most one)
      }
    }
  }
  return htmlFilePath;
}

/** Render one target's format, mapping any renderer throw to a `RenderError` (exit 7). */
function renderOne(report: ReturnType<typeof reportFromOutcome>, target: OutputTarget): string {
  try {
    return renderFormat(report, target.format);
  } catch (cause) {
    throw new RenderError(
      `Failed to render the ${target.format} report: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
}

/** Write one rendered file, mapping a write failure to a `RenderError` (exit 7) naming the path. */
async function writeOne(
  writeFile: WriteFile,
  path: string,
  text: string,
  format: OutputTarget["format"],
  ui: Ui,
): Promise<void> {
  try {
    await writeFile(path, text);
  } catch (cause) {
    throw new RenderError(
      `Failed to write the ${format} report to ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
  ui.info(`Wrote ${format} → ${path}`); // stderr run-summary chrome (stdout stays machine-clean)
}

/**
 * Try to open the written HTML report in a browser. NON-FATAL by design: the
 * artifact is already on disk, so a launch failure prints the path and the run
 * proceeds with its normal exit code — auto-open is a convenience, not a stage.
 */
async function tryOpen(openBrowser: OpenBrowser, path: string, ui: Ui): Promise<void> {
  try {
    await openBrowser(path);
    ui.info(`Opened ${path} in your browser`);
  } catch {
    ui.warn(`Could not open a browser automatically — open ${path} manually`);
  }
}

/**
 * Run the `aiMode`-gated provider preflight. Returns the failure reason when
 * `auto` narration is non-viable (so the caller fails open without a doomed
 * call); returns `undefined` when narration may proceed (or is `off`). Throws
 * `NarrationError` (exit 6) when a `required` provider is unreachable.
 */
async function runPreflight(
  config: RunConfig,
  narrateConfig: NarrateConfig,
  preflight: typeof preflightProvider,
  fetchImpl: typeof fetch | undefined,
  ui: Ui,
): Promise<string | undefined> {
  if (config.aiMode === "off") {
    return undefined; // no provider needed
  }
  const result = await preflight(narrateConfig, { fetchImpl });
  if (result.reachable) {
    return undefined;
  }
  if (config.aiMode === "required") {
    throw new NarrationError(`Provider preflight failed: ${result.reason}`);
  }
  // auto: fail open — surface the degraded reason up front (stderr chrome).
  ui.warn(`⚠ Narrative unavailable: ${result.reason}`);
  return result.reason;
}

/**
 * Resolve the narrate outcome. `off` ⇒ skipped (intentional metrics-only); a
 * non-viable `auto` preflight ⇒ degraded without a doomed call; otherwise run
 * the (itself fail-open) narrate stage.
 */
async function narrateOutcome(
  config: RunConfig,
  narrateConfig: NarrateConfig,
  analysis: ReturnType<typeof analyze>,
  narrate: NarratePort,
  preflightReason: string | undefined,
): Promise<NarrateOutcome> {
  if (config.aiMode === "off") {
    return { kind: "skipped" };
  }
  if (preflightReason !== undefined) {
    return { kind: "degraded", reason: preflightReason };
  }
  return narrate(analysis, narrateConfig); // required-mode failure throws NarrationError (exit 6)
}

/**
 * Count distinct contributors in the analyzed history for `provenance.scale`
 * (FR-17). Uses the SAME `canonicalizeIdentity` + `.mailmap` the engine applies in
 * `summarizeAuthors`, keyed identically (`email\x00name`), so the figure matches
 * `analyze`'s author set exactly — never a divergent re-count.
 */
function countContributors(commits: readonly RawCommit[], mailmap: MailmapIndex): number {
  const keys = new Set<string>();
  for (const commit of commits) {
    const identity = canonicalizeIdentity(commit.author, mailmap);
    keys.add(`${identity.email}\x00${identity.name}`);
  }
  return keys.size;
}
