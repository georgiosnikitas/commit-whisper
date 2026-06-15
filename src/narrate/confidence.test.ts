import { describe, it, expect } from "vitest";

import { assessConfidence, buildEscalation } from "./confidence.js";
import type { GroundingReport } from "./grounding.js";
import type { MetricExplanations } from "./schema.js";
import type { Analysis } from "../analyze/engine.js";

/** An analysis of `computed` count + `notAvailable` count, ids c0.. and n0.. */
function analysis(computed: number, notAvailable: number): Analysis {
  const metrics: Analysis["metrics"] = [];
  for (let i = 0; i < computed; i += 1) {
    metrics.push({ id: `c${i}`, group: "A", title: `C${i}`, status: "computed", value: 1 });
  }
  for (let i = 0; i < notAvailable; i += 1) {
    metrics.push({ id: `n${i}`, group: "A", title: `N${i}`, status: "not_available", reason: "n/a" });
  }
  return { metrics };
}

/** An explanations map covering the first `n` metric ids of `a`. */
function explanationsFor(a: Analysis, n: number): MetricExplanations {
  const record: MetricExplanations = {};
  for (const metric of a.metrics.slice(0, n)) {
    record[metric.id] = { explanation: "e", goodBehaviours: [], needsImprovement: [], suggestions: [] };
  }
  return record;
}

const PERFECT: GroundingReport = { totalClaims: 10, ungroundedClaims: 0 };

describe("assessConfidence — levels", () => {
  it("high: perfect grounding, full coverage, high availability → no escalation", () => {
    const a = analysis(10, 0);
    const conf = assessConfidence({ grounding: PERFECT, analysis: a, explanations: explanationsFor(a, 10) });
    expect(conf.level).toBe("high");
    expect(conf.escalation).toBeUndefined();
    expect(conf.rationale.length).toBeGreaterThan(0);
  });

  it("low: grounding pass rate below 0.5 → escalation present", () => {
    const a = analysis(10, 0);
    const conf = assessConfidence({
      grounding: { totalClaims: 10, ungroundedClaims: 6 }, // 40% pass rate
      analysis: a,
      explanations: explanationsFor(a, 10),
      provider: "gemini",
      llmModel: "gemini-2.0-flash",
    });
    expect(conf.level).toBe("low");
    expect(conf.escalation).toBeDefined();
  });

  it("low: explanation coverage below 0.5 → low", () => {
    const a = analysis(10, 0);
    const conf = assessConfidence({ grounding: PERFECT, analysis: a, explanations: explanationsFor(a, 4) }); // 40% coverage
    expect(conf.level).toBe("low");
  });

  it("medium: the not_available share gates high (perfect grounding + coverage, but >50% n/a)", () => {
    // 4 computed + 6 not_available; explanations cover all 10 → coverage 1.0, availability 0.4.
    const a = analysis(4, 6);
    const conf = assessConfidence({ grounding: PERFECT, analysis: a, explanations: explanationsFor(a, 10) });
    expect(conf.level).toBe("medium"); // not high — availability 0.4 < 0.5
    expect(conf.escalation).toBeUndefined();
  });

  it("medium: a borderline coverage (0.7) between low and high", () => {
    const a = analysis(10, 0);
    const conf = assessConfidence({ grounding: PERFECT, analysis: a, explanations: explanationsFor(a, 7) });
    expect(conf.level).toBe("medium");
  });

  it("treats the exact LOW thresholds (passRate / coverage === 0.5) as NOT low (strict <)", () => {
    const a = analysis(10, 0);
    // passRate exactly 0.5 (1 of 2 ungrounded), full coverage → not low (medium).
    expect(
      assessConfidence({ grounding: { totalClaims: 2, ungroundedClaims: 1 }, analysis: a, explanations: explanationsFor(a, 10) }).level,
    ).toBe("medium");
    // coverage exactly 0.5 (5 of 10), perfect grounding → not low (medium).
    expect(
      assessConfidence({ grounding: PERFECT, analysis: a, explanations: explanationsFor(a, 5) }).level,
    ).toBe("medium");
  });
});

describe("assessConfidence — edge cases + determinism", () => {
  it("vacuous 1.0 for zero claims and zero metrics (nothing to doubt)", () => {
    const conf = assessConfidence({ grounding: { totalClaims: 0, ungroundedClaims: 0 }, analysis: { metrics: [] } });
    expect(conf.level).toBe("high"); // passRate 1, coverage 1, availability 1
  });

  it("is deterministic — two runs are identical", () => {
    const a = analysis(6, 4);
    const input = { grounding: { totalClaims: 8, ungroundedClaims: 1 }, analysis: a, explanations: explanationsFor(a, 6) };
    expect(assessConfidence(input)).toEqual(assessConfidence(input));
  });

  it("rationale names the three signals as percentages", () => {
    const a = analysis(7, 3);
    const conf = assessConfidence({ grounding: { totalClaims: 10, ungroundedClaims: 1 }, analysis: a, explanations: explanationsFor(a, 9) });
    expect(conf.rationale).toContain("90%"); // grounding 9/10
    expect(conf.rationale).toContain("30%"); // 3/10 not available
    expect(conf.rationale.toLowerCase()).toContain("coverage");
  });
});

describe("buildEscalation (AC2)", () => {
  it("names the config to change and the current provider/model", () => {
    const msg = buildEscalation("gemini", "gemini-2.0-flash");
    expect(msg).toContain("COMMIT_WHISPER_PROVIDER");
    expect(msg).toContain("COMMIT_WHISPER_LLM_MODEL");
    expect(msg).toContain("gemini/gemini-2.0-flash");
    expect(msg.toLowerCase()).toContain("stronger");
  });

  it("handles an unset provider/model gracefully", () => {
    const msg = buildEscalation(undefined, undefined);
    expect(msg).toContain("(unset)/(unset)");
  });
});
