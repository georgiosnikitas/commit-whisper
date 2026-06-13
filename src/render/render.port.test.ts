import { describe, it, expect } from "vitest";

import { classifyReport } from "./render.port.js";
import type { Report, ReportAnalysis, ReportNarrative } from "../assemble/report-schema.js";

const ANALYSIS: ReportAnalysis = {
  metrics: [
    { id: "a-commit-volume", group: "A", title: "Commit volume", status: "computed", value: 3 },
  ],
};

const NARRATIVE: ReportNarrative = {
  summary: { headline: "Steady.", overview: "Two commits.", keyFindings: ["Low volume"] },
};

function report(over: Partial<Report>): Report {
  return { schemaVersion: "1.0.0", degraded: false, analysis: ANALYSIS, ...over };
}

describe("classifyReport", () => {
  it("routes a narrated report to the showpiece path with the narrative present", () => {
    const route = classifyReport(report({ narrative: NARRATIVE, degraded: false }));
    expect(route.kind).toBe("showpiece");
    if (route.kind === "showpiece") {
      // The showpiece route carries a narrative-guaranteed report.
      expect(route.report.narrative).toEqual(NARRATIVE);
    }
  });

  it("routes a degraded report (no narrative) to the substrate 'degraded' framing", () => {
    const route = classifyReport(report({ degraded: true }));
    expect(route.kind).toBe("substrate");
    if (route.kind === "substrate") {
      expect(route.framing).toBe("degraded");
      expect(route.analysis).toEqual(ANALYSIS);
    }
  });

  it("routes an intentional metrics-only report (no narrative, not degraded) to the substrate 'metrics-only' framing", () => {
    const route = classifyReport(report({ degraded: false }));
    expect(route.kind).toBe("substrate");
    if (route.kind === "substrate") {
      expect(route.framing).toBe("metrics-only");
    }
  });

  it("a narrative present always wins the showpiece path regardless of the degraded flag", () => {
    // reportFromOutcome never emits this combination, but the classifier must be total.
    const route = classifyReport(report({ narrative: NARRATIVE, degraded: true }));
    expect(route.kind).toBe("showpiece");
  });
});
