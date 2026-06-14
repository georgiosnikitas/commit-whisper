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
import { NarrationError } from "../shared/errors.js";
import { generateNarrative, generateExplanations } from "./generate.js";
import type { NarrateConfig, NarrateOutcome, NarratePort } from "./narrate.port.js";
import { resolveModel } from "./provider.js";
import type { NarrativeParts, MetricExplanations } from "./schema.js";

export interface NarrateDeps {
  resolveModel?: typeof resolveModel;
  generate?: (model: ReturnType<typeof resolveModel>, analysis: Analysis) => Promise<NarrativeParts>;
  generateExplanations?: (
    model: ReturnType<typeof resolveModel>,
    analysis: Analysis,
  ) => Promise<MetricExplanations>;
}

export function createNarrate(deps: NarrateDeps = {}): NarratePort {
  const resolve = deps.resolveModel ?? resolveModel;
  const generate = deps.generate ?? generateNarrative;
  const generateExpl = deps.generateExplanations ?? generateExplanations;

  return async (analysis: Analysis, config: NarrateConfig): Promise<NarrateOutcome> => {
    if (config.aiMode === "off") {
      return { kind: "skipped" };
    }
    try {
      const model = resolve(config);
      // The repo-level narrative (Story 3.1) and the per-metric explanations
      // (Story 3.2) are two independent generations, run concurrently and
      // composed into the full narrative. Either failing degrades/throws the
      // whole narration (graceful per-group degradation is Story 3.3). The
      // explanations map may be incomplete if the model omits metrics — that
      // gap is surfaced by the grounding pass (3.4) / confidence (3.5), not
      // fabricated here.
      const [parts, explanations] = await Promise.all([
        generate(model, analysis),
        generateExpl(model, analysis),
      ]);
      return { kind: "narrated", narrative: { ...parts, explanations } };
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
