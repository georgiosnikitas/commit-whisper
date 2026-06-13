import { describe, it, expect } from "vitest";

import { analyze } from "../../src/analyze/engine.js";
import type { AnalysisContext } from "../../src/analyze/model.js";
import { parseMailmap } from "../../src/analyze/identity.js";
import { SYNTHETIC_HISTORY, SYNTHETIC_MAILMAP } from "../../src/analyze/sample-history.js";
import { assertDeterministic, assertOrderIndependent, serializeAnalysis } from "./harness.js";

function ctx(): AnalysisContext {
  return {
    analysisTimestamp: "2024-03-01T00:00:00.000Z",
    timezone: "UTC",
    mailmap: parseMailmap(SYNTHETIC_MAILMAP),
  };
}

describe("analysis determinism (AC2)", () => {
  it("is byte-identical across two runs of identical input", () => {
    assertDeterministic(() => analyze(SYNTHETIC_HISTORY, ctx()));
  });

  it("is byte-identical regardless of input commit order (total-order proof)", () => {
    assertOrderIndependent(SYNTHETIC_HISTORY, ctx());
  });

  it("depends only on the injected analysisTimestamp (no Date.now())", () => {
    // Two runs with the SAME injected timestamp must match; if any metric read
    // the wall clock, repeated runs would still match here but the value would
    // not reflect `analysisTimestamp` — so also assert age reflects the injection.
    const a = serializeAnalysis(analyze(SYNTHETIC_HISTORY, ctx()));
    const b = serializeAnalysis(analyze(SYNTHETIC_HISTORY, ctx()));
    expect(a).toBe(b);

    const later: AnalysisContext = { ...ctx(), analysisTimestamp: "2025-03-01T00:00:00.000Z" };
    const ageNow = projectAgeDays(analyze(SYNTHETIC_HISTORY, ctx()));
    const ageLater = projectAgeDays(analyze(SYNTHETIC_HISTORY, later));
    expect(ageLater).toBeGreaterThan(ageNow); // age tracks the injected timestamp, not the clock
  });

  it("produces a fully serializable analysis (no Map/Set/Date leaks)", () => {
    const json = serializeAnalysis(analyze(SYNTHETIC_HISTORY, ctx()));
    // Round-trips cleanly and contains no "[object …]" markers from bad values.
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).not.toContain("[object");
  });
});

function projectAgeDays(analysis: ReturnType<typeof analyze>): number {
  const metric = analysis.metrics.find((m) => m.id === "a-project-age");
  return (metric?.value as { ageDays: number }).ageDays;
}
