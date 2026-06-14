import { describe, it, expect } from "vitest";

import { classifyHealth, HEALTH_GLYPH, HEALTH_LABEL, type HealthBand } from "./health.js";
import type { ReportAnalysis } from "../../assemble/report-schema.js";

type Metric = ReportAnalysis["metrics"][number];

function metric(over: Partial<Metric>): Metric {
  return { id: "x", group: "A", title: "X", status: "computed", value: 1, ...over };
}

describe("classifyHealth", () => {
  it("a not_available metric is na", () => {
    expect(classifyHealth(metric({ status: "not_available", value: undefined, reason: "n/a" }))).toBe("na");
  });

  it("bus factor: 1 → risk, 2 → watch, 5 → ok (higher is healthier)", () => {
    expect(classifyHealth(metric({ id: "b-bus-factor", value: { busFactor: 1 } }))).toBe("risk");
    expect(classifyHealth(metric({ id: "b-bus-factor", value: { busFactor: 2 } }))).toBe("watch");
    expect(classifyHealth(metric({ id: "b-bus-factor", value: { busFactor: 5 } }))).toBe("ok");
  });

  it("direct-to-default share: low → ok, high → risk (lower is healthier)", () => {
    expect(classifyHealth(metric({ id: "d-direct-to-default", value: { directToDefaultSharePct: 10 } }))).toBe("ok");
    expect(classifyHealth(metric({ id: "d-direct-to-default", value: { directToDefaultSharePct: 90 } }))).toBe("risk");
  });

  it("hygiene score: high → ok, mid → watch, low → risk", () => {
    expect(classifyHealth(metric({ id: "f-hygiene-score", value: { score: 80 } }))).toBe("ok");
    expect(classifyHealth(metric({ id: "f-hygiene-score", value: { score: 60 } }))).toBe("watch");
    expect(classifyHealth(metric({ id: "f-hygiene-score", value: { score: 30 } }))).toBe("risk");
  });

  it("a computed metric with no registered threshold defaults to ok (no fabricated alarm)", () => {
    expect(classifyHealth(metric({ id: "a-commit-volume", value: { total: 42 } }))).toBe("ok");
  });

  it("a registered classifier with a missing field falls back to ok (tolerant)", () => {
    expect(classifyHealth(metric({ id: "b-bus-factor", value: { somethingElse: 1 } }))).toBe("ok");
  });

  it("thresholds are inclusive at the exact boundary (>= ok-min, <= watch-min)", () => {
    // higherBetter("busFactor", 3, 2): exactly 3 is ok, exactly 2 is watch.
    expect(classifyHealth(metric({ id: "b-bus-factor", value: { busFactor: 3 } }))).toBe("ok");
    // higherBetter("score", 75, 50): exactly 75 is ok, exactly 50 is watch.
    expect(classifyHealth(metric({ id: "f-hygiene-score", value: { score: 75 } }))).toBe("ok");
    expect(classifyHealth(metric({ id: "f-hygiene-score", value: { score: 50 } }))).toBe("watch");
    // lowerBetter("directToDefaultSharePct", 20, 50): exactly 20 is ok, exactly 50 is watch.
    expect(classifyHealth(metric({ id: "d-direct-to-default", value: { directToDefaultSharePct: 20 } }))).toBe("ok");
    expect(classifyHealth(metric({ id: "d-direct-to-default", value: { directToDefaultSharePct: 50 } }))).toBe("watch");
  });

  it("the f-bus-factor-risk roll-up reads the same busFactor field as b-bus-factor", () => {
    // Story 2.5 emits f-bus-factor-risk with a busFactor field → same threshold applies.
    expect(classifyHealth(metric({ id: "f-bus-factor-risk", value: { busFactor: 1, risk: "high" } }))).toBe("risk");
    expect(classifyHealth(metric({ id: "f-bus-factor-risk", value: { busFactor: 5, risk: "low" } }))).toBe("ok");
  });
});

describe("health glyph + label maps", () => {
  it("every band has a distinct glyph and a text label (no color alone)", () => {
    const bands: HealthBand[] = ["ok", "watch", "risk", "na"];
    const glyphs = bands.map((b) => HEALTH_GLYPH[b]);
    expect(new Set(glyphs).size).toBe(bands.length); // shape-differentiated
    for (const b of bands) {
      expect(HEALTH_LABEL[b].length).toBeGreaterThan(0);
    }
    expect(HEALTH_LABEL.na).toBe("n/a");
  });
});
