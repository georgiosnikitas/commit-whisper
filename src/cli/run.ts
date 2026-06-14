/**
 * Pipeline orchestration + pre-pipeline gate band (Story 1.8).
 *
 * `runPipeline` takes the frozen `RunConfig` (no argv/env/prompts) plus injected
 * impure deps and drives `retrieve → analyze → narrate → assemble → render`,
 * writing the terminal report to stdout. It owns the two degraded-success exit
 * states the architecture reserves for the shell:
 *   - clean completion (narrated showpiece OR intentional metrics-only) → 0
 *   - substrate fallback (fail-open, narrative lost in `auto`)          → 9
 * Stage failures throw a typed `CommitSageError` (retrieve 4 · metrics 5 ·
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
import { emptyMailmap } from "../analyze/identity.js";
import type { AnalysisContext } from "../analyze/model.js";
import { projectSelection, selectCommitsWithNotice } from "../analyze/select.js";
import { reportFromOutcome } from "../assemble/report.js";
import type { RunConfig } from "../config/run-config.js";
import { createNarrate } from "../narrate/narrate.js";
import type { NarrateConfig, NarrateOutcome, NarratePort } from "../narrate/narrate.port.js";
import { preflightProvider } from "../narrate/preflight.js";
import { renderFormat } from "../render/render.js";
import { planOutputs, type OutputTarget } from "../render/output-plan.js";
import { createLocalRetrieve } from "../retrieve/local.js";
import type { RetrievePort } from "../retrieve/retrieve.port.js";
import { NarrationError, RenderError } from "../shared/errors.js";
import type { Secret } from "../shared/secret.js";
import { ui as defaultUi, type Ui } from "../shared/ui.js";
import { ExitCode } from "./exit-codes.js";
import { defaultWriteFile, type WriteFile } from "./write-file.js";

export interface RunDeps {
  retrieve?: RetrievePort;
  narrate?: NarratePort;
  preflight?: typeof preflightProvider;
  /** The env-only LLM key, read by the shell (`config/env.ts`) and injected here. */
  aiKey?: Secret<string>;
  fetchImpl?: typeof fetch;
  writeStdout?: (text: string) => void;
  /** Injected file writer (defaults to the real `node:fs/promises` writer) — the one new I/O edge. */
  writeFile?: WriteFile;
  ui?: Ui;
}

export async function runPipeline(config: RunConfig, deps: RunDeps = {}): Promise<number> {
  const retrieve = deps.retrieve ?? createLocalRetrieve();
  const narrate = deps.narrate ?? createNarrate();
  const preflight = deps.preflight ?? preflightProvider;
  const ui = deps.ui ?? defaultUi;
  const writeStdout =
    deps.writeStdout ??
    ((text: string): void => {
      process.stdout.write(text);
    });
  const writeFile = deps.writeFile ?? defaultWriteFile;

  const narrateConfig: NarrateConfig = {
    aiMode: config.aiMode,
    provider: config.provider,
    llmModel: config.llmModel,
    llmBaseUrl: config.llmBaseUrl,
    aiKey: deps.aiKey,
  };

  // — Gate band: license (Epic 7, Free no-op) → aiMode-gated preflight —
  const preflightReason = await runPreflight(config, narrateConfig, preflight, deps.fetchImpl, ui);

  // — Pipeline —
  const history = await retrieve(config); // RetrieveError → exit 4
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

  const outcome = await narrateOutcome(config, narrateConfig, analysis, narrate, preflightReason);
  const report = reportFromOutcome(analysis, outcome);

  // — Render every selected format from the ONE report (no re-analysis, no second
  // LLM call) and emit each to its planned destination (Story 4.4). The default
  // ["terminal"] selection is one stdout target — back-compatible with 1.8. —
  const targets = planOutputs(config.outputFormats, config.outputPath); // UsageError (2) on ambiguous path
  for (const target of targets) {
    const text = renderOne(report, target);
    if (target.destination.kind === "stdout") {
      writeStdout(text.endsWith("\n") ? text : `${text}\n`);
    } else {
      await writeOne(writeFile, target.destination.path, text, target.format, ui);
    }
  }

  return report.degraded ? ExitCode.Degraded : ExitCode.Success;
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
