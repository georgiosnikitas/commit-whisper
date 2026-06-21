/**
 * Narrate stage orchestrator + fail-open (Story 1.6 → 3.1 three-part → 3.2 explanations).
 *
 * Turns the deterministic `Analysis` into a `NarrateOutcome` per `aiMode`:
 *   - `off`      → `skipped` (no model resolution, no LLM call)
 *   - success    → `narrated` with the full Narrative (three parts + the
 *                  per-metric explanation map, keyed by metric id)
 *   - `auto` + failure → `degraded` (FAIL OPEN — the computed analysis is
 *                  preserved upstream; the shell renders the substrate, exit 9)
 *   - `required` + failure → THROWS `NarrationError` (exit 6) — no substrate
 *                  masquerading as success
 *
 * `resolveModel`/`generate`/`generateExplanations` are injectable so the
 * orchestrator is fully testable without a model, a key, or the network. The
 * stage sets no exit code and does no rendering — that is the CLI shell's job.
 */

import type { Analysis } from "../analyze/engine.js";
import type { MetricGroup } from "../analyze/metric.js";
import { NarrationError } from "../shared/errors.js";
import { assessConfidence } from "./confidence.js";
import { generateNarrative, generateExplanations, METRIC_GROUPS } from "./generate.js";
import { groundNarrative } from "./grounding.js";
import type { NarrateConfig, NarrateOutcome, NarratePort, NarrateProgressFn } from "./narrate.port.js";
import { resolveModel } from "./provider.js";
import type { NarrativeParts, MetricExplanations } from "./schema.js";

export interface NarrateDeps {
  resolveModel?: typeof resolveModel;
  generate?: (model: ReturnType<typeof resolveModel>, analysis: Analysis) => Promise<NarrativeParts>;
  generateExplanations?: (
    model: ReturnType<typeof resolveModel>,
    analysis: Analysis,
    deps?: { onGroup?: (group: MetricGroup) => void },
  ) => Promise<MetricExplanations>;
}

export function createNarrate(deps: NarrateDeps = {}): NarratePort {
  const resolve = deps.resolveModel ?? resolveModel;
  const generate = deps.generate ?? generateNarrative;
  const generateExpl = deps.generateExplanations ?? generateExplanations;

  return async (analysis: Analysis, config: NarrateConfig, onProgress?: NarrateProgressFn): Promise<NarrateOutcome> => {
    if (config.aiMode === "off") {
      return { kind: "skipped" };
    }
    try {
      // The phases the progress bar reports: model connect → repo narrative →
      // one per present Metric Group (explanations) → the deterministic finalize
      // (grounding + confidence). Counted up front so the bar has a stable total.
      const presentGroups = METRIC_GROUPS.filter((group) => analysis.metrics.some((metric) => metric.group === group));
      const total = 1 /* narrative */ + presentGroups.length + 1 /* grounding + confidence */;
      let completed = 0;
      const report = (label: string): void => onProgress?.({ completed, total, label });
      report(`Connecting to ${config.provider ?? "the model"}…`);

      const model = resolve(config);
      // The repo-level narrative (Story 3.1: Summary + Explanation + Coaching,
      // the holistic "coaching call") and the per-metric explanations (Story 3.2,
      // now batched per Metric Group — Story 3.3) are two independent generations,
      // run concurrently and composed into the full narrative. If the NARRATIVE
      // call fails the whole narration degrades/throws (the repo-level narrative
      // is required for the showpiece); a single failing explanation GROUP instead
      // degrades gracefully INSIDE `generateExplanations` (its metrics are absent
      // from the map, the rest are carried). An incomplete map (a model omitting
      // metrics) lowers the confidence coverage signal (3.5), not fabricated here.
      const [parts, explanations] = await Promise.all([
        generate(model, analysis).then((value) => {
          completed += 1;
          report("Wrote the summary, explanation & coaching");
          return value;
        }),
        generateExpl(model, analysis, {
          onGroup: (group) => {
            completed += 1;
            report(`Explained Group ${group} metrics`);
          },
        }),
      ]);
      // Deterministic grounding pass (Story 3.4): remove every numeric claim that
      // does not trace to a metric value (no second LLM call), inserting honest
      // placeholders where removal would empty a required field — so a fabricated
      // figure never reaches assemble/render. Its `report` (claim counts) is the
      // verification pass rate the confidence pass consumes.
      const grounded = groundNarrative({ ...parts, explanations }, analysis);
      // Deterministic confidence self-assessment (Story 3.5): a high/medium/low
      // rating from the grounding pass rate, the `not_available` share, and the
      // explanation coverage; a `low` rating names the config to change. Carried
      // under `narrative` (the `analysis` subtree stays byte-stable); it never
      // changes the exit code — a low-confidence run is still a clean showpiece.
      const confidence = assessConfidence({
        grounding: grounded.report,
        analysis,
        explanations: grounded.narrative.explanations,
        provider: config.provider,
        llmModel: config.llmModel,
      });
      completed = total;
      report("Grounded the numbers & assessed confidence");
      return { kind: "narrated", narrative: { ...grounded.narrative, confidence } };
    } catch (err) {
      const reason = narrationReason(err, config.aiKey?.reveal());
      if (config.aiMode === "required") {
        throw err instanceof NarrationError ? err : new NarrationError(reason, { cause: err });
      }
      // auto: fail open — preserve the computed analysis, mark degraded.
      return { kind: "degraded", reason };
    }
  };
}

/**
 * A user-safe narration failure reason. Defensively scrubs the secret (if known)
 * from the underlying error text so a provider/SDK error that echoes the key can
 * never surface it into the degraded reason or a thrown error message.
 */
function narrationReason(err: unknown, secret?: string): string {
  let detail = err instanceof Error ? err.message : "Narration failed.";
  if (secret !== undefined && secret !== "") {
    detail = detail.split(secret).join("***");
  }
  return detail;
}
