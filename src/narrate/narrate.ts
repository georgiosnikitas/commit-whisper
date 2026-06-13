/**
 * Narrate stage orchestrator + fail-open (Story 1.6).
 *
 * Turns the deterministic `Analysis` into a `NarrateOutcome` per `aiMode`:
 *   - `off`      → `skipped` (no model resolution, no LLM call)
 *   - success    → `narrated` with the Summary
 *   - `auto` + failure → `degraded` (FAIL OPEN — the computed analysis is
 *                  preserved upstream; the shell renders the substrate, exit 9)
 *   - `required` + failure → THROWS `NarrationError` (exit 6) — no substrate
 *                  masquerading as success
 *
 * `resolveModel`/`generate` are injectable so the orchestrator is fully testable
 * without a model, a key, or the network. The stage sets no exit code and does
 * no rendering — that is the CLI shell's job (Story 1.8).
 */

import type { Analysis } from "../analyze/engine.js";
import { NarrationError } from "../shared/errors.js";
import { generateSummary } from "./generate.js";
import type { NarrateConfig, NarrateOutcome, NarratePort } from "./narrate.port.js";
import { resolveModel } from "./provider.js";
import type { Summary } from "./schema.js";

export interface NarrateDeps {
  resolveModel?: typeof resolveModel;
  generate?: (model: ReturnType<typeof resolveModel>, analysis: Analysis) => Promise<Summary>;
}

export function createNarrate(deps: NarrateDeps = {}): NarratePort {
  const resolve = deps.resolveModel ?? resolveModel;
  const generate = deps.generate ?? generateSummary;

  return async (analysis: Analysis, config: NarrateConfig): Promise<NarrateOutcome> => {
    if (config.aiMode === "off") {
      return { kind: "skipped" };
    }
    try {
      const model = resolve(config);
      const summary = await generate(model, analysis);
      return { kind: "narrated", narrative: { summary } };
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
